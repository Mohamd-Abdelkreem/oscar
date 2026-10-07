import { isAbsolute, relative, resolve, sep } from "node:path";
import {
  PROOF_INPUT_DEADLINE_MS,
  PROOF_PROCESSING_SLOTS,
  PROOF_STAGING_MAX_BYTES,
  PROOF_UPLOAD_RESERVATION_BYTES,
} from "@template/contracts";

export type ProofsConfig = Readonly<{
  storageRoot: string;
  processingSlots: number;
  uploadReservationBytes: number;
  stagingMaxBytes: number;
  inputDeadlineMs: number;
}>;

function hasControlCharacter(configuredRoot: string) {
  for (const character of configuredRoot) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && (codePoint < 32 || codePoint === 127))
      return true;
  }
  return false;
}

function boundedSetting(
  environment: Readonly<Record<string, string | undefined>>,
  key: string,
  bounds: { minimum: number; maximum: number },
) {
  const configured = environment[key];
  if (configured === undefined) return bounds.maximum;
  if (!/^[1-9]\d*$/u.test(configured))
    throw new Error(`${key} must be a positive integer.`);
  const parsed = Number(configured);
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < bounds.minimum ||
    parsed > bounds.maximum
  )
    throw new Error(`${key} exceeds the approved proof budget.`);
  return parsed;
}

export function parseProofsEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  projectRoot: string,
): ProofsConfig {
  const configuredRoot = environment["PROOF_STORAGE_ROOT"];
  if (
    configuredRoot === undefined ||
    configuredRoot.trim() === "" ||
    hasControlCharacter(configuredRoot) ||
    !isAbsolute(configuredRoot)
  )
    throw new Error(
      "PROOF_STORAGE_ROOT must be an absolute private directory.",
    );
  const storageRoot = resolve(configuredRoot);
  const projectRelative = relative(resolve(projectRoot), storageRoot);
  const rootRelative = relative(storageRoot, resolve(projectRoot));
  if (
    projectRelative === "" ||
    (!isAbsolute(projectRelative) &&
      projectRelative !== ".." &&
      !projectRelative.startsWith(`..${sep}`)) ||
    rootRelative === "" ||
    (!isAbsolute(rootRelative) &&
      rootRelative !== ".." &&
      !rootRelative.startsWith(`..${sep}`))
  )
    throw new Error(
      "PROOF_STORAGE_ROOT must be separate from the project tree.",
    );
  const processingSlots = boundedSetting(
    environment,
    "PROOF_PROCESSING_SLOTS",
    {
      minimum: 1,
      maximum: PROOF_PROCESSING_SLOTS,
    },
  );
  const stagingMaxBytes = boundedSetting(
    environment,
    "PROOF_STAGING_MAX_BYTES",
    {
      minimum: processingSlots * PROOF_UPLOAD_RESERVATION_BYTES,
      maximum: PROOF_STAGING_MAX_BYTES,
    },
  );
  return {
    storageRoot,
    processingSlots,
    uploadReservationBytes: PROOF_UPLOAD_RESERVATION_BYTES,
    stagingMaxBytes,
    inputDeadlineMs: boundedSetting(environment, "PROOF_INPUT_DEADLINE_MS", {
      minimum: 1,
      maximum: PROOF_INPUT_DEADLINE_MS,
    }),
  };
}
