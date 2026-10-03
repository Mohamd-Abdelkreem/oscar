import { z } from "zod";

export const MAX_USDT_AMOUNT = "9223372036854.775807";
const MAX_MICRO_UNITS = 9223372036854775807n;
const MICRO_UNITS_PER_USDT = 1000000n;
const CANONICAL_AMOUNT = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{0,5}[1-9])?$/u;

const canonicalAmountUnits = (amount: string): bigint => {
  const [integer = "", fraction = ""] = amount.split(".");
  return (
    BigInt(integer) * MICRO_UNITS_PER_USDT + BigInt(fraction.padEnd(6, "0"))
  );
};

const validUnsignedAmount = (amount: string): boolean =>
  amount.length <= 20 &&
  CANONICAL_AMOUNT.test(amount) &&
  canonicalAmountUnits(amount) <= MAX_MICRO_UNITS;

export const usdtAmountSchema = z
  .string()
  .refine(validUnsignedAmount, "Invalid USDT amount.");
export const positiveUsdtAmountSchema = usdtAmountSchema.refine(
  (amount) => amount !== "0",
  "USDT amount must be positive.",
);
export const signedUsdtDeltaSchema = z.string().refine((delta) => {
  if (delta.length > 21) return false;
  if (!delta.startsWith("-")) return validUnsignedAmount(delta);
  const magnitude = delta.slice(1);
  return magnitude !== "0" && validUnsignedAmount(magnitude);
}, "Invalid signed USDT movement.");
export const basisPointsSchema = z.number().int().min(0).max(10000);
export const fundSourceSchema = z.enum(["NON_REFERRAL", "REFERRAL"]);
export const businessDateSchema = z.iso
  .date()
  .refine((date) => !date.startsWith("0000"), "Unsupported business year.");

const supportedUtcInstant = (instant: string): boolean => {
  const date = new Date(instant);
  return (
    Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() >= 1 &&
    date.getUTCFullYear() <= 9999
  );
};
export const financialInstantSchema = z.iso
  .datetime({ offset: true })
  .refine(
    (instant) => !instant.startsWith("0000") && !/\.[0-9]{4}/u.test(instant),
    "Unsupported instant precision or year.",
  )
  .refine(supportedUtcInstant, "Unsupported UTC instant.")
  .transform((instant) => new Date(instant).toISOString());
export const financialRequestKeySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9._:-]+$/u);

type HourDigits = {
  decimalIndex: number;
  integerStart: number;
  fractionEnd: number;
};

const scanHourDigits = (hours: string): HourDigits => {
  let decimalIndex = hours.length;
  let integerStart = -1;
  let fractionEnd = -1;
  for (let index = 0; index < hours.length; index += 1) {
    const character = hours.charCodeAt(index);
    if (
      character === 46 &&
      decimalIndex === hours.length &&
      index > 0 &&
      index < hours.length - 1
    ) {
      decimalIndex = index;
    } else if (character < 48 || character > 57) {
      throw new RangeError("Invalid counted-hour decimal.");
    } else if (character !== 48) {
      if (index < decimalIndex && integerStart === -1) integerStart = index;
      if (index > decimalIndex) fractionEnd = index;
    }
  }
  if (hours.length === 0) throw new RangeError("Invalid counted-hour decimal.");
  return { decimalIndex, integerStart, fractionEnd };
};

const normalizedHourCoefficient = (
  hours: string,
): { coefficient: bigint; scale: number } => {
  const { decimalIndex, integerStart, fractionEnd } = scanHourDigits(hours);
  const integerLength = integerStart === -1 ? 0 : decimalIndex - integerStart;
  const scale = fractionEnd === -1 ? 0 : fractionEnd - decimalIndex;
  if (integerLength > 8 || scale > 7)
    throw new RangeError("Unsupported counted-hour range or precision.");
  // Only bounded significant text reaches BigInt; redundant raw zeros remain unrestricted.
  const integer =
    integerStart === -1 ? "0" : hours.slice(integerStart, decimalIndex);
  const fraction =
    scale === 0 ? "" : hours.slice(decimalIndex + 1, fractionEnd + 1);
  return { coefficient: BigInt(integer + fraction), scale };
};

