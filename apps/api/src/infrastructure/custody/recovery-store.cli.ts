import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { z } from "zod";
import { parseRecoveryHelperEnvironment } from "../../core/config/custody.config.js";
import { RecoveryObjectStore } from "./recovery-store.objects.js";
import { recoveryRequestSchema } from "./recovery-store.protocol.js";
import { CustodyStorageError } from "./protected-files.js";

export async function runRecoveryHelper(): Promise<void> {
  if (process.platform !== "linux" || process.argv.length !== 2)
    throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
  const config = parseRecoveryHelperEnvironment(
    process.env,
    fileURLToPath(new URL("../../../../../", import.meta.url)),
  );
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    const input: unknown = chunk;
    if (!(input instanceof Buffer))
      throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
    const bytes: Buffer = input;
    size += bytes.length;
    if (size > config.maximumMessageBytes)
      throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
    chunks.push(bytes);
  }
  let request: unknown;
  try {
    request = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
  }
  const response = await new RecoveryObjectStore(config.storageRoot).execute(
    recoveryRequestSchema.parse(request),
  );
  const serialized = JSON.stringify(response);
  if (Buffer.byteLength(serialized) > config.maximumMessageBytes)
    throw new CustodyStorageError("CUSTODY_INPUT_INVALID");
  process.stdout.write(serialized);
}
if (
  process.argv[1] !== undefined &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runRecoveryHelper().catch((failure: unknown) => {
    const code =
      failure instanceof CustodyStorageError
        ? failure.code
        : failure instanceof z.ZodError
          ? "CUSTODY_INPUT_INVALID"
          : "RECOVERY_UNAVAILABLE";
    process.stdout.write(JSON.stringify({ error: code }));
    process.exitCode = 1;
  });
}
