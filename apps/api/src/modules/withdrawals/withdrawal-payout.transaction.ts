import type {
  DatabaseClient,
  Prisma,
  TreasuryPayoutKey,
  WithdrawalAttempt,
  WithdrawalRequest,
} from "@template/database";
import type { TronPayoutConfig } from "../../core/config/tron.config.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type {
  LedgerContext,
  TransactionLedger,
} from "../ledger/ledger.types.js";
import { treasuryAuthority } from "../treasury/treasury.service.js";
import { lockWithdrawalRequest } from "./withdrawal-cancellation.service.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";

export type PayoutTransaction = {
  transaction: Prisma.TransactionClient;
  ledger: TransactionLedger;
  request: WithdrawalRequest;
  key: TreasuryPayoutKey;
  attempt: WithdrawalAttempt | null;
  now: Date;
};
type PayoutSafety = Pick<LedgerContext, "settlementSafety" | "releaseSafety">;
export class PayoutFinancialTransactions {
  private readonly ledger: LedgerService;
  constructor(
    private readonly database: DatabaseClient,
    private readonly admission: FinancialRuntimeAdmission,
    private readonly config: TronPayoutConfig,
  ) {
    if (admission.processKind !== "SIGNER")
      throw new TreasuryPolicyError("PAYOUT_AUTHORITY_DENIED");
    this.ledger = new LedgerService(
      database,
      {
        businessNamespaces: ["p08.withdrawal.settle", "p08.withdrawal.release"],
        processIds: ["p08-payout"],
      },
      admission,
    );
  }
  dispatch<T>(
    requestId: string,
    work: (scope: PayoutTransaction) => Promise<T>,
  ): Promise<T> {
    return this.run(requestId, work, (tx) =>
      this.admission.assertDispatchAdmission(tx),
    );
  }
  mutate<T>(
    requestId: string,
    work: (scope: PayoutTransaction) => Promise<T>,
    safety: PayoutSafety = {},
  ): Promise<T> {
    return this.run(
      requestId,
      work,
      (tx) => this.admission.assertMutationAdmission(tx),
      safety,
    );
  }
  private async run<T>(
    requestId: string,
    work: (scope: PayoutTransaction) => Promise<T>,
    admit: (tx: Prisma.TransactionClient) => Promise<void>,
    safety: PayoutSafety = {},
  ): Promise<T> {
    const reference = await this.database.withdrawalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    let now: Date | undefined;
    return this.ledger.runInTransaction(
      {
        actor: { type: "PROCESS", processId: "p08-payout" },
        walletIds: [reference.walletId],
        clock: () => {
          if (now === undefined) throw new TreasuryPolicyError();
          return now;
        },
        observe: async () => {},
        mutate: async () => {},
        ...safety,
      },
      async (transaction, ledger) => {
        await treasuryAuthority(transaction, "p06_signer");
        await admit(transaction);
        const request = await lockWithdrawalRequest(transaction, reference);
        await transaction.$queryRaw`SELECT id FROM treasury_payout_keys WHERE id=${this.config.treasuryKeyId}::uuid FOR UPDATE`;
        const key = await transaction.treasuryPayoutKey.findUniqueOrThrow({
          where: { id: this.config.treasuryKeyId },
        });
        if (
          key.network !== this.config.network ||
          key.tokenContract !== this.config.token.contract ||
          key.source !== this.config.treasury
        )
          throw new TreasuryPolicyError("PAYOUT_KEY_CONFLICT");
        await transaction.$queryRaw`SELECT id FROM withdrawal_attempts WHERE withdrawal_id=${requestId}::uuid FOR UPDATE`;
        const attempt = await transaction.withdrawalAttempt.findUnique({
          where: { withdrawalId: requestId },
        });
        const [clock] = await transaction.$queryRaw<
          { now: Date }[]
        >`SELECT clock_timestamp() AS now`;
        if (clock === undefined) throw new TreasuryPolicyError();
        now = clock.now;
        return work({ transaction, ledger, request, key, attempt, now });
      },
    );
  }
}
export async function recordPayoutAction(
  scope: PayoutTransaction,
  kind: string,
  after: WithdrawalRequest,
  financialOperationId?: string,
) {
  return scope.transaction.withdrawalAction.create({
    data: {
      requestId: after.id,
      actorProcessId: "p08-payout",
      actorScope: "process:p08-payout",
      kind,
      intentHash: scope.attempt?.intentHash ?? after.termsHash,
      expectedVersion: scope.request.version,
      committedVersion: after.version,
      occurredAt: scope.now,
      beforeState: scope.request.state,
      afterState: after.state,
      beforeDueAt: scope.request.dueAt,
      afterDueAt: after.dueAt,
      beforeScheduleVersion: scope.request.scheduleVersion,
      afterScheduleVersion: after.scheduleVersion,
      ...(financialOperationId === undefined ? {} : { financialOperationId }),
    },
  });
}
