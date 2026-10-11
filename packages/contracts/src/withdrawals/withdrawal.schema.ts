import { z } from "zod";
import { employeeFinancialIdentitySchema } from "../account/account.schema.ts";
import {
  tronNetworkSchema,
  tronPublicAddressSchema,
} from "../deposits/deposit.schema.ts";
import {
  basisPointsSchema,
  canonicalAmountUnits as units,
  financialInstantSchema,
  financialRequestKeySchema,
  positiveCountedHoursSchema,
  positiveUsdtAmountSchema,
  sourceAllocationSchema,
  usdtAmountSchema,
} from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  financialPageSchema,
  safePageOffset,
} from "../http/http.schema.ts";
import { confirmedReasonShape } from "../identity/identity.schema.ts";
import {
  configurationVersionSchema,
  expectedConfigurationVersionSchema,
} from "../packages/package.schema.ts";
import { fundedAllocationSchema } from "../subscriptions/subscription.schema.ts";

export const withdrawalStateSchema = z.enum([
  "SCHEDULED",
  "SIGNING",
  "SIGNED",
  "SUBMITTED",
  "UNKNOWN",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "FAILED",
]);
export const withdrawalSettlementTermsSchema = z
  .object({
    withdrawalId: z.uuid(),
    attemptId: z.uuid(),
    network: tronNetworkSchema,
    tokenContract: tronPublicAddressSchema,
    source: tronPublicAddressSchema,
    recipient: tronPublicAddressSchema,
    addressVersion: configurationVersionSchema,
    gross: positiveUsdtAmountSchema,
    feeBps: basisPointsSchema,
    fee: usdtAmountSchema,
    net: positiveUsdtAmountSchema,
    sourceAllocation: sourceAllocationSchema,
    transactionId: z.string().regex(/^[0-9a-f]{64}$/u),
    blockId: z.string().regex(/^[0-9a-f]{64}$/u),
    blockNumber: z.string().regex(/^(?:0|[1-9][0-9]{0,15})$/u),
  })
  .strict()
  .refine(
    (terms) =>
      validMoney(terms) && terms.sourceAllocation.gross === terms.gross,
    "Settlement must consume original gross terms.",
  );
export const withdrawalRequestKeySchema = financialRequestKeySchema;
export const withdrawalDestinationBodySchema = z
  .object({ address: tronPublicAddressSchema })
  .strict();
export const withdrawalResendBodySchema = z
  .object({ expectedVersion: expectedConfigurationVersionSchema })
  .strict();
export const withdrawalConsumeBodySchema = z
  .object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/u) })
  .strict();
export const withdrawalQuoteBodySchema = z
  .object({ gross: positiveUsdtAmountSchema })
  .strict();
export const withdrawalAcceptBodySchema = z
  .object({ quoteId: z.uuid(), confirmed: z.literal(true) })
  .strict();
export const withdrawalExtensionBodySchema = z
  .object({
    expectedVersion: expectedConfigurationVersionSchema,
    countedHours: positiveCountedHoursSchema,
    ...confirmedReasonShape,
  })
  .strict();
export const withdrawalRejectionBodySchema = z
  .object({
    expectedVersion: expectedConfigurationVersionSchema,
    ...confirmedReasonShape,
  })
  .strict();
export const withdrawalParamsSchema = z
  .object({ withdrawalId: z.uuid() })
  .strict();
export const withdrawalQuoteParamsSchema = z
  .object({ quoteId: z.uuid() })
  .strict();

