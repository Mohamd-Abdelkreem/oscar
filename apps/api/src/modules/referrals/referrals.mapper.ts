import {
  adminCommissionSchema,
  employeeCommissionSchema,
  type AdminCommission,
  type EmployeeCommission,
} from "@template/contracts";
import type { Prisma } from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { ForbiddenException } from "../../core/errors/index.js";
import { adminRootIdentitySchema } from "@template/contracts";

export const referralRootSelect = {
  id: true,
  fullName: true,
  email: true,
  referralCode: true,
  createdAt: true,
} as const satisfies Prisma.UserSelect;
export const mapReferralRoot = (
  root: Prisma.UserGetPayload<{ select: typeof referralRootSelect }>,
) =>
  adminRootIdentitySchema.parse({
    id: root.id,
    fullName: root.fullName,
    email: root.email,
    referralCode: root.referralCode,
    joinedAt: root.createdAt.toISOString(),
  });

export const savedCommissionInclude = {
  purchase: { select: { buyer: { select: { id: true, fullName: true } } } },
} as const satisfies Prisma.ReferralDecisionInclude;

type SavedCommission = Prisma.ReferralDecisionGetPayload<{
  include: typeof savedCommissionInclude;
}>;

function commissionFields(saved: SavedCommission) {
  return {
    decisionId: saved.id,
    purchaseId: saved.purchaseId,
    occurredAt: saved.occurredAt.toISOString(),
    level: saved.level,
    buyer: {
      id: saved.purchase.buyer.id,
      fullName: saved.purchase.buyer.fullName,
    },
    rateBps: saved.rateBps,
    commissionBase: formatUsdtAmount(saved.commissionBaseUnits),
    award: formatUsdtAmount(saved.awardUnits),
  };
}

export function mapEmployeeCommission(
  saved: SavedCommission,
  beneficiaryId: string,
): EmployeeCommission | null {
  if (saved.recipientUserId !== beneficiaryId) throw new ForbiddenException();
  if (saved.decision === "SKIPPED") return null;
  return employeeCommissionSchema.parse({
    ...commissionFields(saved),
    decision: saved.decision,
    ...(saved.decision === "ELIGIBLE_ZERO"
      ? { zeroReason: saved.zeroReason }
      : {}),
  });
}

// Current ADMIN authority belongs to the calling service; historical eligibility comes only from the saved event.
export function mapAdminCommission(saved: SavedCommission): AdminCommission {
  return adminCommissionSchema.parse({
    ...commissionFields(saved),
    decision: saved.decision,
    skippedReason: saved.skippedReason,
    zeroReason: saved.zeroReason,
    eligibility: adminCommissionSchema.shape.eligibility
      .strip()
      .parse(saved.eligibilitySnapshot),
  });
}
