import { z } from "zod";

import {
  aggregateUsdtAmountSchema,
  canonicalAmountUnits,
  basisPointsSchema,
  financialInstantSchema,
  usdtAmountSchema,
} from "../financial/financial.schema.ts";
import {
  boundedPageQueryShape,
  boundedSearchSchema,
  financialPageSchema,
  nonEmptyBoundedString,
} from "../http/http.schema.ts";
import {
  accountVersionSchema,
  referralCodeSchema,
} from "../identity/identity.schema.ts";
import {
  configurationVersionSchema,
  packageCodeSchema,
  referralRatesSchema,
  safeCountSchema,
} from "../packages/package.schema.ts";
import { validFinancialFilter } from "../wallet/wallet.schema.ts";

export const relativeReferralLevelSchema = z.number().int().min(1).max(5);
const queryLevelSchema = z.preprocess(
  (raw) =>
    typeof raw === "string" && /^[1-5]$/u.test(raw) ? Number(raw) : raw,
  relativeReferralLevelSchema,
);
export const employeeRootIdentitySchema = z
  .object({
    id: z.uuid(),
    fullName: nonEmptyBoundedString(150),
    referralCode: referralCodeSchema,
  })
  .strict();
export const adminRootIdentitySchema = employeeRootIdentitySchema
  .extend({ email: z.email().max(320), joinedAt: financialInstantSchema })
  .strict();
const levelCountSchema = z
  .object({
    level: relativeReferralLevelSchema,
    members: safeCountSchema,
    paidMembers: safeCountSchema,
  })
  .strict()
  .refine(
    (count) => count.paidMembers <= count.members,
    "Paid count cannot exceed members.",
  );
const fiveLevelCountsSchema = z
  .array(levelCountSchema)
  .length(5)
  .refine(
    (counts) => counts.every((count, index) => count.level === index + 1),
    "Counts must contain fixed L1-L5.",
  );
const ownEarnedSchema = z
  .object({
    byLevel: z.tuple([
      aggregateUsdtAmountSchema,
      aggregateUsdtAmountSchema,
      aggregateUsdtAmountSchema,
      aggregateUsdtAmountSchema,
      aggregateUsdtAmountSchema,
    ]),
    total: aggregateUsdtAmountSchema,
  })
  .strict()
  .refine(
    (earnings) =>
      [...earnings.byLevel, earnings.total].every(
        (amount) => aggregateUsdtAmountSchema.safeParse(amount).success,
      ) &&
      earnings.byLevel.reduce(
        (sum, amount) => sum + canonicalAmountUnits(amount),
        0n,
      ) === canonicalAmountUnits(earnings.total),
    "Earned level totals must reconcile.",
  );
const teamSummaryShape = {
  serverNow: financialInstantSchema,
  currentRates: z
    .object({
      version: configurationVersionSchema,
      ratesBps: referralRatesSchema,
    })
    .strict(),
  levelCounts: fiveLevelCountsSchema,
  ownEarned: ownEarnedSchema,
};
export const employeeTeamSummarySchema = z
  .object({ ...teamSummaryShape, root: employeeRootIdentitySchema })
  .strict();
export const adminTeamSummarySchema = z
  .object({
    ...teamSummaryShape,
    root: adminRootIdentitySchema,
    levelCountsScope: z.literal("ROOT_UNFILTERED"),
    deeperDescendantCount: safeCountSchema,
  })
  .strict();
const memberShape = {
  id: z.uuid(),
  fullName: nonEmptyBoundedString(150),
  joinedAt: financialInstantSchema,
  level: relativeReferralLevelSchema,
  packageCode: packageCodeSchema.nullable(),
  viewerEarnedFromMember: aggregateUsdtAmountSchema,
};
export const employeeMemberSchema = z.object(memberShape).strict();
const memberPathStepSchema = z
  .object({ id: z.uuid(), fullName: nonEmptyBoundedString(150) })
  .strict();
export const adminMemberSchema = z
  .object({
    ...memberShape,
    email: z.email().max(320),
    path: z.array(memberPathStepSchema).min(1).max(5),
  })
  .strict()
  .refine(
    (member) =>
      member.path.length === member.level &&
      member.path.at(-1)?.id === member.id &&
      new Set(member.path.map((step) => step.id)).size === member.path.length,
    "Path must describe the relative member level.",
  );
export const employeeMemberFilterSchema = z
  .object({ ...boundedPageQueryShape, level: queryLevelSchema.optional() })
  .strict()
  .refine(validFinancialFilter, "Invalid page.");
export const adminMemberFilterSchema = z
  .object({
    ...boundedPageQueryShape,
    level: queryLevelSchema.optional(),
    q: boundedSearchSchema.optional(),
  })
  .strict()
  .refine(validFinancialFilter, "Invalid page.");
export const rootSearchFilterSchema = z
  .object({ ...boundedPageQueryShape, q: boundedSearchSchema.optional() })
  .strict()
  .refine(validFinancialFilter, "Invalid page.");
