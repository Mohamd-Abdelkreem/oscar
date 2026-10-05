import { describe, expect, it } from "vitest";

import {
  basisPointsSchema,
  aggregateUsdtAmountSchema,
  signedAggregateUsdtDeltaSchema,
  businessDateSchema,
  countedHoursToMilliseconds,
  financialInstantSchema,
  financialOperationResultSchema,
  financialRequestKeySchema,
  fundSourceSchema,
  positiveCountedHoursSchema,
  positiveUsdtAmountSchema,
  signedUsdtDeltaSchema,
  sourceAllocationSchema,
  usdtAmountSchema,
  walletComponentsSchema,
} from "./financial.schema.ts";

const maximum = "9223372036854.775807";
describe("nonspendable aggregate money", () => {
  it("preserves totals above int64 and the 38-digit micro-unit boundary", () => {
    for (const amount of [
      "18446744073709.551614",
      "99999999999999999999999999999999.999999",
    ]) {
      expect(aggregateUsdtAmountSchema.parse(amount)).toBe(amount);
      expect(signedAggregateUsdtDeltaSchema.parse(`-${amount}`)).toBe(
        `-${amount}`,
      );
      expect(usdtAmountSchema.safeParse(amount).success).toBe(false);
      expect(
        sourceAllocationSchema.safeParse({
          referral: amount,
          nonReferral: "0",
          gross: amount,
        }).success,
      ).toBe(false);
    }
  });
  it.each([
    "100000000000000000000000000000000",
    "-0",
    "1.0",
    "01",
    "1e20",
    "0.0000001",
    1,
    null,
  ])("rejects invalid aggregate %s", (amount) => {
    expect(aggregateUsdtAmountSchema.safeParse(amount).success).toBe(false);
    expect(signedAggregateUsdtDeltaSchema.safeParse(amount).success).toBe(
      false,
    );
  });
});
const wallet = {
  availableReferral: "1",
  reservedReferral: "0.000001",
  availableNonReferral: "2",
  reservedNonReferral: "3",
  total: "6.000001",
};
const allocation = { nonReferral: "2", referral: "1", gross: "3" };
const operation = {
  operationId: "bc9a7f7b-6a34-44d0-bcb0-76f4f75a05c7",
  walletId: "d0520a42-3015-451c-bfa8-7939bb747a69",
  recordedAt: "2026-10-02T12:00:00.000Z",
  amount: "3",
  walletAfter: wallet,
};
const reservation = {
  id: "496e9556-b0bf-4ea9-9446-fb73c9e81b0c",
  allocation,
};

describe("exact financial wire amounts", () => {
  it.each(["0", "1", "1.000001", "0.000001", "1.23", maximum])(
    "preserves canonical amount %s as a JSON string",
    (amount) => {
      expect(usdtAmountSchema.parse(amount)).toBe(amount);
      expect(JSON.stringify(usdtAmountSchema.parse(amount))).toBe(
        JSON.stringify(amount),
      );
    },
  );

  it.each([
    "",
    " 1",
    "1 ",
    "1\n",
    "01",
    "00",
    "1.0",
    "1.2300",
    "0.000000",
    "1.",
    ".1",
    "+1",
    "-1",
    "-0",
    "1e3",
    "1,000",
    "0.0000001",
    "9223372036854.775808",
    "9223372036855",
    "9".repeat(500),
    "١",
    1,
    0.1,
    1n,
    null,
  ])("rejects noncanonical, numeric or unrepresentable amount %s", (amount) => {
    expect(usdtAmountSchema.safeParse(amount).success).toBe(false);
  });

  it("keeps positive commands distinct from zero results and signed movements", () => {
    expect(positiveUsdtAmountSchema.safeParse("0").success).toBe(false);
    expect(positiveUsdtAmountSchema.parse("0.000001")).toBe("0.000001");
    for (const delta of ["0", maximum, `-${maximum}`, "-0.000001"]) {
      expect(signedUsdtDeltaSchema.parse(delta)).toBe(delta);
    }
    for (const delta of [
      "-0",
      "-0.0",
      "+1",
      "-1.00",
      "-9223372036854.775808",
    ]) {
      expect(signedUsdtDeltaSchema.safeParse(delta).success).toBe(false);
    }
  });

  it("accepts only integer basis points within the full percentage range", () => {
    for (const rate of [0, 200, 400, 600, 1200, 2100, 10000]) {
      expect(basisPointsSchema.parse(rate)).toBe(rate);
    }
    for (const rate of [-1, 10001, 0.5, "2100", NaN, Infinity]) {
      expect(basisPointsSchema.safeParse(rate).success).toBe(false);
    }
  });
});

