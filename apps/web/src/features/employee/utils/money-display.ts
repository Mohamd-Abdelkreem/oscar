import {
  signedAggregateUsdtDeltaSchema,
  aggregateUsdtAmountSchema,
} from "@template/contracts";

function amountUnits(amount: string): bigint {
  const [integer = "0", fraction = ""] = amount.split(".");
  return BigInt(integer) * 1000000n + BigInt(fraction.padEnd(6, "0"));
}
export function sumAmounts(...amounts: string[]): string {
  const units = amounts.reduce(
    (sum, amount) => sum + amountUnits(aggregateUsdtAmountSchema.parse(amount)),
    0n,
  );
  const fraction = (units % 1000000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/u, "");
  return aggregateUsdtAmountSchema.parse(
    `${(units / 1000000n).toString()}${fraction ? `.${fraction}` : ""}`,
  );
}

export function formatMoney(amount: string, showSign = false): string {
  const parsed = signedAggregateUsdtDeltaSchema.safeParse(amount);
  if (!parsed.success) throw new Error("Invalid canonical money amount.");
  const negative = amount.startsWith("-");
  const [integer = "", fraction = ""] = (
    negative ? amount.slice(1) : amount
  ).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/gu, ",");
  const sign = negative ? "-" : showSign && amount !== "0" ? "+" : "";
  return `${sign}${grouped}.${fraction.padEnd(2, "0")}`;
}
