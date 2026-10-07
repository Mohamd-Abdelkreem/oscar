import { z } from "zod";

const required = z.string().trim().min(1);
const uuid = z.uuid();
const hosts = {
  TRON_NILE: "nile.trongrid.io",
  TRON_SHASTA: "api.shasta.trongrid.io",
} as const;
export function parseTestnetAdmission(
  environment: Readonly<Record<string, string | undefined>>,
) {
  if (environment["P06_TESTNET_OPT_IN"] !== "YES")
    throw new Error("P06_TESTNET_OPT_IN=YES is required before live imports.");
  const network = z
    .enum(["TRON_NILE", "TRON_SHASTA"])
    .parse(environment["TRON_NETWORK"]);
  const provider = new URL(required.parse(environment["TRON_PROVIDER_URL"]));
  if (
    provider.origin !== `https://${hosts[network]}` ||
    provider.href !== `${provider.origin}/`
  )
    throw new Error("Testnet provider mismatch.");
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
  const genesis = z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .refine((s) => !/^0+$/u.test(s))
    .parse(environment["TRON_EXPECTED_GENESIS_BLOCK_ID"]);
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