export const employeeMemberPageSchema = financialPageSchema(
  employeeMemberSchema,
).safeExtend({
  rootId: z.uuid(),
  memberCountScope: z.literal("FILTERED_MEMBERS"),
  serverNow: financialInstantSchema,
});
export const adminMemberPageSchema = financialPageSchema(
  adminMemberSchema,
).safeExtend({
  rootId: z.uuid(),
  memberCountScope: z.literal("FILTERED_MEMBERS"),
  serverNow: financialInstantSchema,
});
export const rootIdentityPageSchema = financialPageSchema(
  adminRootIdentitySchema,
);
export const referralDecisionSchema = z.enum([
  "AWARDED",
  "ELIGIBLE_ZERO",
  "SKIPPED",
]);
export const referralSkippedReasonSchema = z.enum([
  "FREE",
  "EXPIRED",
  "BANNED",
  "ACCOUNT_UNAVAILABLE",
]);
export const referralZeroReasonSchema = z.enum([
  "ZERO_BASE",
  "ZERO_RATE",
  "FLOORED_ZERO",
]);
const commissionShape = {
  decisionId: z.uuid(),
  purchaseId: z.uuid(),
  occurredAt: financialInstantSchema,
  level: relativeReferralLevelSchema,
  buyer: z
    .object({ id: z.uuid(), fullName: nonEmptyBoundedString(150) })
    .strict(),
  rateBps: basisPointsSchema,
  commissionBase: usdtAmountSchema,
  award: usdtAmountSchema,
};
const eligibleDecisions = [
  z
    .object({ ...commissionShape, decision: z.literal("AWARDED") })
    .strict()
    .refine((award) => award.award !== "0", "Award must be positive."),
  z
    .object({
      ...commissionShape,
      decision: z.literal("ELIGIBLE_ZERO"),
      zeroReason: referralZeroReasonSchema,
    })
    .strict()
    .refine(
      (award) => award.award === "0",
      "Zero decision cannot award funds.",
    ),
] as const;
export const employeeCommissionSchema = z
  .discriminatedUnion("decision", eligibleDecisions)
  .refine(
    validEligibleCommission,
    "Saved award must match its exact event calculation.",
  );
function validEligibleCommission(commission: {
  commissionBase: string;
  rateBps: number;
  award: string;
  decision: string;
  zeroReason?: string | null | undefined;
}): boolean {
  if (
    ![commission.commissionBase, commission.award].every(
      (amount) => usdtAmountSchema.safeParse(amount).success,
    ) ||
    !basisPointsSchema.safeParse(commission.rateBps).success
  )
    return false;
  const base = canonicalAmountUnits(commission.commissionBase);
  const calculated = (base * BigInt(commission.rateBps)) / 10000n;
  if (canonicalAmountUnits(commission.award) !== calculated) return false;
  if (commission.decision === "AWARDED") return calculated > 0n;
  const reason =
    base === 0n
      ? "ZERO_BASE"
      : commission.rateBps === 0
        ? "ZERO_RATE"
        : "FLOORED_ZERO";
  return calculated === 0n && commission.zeroReason === reason;
}
const eligibilitySnapshotSchema = z
  .object({
    status: z.enum([
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "BANNED",
      "DEACTIVATED",
    ]),
    role: z.enum(["USER", "ADMIN"]),
    accountVersion: accountVersionSchema,
    emailVerified: z.boolean(),
    subscriptionId: z.uuid().nullable(),
    expiresAt: financialInstantSchema.nullable(),
  })
  .strict();
export const adminCommissionSchema = z
  .object({
    ...commissionShape,
    decision: referralDecisionSchema,
    zeroReason: referralZeroReasonSchema.nullable(),
    skippedReason: referralSkippedReasonSchema.nullable(),
    eligibility: eligibilitySnapshotSchema,
  })
  .strict()
  .refine(
    (decision) =>
      decision.decision === "AWARDED"
        ? decision.award !== "0" &&
          decision.zeroReason === null &&
          decision.skippedReason === null
        : decision.award === "0" &&
          (decision.decision === "SKIPPED"
            ? decision.skippedReason !== null && decision.zeroReason === null
            : decision.zeroReason !== null && decision.skippedReason === null),
    "Decision and reasons must agree.",
  )
  .refine(
    (commission) =>
      commission.decision === "SKIPPED" || validEligibleCommission(commission),
    "Saved award must match its event calculation.",
  );
const commissionFilterShape = {
  ...boundedPageQueryShape,
  level: queryLevelSchema.optional(),
  from: financialInstantSchema.optional(),
  to: financialInstantSchema.optional(),
  buyerId: z.uuid().optional(),
};
export const commissionFilterSchema = z
  .object(commissionFilterShape)
  .strict()
  .refine(validFinancialFilter, "Invalid page or date range.");
export const adminCommissionFilterSchema = z
  .object({
    ...commissionFilterShape,
    decision: referralDecisionSchema.optional(),
  })
  .strict()
  .refine(validFinancialFilter, "Invalid page or date range.");
const commissionSummarySchema = z
  .object({
    scope: z.literal("FILTERED_BENEFICIARY_DECISIONS"),
    awarded: aggregateUsdtAmountSchema,
  })
  .strict();
export const employeeCommissionPageSchema = financialPageSchema(
  employeeCommissionSchema,
).safeExtend({
  beneficiaryId: z.uuid(),
  summary: commissionSummarySchema,
  serverNow: financialInstantSchema,
});
export const adminCommissionPageSchema = financialPageSchema(
  adminCommissionSchema,
).safeExtend({
  beneficiaryId: z.uuid(),
  summary: commissionSummarySchema,
  serverNow: financialInstantSchema,
});

export type EmployeeTeamSummary = z.infer<typeof employeeTeamSummarySchema>;
export type AdminTeamSummary = z.infer<typeof adminTeamSummarySchema>;
export type EmployeeMember = z.infer<typeof employeeMemberSchema>;
export type AdminMember = z.infer<typeof adminMemberSchema>;
export type EmployeeCommission = z.infer<typeof employeeCommissionSchema>;
export type AdminCommission = z.infer<typeof adminCommissionSchema>;
