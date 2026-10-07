import { constants } from "node:fs";
import { link, lstat, open, realpath, unlink } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

export class CustodyStorageError extends Error {
  constructor(
    readonly code:
      | "CUSTODY_INPUT_INVALID"
      | "CUSTODY_STORAGE_UNAVAILABLE"
      | "CUSTODY_EVIDENCE_CONFLICT"
      | "RECOVERY_NOT_FOUND"
      | "RECOVERY_UNAVAILABLE",
  ) {
    super(code);
  }
}
export function fileFailure(failure: unknown, code: string): boolean {
  return failure instanceof Error && "code" in failure && failure.code === code;
}
export async function assertPrivateRoot(root: string): Promise<void> {
  const metadata = await lstat(root);
  if (
    !metadata.isDirectory() ||
    metadata.isSymbolicLink() ||
    (await realpath(root)) !== resolve(root) ||
    (process.platform !== "win32" &&
      ((metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.()))
  )
    throw new CustodyStorageError("CUSTODY_STORAGE_UNAVAILABLE");
}
async function directorySync(root: string): Promise<void> {
  // Windows cannot fsync directories; publication acceptance is Linux-only.
  if (process.platform === "win32") return;
  const directory = await open(
    root,
    constants.O_RDONLY | constants.O_DIRECTORY,
  );
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
export async function readProtectedFile(
  root: string,
  name: string,
  maximumBytes: number,
): Promise<Buffer | null> {
  await assertPrivateRoot(root);
  const path = join(root, name);
  try {
    const metadata = await lstat(path);
    if (
      !metadata.isFile() ||
      metadata.isSymbolicLink() ||
      metadata.size > maximumBytes ||
      (process.platform !== "win32" &&
        ((metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.()))
    )
      throw new CustodyStorageError("CUSTODY_STORAGE_UNAVAILABLE");
    const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const contents = Buffer.alloc(maximumBytes + 1);
      const { bytesRead } = await file.read(contents, 0, contents.length, 0);
      if (bytesRead > maximumBytes)
        throw new CustodyStorageError("CUSTODY_STORAGE_UNAVAILABLE");
      return contents.subarray(0, bytesRead);
    } finally {
      await file.close();
    }
  } catch (failure) {
    if (fileFailure(failure, "ENOENT")) return null;
    if (failure instanceof CustodyStorageError) throw failure;
    throw new CustodyStorageError("CUSTODY_STORAGE_UNAVAILABLE");
  }
}
export async function publishProtectedFile(
  root: string,
  name: string,
  contents: Buffer,
): Promise<Buffer> {
  await assertPrivateRoot(root);
  const temporary = join(root, `.pending-${randomUUID()}`);
  const destination = join(root, name);
  const file = await open(temporary, "wx", 0o600);
  try {
    await file.writeFile(contents);
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    try {
      await link(temporary, destination);
    } catch (failure) {
      if (!fileFailure(failure, "EEXIST")) throw failure;
    }
    await directorySync(root);
    const stored = await readProtectedFile(root, name, 262144);
    if (stored === null)
      throw new CustodyStorageError("CUSTODY_STORAGE_UNAVAILABLE");
    return stored;
  } finally {
    await unlink(temporary);
    await directorySync(root);
  }
}
