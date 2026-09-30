import { describe, expect, it } from "vitest";

import {
  assertNoPrismaDecimal,
  isPrismaDecimal,
  serializeDecimalsDeep,
  serializeDecimalToString,
} from "./decimal.js";

class FakeDecimal {
  constructor(private readonly raw: string) {}
  toString(): string {
    return this.raw;
  }
}
class OtherClass {
  readonly value = 1;
}

describe("generic Decimal serialization", () => {
  it("serializes canonically without money rounding", () => {
    expect(serializeDecimalToString(new FakeDecimal("1.00500"))).toBe("1.005");
    expect(serializeDecimalToString("-0.000")).toBe("0");
  });
  it("walks arrays and plain objects while preserving nullish/primitives/Date", () => {
    const date = new Date("2026-08-18T00:00:00.000Z");
    expect(
      serializeDecimalsDeep({
        amount: new FakeDecimal("10.500"),
        nested: [null, undefined, 1, "x", date],
      }),
    ).toEqual({
      amount: "10.5",
      nested: [null, undefined, 1, "x", date],
    });
  });
  it("does not turn unrelated class instances into empty objects", () => {
    const instance = new OtherClass();
    expect(serializeDecimalsDeep(instance)).toBe(instance);
  });
  it("detects and rejects leaked Decimal values", () => {
    expect(isPrismaDecimal(new FakeDecimal("1.2"))).toBe(true);
    expect(isPrismaDecimal("1.2")).toBe(false);
    expect(() => {
      assertNoPrismaDecimal({ values: [new FakeDecimal("1.2")] });
    }).toThrow(/values\[0\]/u);
    expect(() => {
      assertNoPrismaDecimal({ value: null });
    }).not.toThrow();
  });
});
