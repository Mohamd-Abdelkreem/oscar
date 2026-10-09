import { z } from "zod";

const required = z.string().trim().min(1);
const uuid = z.uuid();
const hosts = {
  TRON_NILE: "nile.trongrid.io",
  TRON_SHASTA: "api.shasta.trongrid.io",
} as const;
function testnetIdentity(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const network = z
    .enum(["TRON_NILE", "TRON_SHASTA"])
    .parse(environment["TRON_NETWORK"]);
  let provider: URL;
  try {
    provider = new URL(required.parse(environment["TRON_PROVIDER_URL"]));
  } catch {
    throw new Error("Testnet provider URL invalid.");
  }
  if (provider.href !== `https://${hosts[network]}/`)
    throw new Error("Testnet provider mismatch.");
  const genesis = z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .refine((s) => !/^0+$/u.test(s))
    .parse(environment["TRON_EXPECTED_GENESIS_BLOCK_ID"]);
  return { network, genesis };
}
export function parseTestnetAdmission(
  environment: Readonly<Record<string, string | undefined>>,
) {
  if ((environment["OSCAR_TESTNET_PROFILE"] ?? "P06") !== "P06")
    throw new Error("P06 admission requires the P06 profile.");
  if (environment["P08_TESTNET_OPT_IN"] === "YES")
    throw new Error("Payout opt-in requires the explicit payout profile.");
  if (environment["P06_TESTNET_OPT_IN"] !== "YES")
    throw new Error("P06_TESTNET_OPT_IN=YES is required before live imports.");
  const { network, genesis } = testnetIdentity(environment);
  const files = [
    "P06_TESTNET_SIGNER_DATABASE_FILE",
    "P06_TESTNET_WORKER_DATABASE_FILE",
    "P06_TESTNET_OPERATOR_DATABASE_FILE",
    "P06_TESTNET_INBOUND_EVIDENCE_FILE",
    "CUSTODY_RECOVERY_KEY_FILE",
    "CUSTODY_KEY_FILE",
    "CUSTODY_SSH_CONFIG_FILE",
    "CUSTODY_SSH_KNOWN_HOSTS_FILE",
  ] as const;
  for (const file of files) required.parse(environment[file]);
  const auth = environment["TRON_PROVIDER_AUTH"] ?? "API_KEY";
  if (auth !== "API_KEY" && auth !== "PUBLIC_TESTNET")
    throw new Error("TRON_PROVIDER_AUTH is unsupported.");
  if (auth === "API_KEY")
    required.parse(environment["TRON_PROVIDER_API_KEY_FILE"]);
  for (const setting of [
    "TRON_TOKEN_CONTRACT",
    "TRON_TREASURY_ADDRESS",
    "CUSTODY_OPERATOR_IDENTITY",
    "CUSTODY_STORAGE_ROOT",
    "CUSTODY_KEY_ID",
    "TRON_MAX_SWEEP_UNITS",
    "TRON_ENERGY_FEE_LIMIT_SUN",
    "TRON_MAX_COMPANY_COST_SUN",
    "TRON_MAX_MANUAL_FUNDING_SUN",
    "CUSTODY_RECOVERY_HOST",
  ])
    required.parse(environment[setting]);
  return {
    network,
    genesis,
    assignmentId: uuid.parse(environment["P06_TESTNET_ASSIGNMENT_ID"]),
    operationId: uuid.parse(environment["P06_TESTNET_SWEEP_ID"]),
    inboundUnits: z
      .string()
      .regex(/^[1-9]\d{0,18}$/u)
      .parse(environment["P06_TESTNET_INBOUND_UNITS"]),
    sweepUnits: z
      .string()
      .regex(/^[1-9]\d{0,18}$/u)
      .parse(environment["P06_TESTNET_SWEEP_UNITS"]),
  };
}

function payoutAmounts(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const amount = z
    .string()
    .regex(/^[1-9]\d{0,18}$/u)
    .refine((v) => BigInt(v) <= 9223372036854775807n);
  const grossUnits = amount.parse(environment["P08_TESTNET_GROSS_UNITS"]);
  const netUnits = amount.parse(environment["P08_TESTNET_NET_UNITS"]);
  if (
    BigInt(netUnits) > BigInt(grossUnits) ||
    BigInt(netUnits) >
      BigInt(amount.parse(environment["TRON_MAX_PAYOUT_UNITS"]))
  )
    throw new Error("Designated payout amount exceeds its fixed gross/cap.");
  for (const setting of [
    "TRON_MAX_SWEEP_UNITS",
    "TRON_ENERGY_FEE_LIMIT_SUN",
    "TRON_MAX_COMPANY_COST_SUN",
    "TRON_MAX_MANUAL_FUNDING_SUN",
    "TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN",
    "TRON_PAYOUT_MAX_COMPANY_COST_SUN",
  ])
    amount.parse(environment[setting]);
  if (
    BigInt(amount.parse(environment["TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN"])) >
    BigInt(amount.parse(environment["TRON_PAYOUT_MAX_COMPANY_COST_SUN"]))
  )
    throw new Error("Payout resource cap exceeds company budget.");
  return { grossUnits, netUnits };
}

