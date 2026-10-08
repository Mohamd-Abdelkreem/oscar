export const BAGHDAD_TIMEZONE = "Asia/Baghdad";

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
