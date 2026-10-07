import type { DatabaseClient, DepositReceipt } from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { canonicalMovementDigest } from "../../infrastructure/tron/tron-receipt.evidence.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import {
  checkOperation,
  operationEvidence,
  type LedgerDiscrepancy,
} from "../ledger/ledger-reconciliation.evidence.js";
import type { LedgerGuardScope, LedgerReply } from "../ledger/ledger.types.js";
import type {
  DepositVerifier,
  OwnedDepositMovement,
  DepositVerification,
} from "./deposit-verifier.js";

const businessKey = (movement: OwnedDepositMovement) =>
  `${movement.network}:${movement.transactionId}:${movement.logIndex.toString()}`;
function matchingReceipt(
  receipt: DepositReceipt,
  movement: OwnedDepositMovement,
) {
  return (
    receipt.assignmentId === movement.assignmentId &&
    receipt.walletId === movement.walletId &&
    canonicalMovementDigest(receipt) === movement.evidenceDigest &&
    receipt.evidenceDigest === movement.evidenceDigest
  );
}
export type DepositProcessing =
  | Exclude<DepositVerification, { state: "VERIFIED" }>
  | { state: "ACCOUNTED"; credits: LedgerReply[] };
export class DepositCreditService {
  private readonly ledger: LedgerService;
  constructor(
    database: DatabaseClient,
    private readonly verifier: DepositVerifier,
    admission: FinancialRuntimeAdmission,
    private readonly clock: () => Date,
  ) {
    this.ledger = new LedgerService(
      database,
      { businessNamespaces: ["p06.deposit"], processIds: ["deposit-indexer"] },
      admission,
    );
  }
  async process(transactionId: unknown): Promise<DepositProcessing> {
    const verified = await this.verifier.verify(transactionId);
    if (verified.state !== "VERIFIED") return verified;
    const credits: LedgerReply[] = [];
    try {
      for (const movement of verified.movements)
        credits.push(await this.credit(movement));
      return { state: "ACCOUNTED", credits };
    } catch (error) {
      if (error instanceof LedgerError)
        return {
          state:
            error.code === "LEDGER_IDENTITY_CONFLICT"
              ? "CONFLICT"
              : "UNRESOLVED",
          code: error.code,
        };
      throw error;
    }
  }
  private async observe(
    movement: OwnedDepositMovement,
    scope: LedgerGuardScope,
  ) {
    const assignment =
      await scope.transaction.depositAddressAssignment.findUnique({
        where: { id: movement.assignmentId },
      });
    if (
      assignment === null ||
      assignment.state !== "READY" ||
      assignment.network !== movement.network ||
      assignment.address !== movement.recipient ||
      assignment.walletId !== scope.wallet.id ||
      assignment.employeeId !== movement.employeeId ||
      scope.wallet.ownerUserId !== movement.employeeId
    )
      throw new LedgerError("LEDGER_UNRESOLVED");
    const operation = await scope.transaction.financialOperation.findUnique({
      where: {
        kind_businessNamespace_businessKey: {
          kind: "CREDIT",
          businessNamespace: "p06.deposit",
          businessKey: businessKey(movement),
        },
      },
      include: operationEvidence,
    });
    const receipt = await scope.transaction.depositReceipt.findUnique({
      where: {
        network_transactionId_logIndex: {
          network: movement.network,
          transactionId: movement.transactionId,
          logIndex: movement.logIndex,
        },
      },
    });
    if (receipt !== null && !matchingReceipt(receipt, movement))
      throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
    if (operation === null && receipt === null) return;
    if (
      operation === null ||
      receipt === null ||
      operation.depositReceipt?.id !== receipt.id
    )
      throw new LedgerError("LEDGER_UNRESOLVED");
    const faults: LedgerDiscrepancy[] = [];
    checkOperation(operation, (fault) => {
      faults.push(fault);
    });
    if (faults.length > 0) throw new LedgerError("LEDGER_UNRESOLVED");
  }
  private credit(movement: OwnedDepositMovement) {
    return this.ledger.execute(
      {
        kind: "CREDIT",
        walletId: movement.walletId,
        businessNamespace: "p06.deposit",
        businessKey: businessKey(movement),
        amount: formatUsdtAmount(movement.amountUnits),
        source: "NON_REFERRAL",
        origin: "DEPOSIT",
      },
      {
        actor: { type: "PROCESS", processId: "deposit-indexer" },
        walletIds: [movement.walletId],
        clock: this.clock,
        observe: (scope: LedgerGuardScope) => this.observe(movement, scope),
        mutate: async () => {},
      },
      async (transaction, outcome) => {
        await transaction.depositReceipt.create({
          data: {
            network: movement.network,
            transactionId: movement.transactionId,
            logIndex: movement.logIndex,
            assignmentId: movement.assignmentId,
            walletId: movement.walletId,
            tokenContract: movement.tokenContract,
            sender: movement.sender,
            recipient: movement.recipient,
            amountUnits: movement.amountUnits,
            blockNumber: movement.blockNumber,
            blockId: movement.blockId,
            blockTimestamp: movement.blockTimestamp,
            executionResult: movement.executionResult,
            finalityPolicy: movement.finalityPolicy,
            verifiedAt: movement.verifiedAt,
            evidenceDigest: movement.evidenceDigest,
            financialOperationId: outcome.operationId,
            recordedAt: new Date(outcome.recordedAt),
          },
        });
      },
    );
  }
}
