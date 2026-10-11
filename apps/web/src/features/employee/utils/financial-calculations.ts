export function roundMoney(amount: number): number {
  return Number(amount.toFixed(2));
}

export function calculateExpectedTotalIncome(
  dailyReward: number,
  durationDays: number,
): number {
  return roundMoney(dailyReward * durationDays);
}

export function formatLocalTime(date: Date): string {
  return `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
}