function payoutPrivateInputs(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const privatePath = z
    .string()
    .regex(/^\/[^\p{Cc}]+$/u)
    .refine((v) => !/(?:^|\/)\.{1,2}(?:\/|$)/u.test(v));
  const files = [
    "P08_TESTNET_SIGNER_DATABASE_FILE",
    "P08_TESTNET_OPERATOR_DATABASE_FILE",
    "CUSTODY_RECOVERY_KEY_FILE",
    "CUSTODY_KEY_FILE",
    "CUSTODY_SSH_CONFIG_FILE",
    "CUSTODY_SSH_KNOWN_HOSTS_FILE",
  ] as const;
  for (const setting of files) privatePath.parse(environment[setting]);
  if (
    environment["P08_TESTNET_SIGNER_DATABASE_FILE"] ===
      environment["P08_TESTNET_OPERATOR_DATABASE_FILE"] ||
    environment["CUSTODY_KEY_FILE"] === environment["CUSTODY_RECOVERY_KEY_FILE"]
  )
    throw new Error(
      "Signer and independent operator credentials must be separate.",
    );
  const storageRoot = privatePath.parse(environment["CUSTODY_STORAGE_ROOT"]);
  const recoveredRoot = privatePath.parse(
    environment["P08_TESTNET_RECOVERED_STORAGE_ROOT"],
  );
  if (
    storageRoot === recoveredRoot ||
    storageRoot.startsWith(recoveredRoot + "/") ||
    recoveredRoot.startsWith(storageRoot + "/")
  )
    throw new Error("Original and recovered private caches must be separate.");
  const auth = environment["TRON_PROVIDER_AUTH"] ?? "API_KEY";
  if (auth === "API_KEY")
    privatePath.parse(environment["TRON_PROVIDER_API_KEY_FILE"]);
  else if (auth !== "PUBLIC_TESTNET")
    throw new Error("Unsupported provider authentication.");
  return recoveredRoot;
}

// Pure admission: no private-file, database, provider or custody imports before this succeeds.
export function parsePayoutTestnetAdmission(
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (
    environment["OSCAR_TESTNET_PROFILE"] !== "P08_PAYOUT" ||
    environment["P08_TESTNET_OPT_IN"] !== "YES" ||
    environment["P06_TESTNET_OPT_IN"] === "YES"
  )
    throw new Error(
      "Payout-only admission requires its separate explicit opt-in.",
    );
  for (const setting of [
    "P08_TESTNET_ISOLATED",
    "P08_TESTNET_FUNDING_CONFIRMED",
    "P08_TESTNET_RESOURCES_CONFIRMED",
  ])
    if (environment[setting] !== "YES")
      throw new Error(
        "Controlled payout isolation, funding and resources required.",
      );
  const { network, genesis } = testnetIdentity(environment);
  const address = z.string().regex(/^T[1-9A-HJ-NP-Za-km-z]{33}$/u);
  const tokenContract = address.parse(environment["TRON_TOKEN_CONTRACT"]);
  const source = address.parse(environment["TRON_TREASURY_ADDRESS"]);
  const recipient = address.parse(environment["P08_TESTNET_RECIPIENT"]);
  if (new Set([tokenContract, source, recipient]).size !== 3)
    throw new Error("Designated payout addresses must be distinct.");
  const { grossUnits, netUnits } = payoutAmounts(environment);
  const recoveredRoot = payoutPrivateInputs(environment);
  z.string()
    .regex(/^test[-_][A-Za-z0-9._-]+$/u)
    .parse(environment["CUSTODY_KEY_ID"]);
  required.parse(environment["CUSTODY_RECOVERY_HOST"]);
  required.parse(environment["CUSTODY_OPERATOR_IDENTITY"]);
  required.parse(environment["P08_TESTNET_APPROVAL_REFERENCE"]);
  const originalTransactionId =
    environment["P08_TESTNET_ORIGINAL_TRANSACTION_ID"] === undefined
      ? null
      : z
          .string()
          .regex(/^[0-9a-f]{64}$/u)
          .refine((value) => !/^0+$/u.test(value))
          .parse(environment["P08_TESTNET_ORIGINAL_TRANSACTION_ID"]);
  return Object.freeze({
    network,
    genesis,
    tokenContract,
    source,
    recipient,
    grossUnits,
    netUnits,
    requestId: uuid.parse(environment["P08_TESTNET_WITHDRAWAL_ID"]),
    treasuryKeyId: uuid.parse(environment["TRON_PAYOUT_KEY_ID"]),
    recoveredRoot,
    originalTransactionId,
  });
}

export function parseTestnetProfile(
  environment: Readonly<Record<string, string | undefined>>,
) {
  const profile = z
    .enum(["P06", "P08_PAYOUT"])
    .parse(environment["OSCAR_TESTNET_PROFILE"] ?? "P06");
  if (profile === "P08_PAYOUT")
    return {
      profile,
      designation: parsePayoutTestnetAdmission(environment),
      files: ["testnet/payouts.testnet.test.ts"],
    } as const;
  return {
    profile,
    designation: parseTestnetAdmission(environment),
    files: [
      "testnet/custody.testnet.test.ts",
      "testnet/deposits.testnet.test.ts",
      "testnet/sweeps.testnet.test.ts",
    ],
  } as const;
}
