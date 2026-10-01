/**
 * Pure utilities for Baghdad timezone formatting and withdrawal countdown calculation.
 * Product timezone: Asia/Baghdad (UTC+03:00)
 */

export const BAGHDAD_TIMEZONE = "Asia/Baghdad";
export const BAGHDAD_OFFSET_HOURS = 3;

/**
 * Format an ISO string or date into a readable Baghdad date-time string (YYYY-MM-DD HH:mm).
 */
export function formatBaghdadDateTime(isoOrDateString: string): string {
  try {
    const date = new Date(isoOrDateString);
    if (isNaN(date.getTime())) {
      return isoOrDateString;
    }

    // Format using standard Intl with Asia/Baghdad timezone
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: BAGHDAD_TIMEZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const year = parts.find((p) => p.type === "year")?.value ?? "2026";
    const month = parts.find((p) => p.type === "month")?.value ?? "01";
    const day = parts.find((p) => p.type === "day")?.value ?? "01";
    const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
    const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return isoOrDateString;
  }
}

export interface RemainingTimeResult {
  readonly text: string;
  readonly isDue: boolean;
  readonly remainingHours: number;
  readonly remainingMinutes: number;
  readonly remainingMs: number;
}

/**
 * Calculate the remaining time until a withdrawal's deadline.
 * Computed from max(0, dueAtMs - currentTimestampMs).
 * Never returns negative duration.
 */
export function calculateRemainingWithdrawalTime(
  dueAtIso: string,
  currentTimestampMs: number,
): RemainingTimeResult {
  const dueAtMs = new Date(dueAtIso).getTime();

  if (isNaN(dueAtMs)) {
    return {
      text: "—",
      isDue: false,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingMs: 0,
    };
  }

  const diffMs = Math.max(0, dueAtMs - currentTimestampMs);

  if (diffMs === 0) {
    return {
      text: "حان موعد المعالجة",
      isDue: true,
      remainingHours: 0,
      remainingMinutes: 0,
      remainingMs: 0,
    };
  }

  const totalMinutes = Math.floor(diffMs / (60 * 1000));
  const remainingHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  let text = "";
  if (remainingHours > 0 && remainingMinutes > 0) {
    text = `${String(remainingHours)} ساعة و${String(remainingMinutes)} دقيقة`;
  } else if (remainingHours > 0) {
    text = `${String(remainingHours)} ساعة`;
  } else {
    text = `${String(remainingMinutes)} دقيقة`;
  }

  return {
    text,
    isDue: false,
    remainingHours,
    remainingMinutes,
    remainingMs: diffMs,
  };
}

/**
 * Compute new dueAt timestamp when extending schedule.
 * newDueAt = CURRENT dueAt + additionalHours * 60 * 60 * 1000
 */
export function computeExtendedDueAt(
  currentDueAtIso: string,
  additionalHours: number,
):
  | { valid: true; newDueAtIso: string; newDueAtMs: number }
  | { valid: false; error: string } {
  if (
    !Number.isInteger(additionalHours) ||
    additionalHours <= 0 ||
    !Number.isFinite(additionalHours)
  ) {
    return {
      valid: false,
      error:
        "عدد الساعات الإضافية يجب أن يكون رقماً صحيحاً موجباً أكبر من الصفر.",
    };
  }

  const currentMs = new Date(currentDueAtIso).getTime();
  if (isNaN(currentMs)) {
    return { valid: false, error: "تاريخ الاستحقاق الحالي غير صالح." };
  }

  const addedMs = additionalHours * 60 * 60 * 1000;
  const newDueAtMs = currentMs + addedMs;
  const newDueAtIso = new Date(newDueAtMs).toISOString();

  return {
    valid: true,
    newDueAtIso,
    newDueAtMs,
  };
}
