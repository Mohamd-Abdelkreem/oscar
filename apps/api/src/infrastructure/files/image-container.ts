import type { ImageFormat } from "./multipart-image-upload.js";

export class UnsupportedImageContainer extends Error {}

export function imageContainerFormat(bytes: Buffer): ImageFormat {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    let offset = 8;
    let sawHeader = false;
    let sawData = false;
    while (offset + 12 <= bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const end = offset + 12 + length;
      if (end > bytes.length) throw new Error("Invalid PNG container.");
      const kind = bytes.toString("ascii", offset + 4, offset + 8);
      if (!sawHeader && (kind !== "IHDR" || length !== 13))
        throw new Error("Invalid PNG header.");
      if (kind === "IHDR") {
        if (sawHeader) throw new Error("Duplicate PNG header.");
        sawHeader = true;
      }
      if (["acTL", "fcTL", "fdAT"].includes(kind))
        throw new UnsupportedImageContainer("Animated PNG is unsupported.");
      if (kind === "IDAT") sawData = true;
      if (kind === "IEND") {
        if (length !== 0 || !sawData || end !== bytes.length)
          throw new Error("Invalid PNG termination.");
        return "png";
      }
      offset = end;
    }
    throw new Error("Incomplete PNG container.");
  }
  if (
    bytes.length >= 4 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  ) {
    if (bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217)
      throw new Error("Incomplete JPEG container.");
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    if (bytes.readUInt32LE(4) + 8 !== bytes.length)
      throw new Error("Invalid WebP length.");
    let offset = 12;
    let sawPixels = false;
    while (offset + 8 <= bytes.length) {
      const kind = bytes.toString("ascii", offset, offset + 4);
      const length = bytes.readUInt32LE(offset + 4);
      const end = offset + 8 + length + (length % 2);
      if (end > bytes.length) throw new Error("Invalid WebP chunk.");
      if (
        kind === "ANIM" ||
        kind === "ANMF" ||
        (kind === "VP8X" &&
          (length !== 10 || ((bytes[offset + 8] ?? 0) & 2) !== 0))
      )
        throw new UnsupportedImageContainer("Animated WebP is unsupported.");
      if (kind === "VP8 " || kind === "VP8L") sawPixels = true;
      offset = end;
    }
    if (offset !== bytes.length || !sawPixels)
      throw new Error("Incomplete WebP container.");
    return "webp";
  }
  throw new UnsupportedImageContainer("Unsupported image container.");
}
