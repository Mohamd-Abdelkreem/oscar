import type { IncomingHttpHeaders } from "node:http";
import type { Readable } from "node:stream";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { Busboy } from "@fastify/busboy";
import {
  PROOF_INPUT_MAX_BYTES,
  PROOF_MULTIPART_MAX_BYTES,
  uploadIdentitySchema,
} from "@template/contracts";
import { AppError } from "../../core/errors/app.error.js";
import type {
  PrivateImageStorage,
  ImageStorageReservation,
} from "./private-image-storage.js";

export type ImageFormat = "png" | "jpeg" | "webp";
const invalidUpload = () =>
  new AppError("Invalid image upload.", 400, "INVALID_IMAGE");

function uploadHeaders(headers: IncomingHttpHeaders) {
  if (
    headers["content-encoding"] !== undefined &&
    headers["content-encoding"] !== "identity"
  )
    throw invalidUpload();
  const contentType = headers["content-type"];
  const matched = contentType?.match(
    /^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9'()+_,\-./:=? ]{1,70})"|([A-Za-z0-9'()+_,\-./:=?]{1,70}))$/iu,
  );
  if (!matched || !contentType) throw invalidUpload();
  const boundary = matched[1] ?? matched[2];
  if (!boundary || boundary.endsWith(" ")) throw invalidUpload();
  const length = headers["content-length"];
  if (
    length !== undefined &&
    (!/^\d+$/u.test(length) || !Number.isSafeInteger(Number(length)))
  )
    throw invalidUpload();
  if (length !== undefined && Number(length) > PROOF_MULTIPART_MAX_BYTES)
    throw new AppError(
      "Upload exceeds the request limit.",
      413,
      "UPLOAD_TOO_LARGE",
    );
  return { ...headers, "content-type": contentType };
}

function declaredFormat(filename: string, mime: string): ImageFormat {
  for (const character of filename) {
    const code = character.codePointAt(0);
    if (code !== undefined && (code < 32 || code === 127))
      throw invalidUpload();
  }
  if (
    filename.length > 255 ||
    /[\\/]/u.test(filename) ||
    filename === "." ||
    filename === ".."
  )
    throw invalidUpload();
  const format =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg"
        ? "jpeg"
        : mime === "image/webp"
          ? "webp"
          : undefined;
  if (!format)
    throw new AppError("Unsupported image type.", 415, "UNSUPPORTED_IMAGE");
  const extension = filename.slice(filename.lastIndexOf(".") + 1).toLowerCase();
  if (
    filename !== "" &&
    (filename.lastIndexOf(".") < 0 ||
      !(format === "jpeg" ? ["jpg", "jpeg"] : [format]).includes(extension))
  )
    throw invalidUpload();
  return format;
}

// Callers must establish current session, role and CSRF authority before reserving or consuming input.
export async function receiveMultipartImage(options: {
  source: Readable;
  headers: IncomingHttpHeaders;
  storage: Pick<PrivateImageStorage, "receive">;
  reservation: ImageStorageReservation;
  inputDeadlineMs: number;
  signal: AbortSignal;
}) {
  const headers = uploadHeaders(options.headers);
  const controller = new AbortController();
  const abort = () => {
    controller.abort(options.signal.reason);
  };
  options.signal.addEventListener("abort", abort, { once: true });
  if (options.signal.aborted) abort();
  const timeout = setTimeout(
    () => {
      controller.abort(
        new AppError("Upload input interrupted.", 408, "UPLOAD_INTERRUPTED"),
      );
    },
    Math.min(options.inputDeadlineMs, 30_000),
  );
  let failure: Error | undefined;
  const fail = (error: Error) => {
    failure ??= error;
    controller.abort(error);
  };
  let commandId: string | undefined;
  let format: ImageFormat | undefined;
  let fileCount = 0;
  let fieldCount = 0;
  let fileWrite:
    | Promise<Awaited<ReturnType<PrivateImageStorage["receive"]>> | undefined>
    | undefined;
  const parser = new Busboy({
    headers,
    preservePath: true,
    highWaterMark: 16_384,
    fileHwm: 16_384,
    limits: {
      files: 1,
      fields: 1,
      parts: 2,
      fileSize: PROOF_INPUT_MAX_BYTES + 1,
      fieldSize: 128,
      headerPairs: 8,
      headerSize: 8_192,
    },
  });
  parser.on("file", (name, stream, filename, encoding, mime) => {
    // Busboy may emit a truncation error before asynchronous file opening finishes.
    stream.on("error", (error: Error) => {
      // Iterator teardown emits AbortError before the byte counter's rejection reaches us.
      // Its rejection below retains the actual overflow/cancellation cause.
      if (error.name !== "AbortError") fail(invalidUpload());
    });
    fileCount++;
    try {
      if (
        name !== "file" ||
        Buffer.byteLength(name) > 32 ||
        fileCount !== 1 ||
        !["binary", "7bit", "8bit"].includes(encoding)
      )
        throw invalidUpload();
      format = declaredFormat(filename, mime);
      stream.on("limit", () => {
        fail(
          new AppError(
            "Upload exceeds the file limit.",
            413,
            "UPLOAD_TOO_LARGE",
          ),
        );
      });
      fileWrite = options.storage
        .receive(
          options.reservation,
          stream,
          PROOF_INPUT_MAX_BYTES,
          controller.signal,
        )
        .catch((error: unknown) => {
          fail(
            error instanceof AppError
              ? error
              : controller.signal.reason instanceof AppError
                ? controller.signal.reason
                : controller.signal.aborted
                  ? new AppError(
                      "Upload input interrupted.",
                      408,
                      "UPLOAD_INTERRUPTED",
                    )
                  : invalidUpload(),
          );
          return undefined;
        });
    } catch (error) {
      stream.resume();
      fail(error instanceof AppError ? error : invalidUpload());
    }
  });
  parser.on("field", (name, value, nameTruncated, valueTruncated, encoding) => {
    fieldCount++;
    const identity = uploadIdentitySchema.safeParse({ commandId: value });
    if (
      name !== "commandId" ||
      Buffer.byteLength(name) > 32 ||
      fieldCount !== 1 ||
      nameTruncated ||
      valueTruncated ||
      Buffer.byteLength(value) > 128 ||
      !["7bit", "8bit", "binary"].includes(encoding) ||
      !identity.success
    )
      fail(invalidUpload());
    else commandId = identity.data.commandId;
  });
  for (const event of ["partsLimit", "filesLimit", "fieldsLimit"] as const)
    parser.on(event, () => {
      fail(invalidUpload());
    });
  let aggregateBytes = 0;
  const counter = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      aggregateBytes += chunk.length;
      if (aggregateBytes > PROOF_MULTIPART_MAX_BYTES)
        callback(
          new AppError(
            "Upload exceeds the request limit.",
            413,
            "UPLOAD_TOO_LARGE",
          ),
        );
      else callback(null, chunk);
    },
  });
  try {
    await pipeline(options.source, counter, parser, {
      signal: controller.signal,
    });
    const written = await fileWrite;
    if (failure) throw failure;
    if (
      !commandId ||
      !format ||
      fileCount !== 1 ||
      fieldCount !== 1 ||
      !written
    )
      throw invalidUpload();
    return { commandId, format, ...written };
  } catch (error) {
    controller.abort(error);
    await fileWrite;
    if (failure) throw failure;
    if (error instanceof AppError) throw error;
    if (controller.signal.reason instanceof AppError)
      throw controller.signal.reason;
    throw invalidUpload();
  } finally {
    clearTimeout(timeout);
    options.signal.removeEventListener("abort", abort);
  }
}
