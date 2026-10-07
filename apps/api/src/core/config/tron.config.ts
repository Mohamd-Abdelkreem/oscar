import { TronWeb } from "tronweb";
import {
  privateCredentialFile,
  requiredCustodySetting,
} from "./custody.config.js";

type Environment = Readonly<Record<string, string | undefined>>;
const providerHosts = {
  TRON_MAINNET: "api.trongrid.io",
  TRON_SHASTA: "api.shasta.trongrid.io",
  TRON_NILE: "nile.trongrid.io",
} as const;
export type TronNetworkName = keyof typeof providerHosts;

function networkSetting(environment: Environment): TronNetworkName {
  const configured = requiredCustodySetting(environment, "TRON_NETWORK");
  if (
    configured !== "TRON_MAINNET" &&
    configured !== "TRON_SHASTA" &&
    configured !== "TRON_NILE"
  ) {
    throw new Error("TRON_NETWORK is unsupported.");
  }
  return configured;
}

function addressSetting(environment: Environment, key: string): string {
  const configured = requiredCustodySetting(environment, key);
  if (
    !/^T[1-9A-HJ-NP-Za-km-z]{33}$/u.test(configured) ||
    !TronWeb.isAddress(configured)
  ) {
    throw new Error(`${key} requires a valid Base58Check TRON address.`);
  }
  return configured;
}

function boundedSetting(
  environment: Environment,
  key: string,
  bounds: readonly [minimum: number, maximum: number, fallback: number],
): number {
  const [minimum, maximum, fallback] = bounds;
  const configured = environment[key];
  if (configured === undefined) return fallback;
  if (!/^[1-9]\d*$/u.test(configured))
    throw new Error(`${key} must be an integer within its approved bounds.`);
  const parsed = Number(configured);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum)
    throw new Error(`${key} exceeds its approved bounds.`);
  return parsed;
}

function exactUnits(environment: Environment, key: string): bigint {
  const configured = requiredCustodySetting(environment, key);
  if (!/^[1-9]\d{0,18}$/u.test(configured))
    throw new Error(`${key} requires exact positive integer units.`);
  const units = BigInt(configured);
  if (units > 9223372036854775807n)
    throw new Error(`${key} exceeds representable units.`);
  return units;
}

function providerKeyFile(
  environment: Environment,
  projectRoot: string,
  network: TronNetworkName,
) {
  const auth = environment["TRON_PROVIDER_AUTH"] ?? "API_KEY";
  if (auth !== "API_KEY" && auth !== "PUBLIC_TESTNET")
    throw new Error("TRON_PROVIDER_AUTH is unsupported.");
  if (auth === "PUBLIC_TESTNET") {
    if (
      network === "TRON_MAINNET" ||
      environment["P06_TESTNET_OPT_IN"] !== "YES"
    )
      throw new Error("PUBLIC_TESTNET requires opted-in Nile or Shasta.");
    return null;
  }
  return privateCredentialFile(
    environment,
    "TRON_PROVIDER_API_KEY_FILE",
    projectRoot,
  );
}

export function parseTronPublicEnvironment(environment: Environment) {
  return Object.freeze({
    network: networkSetting(environment),
    token: Object.freeze({
      symbol: "USDT" as const,
      contract: addressSetting(environment, "TRON_TOKEN_CONTRACT"),
      decimals: 6 as const,
    }),
  });
}

