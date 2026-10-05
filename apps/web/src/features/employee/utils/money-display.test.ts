import { describe, expect, it } from "vitest";
import { formatMoney, sumAmounts } from "./money-display";

describe("exact money display", () => {
  it.each([
    ["0", false, "0.00"],
    ["64.8", true, "+64.80"],
    ["-1.000001", true, "-1.000001"],
    [
      "12345678901234567890123456789012.123456",
      false,
      "12,345,678,901,234,567,890,123,456,789,012.123456",
    ],
  ])("preserves %s without rounding", (amount, signed, expected) => {
    expect(formatMoney(amount, signed)).toBe(expected);
  });
  it.each(["-0", "1.00", "1e3", "1.0000001", "NaN"])(
    "rejects noncanonical %s",
    (amount) => {
      expect(() => formatMoney(amount)).toThrow();
    },
  );
});

it("sums source components exactly across fractional carry and values beyond float precision", () => {
  expect(sumAmounts("9999999999999999999999999999999.999999", "0.000001")).toBe(
    "10000000000000000000000000000000",
  );
  expect(sumAmounts("0.1", "0.2")).toBe("0.3");
  expect(() => sumAmounts("-1")).toThrow();
});