describe("financial dates, instants and identities", () => {
  it("accepts real Gregorian dates including early years and century leap rules", () => {
    for (const date of [
      "0001-01-01",
      "0099-12-31",
      "2000-02-29",
      "2024-02-29",
      "9999-12-31",
    ]) {
      expect(businessDateSchema.parse(date)).toBe(date);
    }
    for (const date of [
      "0000-01-01",
      "1900-02-29",
      "2023-02-29",
      "2026-04-31",
      "2026-13-01",
      "2026-1-01",
      "2026-01-01T00:00:00Z",
    ]) {
      expect(businessDateSchema.safeParse(date).success).toBe(false);
    }
  });

  it.each([
    ["2026-10-02T15:00:00+03:00", "2026-10-02T12:00:00.000Z"],
    ["2026-10-02T12:00:00.1Z", "2026-10-02T12:00:00.100Z"],
    ["2026-10-02T12:00:00.12Z", "2026-10-02T12:00:00.120Z"],
    ["2026-10-02T12:00:00.123Z", "2026-10-02T12:00:00.123Z"],
    ["0001-01-01T03:00:00+03:00", "0001-01-01T00:00:00.000Z"],
  ])("normalizes supported explicit-offset instant %s", (instant, utc) => {
    expect(financialInstantSchema.parse(instant)).toBe(utc);
  });

  it.each([
    "2026-10-02T12:00:00",
    "2026-02-30T12:00:00Z",
    "2026-10-02T24:00:00Z",
    "2026-10-02T12:00:00.1234Z",
    "2026-10-02T12:00:00+24:00",
    "2026-10-02T12:00:60Z",
    "0000-01-01T00:00:00Z",
    "0001-01-01T00:00:00+03:00",
    "9999-12-31T23:00:00-03:00",
  ])(
    "rejects invalid precision, dates or out-of-range UTC instant %s",
    (instant) => {
      expect(financialInstantSchema.safeParse(instant).success).toBe(false);
    },
  );

  it("bounds opaque request keys without coercion and allowlists fund sources", () => {
    for (const key of ["a", "A0._:-", "a".repeat(128)])
      expect(financialRequestKeySchema.parse(key)).toBe(key);
    for (const key of ["", "a".repeat(129), " key", "key\n", "كود", 123]) {
      expect(financialRequestKeySchema.safeParse(key).success).toBe(false);
    }
    expect(fundSourceSchema.parse("REFERRAL")).toBe("REFERRAL");
    expect(fundSourceSchema.parse("NON_REFERRAL")).toBe("NON_REFERRAL");
    expect(fundSourceSchema.safeParse("DEPOSIT").success).toBe(false);
  });
});

