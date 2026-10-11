import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { TronWeb } from "tronweb";
import { afterAll, describe, expect, it } from "vitest";
import {
  parseTronPublicEnvironment,
  parseTronWorkerEnvironment,
  parseTronSignerEnvironment,
  parseTronTestnetEnvironment,
  parseTronPayoutEnvironment,
  parseTronPublicPayoutCapability,
} from "./tron.config.js";

const root = mkdtempSync(join(tmpdir(), "p06-provider-config-"));
const credential = join(root, "provider.key");
writeFileSync(credential, "test-only-provider-sentinel", { mode: 0o600 });
const environment = {
  TRON_NETWORK: "TRON_NILE",
  TRON_TOKEN_CONTRACT: TronWeb.address.fromHex(`41${"11".repeat(20)}`),
  TRON_EXPECTED_GENESIS_BLOCK_ID: "ab".repeat(32),
  TRON_PROVIDER_URL: "https://nile.trongrid.io",
  TRON_PROVIDER_API_KEY_FILE: credential,
  TRON_TREASURY_ADDRESS: TronWeb.address.fromHex(`41${"22".repeat(20)}`),
  TRON_MAX_SWEEP_UNITS: "1000000",
  TRON_ENERGY_FEE_LIMIT_SUN: "100",
  TRON_MAX_COMPANY_COST_SUN: "200",
  TRON_MAX_MANUAL_FUNDING_SUN: "300",
};
const project = process.cwd();
afterAll(() => {
  if (
    !relative(resolve(tmpdir()), resolve(root)).startsWith(
      "p06-provider-config-",
    )
  )
    throw new Error("Unsafe temporary cleanup target.");
  rmSync(root, { recursive: true, force: true });
});

