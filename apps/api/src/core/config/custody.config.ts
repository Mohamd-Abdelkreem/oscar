import { lstatSync, realpathSync, readFileSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { z } from "zod";

type Environment = Readonly<Record<string, string | undefined>>;
export function payoutTreasuryKeyId(environment: Environment): string {
  return z
    .uuid()
    .parse(requiredCustodySetting(environment, "TRON_PAYOUT_KEY_ID"));
}

export function requiredCustodySetting(
  environment: Environment,
  key: string,
): string {
  const configured = environment[key];
  if (
    configured === undefined ||
    configured.trim() === "" ||
    /\p{Cc}/u.test(configured) ||
    /^(change[-_ ]?me|replace[-_ ]?me|example|placeholder|default)/iu.test(
      configured,
    )
  ) {
    throw new Error(`${key} requires an explicit protected setting.`);
  }
  return configured;
}

function overlaps(first: string, second: string): boolean {
  const suffix = relative(first, second);
  return (
    suffix === "" ||
    (!isAbsolute(suffix) && suffix !== ".." && !suffix.startsWith(`..${sep}`))
  );
}

export function privateCustodyPath(
  environment: Environment,
  key: string,
  projectRoot: string,
  kind: "file" | "directory",
): string {
  const configured = requiredCustodySetting(environment, key);
  if (!isAbsolute(configured))
    throw new Error(`${key} requires an absolute private path.`);
  const protectedPath = resolve(configured);
  const project = resolve(projectRoot);
  const proofRoot = environment["PROOF_STORAGE_ROOT"];
  if (
    overlaps(project, protectedPath) ||
    overlaps(protectedPath, project) ||
    (proofRoot !== undefined &&
      (overlaps(resolve(proofRoot), protectedPath) ||
        overlaps(protectedPath, resolve(proofRoot))))
  ) {
    throw new Error(`${key} must be outside project and proof storage.`);
  }
  try {
    const metadata = lstatSync(protectedPath);
    if (
      metadata.isSymbolicLink() ||
      realpathSync(protectedPath) !== protectedPath ||
      (kind === "file" ? !metadata.isFile() : !metadata.isDirectory())
    ) {
      throw new Error("unsafe path");
    }
    if (
      process.platform !== "win32" &&
      ((metadata.mode & 0o077) !== 0 ||
        (process.getuid !== undefined && metadata.uid !== process.getuid()))
    ) {
      throw new Error("unsafe permissions");
    }
  } catch {
    throw new Error(
      `${key} requires accessible owner-only ${kind} storage without symlinks.`,
    );
  }
  return protectedPath;
}

export function privateCredentialFile(
  environment: Environment,
  key: string,
  projectRoot: string,
  maximumBytes = 4096,
): string {
  const credentialFile = privateCustodyPath(
    environment,
    key,
    projectRoot,
    "file",
  );
  const size = lstatSync(credentialFile).size;
  if (size < 1 || size > maximumBytes)
    throw new Error(`${key} has an invalid credential-file size.`);
  return credentialFile;
}

export function parseSignerCustodyEnvironment(
  environment: Environment,
  projectRoot: string,
) {
  const keyFile = privateDecryptionKeyFile(
    environment,
    "CUSTODY_KEY_FILE",
    projectRoot,
  );
  const keyId = requiredCustodySetting(environment, "CUSTODY_KEY_ID");
  if (!/^[A-Za-z0-9._-]{1,64}$/u.test(keyId))
    throw new Error("CUSTODY_KEY_ID is invalid.");
  if (environment["NODE_ENV"] === "production" && /^test[-_]/iu.test(keyId))
    throw new Error("Production custody rejects test key identifiers.");
  const storageRoot = privateCustodyPath(
    environment,
    "CUSTODY_STORAGE_ROOT",
    projectRoot,
    "directory",
  );
  const sshConfigFile = privateCredentialFile(
    environment,
    "CUSTODY_SSH_CONFIG_FILE",
    projectRoot,
    65536,
  );
  const knownHostsFile = privateCredentialFile(
    environment,
    "CUSTODY_SSH_KNOWN_HOSTS_FILE",
    projectRoot,
    65536,
  );
  const recoveryHost = requiredCustodySetting(
    environment,
    "CUSTODY_RECOVERY_HOST",
  );
  if (!/^[A-Za-z][A-Za-z0-9._-]{0,63}$/u.test(recoveryHost))
    throw new Error("CUSTODY_RECOVERY_HOST requires a fixed SSH alias.");
  const sshConfiguration = readFileSync(sshConfigFile, "utf8");
  if (
    /^\s*(Include|ProxyCommand|LocalCommand|RemoteCommand|Match|ControlMaster)\b/imu.test(
      sshConfiguration,
    )
  ) {
    throw new Error(
      "CUSTODY_SSH_CONFIG_FILE contains unsupported execution or multiplexing directives.",
    );
  }
  if (
    !sshConfiguration
      .split(/\r?\n/u)
      .some((line) => line.trim() === `Host ${recoveryHost}`)
  ) {
    throw new Error(
      "CUSTODY_SSH_CONFIG_FILE must bind the fixed recovery host alias.",
    );
  }
  const operatorIdentity = requiredCustodySetting(
    environment,
    "CUSTODY_OPERATOR_IDENTITY",
  );
  if (operatorIdentity.length > 160)
    throw new Error("CUSTODY_OPERATOR_IDENTITY is too long.");
  return Object.freeze({
    keyFile,
    keyId,
    keyFiles: retainedCustodyKeyFiles(environment, projectRoot, keyId, keyFile),
    storageRoot,
    sshConfigFile,
    knownHostsFile,
    recoveryHost,
    operatorIdentity,
    sshTimeoutMs: 10000,
    maximumMessageBytes: 262144,
    maximumListPage: 100,
    maximumAttempts: 3,
  });
}

function retainedCustodyKeyFiles(
  environment: Environment,
  projectRoot: string,
  currentKeyId: string,
  currentKeyFile: string,
): Readonly<Record<string, string>> {
  const keyFiles: Record<string, string> = { [currentKeyId]: currentKeyFile };
  if (
    environment["CUSTODY_RETAINED_KEYS_FILE"] === undefined ||
    environment["CUSTODY_RETAINED_KEYS_FILE"].trim() === ""
  )
    return Object.freeze(keyFiles);
  const manifest = privateCredentialFile(
    environment,
    "CUSTODY_RETAINED_KEYS_FILE",
    projectRoot,
    65536,
  );
  let decoded: unknown;
  try {
    decoded = JSON.parse(readFileSync(manifest, "utf8"));
  } catch {
    throw new Error(
      "CUSTODY_RETAINED_KEYS_FILE requires a valid retained-key manifest.",
    );
  }
  const parsed = z
    .record(z.string().regex(/^[A-Za-z0-9._-]{1,64}$/u), z.string())
    .safeParse(decoded);
  if (!parsed.success || Object.keys(parsed.data).length > 64)
    throw new Error(
      "CUSTODY_RETAINED_KEYS_FILE requires a bounded retained-key manifest.",
    );
  for (const [keyId, file] of Object.entries(parsed.data)) {
    if (keyId === currentKeyId && file !== currentKeyFile)
      throw new Error(
        "CUSTODY_RETAINED_KEYS_FILE cannot replace the current key identity.",
      );
    keyFiles[keyId] = privateDecryptionKeyFile(
      { RETAINED_KEY: file },
      "RETAINED_KEY",
      projectRoot,
    );
  }
  return Object.freeze(keyFiles);
}

export function parseRecoveryHelperEnvironment(
  environment: Environment,
  projectRoot: string,
) {
  return Object.freeze({
    storageRoot: privateCustodyPath(
      environment,
      "CUSTODY_RECOVERY_STORAGE_ROOT",
      projectRoot,
      "directory",
    ),
    maximumMessageBytes: 262144,
    maximumListPage: 100,
  });
}

export function parseRecoveryOperatorEnvironment(
  environment: Environment,
  projectRoot: string,
) {
  const escrowKeyFile = privateDecryptionKeyFile(
    environment,
    "CUSTODY_RECOVERY_KEY_FILE",
    projectRoot,
  );
  return Object.freeze({
    escrowKeyFile,
    operatorIdentity: requiredCustodySetting(
      environment,
      "CUSTODY_OPERATOR_IDENTITY",
    ),
  });
}

function privateDecryptionKeyFile(
  environment: Environment,
  key: string,
  projectRoot: string,
) {
  const keyFile = privateCredentialFile(environment, key, projectRoot, 32);
  const keyBytes = readFileSync(keyFile);
  const valid = keyBytes.length === 32 && new Set(keyBytes).size >= 8;
  keyBytes.fill(0);
  if (!valid)
    throw new Error(
      `${key} requires an explicit 32-byte key without repeated default bytes.`,
    );
  return keyFile;
}

export type SignerCustodyConfig = ReturnType<
  typeof parseSignerCustodyEnvironment
>;