const serverNowShape = { serverNow: financialInstantSchema };
export const withdrawalDestinationSchema = z.discriminatedUnion("state", [
  z.object({ state: z.literal("UNSET"), ...serverNowShape }).strict(),
  z
    .object({
      state: z.literal("PENDING"),
      ...serverNowShape,
      network: tronNetworkSchema,
      address: tronPublicAddressSchema,
      version: configurationVersionSchema,
      issuedAt: financialInstantSchema,
      expiresAt: financialInstantSchema,
      nextIssuanceAt: financialInstantSchema,
      proofStatus: z.enum(["PENDING", "EXPIRED"]),
      deliveryStatus: z.enum([
        "NOT_ATTEMPTED",
        "UNKNOWN",
        "ACKNOWLEDGED",
        "REJECTED",
      ]),
    })
    .strict()
    .refine(
      (proof) =>
        proof.issuedAt < proof.expiresAt &&
        proof.issuedAt < proof.nextIssuanceAt &&
        (proof.proofStatus === "EXPIRED") ===
          proof.serverNow >= proof.expiresAt,
      "Proof dates and status must agree.",
    ),
  z
    .object({
      state: z.literal("CONFIRMED"),
      ...serverNowShape,
      network: tronNetworkSchema,
      address: tronPublicAddressSchema,
      addressVersion: configurationVersionSchema,
      confirmedAt: financialInstantSchema,
    })
    .strict(),
]);
const calendarShape = {
  zone: z.literal("Asia/Baghdad"),
  countedHours: z.literal("72"),
  excludedWeekdays: z.tuple([z.literal(6), z.literal(7)]),
};
export const withdrawalCalendarSchema = z.object(calendarShape).strict();
const moneyShape = {
  gross: positiveUsdtAmountSchema,
  feeBps: basisPointsSchema,
  fee: usdtAmountSchema,
  net: positiveUsdtAmountSchema,
};
const validMoney = (
  amounts: z.infer<z.ZodObject<typeof moneyShape>>,
): boolean => {
  if (
    !basisPointsSchema.safeParse(amounts.feeBps).success ||
    ![amounts.gross, amounts.fee, amounts.net].every(
      (amount) => usdtAmountSchema.safeParse(amount).success,
    )
  )
    return false;
  return (
    units(amounts.fee) ===
      (units(amounts.gross) * BigInt(amounts.feeBps)) / 10000n &&
    units(amounts.fee) + units(amounts.net) === units(amounts.gross)
  );
};
const eligibilityShape = {
  effectiveMembership: z.enum(["FREE", "PAID"]),
  subscriptionId: z.uuid().nullable(),
  subscriptionVersion: configurationVersionSchema.nullable(),
  subscriptionExpiresAt: financialInstantSchema.nullable(),
  feeBasis: z.enum(["FREE_POLICY", "SUBSCRIPTION"]),
  policyVersion: configurationVersionSchema,
};
const validEligibility = (
  eligibility: z.infer<z.ZodObject<typeof eligibilityShape>>,
): boolean =>
  eligibility.effectiveMembership === "PAID"
    ? eligibility.feeBasis === "SUBSCRIPTION" &&
      eligibility.subscriptionId !== null &&
      eligibility.subscriptionVersion !== null &&
      eligibility.subscriptionExpiresAt !== null
    : eligibility.feeBasis === "FREE_POLICY" &&
      eligibility.subscriptionId === null &&
      eligibility.subscriptionVersion === null &&
      eligibility.subscriptionExpiresAt === null;
const recipientShape = {
  network: tronNetworkSchema,
  recipient: tronPublicAddressSchema,
  addressVersion: configurationVersionSchema,
};
const withdrawalQuoteFieldsSchema = z
  .object({
    quoteId: z.uuid(),
    quotedAt: financialInstantSchema,
    quoteExpiresAt: financialInstantSchema,
    ...serverNowShape,
    ...moneyShape,
    ...eligibilityShape,
    ...recipientShape,
    minimumGross: positiveUsdtAmountSchema,
    maximumGross: positiveUsdtAmountSchema,
    eligibleNonReferral: usdtAmountSchema,
    eligibleReferral: usdtAmountSchema,
    fundedAllocation: fundedAllocationSchema,
    requiredTopUp: usdtAmountSchema,
    canAccept: z.boolean(),
    blockReason: z
      .enum(["INSUFFICIENT_FUNDS", "WITHDRAWAL_BLOCKED", "WITHDRAWAL_ACTIVE"])
      .nullable(),
    preview: z
      .object({
        dueAt: financialInstantSchema,
        dispatchAt: financialInstantSchema,
        calendar: withdrawalCalendarSchema,
      })
      .strict(),
  })
  .strict();

