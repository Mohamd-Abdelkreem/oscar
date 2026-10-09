import type { DatabaseClient } from "@template/database";
import type { TronPayoutConfig } from "../../core/config/tron.config.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import type { PayoutStores } from "./payout-records.js";
import type { PayoutProvider } from "./withdrawal-payout.execution.js";
import { PayoutFinancialTransactions } from "./withdrawal-payout.transaction.js";
import { WithdrawalReconciliation } from "./withdrawal-reconciliation.js";
import { WithdrawalSettlementService } from "./withdrawal-settlement.service.js";
import { PayoutClaim } from "./withdrawal-payout.claim.js";
import { PayoutRetention } from "./withdrawal-payout.retention.js";
import { PayoutBroadcast } from "./withdrawal-payout.broadcast.js";

export class WithdrawalAttempts {
  readonly transactions: PayoutFinancialTransactions;
  readonly reconciliation: WithdrawalReconciliation;
  private readonly claims: PayoutClaim;
  private readonly retention: PayoutRetention;
  private readonly sends: PayoutBroadcast;
  constructor(
    database: DatabaseClient,
    admission: FinancialRuntimeAdmission,
    config: TronPayoutConfig,
    dependencies: { stores: PayoutStores; provider: PayoutProvider },
  ) {
    this.transactions = new PayoutFinancialTransactions(
      database,
      admission,
      config,
    );
    this.reconciliation = new WithdrawalReconciliation(
      database,
      dependencies.provider,
      dependencies.stores,
      new WithdrawalSettlementService(this.transactions),
    );
    const context = {
      database,
      config,
      ...dependencies,
      transactions: this.transactions,
      reconciliation: this.reconciliation,
    };
    this.claims = new PayoutClaim(context);
    this.retention = new PayoutRetention(context, this.claims);
    this.sends = new PayoutBroadcast(context);
  }
  candidates(limit = 50) {
    return this.claims.candidates(limit);
  }
  claim(requestId: string) {
    return this.claims.claim(requestId);
  }
  sign(requestId: string) {
    return this.retention.sign(requestId);
  }
  broadcast(requestId: string) {
    return this.sends.broadcast(requestId);
  }
}
