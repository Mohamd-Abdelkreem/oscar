import { describe, expect, it } from "vitest";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";

describe("withdrawal counted deadlines", () => {
  const clock = new BusinessClock(() => new Date("2026-10-08T09:00:00Z"));
  it.each([
    ["2026-10-09T09:00:00Z", "2026-10-14T09:00:00Z"],
    ["2026-10-10T09:00:00Z", "2026-10-14T21:00:00Z"],
    ["2026-10-11T09:00:00Z", "2026-10-14T21:00:00Z"],
  ])("counts 72 weekday hours from %s", (accepted, due) => {
    expect(clock.initialWithdrawalDeadline(accepted)).toBe(
      new Date(due).toISOString(),
    );
    expect(clock.remainingCountedMilliseconds(accepted, due)).toBe(259200000n);
  });
  it("keeps a Saturday cutoff due distinct from Monday dispatch", () => {
    const due = clock.initialWithdrawalDeadline("2026-10-06T21:00:00Z");
    expect(due).toBe("2026-10-09T21:00:00.000Z");
    expect(clock.normalizeNewDispatch(due)).toBe("2026-10-11T21:00:00.000Z");
    expect(
      clock.remainingCountedMilliseconds(due, "2026-10-11T21:00:00Z"),
    ).toBe(0n);
  });
  it("extends the existing deadline by exact fractional hours across a weekend", () => {
    const original = "2026-10-09T20:30:00Z";
    const extended = clock.extendDeadline(original, "0.500005");
    expect(extended).toBe("2026-10-11T21:00:00.018Z");
    expect(clock.remainingCountedMilliseconds(original, extended)).toBe(
      1800018n,
    );
    expect(clock.extendDeadline(extended, "0.25")).toBe(
      "2026-10-11T21:15:00.018Z",
    );
  });
  it("uses explicit instants independently of the host zone and rejects unrepresentable durations", () => {
    expect(clock.initialWithdrawalDeadline("2026-10-09T12:00:00+03:00")).toBe(
      "2026-10-14T09:00:00.000Z",
    );
    for (const hours of ["0", "-1", "0.0000001", "1e3"])
      expect(() =>
        clock.extendDeadline("2026-10-08T09:00:00Z", hours),
      ).toThrow();
    expect(() => clock.extendDeadline("9999-12-31T20:59:59Z", "72")).toThrow();
  });
});