type QuoteFacts = z.infer<typeof withdrawalQuoteFieldsSchema>;
const validQuoteAmounts = (quote: QuoteFacts): boolean =>
  validMoney(quote) &&
  [
    quote.minimumGross,
    quote.maximumGross,
    quote.eligibleNonReferral,
    quote.eligibleReferral,
    quote.requiredTopUp,
  ].every((amount) => usdtAmountSchema.safeParse(amount).success) &&
  fundedAllocationSchema.safeParse(quote.fundedAllocation).success;

const validQuoteFunding = (quote: QuoteFacts): boolean => {
  const gross = units(quote.gross),
    available = units(quote.eligibleNonReferral);
  const nonReferral = gross < available ? gross : available;
  const remainder = gross - nonReferral;
  const eligibleReferral = units(quote.eligibleReferral);
  const referral = remainder < eligibleReferral ? remainder : eligibleReferral;
  return (
    units(quote.fundedAllocation.nonReferral) === nonReferral &&
    units(quote.fundedAllocation.referral) === referral &&
    units(quote.fundedAllocation.total) + units(quote.requiredTopUp) ===
      gross &&
    (quote.effectiveMembership !== "FREE" || quote.eligibleReferral === "0")
  );
};

const validQuoteAcceptance = (quote: QuoteFacts): boolean =>
  quote.canAccept === (quote.blockReason === null) &&
  (!quote.canAccept || quote.requiredTopUp === "0") &&
  (quote.requiredTopUp === "0" || quote.blockReason !== null) &&
  (quote.blockReason !== "INSUFFICIENT_FUNDS" || quote.requiredTopUp !== "0");

const validQuoteTiming = (quote: QuoteFacts): boolean => {
  const ttl =
    new Date(quote.quoteExpiresAt).getTime() -
    new Date(quote.quotedAt).getTime();
  return (
    ttl >= 60000 &&
    ttl <= 3600000 &&
    quote.quotedAt <= quote.serverNow &&
    quote.preview.dueAt >= quote.quotedAt &&
    quote.preview.dueAt <= quote.preview.dispatchAt &&
    (quote.effectiveMembership !== "PAID" ||
      (quote.subscriptionExpiresAt !== null &&
        quote.quotedAt < quote.subscriptionExpiresAt))
  );
};

export const withdrawalQuoteSchema = withdrawalQuoteFieldsSchema.refine(
  (quote) =>
    validQuoteAmounts(quote) &&
    validEligibility(quote) &&
    units(quote.gross) >= units(quote.minimumGross) &&
    units(quote.gross) <= units(quote.maximumGross) &&
    validQuoteFunding(quote) &&
    validQuoteAcceptance(quote) &&
    validQuoteTiming(quote),
  "Quote money, sources, eligibility and lifetime must agree.",
);

// Read countdowns include zero and truncate display hours; command hours are positive.
export const remainingCountedMillisecondsSchema = z
  .string()
  .refine(
    (milliseconds) =>
      /^(?:0|[1-9][0-9]{0,14})$/u.test(milliseconds) &&
      BigInt(milliseconds) <= 315537897599999n,
    "Unsupported countdown range.",
  );
export const remainingCountedHoursSchema = z
  .string()
  .max(16)
  .regex(/^(?:0|[1-9][0-9]*)(?:\.[0-9]{0,5}[1-9])?$/u);
export const withdrawalCountdownSchema = z
  .object({
    remainingCountedMilliseconds: remainingCountedMillisecondsSchema,
    remainingCountedHours: remainingCountedHoursSchema,
  })
  .strict()
  .refine((countdown) => {
    if (
      !remainingCountedMillisecondsSchema.safeParse(
        countdown.remainingCountedMilliseconds,
      ).success ||
      !remainingCountedHoursSchema.safeParse(countdown.remainingCountedHours)
        .success
    )
      return false;
    return (
      units(countdown.remainingCountedHours) ===
      (BigInt(countdown.remainingCountedMilliseconds) * 1000000n) / 3600000n
    );
  }, "Countdown display must truncate the exact duration.");
