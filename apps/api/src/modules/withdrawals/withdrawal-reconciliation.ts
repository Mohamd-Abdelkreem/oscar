import type { DatabaseClient } from "@template/database";
import { retainedSignedPayout } from "./withdrawal-payout.records.js";
import type { PayoutStores } from "./payout-records.js";
import {
  verifyOriginalPayout,
  type PayoutObservationProvider,
} from "./withdrawal-reconciliation.evidence.js";
import type { WithdrawalSettlementService } from "./withdrawal-settlement.service.js";

export class WithdrawalReconciliation {
  constructor(
    private readonly database: DatabaseClient,
    private readonly provider: PayoutObservationProvider,
    private readonly stores: PayoutStores,
    private readonly settlement: WithdrawalSettlementService,
  ) {}
  async observe(requestId: string) {
    const request = await this.database.withdrawalRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    const attempt = await this.database.withdrawalAttempt.findUniqueOrThrow({
      where: { withdrawalId: requestId },
    });
    const signed = await retainedSignedPayout(this.stores, request, attempt);
    const evidence = await verifyOriginalPayout({
      request,
      attempt,
      provider: this.provider,
      retainedSigned: signed.record.transaction,
      now: new Date(),
    });
    return evidence.outcome === "CHAIN_FAILED"
      ? this.settlement.fail(requestId, evidence)
      : this.settlement.settle(requestId, evidence);
  }
}
