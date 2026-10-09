import { describe, expect, it } from "vitest";
import {
  parseTestnetAdmission,
  parsePayoutTestnetAdmission,
  parseTestnetProfile,
} from "./testnet.config.js";

function payoutEnvironment() {
  return {
    OSCAR_TESTNET_PROFILE: "P08_PAYOUT",
    P08_TESTNET_OPT_IN: "YES",
    P08_TESTNET_ISOLATED: "YES",
    P08_TESTNET_FUNDING_CONFIRMED: "YES",
    P08_TESTNET_RESOURCES_CONFIRMED: "YES",
    P08_TESTNET_APPROVAL_REFERENCE: "controlled-payout-owner-approval",
    TRON_NETWORK: "TRON_NILE",
    TRON_PROVIDER_URL: "https://nile.trongrid.io",
    TRON_EXPECTED_GENESIS_BLOCK_ID: "ab".repeat(32),
    TRON_PROVIDER_AUTH: "PUBLIC_TESTNET",
    TRON_TOKEN_CONTRACT: "TXLAQ63Xg1NAzckPwKHvzw7CSEmLMEqcdj",
    TRON_TREASURY_ADDRESS: "TCLBgkbfVkJroVBJVqBEsxtPNQEQMTQCLQ",
    P08_TESTNET_RECIPIENT: "TD5gsCwxykWsLN9aPrq2TAfNjByuZKYp4E",
    P08_TESTNET_WITHDRAWAL_ID: "bd9e5ee0-2b6a-411b-bcb1-0d0c17480bf4",
    TRON_PAYOUT_KEY_ID: "ec53a258-d63e-451c-ae0c-a5c37a4a9e02",
    P08_TESTNET_GROSS_UNITS: "100000000",
    P08_TESTNET_NET_UNITS: "79000000",
    TRON_MAX_PAYOUT_UNITS: "100000000",
    TRON_MAX_SWEEP_UNITS: "100000000",
    TRON_ENERGY_FEE_LIMIT_SUN: "1000000",
    TRON_MAX_COMPANY_COST_SUN: "2000000",
    TRON_MAX_MANUAL_FUNDING_SUN: "1000000",
    TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN: "1000000",
    TRON_PAYOUT_MAX_COMPANY_COST_SUN: "2000000",
    P08_TESTNET_SIGNER_DATABASE_FILE: "/private/signer/database",
    P08_TESTNET_OPERATOR_DATABASE_FILE: "/private/operator/database",
    CUSTODY_RECOVERY_KEY_FILE: "/private/operator/escrow",
    CUSTODY_KEY_FILE: "/private/signer/master",
    CUSTODY_SSH_CONFIG_FILE: "/private/signer/ssh",
    CUSTODY_SSH_KNOWN_HOSTS_FILE: "/private/signer/known_hosts",
    CUSTODY_STORAGE_ROOT: "/private/signer/original",
    P08_TESTNET_RECOVERED_STORAGE_ROOT: "/private/signer/recovered",
    CUSTODY_KEY_ID: "test-only",
    CUSTODY_RECOVERY_HOST: "isolated-archive",
    CUSTODY_OPERATOR_IDENTITY: "independent-test-operator",
  };
}

describe("live testnet admission", () => {
  it.each([undefined, "NO", "true"])(
    "rejects opt-in %s before private or network imports",
    (opt) => {
      expect(() => parseTestnetAdmission({ P06_TESTNET_OPT_IN: opt })).toThrow(
        "P06_TESTNET_OPT_IN=YES",
      );
    },
  );
  it.each(["TRON_MAINNET", undefined])("rejects network %s", (network) => {
    expect(() =>
      parseTestnetAdmission({
        P06_TESTNET_OPT_IN: "YES",
        TRON_NETWORK: network,
      }),
    ).toThrow();
  });
  it("rejects mismatched provider and missing designated inputs", () => {
    expect(() =>
      parseTestnetAdmission({
        P06_TESTNET_OPT_IN: "YES",
        TRON_NETWORK: "TRON_NILE",
        TRON_PROVIDER_URL: "https://api.trongrid.io",
      }),
    ).toThrow("mismatch");
    expect(() =>
      parseTestnetAdmission({
        P06_TESTNET_OPT_IN: "YES",
        TRON_NETWORK: "TRON_NILE",
        TRON_PROVIDER_URL: "https://nile.trongrid.io",
      }),
    ).toThrow();
  });
});

