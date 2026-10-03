import {
  financialOperationResultSchema,
  MAX_USDT_AMOUNT,
  type WalletComponents,
} from "@template/contracts";
import type { Prisma, FundSource } from "@template/database";
import { parseUsdtAmount } from "../../core/financial/money.js";
import type { SourceMovement } from "./ledger.effects.js";
import { acceptedTermsSchema, type AcceptedTerms } from "./ledger.types.js";

const MAX_USDT_UNITS = parseUsdtAmount(MAX_USDT_AMOUNT);
const WITHDRAWAL_ORDER: FundSource[] = ["NON_REFERRAL", "REFERRAL"];
export const operationEvidence = {
  postings: true,
  openingAllocation: true,
  releaseAllocation: true,
  audit: { include: { referenceOperation: { select: { walletId: true } } } },
} satisfies Prisma.FinancialOperationInclude;
type OperationEvidence = Prisma.FinancialOperationGetPayload<{
  include: typeof operationEvidence;
}>;
type Category =
  | "INVALID_TERMS"
  | "INVALID_OUTCOME"
  | "MISSING_POSTING"
  | "EXTRA_POSTING"
  | "POSTING_MISMATCH"
  | "ALLOCATION_MISMATCH"
  | "AUDIT_MISMATCH"
  | "PROJECTION_MISMATCH";
export type LedgerDiscrepancy = {
  category: Category;
  operationId?: string;
  allocationId?: string;
  source?: FundSource;
  component?: keyof WalletComponents;
  expected?: string;
  actual?: string;
  difference?: string;
};
export type LedgerReconciliation = {
  walletId: string;
  consistent: boolean;
  discrepancies: LedgerDiscrepancy[];
  truncated: boolean;
};
export type ReportFault = (fault: LedgerDiscrepancy) => void;
// Aggregate diagnostics can exceed storage bounds; the bounded money formatter is inappropriate here.
const diagnosticAmount = (units: bigint): string => {
  const magnitude = units < 0n ? -units : units;
  const fraction = (magnitude % 1_000_000n)
    .toString()
    .padStart(6, "0")
    .replace(/0+$/u, "");
  return `${units < 0n ? "-" : ""}${(magnitude / 1_000_000n).toString()}${fraction === "" ? "" : `.${fraction}`}`;
};
export const compareMoney = (
  report: ReportFault,
  fault: LedgerDiscrepancy,
  expected: bigint,
  actual: bigint,
) => {
  if (expected !== actual)
    report({
      ...fault,
      expected: diagnosticAmount(expected),
      actual: diagnosticAmount(actual),
      difference: diagnosticAmount(actual - expected),
    });
};
export const components = (snapshot: WalletComponents) => ({
  availableNonReferral: parseUsdtAmount(snapshot.availableNonReferral),
  reservedNonReferral: parseUsdtAmount(snapshot.reservedNonReferral),
  availableReferral: parseUsdtAmount(snapshot.availableReferral),
  reservedReferral: parseUsdtAmount(snapshot.reservedReferral),
});
const movement = (
  source: FundSource,
  availableDeltaUnits: bigint,
  reservedDeltaUnits = 0n,
): SourceMovement => ({ source, availableDeltaUnits, reservedDeltaUnits });