export const withdrawalActionSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum([
      "ACCEPT",
      "EXTEND",
      "REJECT",
      "RESTRICTION_CANCEL",
      "FUTURE_DESTINATION_CANCEL",
      "CLAIM",
      "SIGNED",
      "BROADCAST_ADMISSION",
      "OBSERVE",
      "COMPLETE",
      "SAFE_FAIL",
    ]),
    occurredAt: financialInstantSchema,
    actorUserId: z.uuid().nullable(),
    reason: z.string().trim().min(1).max(500).nullable(),
    committedVersion: configurationVersionSchema,
    dueAt: financialInstantSchema,
    scheduleVersion: configurationVersionSchema,
  })
  .strict();
const withdrawalRequestFieldsSchema = z
  .object({
    id: z.uuid(),
    quoteId: z.uuid(),
    acceptedAt: financialInstantSchema,
    version: configurationVersionSchema,
    scheduleVersion: configurationVersionSchema,
    state: withdrawalStateSchema,
    ...moneyShape,
    ...eligibilityShape,
    ...recipientShape,
    sourceAllocation: sourceAllocationSchema,
    calendar: withdrawalCalendarSchema,
    originalDueAt: financialInstantSchema,
    dueAt: financialInstantSchema,
    dispatchAt: financialInstantSchema,
    ...serverNowShape,
    remainingCountedMilliseconds: remainingCountedMillisecondsSchema,
    remainingCountedHours: remainingCountedHoursSchema,
    actions: z.array(withdrawalActionSchema).max(100),
    transactionId: z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .nullable()
      .default(null),
    blocker: z
      .enum([
        "LIQUIDITY_SHORTFALL",
        "RESOURCE_SHORTFALL",
        "PROVIDER_UNAVAILABLE",
        "TREASURY_BUSY",
        "RECOVERY_UNAVAILABLE",
        "EVIDENCE_CONFLICT",
        "DISPATCH_PAUSED",
      ])
      .nullable()
      .default(null),
    settlement: withdrawalSettlementTermsSchema.nullable().default(null),
    finalizedAt: financialInstantSchema.nullable(),
    release: z
      .object({
        gross: positiveUsdtAmountSchema,
        sourceAllocation: sourceAllocationSchema,
        chargedFee: z.literal("0"),
        releasedAt: financialInstantSchema,
      })
      .strict()
      .nullable(),
  })
  .strict();
type RequestFacts = z.infer<typeof withdrawalRequestFieldsSchema>;

const validRequestRelease = (request: RequestFacts): boolean => {
  const needsRelease = ["REJECTED", "CANCELLED", "FAILED"].includes(
    request.state,
  );
  if (needsRelease !== (request.release !== null)) return false;
  if (request.release === null) return true;
  const released = request.release;
  return (
    released.gross === request.gross &&
    released.releasedAt === request.finalizedAt &&
    released.sourceAllocation.nonReferral ===
      request.sourceAllocation.nonReferral &&
    released.sourceAllocation.referral === request.sourceAllocation.referral &&
    released.sourceAllocation.gross === request.gross
  );
};

const validRequestTiming = (request: RequestFacts): boolean =>
  request.acceptedAt <= request.originalDueAt &&
  request.originalDueAt <= request.dueAt &&
  request.dueAt <= request.dispatchAt &&
  withdrawalCountdownSchema.safeParse({
    remainingCountedMilliseconds: request.remainingCountedMilliseconds,
    remainingCountedHours: request.remainingCountedHours,
  }).success &&
  ["COMPLETED", "REJECTED", "CANCELLED", "FAILED"].includes(request.state) ===
    (request.finalizedAt !== null);
