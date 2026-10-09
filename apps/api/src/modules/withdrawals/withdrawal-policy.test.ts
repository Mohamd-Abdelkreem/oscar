import { describe, expect, it } from "vitest";
import { MAX_USDT_AMOUNT } from "@template/contracts";
import { parseUsdtAmount } from "../../core/financial/money.js";
import { calculateWithdrawalPolicy } from "./withdrawal-policy.js";

const policy = {
  minimumGrossUnits: 16000000n,
  maximumGrossUnits: 500000000n,
  freeFeeBps: 2100,
  version: 1,
};
const now = new Date("2026-10-08T09:00:00Z");
const wallet = {
  availableNonReferralUnits: 70000000n,
  availableReferralUnits: 30000000n,
};
const paid = {
  id: "subscription",
  packageVersion: 2,
  withdrawalFeeBps: 1000,
  state: "CURRENT",
  activationAt: new Date("2026-10-01T00:00:00Z"),
  expiresAt: new Date("2026-10-09T00:00:00Z"),
};

describe("withdrawal quote policy", () => {
  it.each(["16", "500"])(
    "accepts inclusive gross %s and conserves fee/net exactly",
    (gross) => {
      const result = calculateWithdrawalPolicy(
        gross,
        policy,
        wallet,
        null,
        now,
      );
      expect(result.gross).toBe(parseUsdtAmount(gross));
      expect(result.fee + result.net).toBe(result.gross);
      expect(result.fee).toBe((result.gross * 2100n) / 10000n);
    },
  );
  it.each(["15.999999", "500.000001", "1e2", "100.0", "01", "-1", "0"])(
    "rejects unsupported gross %s",
    (gross) => {
      expect(() =>
        calculateWithdrawalPolicy(gross, policy, wallet, null, now),
      ).toThrow();
    },
  );
  it("floors fees at one micro and rejects a zero-net policy", () => {
    const wide = {
      ...policy,
      minimumGrossUnits: 1n,
      maximumGrossUnits: parseUsdtAmount(MAX_USDT_AMOUNT),
    };
    expect(
      calculateWithdrawalPolicy("0.000001", wide, wallet, null, now),
    ).toMatchObject({ fee: 0n, net: 1n });
    const maximum = calculateWithdrawalPolicy(
      MAX_USDT_AMOUNT,
      wide,
      wallet,
      null,
      now,
    );
    expect(maximum.fee + maximum.net).toBe(maximum.gross);
    expect(() =>
      calculateWithdrawalPolicy(
        "100",
        { ...policy, freeFeeBps: 10000 },
        wallet,
        null,
        now,
      ),
    ).toThrow();
  });
  it("uses the saved paid rate and non-referral-first funding until exclusive expiry", () => {
    expect(
      calculateWithdrawalPolicy("80", policy, wallet, paid, now),
    ).toMatchObject({
      feeBps: 1000,
      fee: 8000000n,
      nonReferral: 70000000n,
      referral: 10000000n,
      topUp: 0n,
      paid: true,
    });
    expect(
      calculateWithdrawalPolicy("80", policy, wallet, paid, paid.expiresAt),
    ).toMatchObject({
      feeBps: 2100,
      eligibleReferral: 0n,
      referral: 0n,
      topUp: 10000000n,
      paid: false,
    });
    expect(
      calculateWithdrawalPolicy("80", policy, wallet, null, now),
    ).toMatchObject({ nonReferral: 70000000n, referral: 0n, topUp: 10000000n });
  });
});
