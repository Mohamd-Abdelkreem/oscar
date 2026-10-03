import { describe, expect, it } from "vitest";

import {
  addUnits,
  feeAndNetUnits,
  formatSignedUsdtDelta,
  formatUsdtAmount,
  parseSignedUsdtDelta,
  parseUsdtAmount,
  percentageUnits,
  subtractUnits,
  totalUnits,
} from "./money.js";

const maximumUnits = 9223372036854775807n;

describe("exact micro-USDT arithmetic", () => {
  it.each([
    ["0", 0n],
    ["1", 1000000n],
    ["1.000001", 1000001n],
    ["0.000001", 1n],
    ["9223372036854.775807", maximumUnits],
  ])("round-trips %s without losing a micro-unit", (amount, units) => {
    expect(parseUsdtAmount(amount)).toBe(units);
    expect(formatUsdtAmount(units)).toBe(amount);
    expect(parseSignedUsdtDelta(amount)).toBe(units);
    expect(formatSignedUsdtDelta(units)).toBe(amount);
  });

  it.each([
    ["-0.000001", -1n],
    ["-9223372036854.775807", -maximumUnits],
  ])("preserves signed movement %s", (delta, units) => {
    expect(parseSignedUsdtDelta(delta)).toBe(units);
    expect(formatSignedUsdtDelta(units)).toBe(delta);
  });

  it("rejects malformed inputs and units outside their signed/nonnegative bounds", () => {
    for (const amount of ["1.00", "-1", "9223372036854.775808", 1]) {
      expect(() => parseUsdtAmount(amount)).toThrow();
    }
    expect(() => parseSignedUsdtDelta("-0")).toThrow();
    expect(() => formatUsdtAmount(-1n)).toThrow();
    expect(() => formatUsdtAmount(maximumUnits + 1n)).toThrow();
    expect(() => formatSignedUsdtDelta(-maximumUnits - 1n)).toThrow();
    expect(() => formatSignedUsdtDelta(maximumUnits + 1n)).toThrow();
  });

  it("checks component and aggregate overflow before returning a balance", () => {
    expect(addUnits(maximumUnits - 1n, 1n)).toBe(maximumUnits);
    expect(subtractUnits(1n, 1n)).toBe(0n);
    expect(totalUnits([70000000n, 30000000n, 5n, 1n])).toBe(100000006n);
    expect(() => addUnits(maximumUnits, 1n)).toThrow();
    expect(() => subtractUnits(1n, 2n)).toThrow();
    expect(() => addUnits(-1n, 2n)).toThrow();
    expect(() => subtractUnits(2n, -1n)).toThrow();
    expect(() => totalUnits([maximumUnits, 1n, 0n, 0n])).toThrow();
    expect(() => totalUnits([0n, -1n, 0n, 0n])).toThrow();
  });

  it.each([
    [100000000n, 2100, 21000000n],
    [100000000n, 1200, 12000000n],
    [100000000n, 600, 6000000n],
    [100000000n, 400, 4000000n],
    [100000000n, 200, 2000000n],
    [9n, 1200, 1n],
    [1n, 2100, 0n],
    [maximumUnits, 10000, maximumUnits],
    [maximumUnits, 2100, 1936908127739502919n],
    [maximumUnits, 0, 0n],
    [0n, 10000, 0n],
  ])("floors %s units at %s basis points exactly", (units, rate, expected) => {
    expect(percentageUnits(units, rate)).toBe(expected);
  });

  it("rejects invalid rates and unbounded percentage operands", () => {
    for (const rate of [-1, 0.5, 10001, NaN, Infinity]) {
      expect(() => percentageUnits(1n, rate)).toThrow();
    }
    expect(() => percentageUnits(-1n, 2100)).toThrow();
    expect(() => percentageUnits(maximumUnits + 1n, 2100)).toThrow();
  });

  it.each([
    [100000000n, 2100, 21000000n, 79000000n],
    [1n, 2100, 0n, 1n],
    [1n, 10000, 1n, 0n],
    [maximumUnits, 2100, 1936908127739502919n, 7286463909115272888n],
  ])("conserves gross %s with fee rate %s", (gross, rate, fee, net) => {
    const amounts = feeAndNetUnits(gross, rate);
    expect(amounts).toEqual({ gross, fee, net });
    expect(amounts.fee + amounts.net).toBe(gross);
  });
});