const validRequestSettlement = (request: RequestFacts): boolean => {
  const terms = request.settlement;
  if (request.state !== "COMPLETED") return terms === null;
  return (
    terms !== null &&
    terms.withdrawalId === request.id &&
    terms.transactionId === request.transactionId &&
    terms.network === request.network &&
    terms.recipient === request.recipient &&
    terms.addressVersion === request.addressVersion &&
    terms.gross === request.gross &&
    terms.feeBps === request.feeBps &&
    terms.fee === request.fee &&
    terms.net === request.net &&
    terms.sourceAllocation.nonReferral ===
      request.sourceAllocation.nonReferral &&
    terms.sourceAllocation.referral === request.sourceAllocation.referral
  );
};

export const withdrawalRequestSchema = withdrawalRequestFieldsSchema.refine(
  (request) =>
    validMoney(request) &&
    validEligibility(request) &&
    request.gross === request.sourceAllocation.gross &&
    validRequestRelease(request) &&
    validRequestSettlement(request) &&
    validRequestTiming(request),
  "Saved request facts must agree.",
);
export const withdrawalCommandResultSchema = z
  .object({ withdrawal: withdrawalRequestSchema, replayed: z.boolean() })
  .strict();
export const withdrawalHistorySchema = financialPageSchema(
  withdrawalRequestSchema,
);
export const adminWithdrawalRequestSchema = withdrawalRequestSchema
  .safeExtend({
    employee: employeeFinancialIdentitySchema,
    canExtend: z.boolean(),
    canReject: z.boolean(),
  })
  .refine(
    (request) =>
      (!request.canExtend && !request.canReject) ||
      (request.state === "SCHEDULED" &&
        request.version < 2147483647 &&
        request.scheduleVersion < 2147483647),
    "Only supported safely scheduled requests offer actions.",
  );
export const adminWithdrawalHistorySchema = financialPageSchema(
  adminWithdrawalRequestSchema,
);
export const adminWithdrawalActionOutcomeQuerySchema = z
  .object({
    kind: z.enum(["EXTEND", "REJECT"]),
    requestKey: financialRequestKeySchema,
    expectedVersion: z.union([
      expectedConfigurationVersionSchema,
      z
        .string()
        .regex(/^[1-9]\d{0,9}$/u)
        .transform(Number)
        .pipe(expectedConfigurationVersionSchema),
    ]),
  })
  .strict();
const observedAdminActionSchema = z
  .object({
    id: z.uuid(),
    kind: z.enum(["EXTEND", "REJECT"]),
    actorUserId: z.uuid(),
    occurredAt: financialInstantSchema,
    reason: z.string().trim().min(1).max(500),
    expectedVersion: expectedConfigurationVersionSchema,
    committedVersion: configurationVersionSchema,
    beforeDueAt: financialInstantSchema,
    afterDueAt: financialInstantSchema,
    beforeScheduleVersion: configurationVersionSchema,
    afterScheduleVersion: configurationVersionSchema,
  })
  .strict();
