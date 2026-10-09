import type { DatabaseClient } from "@template/database";
import type { TronPayoutConfig } from "../../core/config/tron.config.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";
import type {
  PayoutFinancialTransactions,
  PayoutTransaction,
} from "./withdrawal-payout.transaction.js";
import type { PayoutDispatchProvider } from "./withdrawal-payout.resources.js";
import type { PayoutObservationProvider } from "./withdrawal-reconciliation.evidence.js";
import type { PayoutStores } from "./payout-records.js";
import type { WithdrawalReconciliation } from "./withdrawal-reconciliation.js";

export type PayoutProvider = PayoutDispatchProvider & PayoutObservationProvider;
export type PayoutExecution = Readonly<{
  database: DatabaseClient;
  config: TronPayoutConfig;
  stores: PayoutStores;
  provider: PayoutProvider;
  transactions: PayoutFinancialTransactions;
  reconciliation: WithdrawalReconciliation;
}>;
export async function assertPayoutDispatchable(scope: PayoutTransaction) {
  const [row] = await scope.transaction.$queryRaw<
    { id: string }[]
  >`SELECT r.id FROM withdrawal_requests r JOIN users u ON u.id=r.employee_id JOIN withdrawal_destinations d ON d.id=r.destination_id
      WHERE r.id=${scope.request.id}::uuid AND r.dispatch_at<=${scope.now} AND extract(isodow FROM ${scope.now}::timestamptz AT TIME ZONE 'Asia/Baghdad') NOT IN (6,7)
      AND u.role='USER' AND u.status='ACTIVE' AND u.email_verified_at IS NOT NULL AND NOT u.withdrawals_blocked
      AND d.address_version=r.address_version AND d.address=r.recipient`;
  if (row === undefined)
    throw new TreasuryPolicyError("PAYOUT_NOT_DISPATCHABLE");
}