describe("payout-only admission before live imports", () => {
  it("admits designated fixed payout inputs without P06 setup or private I/O", () => {
    const environment = payoutEnvironment();
    expect(parsePayoutTestnetAdmission(environment)).toMatchObject({
      requestId: environment.P08_TESTNET_WITHDRAWAL_ID,
      netUnits: "79000000",
    });
    expect(parseTestnetProfile(environment).files).toEqual([
      "testnet/payouts.testnet.test.ts",
    ]);
    expect(() => parseTestnetAdmission(environment)).toThrow("P06 profile");
  });
  it.each([
    ["OSCAR_TESTNET_PROFILE", undefined],
    ["OSCAR_TESTNET_PROFILE", "P06"],
    ["OSCAR_TESTNET_PROFILE", "anything"],
    ["P08_TESTNET_OPT_IN", undefined],
    ["P06_TESTNET_OPT_IN", "YES"],
    ["P08_TESTNET_ISOLATED", undefined],
    ["P08_TESTNET_FUNDING_CONFIRMED", "NO"],
    ["P08_TESTNET_RESOURCES_CONFIRMED", "NO"],
    ["P08_TESTNET_APPROVAL_REFERENCE", undefined],
    ["TRON_NETWORK", "TRON_MAINNET"],
    ["TRON_PROVIDER_URL", "https://api.trongrid.io"],
    ["TRON_PROVIDER_URL", "https://nile.trongrid.io/?fallback=mainnet"],
    ["TRON_EXPECTED_GENESIS_BLOCK_ID", "00".repeat(32)],
    ["P08_TESTNET_WITHDRAWAL_ID", undefined],
    ["TRON_PAYOUT_KEY_ID", undefined],
    ["CUSTODY_KEY_ID", "production"],
    ["P08_TESTNET_NET_UNITS", "100000001"],
    ["P08_TESTNET_GROSS_UNITS", "0"],
    ["TRON_MAX_PAYOUT_UNITS", "1"],
    ["TRON_PAYOUT_ENERGY_FEE_LIMIT_SUN", "2000001"],
    ["P08_TESTNET_RECIPIENT", "TCLBgkbfVkJroVBJVqBEsxtPNQEQMTQCLQ"],
    ["P08_TESTNET_OPERATOR_DATABASE_FILE", undefined],
    ["P08_TESTNET_SIGNER_DATABASE_FILE", "relative/database"],
    ["P08_TESTNET_OPERATOR_DATABASE_FILE", "/private/signer/database"],
    ["CUSTODY_RECOVERY_KEY_FILE", "/private/signer/master"],
    ["P08_TESTNET_RECOVERED_STORAGE_ROOT", "/private/signer/original/child"],
    ["CUSTODY_KEY_FILE", "/private/../public/key"],
    ["TRON_PROVIDER_AUTH", "API_KEY"],
    ["P08_TESTNET_ORIGINAL_TRANSACTION_ID", ""],
    ["P08_TESTNET_ORIGINAL_TRANSACTION_ID", "00".repeat(32)],
    ["P08_TESTNET_ORIGINAL_TRANSACTION_ID", "not-a-transaction"],
  ] as const)(
    "rejects unsafe or missing %s=%s with no fallback",
    (setting, value) => {
      expect(() =>
        parseTestnetProfile({ ...payoutEnvironment(), [setting]: value }),
      ).toThrow();
    },
  );
  it("binds recovery-only payout admission to one explicit original transaction", () => {
    const originalTransactionId = "ab".repeat(32);
    const selected = parseTestnetProfile({
      ...payoutEnvironment(),
      P08_TESTNET_ORIGINAL_TRANSACTION_ID: originalTransactionId,
    });
    expect(selected.profile).toBe("P08_PAYOUT");
    expect(selected.files).toEqual(["testnet/payouts.testnet.test.ts"]);
    expect(selected.designation).toMatchObject({ originalTransactionId });
  });
  it("keeps the independently opted-in P06 discovery isolated from payout execution", () => {
    const environment = {
      ...payoutEnvironment(),
      OSCAR_TESTNET_PROFILE: "P06",
      P08_TESTNET_OPT_IN: undefined,
      P06_TESTNET_OPT_IN: "YES",
      P06_TESTNET_SIGNER_DATABASE_FILE: "/private/p06/signer",
      P06_TESTNET_WORKER_DATABASE_FILE: "/private/p06/worker",
      P06_TESTNET_OPERATOR_DATABASE_FILE: "/private/p06/operator",
      P06_TESTNET_INBOUND_EVIDENCE_FILE: "/private/p06/evidence",
      P06_TESTNET_ASSIGNMENT_ID: "e9df43f4-b0e7-43b3-9009-ff27940b577e",
      P06_TESTNET_SWEEP_ID: "e6b70d7c-44c9-4c41-9c5d-530066e979a7",
      P06_TESTNET_INBOUND_UNITS: "100000000",
      P06_TESTNET_SWEEP_UNITS: "79000000",
    };
    expect(parseTestnetProfile(environment).files).toEqual([
      "testnet/custody.testnet.test.ts",
      "testnet/deposits.testnet.test.ts",
      "testnet/sweeps.testnet.test.ts",
    ]);
    expect(() => parsePayoutTestnetAdmission(environment)).toThrow(
      "separate explicit opt-in",
    );
  });
});
