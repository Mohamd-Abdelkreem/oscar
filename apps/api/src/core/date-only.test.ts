import { describe, expect, it } from "vitest";

import {
  isDateOnlyString,
  parseDateOnly,
  serializeDateOnly,
  serializeNullableDateOnly,
} from "./date-only.js";

describe("date-only values", () => {
  it("validates real YYYY-MM-DD calendar dates", () => {
    expect(isDateOnlyString("2024-02-29")).toBe(true);
    expect(isDateOnlyString("2026-02-29")).toBe(false);
    expect(isDateOnlyString("2026-2-09")).toBe(false);
  });
  it("round-trips in UTC without timezone shifts", () => {
    const date = parseDateOnly("2026-08-18");
    expect(serializeDateOnly(date)).toBe("2026-08-18");
    expect(serializeNullableDateOnly(date)).toBe("2026-08-18");
    expect(serializeNullableDateOnly(null)).toBeNull();
  });
  it("rejects impossible dates and invalid Date values", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow();
    expect(() => serializeDateOnly(new Date(Number.NaN))).toThrow();
  });
});