const adminOutcomeShape = {
  kind: z.enum(["EXTEND", "REJECT"]),
  requestKey: financialRequestKeySchema,
  withdrawalId: z.uuid(),
  expectedVersion: expectedConfigurationVersionSchema,
  ...serverNowShape,
  withdrawal: adminWithdrawalRequestSchema,
};
export const adminWithdrawalActionOutcomeSchema = z
  .discriminatedUnion("status", [
    z
      .object({
        ...adminOutcomeShape,
        status: z.literal("COMMITTED"),
        action: observedAdminActionSchema,
      })
      .strict(),
    z
      .object({ ...adminOutcomeShape, status: z.literal("NOT_OBSERVED") })
      .strict(),
    z
      .object({ ...adminOutcomeShape, status: z.literal("SUPERSEDED") })
      .strict(),
  ])
  .refine((outcome) => {
    if (
      outcome.withdrawalId !== outcome.withdrawal.id ||
      outcome.serverNow !== outcome.withdrawal.serverNow
    )
      return false;
    if (outcome.status === "NOT_OBSERVED")
      return outcome.withdrawal.version === outcome.expectedVersion;
    if (outcome.status === "SUPERSEDED")
      return outcome.withdrawal.version > outcome.expectedVersion;
    const action = outcome.action;
    return (
      action.kind === outcome.kind &&
      action.expectedVersion === outcome.expectedVersion &&
      action.committedVersion === action.expectedVersion + 1 &&
      action.committedVersion <= outcome.withdrawal.version &&
      action.occurredAt <= outcome.serverNow &&
      action.beforeDueAt <= action.afterDueAt &&
      action.afterDueAt <= outcome.withdrawal.dueAt &&
      action.afterScheduleVersion <= outcome.withdrawal.scheduleVersion &&
      (action.kind === "EXTEND"
        ? action.afterScheduleVersion === action.beforeScheduleVersion + 1 &&
          action.afterDueAt > action.beforeDueAt
        : action.afterScheduleVersion === action.beforeScheduleVersion &&
          action.afterDueAt === action.beforeDueAt)
    );
  }, "Observed action identity and saved versions must agree.");
export const withdrawalFilterSchema = z
  .object({ ...boundedPageQueryShape, state: withdrawalStateSchema.optional() })
  .strict()
  .refine(safePageOffset, "Invalid page offset.");
export const adminWithdrawalFilterSchema = z
  .object({
    ...boundedPageQueryShape,
    state: withdrawalStateSchema.optional(),
    employeeId: z.uuid().optional(),
    from: financialInstantSchema.optional(),
    to: financialInstantSchema.optional(),
    q: boundedSearchSchema.optional(),
  })
  .strict()
  .refine(
    (filter) =>
      safePageOffset(filter) &&
      (filter.from === undefined ||
        filter.to === undefined ||
        filter.from <= filter.to),
    "Invalid page or date range.",
  );
export const withdrawalQuoteOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("COMMITTED"),
      quoteId: z.uuid(),
      withdrawal: withdrawalRequestSchema,
      ...serverNowShape,
    })
    .strict()
    .refine(
      (outcome) => outcome.quoteId === outcome.withdrawal.quoteId,
      "Quote identity must agree.",
    ),
  z
    .object({
      status: z.literal("NOT_OBSERVED"),
      quoteId: z.uuid(),
      quote: withdrawalQuoteSchema,
      ...serverNowShape,
    })
    .strict()
    .refine(
      (outcome) =>
        outcome.quoteId === outcome.quote.quoteId &&
        outcome.serverNow < outcome.quote.quoteExpiresAt,
      "Live quote identity and time must agree.",
    ),
  z
    .object({
      status: z.literal("EXPIRED_UNCOMMITTED"),
      quoteId: z.uuid(),
      quote: withdrawalQuoteSchema,
      ...serverNowShape,
    })
    .strict()
    .refine(
      (outcome) =>
        outcome.quoteId === outcome.quote.quoteId &&
        outcome.serverNow >= outcome.quote.quoteExpiresAt,
      "Expired quote identity and time must agree.",
    ),
]);
export const withdrawalStatusSchema = z
  .object({
    ...serverNowShape,
    withdrawalExecutionReady: z.boolean(),
    network: tronNetworkSchema.nullable(),
    destination: withdrawalDestinationSchema,
    activeWithdrawal: withdrawalRequestSchema.nullable(),
    withdrawalsBlocked: z.boolean(),
  })
  .strict();

export type WithdrawalDestination = z.infer<typeof withdrawalDestinationSchema>;
export type WithdrawalQuote = z.infer<typeof withdrawalQuoteSchema>;
export type WithdrawalRequest = z.infer<typeof withdrawalRequestSchema>;
export type WithdrawalCommandResult = z.infer<
  typeof withdrawalCommandResultSchema
>;
export type WithdrawalFilter = z.infer<typeof withdrawalFilterSchema>;
export type AdminWithdrawalFilter = z.infer<typeof adminWithdrawalFilterSchema>;
