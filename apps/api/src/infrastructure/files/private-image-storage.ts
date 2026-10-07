import { randomUUID, createHash } from "node:crypto";
import { constants } from "node:fs";
import {
  lstat,
  link,
  mkdir,
  open,
  opendir,
  readdir,
  realpath,
  rename,
  rmdir,
  statfs,
  unlink,
} from "node:fs/promises";
import { dirname, join, parse, resolve } from "node:path";
import { addAbortSignal, type Readable } from "node:stream";
import type { ProofsConfig } from "../../core/config/proofs.config.js";
import { AppError } from "../../core/errors/app.error.js";

export type ImageStorageReservation = Readonly<{
  storageKey: string;
  inputPath: string;
  outputPath: string;
}>;

export const storageScanBatchSize = 100;
export type StorageRecordDisposition = "RETAINED" | "UNACCEPTED" | "DELETED";
export type StorageRecordLookup = (
  keys: readonly string[],
) => Promise<ReadonlyMap<string, StorageRecordDisposition>>;

const storageKeyPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const storageUnavailable = () =>
  new AppError(
    "Private image storage is unavailable.",
    503,
    "STORAGE_UNAVAILABLE",
  );

async function syncDirectory(directory: string) {
  const handle = await open(
    directory,
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function privateDirectory(directory: string) {
  const attributes = await lstat(directory);
  if (!attributes.isDirectory() || attributes.isSymbolicLink())
    throw storageUnavailable();
  if (process.platform !== "win32") {
    if (
      (attributes.mode & 0o077) !== 0 ||
      attributes.uid !== process.getuid?.()
    )
      throw storageUnavailable();
  }
}

function missingFile(error: unknown) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT")
    return;
  throw error;
}

async function existingPrivateDirectory(directory: string) {
  try {
    await privateDirectory(directory);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT")
      return false;
    throw error;
  }
}

export class PrivateImageStorage {
  private initialized = false;
  private leftoverBytes = 0;
  private readonly leftoverByKey = new Map<string, number>();
  private readonly reservations = new Map<string, ImageStorageReservation>();
  private readonly publishedKeys = new Set<string>();
  private readonly abandonedKeys = new Set<string>();

  constructor(private readonly config: ProofsConfig) {}

  closeAdmission() {
    this.initialized = false;
  }

  async initialize(
    lookup: StorageRecordLookup = () => Promise.resolve(new Map()),
  ) {
    if (this.reservations.size !== 0) throw storageUnavailable();
    this.initialized = false;
    const root = resolve(this.config.storageRoot);
    for (let ancestor = root; ; ancestor = dirname(ancestor)) {
      if ((await lstat(ancestor)).isSymbolicLink()) throw storageUnavailable();
      if (ancestor === parse(ancestor).root) break;
    }
    if ((await realpath(root)) !== root) throw storageUnavailable();
    await privateDirectory(root);
    for (const folder of ["staging", "assets"]) {
      const directory = join(root, folder);
      await mkdir(directory, { mode: 0o700 }).catch((error: unknown) => {
        if (!(
          error instanceof Error &&
          "code" in error &&
          error.code === "EEXIST"
        ))
          throw error;
      });
      await privateDirectory(directory);
      await syncDirectory(directory);
    }
    await syncDirectory(root);
    await this.accountLeftovers(lookup);
    this.initialized = true;
  }

  private keyPath(folder: "staging" | "assets", storageKey: string) {
    if (!storageKeyPattern.test(storageKey)) throw storageUnavailable();
    return join(this.config.storageRoot, folder, storageKey);
  }

  private async *storageBatches(folder: "staging" | "assets") {
    const directory = await opendir(join(this.config.storageRoot, folder));
    let keys: string[] = [];
    for await (const entry of directory) {
      if (!entry.isDirectory() || !storageKeyPattern.test(entry.name))
        throw storageUnavailable();
      keys.push(entry.name);
      if (keys.length === storageScanBatchSize) {
        yield keys;
        keys = [];
      }
    }
    if (keys.length !== 0) yield keys;
  }

  private async accountLeftovers(lookup: StorageRecordLookup) {
    let byteCount = 0;
    this.leftoverByKey.clear();
    for (const folder of ["staging", "assets"] as const) {
      for await (const keys of this.storageBatches(folder)) {
        const records =
          folder === "assets"
            ? await lookup(keys)
            : new Map<string, StorageRecordDisposition>();
        for (const key of keys) {
          const storedBytes = await this.validatedFileBytes(folder, key);
          if (
            folder === "assets" &&
            ["RETAINED", "DELETED"].includes(records.get(key) ?? "")
          )
            continue;
          byteCount += storedBytes;
          if (
            !Number.isSafeInteger(byteCount) ||
            byteCount > this.config.stagingMaxBytes
          )
            throw storageUnavailable();
          if (storedBytes > 0)
            this.leftoverByKey.set(
              key,
              (this.leftoverByKey.get(key) ?? 0) + storedBytes,
            );
        }
      }
    }
    this.leftoverBytes = byteCount;
  }

  private async validatedFileBytes(folder: "staging" | "assets", key: string) {
    const directory = this.keyPath(folder, key);
    await privateDirectory(directory);
    let byteCount = 0;
    for await (const entry of await opendir(directory)) {
      if (!["input", "output.png", "content.png"].includes(entry.name))
        throw storageUnavailable();
      const attributes = await lstat(join(directory, entry.name));
      if (!attributes.isFile() || attributes.isSymbolicLink())
        throw storageUnavailable();
      byteCount += attributes.size;
    }
    return byteCount;
  }

  async reserve(): Promise<ImageStorageReservation> {
    if (!this.initialized) throw storageUnavailable();
    if (this.reservations.size >= this.config.processingSlots)
      throw new AppError(
        "Image processing is busy.",
        429,
        "PROOF_PROCESSING_BUSY",
      );
    const reservedBytes =
      (this.reservations.size + 1) * this.config.uploadReservationBytes;
    if (this.leftoverBytes + reservedBytes > this.config.stagingMaxBytes)
      throw storageUnavailable();
    const storageKey = randomUUID();
    if (this.reservations.has(storageKey)) throw storageUnavailable();
    const staging = this.keyPath("staging", storageKey);
    const reservation = {
      storageKey,
      inputPath: join(staging, "input"),
      outputPath: join(staging, "output.png"),
    };
    // Occupy capacity before asynchronous disk checks so concurrent admission is bounded.
    this.reservations.set(storageKey, reservation);
    const createdFolders: ("staging" | "assets")[] = [];
    try {
      const volume = await statfs(this.config.storageRoot, { bigint: true });
      if (volume.bavail * volume.bsize < BigInt(reservedBytes))
        throw storageUnavailable();
      await mkdir(staging, { mode: 0o700 });
      createdFolders.push("staging");
      await mkdir(this.keyPath("assets", storageKey), { mode: 0o700 });
      createdFolders.push("assets");
      await syncDirectory(join(this.config.storageRoot, "staging"));
      await syncDirectory(join(this.config.storageRoot, "assets"));
      return reservation;
    } catch (error) {
      for (const folder of createdFolders) {
        if (folder === "staging") await this.removeStaging(storageKey);
        else await this.removeContent(storageKey);
      }
      this.reservations.delete(storageKey);
      throw error;
    }
  }

  private owned(reservation: ImageStorageReservation) {
    if (this.reservations.get(reservation.storageKey) !== reservation)
      throw storageUnavailable();
  }

  async receive(
    reservation: ImageStorageReservation,
    source: Readable,
    maximumBytes: number,
    signal: AbortSignal,
  ) {
    return this.writeImage(reservation, {
      path: reservation.inputPath,
      source,
      maximumBytes,
      signal,
      overflowError: new AppError(
        "Upload exceeds the file limit.",
        413,
        "UPLOAD_TOO_LARGE",
      ),
    });
  }

  async writeCanonical(
    reservation: ImageStorageReservation,
    source: Readable,
    maximumBytes: number,
    signal: AbortSignal,
  ) {
    return this.writeImage(reservation, {
      path: reservation.outputPath,
      source,
      maximumBytes,
      signal,
      overflowError: new AppError(
        "Processed image exceeds the output limit.",
        400,
        "INVALID_IMAGE",
      ),
    });
  }

  private async writeImage(
    reservation: ImageStorageReservation,
    image: {
      path: string;
      source: Readable;
      maximumBytes: number;
      signal: AbortSignal;
      overflowError: AppError;
    },
  ) {
    this.owned(reservation);
    await privateDirectory(dirname(image.path));
    let byteCount = 0;
    const hash = createHash("sha256");
    const file = await open(
      image.path,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    try {
      for await (const chunk of addAbortSignal(image.signal, image.source)) {
        if (!Buffer.isBuffer(chunk))
          throw new AppError("Invalid image stream.", 400, "INVALID_IMAGE");
        byteCount += chunk.length;
        if (byteCount > image.maximumBytes) throw image.overflowError;
        hash.update(chunk);
        await file.writeFile(chunk);
      }
      if (byteCount === 0)
        throw new AppError("An image is required.", 400, "INVALID_IMAGE");
      await file.sync();
      await syncDirectory(dirname(image.path));
      return { byteCount, contentHash: hash.digest("hex") };
    } finally {
      await file.close();
    }
  }

  async publish(reservation: ImageStorageReservation, maximumBytes: number) {
    this.owned(reservation);
    await privateDirectory(dirname(reservation.outputPath));
    const attributes = await lstat(reservation.outputPath);
    if (
      !attributes.isFile() ||
      attributes.isSymbolicLink() ||
      attributes.size < 1 ||
      attributes.size > maximumBytes
    )
      throw new AppError("Invalid processed image.", 400, "INVALID_IMAGE");
    const destination = this.keyPath("assets", reservation.storageKey);
    await privateDirectory(destination);
    if ((await readdir(destination)).length !== 0) throw storageUnavailable();
    const file = await open(
      reservation.outputPath,
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      await file.sync();
    } finally {
      await file.close();
    }
    const staging = dirname(reservation.outputPath);
    await link(reservation.outputPath, join(staging, "content.png"));
    await unlink(reservation.outputPath);
    await syncDirectory(staging);
    // POSIX directory rename cannot replace a nonempty destination. This keeps
    // publication atomic without the overwriting semantics of a file rename.
    await rename(staging, destination);
    this.publishedKeys.add(reservation.storageKey);
    await unlink(join(destination, "input")).catch(missingFile);
    await syncDirectory(destination);
    await syncDirectory(join(this.config.storageRoot, "assets"));
    await syncDirectory(join(this.config.storageRoot, "staging"));
  }

  async content(storageKey: string, maximumBytes: number) {
    const directory = this.keyPath("assets", storageKey);
    await privateDirectory(directory);
    const file = await open(
      join(directory, "content.png"),
      constants.O_RDONLY | constants.O_NOFOLLOW,
    );
    try {
      const attributes = await file.stat();
      if (
        !attributes.isFile() ||
        attributes.size < 1 ||
        attributes.size > maximumBytes
      )
        throw storageUnavailable();
      return file;
    } catch (error) {
      await file.close();
      throw error;
    }
  }

  async releaseAccepted(reservation: ImageStorageReservation) {
    this.owned(reservation);
    await this.removeStaging(reservation.storageKey);
    this.publishedKeys.delete(reservation.storageKey);
    this.reservations.delete(reservation.storageKey);
  }

  private async removeStaging(storageKey: string) {
    const directory = this.keyPath("staging", storageKey);
    if (await existingPrivateDirectory(directory)) {
      for (const filename of ["input", "output.png", "content.png"])
        await unlink(join(directory, filename)).catch(missingFile);
      await rmdir(directory).catch(missingFile);
    }
    await syncDirectory(join(this.config.storageRoot, "staging"));
  }

  async discard(reservation: ImageStorageReservation) {
    this.owned(reservation);
    await this.removeStaging(reservation.storageKey);
    if (this.publishedKeys.has(reservation.storageKey)) {
      await this.removeContent(reservation.storageKey);
    } else {
      await rmdir(this.keyPath("assets", reservation.storageKey)).catch(
        missingFile,
      );
      await syncDirectory(join(this.config.storageRoot, "assets"));
    }
    this.publishedKeys.delete(reservation.storageKey);
    this.reservations.delete(reservation.storageKey);
  }

  async removeContent(storageKey: string) {
    const directory = this.keyPath("assets", storageKey);
    if (await existingPrivateDirectory(directory)) {
      for (const filename of ["input", "content.png"])
        await unlink(join(directory, filename)).catch(missingFile);
      await rmdir(directory).catch(missingFile);
    }
    await syncDirectory(join(this.config.storageRoot, "assets"));
  }

  async removeUnaccepted(storageKey: string) {
    // The caller must first persist FAILED, or prove no database owner exists.
    // Active uploads own their cleanup and must keep their slot until child reap.
    if (
      this.reservations.has(storageKey) &&
      !this.abandonedKeys.has(storageKey)
    )
      return;
    await this.removeStaging(storageKey);
    await this.removeContent(storageKey);
    this.leftoverBytes -= this.leftoverByKey.get(storageKey) ?? 0;
    this.leftoverByKey.delete(storageKey);
    this.reservations.delete(storageKey);
    this.publishedKeys.delete(storageKey);
    this.abandonedKeys.delete(storageKey);
  }

  abandon(reservation: ImageStorageReservation) {
    if (this.reservations.get(reservation.storageKey) === reservation)
      this.abandonedKeys.add(reservation.storageKey);
  }

  abandonedStorageKeys() {
    return [...this.abandonedKeys];
  }

  async recoverAccepted(storageKey: string) {
    const reservation = this.reservations.get(storageKey);
    if (reservation !== undefined && this.abandonedKeys.has(storageKey)) {
      await this.releaseAccepted(reservation);
      this.abandonedKeys.delete(storageKey);
    }
  }

  async reconcileOrphans(lookup: StorageRecordLookup) {
    this.initialized = false;
    for (const folder of ["staging", "assets"] as const) {
      for await (const keys of this.storageBatches(folder)) {
        const records = await lookup(keys);
        for (const key of keys) {
          if (!records.has(key)) await this.removeUnaccepted(key);
          else if (folder === "assets" && records.get(key) === "DELETED")
            await this.removeContent(key);
        }
      }
    }
    this.initialized = true;
  }
}
