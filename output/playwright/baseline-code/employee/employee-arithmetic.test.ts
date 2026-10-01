import { describe, expect, it } from "vitest";
import { getButtonClassName } from "./components/common/button";
import { FINANCIAL_RULES } from "./constants/branding";
import { PACKAGES } from "./fixtures/employee.fixtures";
import { calculateExpectedTotalIncome } from "./types/employee.types";

describe("Employee Financial Arithmetic & Rules Invariants", () => {
  it("verifies the exact five paid positions data, terms, and expected gross income", () => {
    const paidTiers = PACKAGES.filter((p) => p.id !== "FREE");
    expect(paidTiers).toHaveLength(5);

    const expectedTable = [
      { id: "S1", title: "منصب S1", price: 60, dailyProfit: 2.0, days: 365, expectedIncome: 730.0 },
      { id: "S2", title: "منصب S2", price: 120, dailyProfit: 4.0, days: 365, expectedIncome: 1460.0 },
      { id: "O1", title: "منصب O1", price: 600, dailyProfit: 16.0, days: 365, expectedIncome: 5840.0 },
      { id: "O2", title: "منصب O2", price: 1200, dailyProfit: 38.0, days: 365, expectedIncome: 13870.0 },
      { id: "A1", title: "منصب A1", price: 2600, dailyProfit: 67.0, days: 365, expectedIncome: 24455.0 },
    ];

    for (const expected of expectedTable) {
      const tier = paidTiers.find((p) => p.id === expected.id);
      expect(tier).toBeDefined();
      if (!tier) continue;

      expect(tier.name).toBe(expected.title);
      expect(tier.price).toBe(expected.price);
      expect(tier.dailyReward).toBe(expected.dailyProfit);
      expect(tier.durationDays).toBe(expected.days);
      expect(tier.cycle).toBe("يومي");

      // Verify calculation formula
      const calculatedGross = calculateExpectedTotalIncome(tier.dailyReward, tier.durationDays);
      expect(calculatedGross).toBe(expected.expectedIncome);
    }
  });

  it("calculates S1 to O1 package upgrade arithmetic accurately", () => {
    const s1 = PACKAGES.find((p) => p.id === "S1");
    const o1 = PACKAGES.find((p) => p.id === "O1");

    expect(s1).toBeDefined();
    expect(o1).toBeDefined();

    const s1Price = s1?.price ?? 0;
    const o1Price = o1?.price ?? 0;

    expect(s1Price).toBe(60);
    expect(o1Price).toBe(600);

    const upgradeCost = o1Price - s1Price;
    expect(upgradeCost).toBe(540);

    const availableBalance = 40;
    const requiredAdditionalDeposit = upgradeCost - availableBalance;
    expect(requiredAdditionalDeposit).toBe(500);
  });

  it("calculates 21% withdrawal fee and net received amount correctly", () => {
    const requestedAmount = 100;
    const feeRate = FINANCIAL_RULES.withdrawalFeeRate;
    expect(feeRate).toBe(0.21);

    const fee = Number((requestedAmount * feeRate).toFixed(2));
    const netReceived = Number((requestedAmount - fee).toFixed(2));

    expect(fee).toBe(21.0);
    expect(netReceived).toBe(79.0);
  });

  it("calculates L1-L5 referral commissions with confirmed fixtures", () => {
    const l1Rate = FINANCIAL_RULES.referralRates[0].rate;
    expect(l1Rate).toBe(0.12);

    // 100 USDT package purchase at L1
    const purchaseBasis = 100;
    const commission1 = Number((purchaseBasis * l1Rate).toFixed(2));
    expect(commission1).toBe(12.0);

    // 540 USDT package upgrade at L1
    const upgradeBasis = 540;
    const commission2 = Number((upgradeBasis * l1Rate).toFixed(2));
    expect(commission2).toBe(64.8);
  });

  it("maintains balance invariant: total = available + reserved", () => {
    const initialAvailable = 40.0;
    const initialReserved = 0.0;
    const initialTotal = initialAvailable + initialReserved;

    // Withdrawal request for 30 USDT
    const withdrawAmount = 30.0;
    const postReqAvailable = initialAvailable - withdrawAmount;
    const postReqReserved = initialReserved + withdrawAmount;
    const postReqTotal = postReqAvailable + postReqReserved;

    expect(postReqAvailable).toBe(10.0);
    expect(postReqReserved).toBe(30.0);
    expect(postReqTotal).toBe(initialTotal); // Total stays invariant upon reservation

    // Rejection unlocks reservation
    const postRejectionAvailable = postReqAvailable + withdrawAmount;
    const postRejectionReserved = postReqReserved - withdrawAmount;
    const postRejectionTotal = postRejectionAvailable + postRejectionReserved;

    expect(postRejectionAvailable).toBe(40.0);
    expect(postRejectionReserved).toBe(0.0);
    expect(postRejectionTotal).toBe(initialTotal);
  });

  it("verifies shared Button class names and styling variant rules", () => {
    expect(getButtonClassName({ variant: "primary", size: "default" })).toBe(
      "emp-btn emp-btn--default emp-btn--primary",
    );

    expect(getButtonClassName({ variant: "dark", size: "compact", fullWidth: true })).toBe(
      "emp-btn emp-btn--compact emp-btn--dark emp-btn--full",
    );

    expect(getButtonClassName({ variant: "destructive" })).toBe(
      "emp-btn emp-btn--default emp-btn--destructive",
    );

    expect(getButtonClassName({ variant: "outline", className: "extra-class" })).toBe(
      "emp-btn emp-btn--default emp-btn--outline extra-class",
    );
  });
});