export function parseTronWorkerEnvironment(
  environment: Environment,
  projectRoot: string,
) {
  const publicMetadata = parseTronPublicEnvironment(environment);
  const genesisBlockId = requiredCustodySetting(
    environment,
    "TRON_EXPECTED_GENESIS_BLOCK_ID",
  );
  if (
    !/^[0-9a-f]{64}$/u.test(genesisBlockId) ||
    /^0{64}$/u.test(genesisBlockId)
  )
    throw new Error(
      "TRON_EXPECTED_GENESIS_BLOCK_ID requires a pinned canonical identity.",
    );
  let provider: URL;
  try {
    provider = new URL(
      requiredCustodySetting(environment, "TRON_PROVIDER_URL"),
    );
  } catch {
    throw new Error(
      "TRON_PROVIDER_URL requires an explicit allowlisted HTTPS provider.",
    );
  }
  if (
    provider.protocol !== "https:" ||
    provider.hostname !== providerHosts[publicMetadata.network] ||
    provider.port !== "" ||
    provider.username !== "" ||
    provider.password !== "" ||
    provider.search !== "" ||
    provider.hash !== "" ||
    provider.pathname !== "/"
  )
    throw new Error(
      "TRON_PROVIDER_URL must match the selected network without credentials, paths or redirects.",
    );
  return Object.freeze({
    ...publicMetadata,
    genesisBlockId,
    providerUrl: provider.origin,
    providerApiKeyFile: providerKeyFile(
      environment,
      projectRoot,
      publicMetadata.network,
    ),
    maximumRedirects: 0,
    providerTimeoutMs: boundedSetting(
      environment,
      "TRON_PROVIDER_TIMEOUT_MS",
      [1000, 60000, 10000],
    ),
    maximumResponseBytes: boundedSetting(
      environment,
      "TRON_MAX_RESPONSE_BYTES",
      [1024, 2097152, 2097152],
    ),
    discoveryPageSize: boundedSetting(
      environment,
      "TRON_DISCOVERY_PAGE_SIZE",
      [1, 200, 100],
    ),
    pagesPerAddress: boundedSetting(
      environment,
      "TRON_PAGES_PER_ADDRESS",
      [1, 20, 5],
    ),
    candidateBatchSize: boundedSetting(
      environment,
      "TRON_CANDIDATE_BATCH_SIZE",
      [1, 200, 50],
    ),
    concurrentReads: boundedSetting(
      environment,
      "TRON_CONCURRENT_READS",
      [1, 16, 4],
    ),
    maximumAttempts: boundedSetting(
      environment,
      "TRON_MAX_ATTEMPTS",
      [1, 3, 3],
    ),
    scanLagAlertAfterMs: boundedSetting(
      environment,
      "TRON_SCAN_LAG_ALERT_AFTER_MS",
      [1000, 86400000, 300000],
    ),
    pendingWorkAlertAfterMs: boundedSetting(
      environment,
      "TRON_PENDING_WORK_ALERT_AFTER_MS",
      [1000, 86400000, 300000],
    ),
  });
}

export function parseTronSignerEnvironment(
  environment: Environment,
  projectRoot: string,
) {
  const provider = parseTronWorkerEnvironment(environment, projectRoot);
  const treasury = addressSetting(environment, "TRON_TREASURY_ADDRESS");
  if (treasury === provider.token.contract)
    throw new Error("TRON_TREASURY_ADDRESS cannot be the token contract.");
  const maximumSweepUnits = exactUnits(environment, "TRON_MAX_SWEEP_UNITS");
  const energyFeeLimitSun = exactUnits(
    environment,
    "TRON_ENERGY_FEE_LIMIT_SUN",
  );
  const maximumCompanyCostSun = exactUnits(
    environment,
    "TRON_MAX_COMPANY_COST_SUN",
  );
  const maximumManualFundingSun = exactUnits(
    environment,
    "TRON_MAX_MANUAL_FUNDING_SUN",
  );
  if (energyFeeLimitSun > maximumCompanyCostSun)
    throw new Error(
      "TRON_ENERGY_FEE_LIMIT_SUN exceeds the separate company cost budget.",
    );
  return Object.freeze({
    ...provider,
    treasury,
    maximumSweepUnits,
    energyFeeLimitSun,
    maximumCompanyCostSun,
    maximumManualFundingSun,
  });
}

export function parseTronTestnetEnvironment(
  environment: Environment,
  projectRoot: string,
) {
  if (environment["P06_TESTNET_OPT_IN"] !== "true")
    throw new Error(
      "P06_TESTNET_OPT_IN must explicitly authorize the test profile.",
    );
  const configuration = parseTronSignerEnvironment(environment, projectRoot);
  if (configuration.network === "TRON_MAINNET")
    throw new Error("Controlled testnet configuration rejects MAINNET.");
  return configuration;
}

export type TronWorkerConfig = ReturnType<typeof parseTronWorkerEnvironment>;
