import { describe, expect, it } from "vitest";

import { PACKAGES } from "./fixtures/package.fixtures";
import {
  calculateExpectedTotalIncome,
  getWithdrawalAmounts,
} from "./utils/financial-calculations";

describe("employee financial calculations", () => {
  it("preserves the five approved paid positions and their full-term income", () => {
    const positions = PACKAGES.filter((pkg) => pkg.id !== "FREE").map(
      (pkg) => ({
        id: pkg.id,
        name: pkg.name,
        price: pkg.price,
        dailyReward: pkg.dailyReward,
        days: pkg.durationDays,
        cycle: pkg.cycle,
        expectedIncome: calculateExpectedTotalIncome(
          pkg.dailyReward,
          pkg.durationDays,
        ),
      }),
    );
    expect(positions).toEqual([
      {
        id: "S1",
        name: "منصب S1",
        price: 60,
        dailyReward: 2,
        days: 365,
        cycle: "يومي",
        expectedIncome: 730,
      },
      {
        id: "S2",
        name: "منصب S2",
        price: 120,
        dailyReward: 4,
        days: 365,
        cycle: "يومي",
        expectedIncome: 1460,
      },
      {
        id: "O1",
        name: "منصب O1",
        price: 600,
        dailyReward: 16,
        days: 365,
        cycle: "يومي",
        expectedIncome: 5840,
      },
      {
        id: "O2",
        name: "منصب O2",
        price: 1200,
        dailyReward: 38,
        days: 365,
        cycle: "يومي",
        expectedIncome: 13870,
      },
      {
        id: "A1",
        name: "منصب A1",
        price: 2600,
        dailyReward: 67,
        days: 365,
        cycle: "يومي",
        expectedIncome: 24455,
      },
    ]);
  });

  it.each([
    [100, { fee: 21, netAmount: 79 }],
    [99.99, { fee: 21, netAmount: 78.99 }],
  ])(
    "rounds the withdrawal fee and net amount for %s USDT",
    (amount, expected) => {
      expect(getWithdrawalAmounts(amount)).toEqual(expected);
    },
  );
});
