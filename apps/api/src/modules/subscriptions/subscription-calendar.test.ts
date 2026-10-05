import { describe, expect, it, vi } from "vitest";
import type { Package } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { mapPackageTerms } from "../packages/packages.mapper.js";

const configured: Package = {
  code: "S1",
  tierOrder: 1,
  version: 1,
  priceUnits: 60000000n,
  dailyRewardUnits: 2000000n,
  countedWorkDates: 365,
  withdrawalFeeBps: 2100,
  updatedAt: new Date("2026-10-05T09:00:00Z"),
  updatedByUserId: null,
};
const calendar = new BusinessClock(() => new Date("2026-10-05T09:00:00Z"));

describe("accepted package calendar terms", () => {
  it.each([
    [
      "2026-10-05T17:59:59.999+03:00",
      365,
      "2026-10-05",
      "2028-02-25",
      "2028-02-25T21:00:00.000Z",
    ],
    [
      "2026-10-05T18:00:00+03:00",
      365,
      "2026-10-06",
      "2028-02-28",
      "2028-02-28T21:00:00.000Z",
    ],
    [
      "2026-10-05T18:00:00.001+03:00",
      365,
      "2026-10-06",
      "2028-02-28",
      "2028-02-28T21:00:00.000Z",
    ],
    [
      "2026-10-02T17:59:59.999+03:00",
      1,
      "2026-10-02",
      "2026-10-02",
      "2026-10-02T21:00:00.000Z",
    ],
    [
      "2026-10-02T18:00:00+03:00",
      5,
      "2026-10-05",
      "2026-10-09",
      "2026-10-09T21:00:00.000Z",
    ],
    [
      "2026-10-03T12:00:00+03:00",
      6,
      "2026-10-05",
      "2026-10-12",
      "2026-10-12T21:00:00.000Z",
    ],
    [
      "2026-10-04T12:00:00+03:00",
      6,
      "2026-10-05",
      "2026-10-12",
      "2026-10-12T21:00:00.000Z",
    ],
  ])(
    "preserves the disclosed term for %s and %s work dates",
    (activation, duration, first, final, expiry) => {
      const terms = mapPackageTerms({
        ...configured,
        countedWorkDates: duration,
      });
      const term = calendar.subscriptionTerm(
        activation,
        terms.countedWorkDates,
      );
      expect(term).toEqual({
        activationAt: new Date(activation).toISOString(),
        firstWorkDate: first,
        finalWorkDate: final,
        expiresAt: expiry,
      });
      expect(terms.conditionalGross).toBe(String(duration * 2));
      expect(
        calendar.isSubscriptionActive(
          term,
          new Date(Date.parse(expiry) - 1).toISOString(),
        ),
      ).toBe(true);
      expect(calendar.isSubscriptionActive(term, expiry)).toBe(false);
      expect(
        calendar.isSubscriptionActive(
          term,
          new Date(Date.parse(expiry) + 1).toISOString(),
        ),
      ).toBe(false);
    },
  );

  it("keeps the accepted term independent of host zone and task-window eligibility", () => {
    try {
      for (const zone of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        vi.stubEnv("TZ", zone);
        const term = calendar.subscriptionTerm("2026-10-03T09:00:00Z", 1);
        expect(term).toEqual({
          activationAt: "2026-10-03T09:00:00.000Z",
          firstWorkDate: "2026-10-05",
          finalWorkDate: "2026-10-05",
          expiresAt: "2026-10-05T21:00:00.000Z",
        });
        expect(calendar.isSubscriptionActive(term, term.activationAt)).toBe(
          true,
        );
        expect(calendar.isTaskWindowOpen(term.activationAt)).toBe(false);
      }
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("rejects unrepresentable package gross/calendar terms without rounding or clamping", () => {
    expect(
      mapPackageTerms({
        ...configured,
        countedWorkDates: 1,
        dailyRewardUnits: 9223372036854775807n,
      }).conditionalGross,
    ).toBe("9223372036854.775807");
    expect(() =>
      mapPackageTerms({
        ...configured,
        countedWorkDates: 2,
        dailyRewardUnits: 9223372036854775807n,
      }),
    ).toThrow();
    expect(() => calendar.subscriptionTerm("9999-12-31T09:00:00Z", 1)).toThrow(
      RangeError,
    );
    expect(() =>
      calendar.subscriptionTerm("2026-10-05T09:00:00Z", 2147483647),
    ).toThrow(RangeError);
  });
});