const allocatedMovements = (
  operation: OperationEvidence,
  terms: AcceptedTerms,
): SourceMovement[] | null => {
  if (terms.kind !== "PURCHASE_DEBIT" && terms.kind !== "RESERVE") return null;
  const before = components(terms.walletBefore);
  const order: FundSource[] =
    terms.kind === "PURCHASE_DEBIT"
      ? ["REFERRAL", "NON_REFERRAL"]
      : WITHDRAWAL_ORDER.filter((source) =>
          terms.eligibleSources.includes(source),
        );
  let remaining = operation.magnitudeUnits;
  const expected: SourceMovement[] = [];
  for (const source of order) {
    const available =
      source === "REFERRAL"
        ? before.availableReferral
        : before.availableNonReferral;
    const consumed = available < remaining ? available : remaining;
    if (consumed > 0n)
      expected.push(
        movement(source, -consumed, terms.kind === "RESERVE" ? consumed : 0n),
      );
    remaining -= consumed;
  }
  return remaining === 0n ? expected : null;
};
const expectedMovements = (
  operation: OperationEvidence,
  terms: AcceptedTerms,
): SourceMovement[] | null => {
  const magnitude = operation.magnitudeUnits;
  switch (terms.kind) {
    case "CREDIT":
      if (
        ((operation.origin === "DEPOSIT" ||
          operation.origin === "TASK_REWARD") &&
          terms.source === "NON_REFERRAL") ||
        (operation.origin === "REFERRAL_COMMISSION" &&
          terms.source === "REFERRAL")
      )
        return [movement(terms.source, magnitude)];
      return null;
    case "CORRECTION":
      return operation.origin === "ADMIN_ADJUSTMENT"
        ? [
            movement(
              terms.source,
              terms.direction === "CREDIT" ? magnitude : -magnitude,
            ),
          ]
        : null;
    case "PURCHASE_DEBIT":
      return operation.origin === "PACKAGE_PURCHASE"
        ? allocatedMovements(operation, terms)
        : null;
    case "RESERVE":
      return operation.origin === "WITHDRAWAL_RESERVATION"
        ? allocatedMovements(operation, terms)
        : null;
    case "RELEASE": {
      const allocation = operation.releaseAllocation;
      if (operation.origin !== "RESERVATION_RELEASE" || allocation === null)
        return null;
      return [
        movement(
          "NON_REFERRAL",
          allocation.nonReferralUnits,
          -allocation.nonReferralUnits,
        ),
        movement(
          "REFERRAL",
          allocation.referralUnits,
          -allocation.referralUnits,
        ),
      ].filter((posting) => posting.availableDeltaUnits !== 0n);
    }
  }
};
const checkPostings = (
  operation: OperationEvidence,
  expected: SourceMovement[],
  report: ReportFault,
) => {
  for (const posting of expected) {
    const actual = operation.postings.find(
      ({ source }) => source === posting.source,
    );
    const fault = { operationId: operation.id, source: posting.source };
    if (actual === undefined) {
      report({ ...fault, category: "MISSING_POSTING" });
      continue;
    }
    compareMoney(
      report,
      {
        ...fault,
        category: "POSTING_MISMATCH",
        component:
          posting.source === "REFERRAL"
            ? "availableReferral"
            : "availableNonReferral",
      },
      posting.availableDeltaUnits,
      actual.availableDeltaUnits,
    );
    compareMoney(
      report,
      {
        ...fault,
        category: "POSTING_MISMATCH",
        component:
          posting.source === "REFERRAL"
            ? "reservedReferral"
            : "reservedNonReferral",
      },
      posting.reservedDeltaUnits,
      actual.reservedDeltaUnits,
    );
  }
  for (const posting of operation.postings)
    if (!expected.some(({ source }) => source === posting.source))
      report({
        category: "EXTRA_POSTING",
        operationId: operation.id,
        source: posting.source,
      });
};
const checkAudit = (
  operation: OperationEvidence,
  terms: AcceptedTerms | null,
  report: ReportFault,
) => {
  const audit = operation.audit;
  const correction = terms?.kind === "CORRECTION" ? terms : null;
  if (
    audit === null ||
    audit.action !== operation.kind ||
    audit.actorType !== operation.actorType ||
    audit.actorUserId !== operation.actorUserId ||
    audit.actorProcessId !== operation.actorProcessId ||
    audit.createdAt.getTime() !== operation.createdAt.getTime() ||
    (operation.kind === "CORRECTION"
      ? correction === null ||
        audit.reason !== correction.reason ||
        audit.referenceOperationId !== correction.referenceOperationId ||
        audit.referenceOperation?.walletId !== operation.walletId
      : audit.reason !== null || audit.referenceOperationId !== null)
  )
    report({ category: "AUDIT_MISMATCH", operationId: operation.id });
};
const checkOutcome = (
  operation: OperationEvidence,
  terms: AcceptedTerms | null,
  report: ReportFault,
) => {
  const parsed = financialOperationResultSchema.safeParse(operation.outcome);
  if (!parsed.success) {
    report({ category: "INVALID_OUTCOME", operationId: operation.id });
    return;
  }
  const outcome = parsed.data;
  if (
    outcome.operationId !== operation.id ||
    outcome.walletId !== operation.walletId ||
    outcome.kind !== operation.kind ||
    parseUsdtAmount(outcome.amount) !== operation.magnitudeUnits ||
    outcome.recordedAt !== operation.createdAt.toISOString()
  )
    report({ category: "INVALID_OUTCOME", operationId: operation.id });
  if (terms !== null) {
    const after = components(terms.walletBefore);
    for (const posting of operation.postings) {
      if (posting.source === "NON_REFERRAL") {
        after.availableNonReferral += posting.availableDeltaUnits;
        after.reservedNonReferral += posting.reservedDeltaUnits;
      } else {
        after.availableReferral += posting.availableDeltaUnits;
        after.reservedReferral += posting.reservedDeltaUnits;
      }
    }
    const actual = components(outcome.walletAfter);
    for (const component of Object.keys(after) as (keyof typeof after)[])
      compareMoney(
        report,
        { category: "INVALID_OUTCOME", operationId: operation.id, component },
        after[component],
        actual[component],
      );
    if (
      Object.values(after).some(
        (units) => units < 0n || units > MAX_USDT_UNITS,
      ) ||
      Object.values(after).reduce((sum, units) => sum + units, 0n) >
        MAX_USDT_UNITS
    )
      report({ category: "INVALID_OUTCOME", operationId: operation.id });
  }
  if (outcome.kind === "RESERVE" || outcome.kind === "RELEASE") {
    const allocation =
      outcome.kind === "RESERVE"
        ? operation.openingAllocation
        : operation.releaseAllocation;
    if (
      allocation === null ||
      outcome.reservation.id !== allocation.id ||
      parseUsdtAmount(outcome.reservation.allocation.nonReferral) !==
        allocation.nonReferralUnits ||
      parseUsdtAmount(outcome.reservation.allocation.referral) !==
        allocation.referralUnits ||
      parseUsdtAmount(outcome.reservation.allocation.gross) !==
        allocation.grossUnits
    )
      report({ category: "ALLOCATION_MISMATCH", operationId: operation.id });
  }
};
const checkAllocation = (
  operation: OperationEvidence,
  terms: AcceptedTerms | null,
  expected: SourceMovement[] | null,
  report: ReportFault,
) => {
  if (operation.kind !== "RESERVE" && operation.kind !== "RELEASE") {
    if (
      operation.openingAllocation !== null ||
      operation.releaseAllocation !== null
    )
      report({ category: "ALLOCATION_MISMATCH", operationId: operation.id });
    return;
  }
  const allocation =
    operation.kind === "RESERVE"
      ? operation.openingAllocation
      : operation.releaseAllocation;
  const reference =
    terms?.kind === "RESERVE" || terms?.kind === "RELEASE"
      ? terms.reservationId
      : null;
  const invalid =
    allocation === null ||
    allocation.walletId !== operation.walletId ||
    allocation.id !== reference ||
    allocation.grossUnits !== operation.magnitudeUnits ||
    allocation.nonReferralUnits + allocation.referralUnits !==
      allocation.grossUnits ||
    (operation.kind === "RESERVE"
      ? allocation.openingOperationId !== operation.id ||
        allocation.createdAt.getTime() !== operation.createdAt.getTime()
      : allocation.releaseOperationId !== operation.id ||
        allocation.state !== "RELEASED" ||
        allocation.releasedAt?.getTime() !== operation.createdAt.getTime()) ||
    (allocation.state === "ACTIVE"
      ? allocation.releaseOperationId !== null || allocation.releasedAt !== null
      : allocation.releaseOperationId === null ||
        allocation.releasedAt === null);
  if (invalid) {
    report({ category: "ALLOCATION_MISMATCH", operationId: operation.id });
    return;
  }
  if (operation.kind === "RESERVE" && expected !== null) {
    for (const source of ["NON_REFERRAL", "REFERRAL"] as const)
      compareMoney(
        report,
        {
          category: "ALLOCATION_MISMATCH",
          operationId: operation.id,
          allocationId: allocation.id,
          source,
        },
        expected.find((posting) => posting.source === source)
          ?.reservedDeltaUnits ?? 0n,
        source === "NON_REFERRAL"
          ? allocation.nonReferralUnits
          : allocation.referralUnits,
      );
  }
};
export const checkOperation = (
  operation: OperationEvidence,
  report: ReportFault,
) => {
  const parsed = acceptedTermsSchema.safeParse(operation.acceptedTerms);
  const terms =
    parsed.success && parsed.data.kind === operation.kind ? parsed.data : null;
  const expected = terms === null ? null : expectedMovements(operation, terms);
  if (terms === null || expected === null)
    report({ category: "INVALID_TERMS", operationId: operation.id });
  if (expected !== null) checkPostings(operation, expected, report);
  checkOutcome(operation, terms, report);
  checkAudit(operation, terms, report);
  checkAllocation(operation, terms, expected, report);
};
