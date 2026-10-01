import { describe, expect, it } from "vitest";
import {
  calculateRemainingWithdrawalTime,
  computeExtendedDueAt,
  formatBaghdadDateTime,
} from "./time.utils";

describe("time.utils", () => {
  describe("formatBaghdadDateTime", () => {
    it("formats UTC ISO timestamps into Baghdad local time (UTC+03:00)", () => {
      // 2026-10-01T10:00:00Z -> in Baghdad (UTC+3) is 13:00
      const utcIso = "2026-10-01T10:00:00Z";
      const formatted = formatBaghdadDateTime(utcIso);
      expect(formatted).toBe("2026-10-01 13:00");
    });

    it("formats timezone-explicit Baghdad timestamps (+03:00) correctly", () => {
      const baghdadIso = "2026-10-01T14:30:00+03:00";
      const formatted = formatBaghdadDateTime(baghdadIso);
      expect(formatted).toBe("2026-10-01 14:30");
    });

    it("handles invalid date strings gracefully without throwing", () => {
      expect(formatBaghdadDateTime("invalid-date-string")).toBe("invalid-date-string");
    });
  });

  describe("calculateRemainingWithdrawalTime", () => {
    it("returns formatted remaining hours and minutes for future deadlines", () => {
      const currentMs = new Date("2026-10-01T10:00:00Z").getTime();
      // 40 hours and 30 minutes in the future
      const dueAtMs = currentMs + (40 * 60 + 30) * 60 * 1000;
      const dueAtIso = new Date(dueAtMs).toISOString();

      const result = calculateRemainingWithdrawalTime(dueAtIso, currentMs);
      expect(result.isDue).toBe(false);
      expect(result.remainingHours).toBe(40);
      expect(result.remainingMinutes).toBe(30);
      expect(result.text).toBe("40 ساعة و30 دقيقة");
    });

    it("returns 'حان موعد المعالجة' and 0 remaining time when deadline is reached or past", () => {
      const currentMs = new Date("2026-10-01T10:00:00Z").getTime();

      // Exactly at deadline
      const exactlyDueIso = new Date(currentMs).toISOString();
      const resExact = calculateRemainingWithdrawalTime(exactlyDueIso, currentMs);
      expect(resExact.isDue).toBe(true);
      expect(resExact.text).toBe("حان موعد المعالجة");
      expect(resExact.remainingHours).toBe(0);
      expect(resExact.remainingMinutes).toBe(0);
      expect(resExact.remainingMs).toBe(0);

      // Past deadline (e.g. 5 hours ago)
      const pastDueIso = new Date(currentMs - 5 * 3600 * 1000).toISOString();
      const resPast = calculateRemainingWithdrawalTime(pastDueIso, currentMs);
      expect(resPast.isDue).toBe(true);
      expect(resPast.text).toBe("حان موعد المعالجة");
      expect(resPast.remainingHours).toBe(0);
      expect(resPast.remainingMinutes).toBe(0);
      expect(resPast.remainingMs).toBe(0); // Never negative!
    });

    it("handles invalid timestamps gracefully", () => {
      const res = calculateRemainingWithdrawalTime("invalid-timestamp", Date.now());
      expect(res.text).toBe("—");
      expect(res.isDue).toBe(false);
      expect(res.remainingHours).toBe(0);
    });
  });

  describe("computeExtendedDueAt", () => {
    it("adds additional hours to the CURRENT dueAt timestamp", () => {
      const initialDueAt = "2026-10-04T10:00:00.000Z";
      const initialMs = new Date(initialDueAt).getTime();

      // Extend by 12 hours
      const ext1 = computeExtendedDueAt(initialDueAt, 12);
      expect(ext1.valid).toBe(true);
      if (!ext1.valid) return;
      expect(ext1.newDueAtMs).toBe(initialMs + 12 * 3600 * 1000);

      // Extend again by another 6 hours from newDueAt
      const ext2 = computeExtendedDueAt(ext1.newDueAtIso, 6);
      expect(ext2.valid).toBe(true);
      if (!ext2.valid) return;
      expect(ext2.newDueAtMs).toBe(initialMs + (12 + 6) * 3600 * 1000);
    });

    it("rejects non-positive, zero, fractional, or invalid values", () => {
      const validDueAt = "2026-10-04T10:00:00.000Z";
      expect(computeExtendedDueAt(validDueAt, 0).valid).toBe(false);
      expect(computeExtendedDueAt(validDueAt, -5).valid).toBe(false);
      expect(computeExtendedDueAt(validDueAt, 2.5).valid).toBe(false);
      expect(computeExtendedDueAt(validDueAt, NaN).valid).toBe(false);
    });
  });
});
