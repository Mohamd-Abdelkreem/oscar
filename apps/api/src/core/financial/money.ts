import {
  basisPointsSchema,
  MAX_USDT_AMOUNT,
  signedUsdtDeltaSchema,
  usdtAmountSchema,
} from "@template/contracts";

const MICRO_UNITS_PER_USDT = 1000000n;

const decimalUnits = (amount: string): bigint => {
  const [integer = "", fraction = ""] = amount.split(".");
  return (
    BigInt(integer) * MICRO_UNITS_PER_USDT + BigInt(fraction.padEnd(6, "0"))
  );
};

const MAX_MICRO_UNITS = decimalUnits(MAX_USDT_AMOUNT);

const boundedUnits = (units: bigint): bigint => {
  if (units < 0n || units > MAX_MICRO_UNITS)
    throw new RangeError("USDT units exceed supported bounds.");
  return units;
};

export const parseUsdtAmount = (amount: unknown): bigint => {
  const parsed = usdtAmountSchema.safeParse(amount);
  if (!parsed.success) throw new RangeError("Invalid USDT amount.");
  return decimalUnits(parsed.data);
};

export const parseSignedUsdtDelta = (delta: unknown): bigint => {
  const parsed = signedUsdtDeltaSchema.safeParse(delta);
  if (!parsed.success) throw new RangeError("Invalid signed USDT movement.");
  return parsed.data.startsWith("-")
    ? -decimalUnits(parsed.data.slice(1))
    : decimalUnits(parsed.data);
};

export const formatUsdtAmount = (units: bigint): string => {
  boundedUnits(units);
  const integer = units / MICRO_UNITS_PER_USDT;
  const fraction = (units % MICRO_UNITS_PER_USDT)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/u, "");
  return fraction.length === 0
    ? integer.toString()
    : `${integer.toString()}.${fraction}`;
};

export const formatSignedUsdtDelta = (units: bigint): string =>
  units < 0n ? `-${formatUsdtAmount(-units)}` : formatUsdtAmount(units);

export const addUnits = (first: bigint, second: bigint): bigint =>
  boundedUnits(boundedUnits(first) + boundedUnits(second));

export const subtractUnits = (balance: bigint, magnitude: bigint): bigint =>
  boundedUnits(boundedUnits(balance) - boundedUnits(magnitude));

export const totalUnits = (components: readonly bigint[]): bigint =>
  components.reduce((total, component) => addUnits(total, component), 0n);

export const percentageUnits = (units: bigint, basisPoints: number): bigint => {
  boundedUnits(units);
  const rate = basisPointsSchema.safeParse(basisPoints);
  if (!rate.success) throw new RangeError("Invalid basis-point rate.");
  return (units * BigInt(rate.data)) / 10000n;
};

export const feeAndNetUnits = (
  gross: bigint,
  basisPoints: number,
): {
  gross: bigint;
  fee: bigint;
  net: bigint;
} => {
  const fee = percentageUnits(gross, basisPoints);
  return { gross, fee, net: subtractUnits(gross, fee) };
};
