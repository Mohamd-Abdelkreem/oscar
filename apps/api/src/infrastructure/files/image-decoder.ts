import { fork } from "node:child_process";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import {
  PROOF_CHILD_DEADLINE_MS,
  PROOF_CHILD_HEAP_MIB,
  PROOF_OUTPUT_MAX_BYTES,
} from "@template/contracts";
import { AppError } from "../../core/errors/app.error.js";
import type {
  PrivateImageStorage,
  ImageStorageReservation,
} from "./private-image-storage.js";
import type { ImageFormat } from "./multipart-image-upload.js";

const measurement = z.number().int().positive();
const messageSchema = z.discriminatedUnion("type", [
  z.strictObject({
    type: z.literal("rss"),
    pid: measurement,
    bytes: measurement,
  }),
  z.strictObject({
    type: z.literal("final"),
    pid: measurement,
    bytes: measurement,
  }),
  z.strictObject({
    type: z.literal("decoded"),
    pid: measurement,
    width: measurement,
    height: measurement,
  }),
  z.strictObject({
    type: z.literal("invalid"),
    pid: measurement,
    code: z.enum(["INVALID_IMAGE", "UNSUPPORTED_IMAGE"]),
  }),
]);
export type DecoderObservation = Readonly<{
  pid: number;
  sampledRssBytes: number;
  finalMaxRssBytes: number | null;
  partial: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
}>;

export async function decodeImage(options: {
  reservation: ImageStorageReservation;
  format: ImageFormat;
  storage: Pick<PrivateImageStorage, "writeCanonical">;
  signal: AbortSignal;
  observe?: (observation: DecoderObservation) => void;
}) {
  const extension = import.meta.url.endsWith(".ts") ? "ts" : "js";
  const entry = fileURLToPath(
    new URL(`./image-decoder-child.${extension}`, import.meta.url),
  );
  const child = fork(entry, [], {
    stdio: ["ignore", "pipe", "ignore", "ipc"],
    execArgv: [
      ...(extension === "ts"
        ? ["--conditions=development", "--import", "tsx"]
        : []),
      `--max-old-space-size=${String(PROOF_CHILD_HEAP_MIB)}`,
    ],
  });
  const controller = new AbortController();
  const state: {
    sampledRssBytes: number;
    finalMaxRssBytes: number | null;
    dimensions: { width: number; height: number } | undefined;
    failed: boolean;
    forced: boolean;
    failureCode: "INVALID_IMAGE" | "UNSUPPORTED_IMAGE" | null;
  } = {
    sampledRssBytes: 0,
    finalMaxRssBytes: null,
    dimensions: undefined,
    failed: false,
    forced: false,
    failureCode: null,
  };
  const stop = () => {
    controller.abort();
    if (child.exitCode === null && child.signalCode === null)
      state.forced = child.kill("SIGKILL") || state.forced;
  };
  const timer = setTimeout(stop, PROOF_CHILD_DEADLINE_MS);
  timer.unref();
  options.signal.addEventListener("abort", stop, { once: true });
  child.on("error", () => {
    state.failed = true;
    stop();
  });
  child.on("message", (raw: unknown) => {
    const result = messageSchema.safeParse(raw);
    if (!result.success || result.data.pid !== child.pid) {
      state.failed = true;
      stop();
      return;
    }
    const message = result.data;
    if (message.type === "rss")
      state.sampledRssBytes = Math.max(state.sampledRssBytes, message.bytes);
    if (message.type === "decoded")
      state.dimensions = { width: message.width, height: message.height };
    if (message.type === "invalid") {
      state.failed = true;
      state.failureCode = message.code;
    }
    if (message.type === "final") {
      if (
        state.finalMaxRssBytes !== null ||
        message.bytes < state.sampledRssBytes
      ) {
        state.failed = true;
        stop();
        return;
      }
      state.finalMaxRssBytes = message.bytes;
      child.send({ type: "ack", pid: child.pid }, (error) => {
        if (error) stop();
      });
    }
  });
  const closed = new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>((resolve) =>
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    }),
  );
  try {
    if (!child.stdout) {
      stop();
      throw new Error("Decoder output unavailable.");
    }
    if (options.signal.aborted) stop();
    else
      child.send(
        {
          type: "decode",
          inputPath: options.reservation.inputPath,
          format: options.format,
        },
        (error) => {
          if (error) stop();
        },
      );
    const written = await options.storage
      .writeCanonical(
        options.reservation,
        child.stdout,
        PROOF_OUTPUT_MAX_BYTES,
        controller.signal,
      )
      .catch((error: unknown) => {
        stop();
        throw error;
      });
    const result = await closed;
    if (
      state.failed ||
      state.forced ||
      result.code !== 0 ||
      !state.dimensions ||
      state.finalMaxRssBytes === null
    )
      throw new AppError("Image could not be processed.", 400, "INVALID_IMAGE");
    return { ...written, ...state.dimensions };
  } catch (error) {
    stop();
    const result = await closed;
    if (state.failureCode !== null)
      throw new AppError(
        "Image could not be processed.",
        state.failureCode === "UNSUPPORTED_IMAGE" ? 415 : 400,
        state.failureCode,
      );
    if (
      error instanceof AppError &&
      (state.dimensions !== undefined || state.finalMaxRssBytes !== null)
    )
      throw error;
    if (result.signal !== null || state.finalMaxRssBytes === null)
      throw new AppError(
        "Image processing is unavailable.",
        503,
        "IMAGE_PROCESSING_UNAVAILABLE",
      );
    if (error instanceof AppError) throw error;
    throw new AppError(
      "Image processing is unavailable.",
      503,
      "IMAGE_PROCESSING_UNAVAILABLE",
    );
  } finally {
    const result = await closed;
    clearTimeout(timer);
    options.signal.removeEventListener("abort", stop);
    if (child.pid !== undefined)
      options.observe?.({
        pid: child.pid,
        sampledRssBytes: state.sampledRssBytes,
        finalMaxRssBytes: state.finalMaxRssBytes,
        partial: state.forced || state.finalMaxRssBytes === null,
        exitCode: result.code,
        signal: result.signal,
      });
  }
}
