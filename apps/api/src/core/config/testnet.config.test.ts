import { describe, expect, it } from "vitest";
import { parseTestnetAdmission } from "./testnet.config.js";

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
