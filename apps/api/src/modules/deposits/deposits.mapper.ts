import {
  manualCreditOutcomeSchema,
  type ManualCreditOutcome,
} from "@template/contracts";
import type { Prisma } from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { mapRecordedOutcome } from "../ledger/ledger.mapper.js";
import { AppError } from "../../core/errors/app.error.js";

export const depositPersonSelect = {
  id: true,
  fullName: true,
  email: true,
} satisfies Prisma.UserSelect;
export const manualCreditSelect = {
  id: true,
  employeeId: true,
  amountUnits: true,
  reason: true,
  referenceKind: true,
  externalReference: true,
  referenceOperationId: true,
  financialOperationId: true,
  recordedAt: true,
  actor: { select: depositPersonSelect },
} satisfies Prisma.ManualCreditSelect;
export const depositOperationSelect = {
  id: true,
  createdAt: true,
  magnitudeUnits: true,
  outcome: true,
  wallet: { select: { owner: { select: depositPersonSelect } } },
  depositReceipt: {
    select: {
      id: true,
      network: true,
      tokenContract: true,
      transactionId: true,
      logIndex: true,
      recipient: true,
      verifiedAt: true,
    },
  },
  manualCredit: { select: manualCreditSelect },
} satisfies Prisma.FinancialOperationSelect;
export type DepositOperation = Prisma.FinancialOperationGetPayload<{
  select: typeof depositOperationSelect;
}>;
type ManualRecord = Prisma.ManualCreditGetPayload<{
  select: typeof manualCreditSelect;
}>;
export const mapDepositPerson = (person: {
  id: string;
  fullName: string;
  email: string;
}) => ({ id: person.id, name: person.fullName, email: person.email });
export function mapManualReference(record: ManualRecord) {
  return record.referenceKind === "EXTERNAL"
    ? { kind: "EXTERNAL" as const, value: record.externalReference }
    : {
        kind: "LEDGER_OPERATION" as const,
        operationId: record.referenceOperationId,
      };
}
export function mapDepositHistory(operation: DepositOperation, admin: boolean) {
  const common = {
    operationId: operation.id,
    amount: formatUsdtAmount(operation.magnitudeUnits),
    source: "NON_REFERRAL" as const,
    recordedAt: operation.createdAt.toISOString(),
    ...(admin ? { employee: mapDepositPerson(operation.wallet.owner) } : {}),
  };
  const receipt = operation.depositReceipt;
  if (receipt !== null)
    return {
      ...common,
      id: receipt.id,
      kind: "CHAIN_DEPOSIT" as const,
      state: "CONFIRMED" as const,
      network: receipt.network,
      tokenContract: receipt.tokenContract,
      transactionId: receipt.transactionId,
      logIndex: receipt.logIndex,
      address: receipt.recipient,
      confirmedAt: receipt.verifiedAt.toISOString(),
    };
  const grant = operation.manualCredit;
  if (grant === null)
    throw new AppError(
      "Deposit evidence is unresolved.",
      409,
      "DEPOSIT_UNRESOLVED",
    );
  return {
    ...common,
    id: grant.id,
    actionId: grant.id,
    kind: "MANUAL_CREDIT" as const,
    state: "RECORDED" as const,
    ...(admin
      ? {
          actor: mapDepositPerson(grant.actor),
          reason: grant.reason,
          reference: mapManualReference(grant),
        }
      : {}),
  };
}
export function mapManualOutcome(
  operation: DepositOperation,
  replayed: boolean,
): ManualCreditOutcome {
  const grant = operation.manualCredit;
  if (grant === null)
    throw new AppError(
      "Deposit evidence is unresolved.",
      409,
      "DEPOSIT_UNRESOLVED",
    );
  return manualCreditOutcomeSchema.parse({
    actionId: grant.id,
    operationId: operation.id,
    employeeId: grant.employeeId,
    amount: formatUsdtAmount(grant.amountUnits),
    source: "NON_REFERRAL",
    state: "RECORDED",
    recordedAt: operation.createdAt.toISOString(),
    actor: mapDepositPerson(grant.actor),
    reason: grant.reason,
    reference: mapManualReference(grant),
    walletAfter: mapRecordedOutcome(operation.outcome).walletAfter,
    replayed,
  });
}