describe("exact counted-hour extension boundary", () => {
  it.each([
    ["1", 3600000n],
    ["1.5", 5400000n],
    ["0001.5000", 5400000n],
    ["0.0000025", 9n],
    ["0.000002500000", 9n],
    ["99999999.9999975", 359999999999991n],
    [`${"0".repeat(10000)}1.5${"0".repeat(10000)}`, 5400000n],
  ])(
    "preserves valid spelling and converts %s exactly",
    (hours, milliseconds) => {
      expect(positiveCountedHoursSchema.parse(hours)).toBe(hours);
      expect(countedHoursToMilliseconds(hours)).toBe(milliseconds);
      expect(
        JSON.parse(JSON.stringify(positiveCountedHoursSchema.parse(hours))),
      ).toBe(hours);
    },
  );

  it.each([
    "0",
    "00.000",
    "0.0000001",
    "0.000001",
    "0.00000001",
    "100000000",
    "-1",
    "+1",
    " 1",
    "1\n",
    "1e3",
    "1,000",
    ".5",
    "1.",
    "1.2.3",
    "١",
    1.5,
    1n,
    null,
  ])("rejects malformed, nonpositive or inexact duration %s", (hours) => {
    expect(positiveCountedHoursSchema.safeParse(hours).success).toBe(false);
    expect(() => countedHoursToMilliseconds(hours)).toThrow();
  });
});

describe("strict JSON-safe financial projections", () => {
  it("requires exact bounded source sums without defaulting missing amounts", () => {
    expect(walletComponentsSchema.parse(wallet)).toEqual(wallet);
    expect(sourceAllocationSchema.parse(allocation)).toEqual(allocation);
    for (const invalidWallet of [
      { ...wallet, total: "6" },
      { ...wallet, availableReferral: maximum, total: maximum },
      { ...wallet, availableReferral: undefined },
      { ...wallet, total: 6.000001 },
    ])
      expect(walletComponentsSchema.safeParse(invalidWallet).success).toBe(
        false,
      );
    for (const invalidAllocation of [
      { ...allocation, gross: "2" },
      { nonReferral: "0", referral: "0", gross: "0" },
      { ...allocation, referral: maximum, gross: maximum },
    ])
      expect(sourceAllocationSchema.safeParse(invalidAllocation).success).toBe(
        false,
      );
  });

  it.each([
    "actor",
    "role",
    "eligibility",
    "fee",
    "reward",
    "deadline",
    "privateKey",
    "intentHash",
    "audit",
  ])(
    "rejects unsupported authority/private field %s at every projection level",
    (field) => {
      expect(
        walletComponentsSchema.safeParse({ ...wallet, [field]: "forged" })
          .success,
      ).toBe(false);
      expect(
        sourceAllocationSchema.safeParse({ ...allocation, [field]: "forged" })
          .success,
      ).toBe(false);
      expect(
        financialOperationResultSchema.safeParse({
          ...operation,
          kind: "CREDIT",
          [field]: "forged",
        }).success,
      ).toBe(false);
    },
  );

  it.each(["CREDIT", "PURCHASE_DEBIT", "CORRECTION", "RESERVE", "RELEASE"])(
    "requires the exact result shape for %s",
    (kind) => {
      const hasReservation = kind === "RESERVE" || kind === "RELEASE";
      const projection = {
        ...operation,
        kind,
        ...(hasReservation
          ? {
              reservation: {
                ...reservation,
                state: kind === "RESERVE" ? "ACTIVE" : "RELEASED",
              },
            }
          : {}),
      };
      const parsed = financialOperationResultSchema.parse(projection);
      expect(JSON.parse(JSON.stringify(parsed))).toEqual(projection);
      expect(
        financialOperationResultSchema.safeParse({
          ...projection,
          kind: "UNKNOWN",
        }).success,
      ).toBe(false);
      const wrongReservation = {
        ...reservation,
        state: kind === "RESERVE" ? "RELEASED" : "ACTIVE",
      };
      expect(
        financialOperationResultSchema.safeParse({
          ...projection,
          reservation: wrongReservation,
        }).success,
      ).toBe(false);
      if (hasReservation) {
        expect(
          financialOperationResultSchema.safeParse({ ...operation, kind })
            .success,
        ).toBe(false);
        expect(
          financialOperationResultSchema.safeParse({
            ...projection,
            amount: "2",
          }).success,
        ).toBe(false);
        expect(
          financialOperationResultSchema.safeParse({
            ...projection,
            reservation: { ...projection.reservation, privateKey: "secret" },
          }).success,
        ).toBe(false);
      }
    },
  );
});