describe("explicit bounded TRON configuration", () => {
  it("parses optional public payout capability without protected configuration", () => {
    expect(parseTronPublicPayoutCapability({})).toBeUndefined();
    expect(
      parseTronPublicPayoutCapability({ TRON_NETWORK: "TRON_NILE" }),
    ).toBeUndefined();
    const publicOnly = {
      TRON_NETWORK: environment.TRON_NETWORK,
      TRON_TOKEN_CONTRACT: environment.TRON_TOKEN_CONTRACT,
      TRON_PAYOUT_KEY_ID: "8f4be6e1-6b22-4c54-b9ec-9af1ba7bff15",
    };
    expect(parseTronPublicPayoutCapability(publicOnly)).toEqual({
      ...parseTronPublicEnvironment(publicOnly),
      treasuryKeyId: publicOnly.TRON_PAYOUT_KEY_ID,
    });
    for (const patch of [
      { TRON_PAYOUT_KEY_ID: "bad" },
      { TRON_NETWORK: undefined },
      { TRON_NETWORK: "OTHER" },
      { TRON_TOKEN_CONTRACT: "bad" },
    ])
      expect(() =>
        parseTronPublicPayoutCapability({ ...publicOnly, ...patch }),
      ).toThrow();
  });
  it("requires a separate immutable payout key and independent positive bounded payout caps", () => {
    const payout = {
      ...environment,
      TRON_PAYOUT_KEY_ID: "8f4be6e1-6b22-4c54-b9ec-9af1ba7bff15",
      TRON_MAX_PAYOUT_UNITS: "500000000",
      TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN: "1000000",
      TRON_PAYOUT_MAX_COMPANY_COST_SUN: "2000000",
    };
    expect(parseTronPayoutEnvironment(payout, project)).toMatchObject({
      treasuryKeyId: payout.TRON_PAYOUT_KEY_ID,
      maximumPayoutUnits: 500000000n,
      payoutEnergyFeeLimitSun: 1000000n,
    });
    for (const key of [
      "TRON_PAYOUT_KEY_ID",
      "TRON_MAX_PAYOUT_UNITS",
      "TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN",
      "TRON_PAYOUT_MAX_COMPANY_COST_SUN",
    ]) {
      expect(() =>
        parseTronPayoutEnvironment({ ...payout, [key]: undefined }, project),
      ).toThrow();
      expect(() =>
        parseTronPayoutEnvironment({ ...payout, [key]: "-1" }, project),
      ).toThrow();
    }
    expect(() =>
      parseTronPayoutEnvironment(
        { ...payout, TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN: "2000001" },
        project,
      ),
    ).toThrow();
  });
  it("allows credential-free public testnet only with explicit live opt-in", () => {
    const publicTestnet = {
      ...environment,
      TRON_PROVIDER_AUTH: "PUBLIC_TESTNET",
      TRON_PROVIDER_API_KEY_FILE: undefined,
      P06_TESTNET_OPT_IN: "YES",
    };
    expect(
      parseTronWorkerEnvironment(publicTestnet, project).providerApiKeyFile,
    ).toBeNull();
    expect(() =>
      parseTronWorkerEnvironment(
        { ...publicTestnet, P06_TESTNET_OPT_IN: undefined },
        project,
      ),
    ).toThrow("opted-in");
    expect(() =>
      parseTronWorkerEnvironment(
        {
          ...publicTestnet,
          TRON_NETWORK: "TRON_MAINNET",
          TRON_PROVIDER_URL: "https://api.trongrid.io",
        },
        project,
      ),
    ).toThrow("opted-in");
    expect(() =>
      parseTronWorkerEnvironment(
        { ...environment, TRON_PROVIDER_AUTH: "anonymous" },
        project,
      ),
    ).toThrow("TRON_PROVIDER_AUTH");
  });
  it("admits public payout provider authentication only with its exact separately opted-in profile", () => {
    const payout = {
      ...environment,
      TRON_PROVIDER_AUTH: "PUBLIC_TESTNET",
      TRON_PROVIDER_API_KEY_FILE: undefined,
      OSCAR_TESTNET_PROFILE: "P08_PAYOUT",
      P08_TESTNET_OPT_IN: "YES",
    };
    expect(
      parseTronWorkerEnvironment(payout, project).providerApiKeyFile,
    ).toBeNull();
    for (const rejected of [
      { ...payout, OSCAR_TESTNET_PROFILE: undefined },
      { ...payout, P08_TESTNET_OPT_IN: undefined },
      {
        ...payout,
        TRON_NETWORK: "TRON_MAINNET",
        TRON_PROVIDER_URL: "https://api.trongrid.io",
      },
    ])
      expect(() => parseTronWorkerEnvironment(rejected, project)).toThrow(
        "opted-in",
      );
  });
  it("exposes only public token metadata and pins provider policy", () => {
    expect(Object.keys(parseTronPublicEnvironment(environment)).sort()).toEqual(
      ["network", "token"],
    );
    expect(parseTronWorkerEnvironment(environment, project)).toMatchObject({
      maximumRedirects: 0,
      scanLagAlertAfterMs: 300000,
      pendingWorkAlertAfterMs: 300000,
    });
    expect(
      parseTronSignerEnvironment(environment, project).maximumSweepUnits,
    ).toBe(1000000n);
  });
  it.each([
    "TRON_NETWORK",
    "TRON_TOKEN_CONTRACT",
    "TRON_EXPECTED_GENESIS_BLOCK_ID",
    "TRON_PROVIDER_URL",
    "TRON_PROVIDER_API_KEY_FILE",
  ])("requires explicit %s", (key) => {
    expect(() =>
      parseTronWorkerEnvironment({ ...environment, [key]: undefined }, project),
    ).toThrow(key);
    expect(() =>
      parseTronWorkerEnvironment(
        { ...environment, [key]: "placeholder" },
        project,
      ),
    ).toThrow();
  });
  it.each([
    "http://nile.trongrid.io",
    "https://api.trongrid.io",
    "https://nile.trongrid.io.evil.test",
    "https://user:secret@nile.trongrid.io",
    "https://nile.trongrid.io/path",
    "https://nile.trongrid.io?redirect=1",
    "https://nile.trongrid.io:8443",
  ])("rejects provider %s", (url) => {
    expect(() =>
      parseTronWorkerEnvironment(
        { ...environment, TRON_PROVIDER_URL: url },
        project,
      ),
    ).toThrow("TRON_PROVIDER_URL");
  });
  it.each(["TRON_SCAN_LAG_ALERT_AFTER_MS", "TRON_PENDING_WORK_ALERT_AFTER_MS"])(
    "bounds %s",
    (key) => {
      for (const value of ["1000", "86400000"])
        expect(() =>
          parseTronWorkerEnvironment({ ...environment, [key]: value }, project),
        ).not.toThrow();
      for (const value of ["999", "86400001", "1.5", "", "-1"])
        expect(() =>
          parseTronWorkerEnvironment({ ...environment, [key]: value }, project),
        ).toThrow(key);
    },
  );
  it.each([
    "TRON_PROVIDER_TIMEOUT_MS",
    "TRON_MAX_RESPONSE_BYTES",
    "TRON_DISCOVERY_PAGE_SIZE",
    "TRON_PAGES_PER_ADDRESS",
    "TRON_CANDIDATE_BATCH_SIZE",
    "TRON_CONCURRENT_READS",
    "TRON_MAX_ATTEMPTS",
  ])("rejects unbounded %s", (key) => {
    expect(() =>
      parseTronWorkerEnvironment(
        { ...environment, [key]: "999999999" },
        project,
      ),
    ).toThrow(key);
    expect(() =>
      parseTronWorkerEnvironment({ ...environment, [key]: "1.1" }, project),
    ).toThrow(key);
  });
  it("rejects malformed token, genesis and inexact costs", () => {
    expect(() =>
      parseTronPublicEnvironment({
        ...environment,
        TRON_TOKEN_CONTRACT: "T".repeat(34),
      }),
    ).toThrow();
    expect(() =>
      parseTronWorkerEnvironment(
        { ...environment, TRON_EXPECTED_GENESIS_BLOCK_ID: "0".repeat(64) },
        project,
      ),
    ).toThrow();
    expect(() =>
      parseTronSignerEnvironment(
        { ...environment, TRON_MAX_SWEEP_UNITS: "1.000001" },
        project,
      ),
    ).toThrow();
    expect(() =>
      parseTronSignerEnvironment(
        { ...environment, TRON_ENERGY_FEE_LIMIT_SUN: "201" },
        project,
      ),
    ).toThrow();
  });
  it("requires testnet opt-in and rejects mainnet", () => {
    expect(() => parseTronTestnetEnvironment(environment, project)).toThrow(
      "P06_TESTNET_OPT_IN",
    );
    expect(() =>
      parseTronTestnetEnvironment(
        { ...environment, P06_TESTNET_OPT_IN: "true" },
        project,
      ),
    ).not.toThrow();
    expect(() =>
      parseTronTestnetEnvironment(
        {
          ...environment,
          P06_TESTNET_OPT_IN: "true",
          TRON_NETWORK: "TRON_MAINNET",
          TRON_PROVIDER_URL: "https://api.trongrid.io",
        },
        project,
      ),
    ).toThrow("MAINNET");
  });
});