export const countedHoursToMilliseconds = (hours: unknown): bigint => {
  if (typeof hours !== "string")
    throw new RangeError("Counted hours must be a decimal string.");
  const { coefficient, scale } = normalizedHourCoefficient(hours);
  const numerator = coefficient * 3600000n;
  const denominator = 10n ** BigInt(scale);
  if (numerator <= 0n || numerator % denominator !== 0n) {
    throw new RangeError(
      "Counted hours must represent positive whole milliseconds.",
    );
  }
  return numerator / denominator;
};

export const positiveCountedHoursSchema = z.string().refine((hours) => {
  try {
    countedHoursToMilliseconds(hours);
    return true;
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}, "Invalid counted-hour duration.");

export const walletComponentsSchema = z
  .object({
    availableReferral: usdtAmountSchema,
    reservedReferral: usdtAmountSchema,
    availableNonReferral: usdtAmountSchema,
    reservedNonReferral: usdtAmountSchema,
    total: usdtAmountSchema,
  })
  .strict()
  .refine((wallet) => {
    if (
      ![
        wallet.availableReferral,
        wallet.reservedReferral,
        wallet.availableNonReferral,
        wallet.reservedNonReferral,
        wallet.total,
      ].every(validUnsignedAmount)
    )
      return false;
    return (
      canonicalAmountUnits(wallet.availableReferral) +
        canonicalAmountUnits(wallet.reservedReferral) +
        canonicalAmountUnits(wallet.availableNonReferral) +
        canonicalAmountUnits(wallet.reservedNonReferral) ===
      canonicalAmountUnits(wallet.total)
    );
  }, "Wallet components must equal total ownership.");

export const sourceAllocationSchema = z
  .object({
    nonReferral: usdtAmountSchema,
    referral: usdtAmountSchema,
    gross: positiveUsdtAmountSchema,
  })
  .strict()
  .refine((allocation) => {
    if (
      ![allocation.nonReferral, allocation.referral, allocation.gross].every(
        validUnsignedAmount,
      )
    )
      return false;
    return (
      canonicalAmountUnits(allocation.nonReferral) +
        canonicalAmountUnits(allocation.referral) ===
      canonicalAmountUnits(allocation.gross)
    );
  }, "Source allocation must equal gross.");

const operationFields = {
  operationId: z.uuid(),
  walletId: z.uuid(),
  recordedAt: financialInstantSchema,
  amount: positiveUsdtAmountSchema,
  walletAfter: walletComponentsSchema,
};
const reservationFields = { id: z.uuid(), allocation: sourceAllocationSchema };

export const financialOperationResultSchema = z
  .discriminatedUnion("kind", [
    z.object({ ...operationFields, kind: z.literal("CREDIT") }).strict(),
    z
      .object({ ...operationFields, kind: z.literal("PURCHASE_DEBIT") })
      .strict(),
    z.object({ ...operationFields, kind: z.literal("CORRECTION") }).strict(),
    z
      .object({
        ...operationFields,
        kind: z.literal("RESERVE"),
        reservation: z
          .object({ ...reservationFields, state: z.literal("ACTIVE") })
          .strict(),
      })
      .strict(),
    z
      .object({
        ...operationFields,
        kind: z.literal("RELEASE"),
        reservation: z
          .object({ ...reservationFields, state: z.literal("RELEASED") })
          .strict(),
      })
      .strict(),
  ])
  .refine(
    (operation) =>
      (operation.kind !== "RESERVE" && operation.kind !== "RELEASE") ||
      operation.amount === operation.reservation.allocation.gross,
    "Reservation magnitude must equal gross.",
  );

export type UsdtAmount = z.infer<typeof usdtAmountSchema>;
export type PositiveUsdtAmount = z.infer<typeof positiveUsdtAmountSchema>;
export type SignedUsdtDelta = z.infer<typeof signedUsdtDeltaSchema>;
export type BasisPoints = z.infer<typeof basisPointsSchema>;
export type FundSource = z.infer<typeof fundSourceSchema>;
export type BusinessDate = z.infer<typeof businessDateSchema>;
export type FinancialInstant = z.infer<typeof financialInstantSchema>;
export type FinancialRequestKey = z.infer<typeof financialRequestKeySchema>;
export type PositiveCountedHours = z.infer<typeof positiveCountedHoursSchema>;
export type WalletComponents = z.infer<typeof walletComponentsSchema>;
export type SourceAllocation = z.infer<typeof sourceAllocationSchema>;
export type FinancialOperationResult = z.infer<
  typeof financialOperationResultSchema
>;
