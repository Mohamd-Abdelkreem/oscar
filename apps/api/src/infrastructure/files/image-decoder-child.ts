import { readFile } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { z } from "zod";
import {
  PROOF_INPUT_MAX_BYTES,
  PROOF_MAX_PIXELS,
  PROOF_MAX_DIMENSION,
  PROOF_MAX_CHANNELS,
  PROOF_DECODER_TIMEOUT_SECONDS,
} from "@template/contracts";
import {
  imageContainerFormat,
  UnsupportedImageContainer,
} from "./image-container.js";

const requestSchema = z.strictObject({
  type: z.literal("decode"),
  inputPath: z.string(),
  format: z.enum(["png", "jpeg", "webp"]),
});
function report(message: object) {
  if (process.connected) process.send?.({ ...message, pid: process.pid });
}
function sample() {
  report({ type: "rss", bytes: process.memoryUsage.rss() });
}

async function decode(request: z.infer<typeof requestSchema>) {
  sharp.cache(false);
  sharp.concurrency(1);
  sample();
  const bytes = await readFile(request.inputPath);
  if (
    bytes.length < 1 ||
    bytes.length > PROOF_INPUT_MAX_BYTES ||
    imageContainerFormat(bytes) !== request.format
  )
    throw new Error("Invalid input.");
  const image = sharp(bytes, {
    failOn: "warning",
    limitInputPixels: PROOF_MAX_PIXELS,
    limitInputChannels: PROOF_MAX_CHANNELS,
    unlimited: false,
    animated: false,
  }).timeout({ seconds: PROOF_DECODER_TIMEOUT_SECONDS });
  const metadata = await image.metadata();
  if (
    metadata.format !== request.format ||
    !metadata.width ||
    !metadata.height ||
    metadata.width > PROOF_MAX_DIMENSION ||
    metadata.height > PROOF_MAX_DIMENSION ||
    metadata.width * metadata.height > PROOF_MAX_PIXELS ||
    metadata.channels > PROOF_MAX_CHANNELS ||
    (metadata.pages ?? 1) !== 1
  )
    throw new Error("Invalid raster.");
  const rotated =
    metadata.orientation !== undefined &&
    metadata.orientation >= 5 &&
    metadata.orientation <= 8;
  report({
    type: "decoded",
    width: rotated ? metadata.height : metadata.width,
    height: rotated ? metadata.width : metadata.height,
  });
  sample();
  await pipeline(image.autoOrient().png(), process.stdout);
  sample();
}

if (!process.send) throw new Error("Decoder requires supervision.");
async function processRequest(message: unknown) {
  const timer = setInterval(sample, 100);
  timer.unref();
  let succeeded = false;
  try {
    const request = requestSchema.parse(message);
    await decode(request);
    succeeded = true;
  } catch (error) {
    report({
      type: "invalid",
      code:
        error instanceof UnsupportedImageContainer
          ? "UNSUPPORTED_IMAGE"
          : "INVALID_IMAGE",
    });
  } finally {
    clearInterval(timer);
    const maxRssBytes = process.resourceUsage().maxRSS * 1_024;
    process.once("message", (ack: unknown) => {
      if (
        z
          .strictObject({ type: z.literal("ack"), pid: z.literal(process.pid) })
          .safeParse(ack).success
      ) {
        process.exitCode = succeeded ? 0 : 1;
        process.disconnect();
      }
    });
    report({ type: "final", bytes: maxRssBytes });
  }
}
process.once("message", (message: unknown) => {
  void processRequest(message).catch(() => {
    process.exitCode = 1;
    process.disconnect();
  });
});
