import { randomUUID } from "node:crypto";
import { createDatabaseClient, type DatabaseClient } from "@template/database";
import {
  acknowledgeFinancialBoot,
  changeDispatchPause,
  FinancialRuntimeAdmission,
} from "../../custody/runtime-control.js";
import { withdrawalTermsHash } from "../withdrawal-quote.service.js";
import { lockWithdrawalRequest } from "../withdrawal-cancellation.service.js";
import {
  payoutIntentHash,
  payoutIntentSchema,
} from "../withdrawal-payout.intent.js";

export async function admitWithdrawalRuntimeFixture(
  owner: DatabaseClient,
  runtime: DatabaseClient,
  kind: "DEPOSIT_WORKER" | "SIGNER" | "API",
) {
  const [context] = await owner.$queryRaw<
    { name: string }[]
  >`SELECT current_database() AS name`;
  if (!/^p02_identity_[0-9a-f]{32}$/u.test(context?.name ?? ""))
    throw new Error(
      "Protected fixtures require an isolated withdrawal database.",
    );
  const admission = new FinancialRuntimeAdmission(runtime, kind);
  await admission.register();
  const cutoff = new Date();
  const reference = `group-a-non-signing:${admission.bootId}`;
  await acknowledgeFinancialBoot(owner, {
    bootId: admission.bootId,
    operatorIdentity: "disposable-test-recovery",
    reason: "Verified isolated Group A history; no private attempts",
    evidence: {
      financialHistoryReference: reference,
      assignmentInventoryReference: reference,
      attemptInventoryReference: reference,
      reconciliationReference: reference,
      reconciliationCutoff: cutoff,
      financialHistoryRecoveredThrough: cutoff,
    },
  });
  if (kind === "SIGNER")
    await changeDispatchPause(owner, {
      action: "RESUME",
      operatorIdentity: "disposable-test-recovery",
      reason: "Non-signing Group A claim test only",
    });
  return admission;
}

// Non-signing races use minimal Group B SQL authority; no private body or live key exists.
export async function claimWithdrawalFixture(
  clients: { runtime: DatabaseClient; owner: DatabaseClient },
  admission: FinancialRuntimeAdmission,
  requestId: string,
  scheduleVersion: number,
) {
  const { runtime, owner } = clients;
  const createdAt = new Date();
  const key = await owner.treasuryPayoutKey.create({
    data: {
      id: randomUUID(),
      network: "TRON_NILE",
      tokenContract: `T${"3".repeat(33)}`,
      source: `T${"2".repeat(33)}`,
      envelopeId: randomUUID(),
      envelopeDigest: "a".repeat(64),
      recoveryDigest: "a".repeat(64),
      recoveryAckId: randomUUID(),
      recoveryAcknowledgedAt: createdAt,
      createdAt,
      operatorIdentity: "disposable-non-signing-fixture",
      reason: "SQL claim race; no actual signing material",
    },
  });
  const reference = await runtime.withdrawalRequest.findUniqueOrThrow({
    where: { id: requestId },
  });
  return runtime.$transaction(
    async (transaction) => {
      await admission.assertDispatchAdmission(transaction);
      await transaction.$queryRaw`SELECT id FROM users WHERE id=${reference.employeeId}::uuid FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM wallets WHERE id=${reference.walletId}::uuid FOR UPDATE`;
      await transaction.$queryRaw`SELECT id FROM reservation_allocations WHERE wallet_id=${reference.walletId}::uuid ORDER BY id FOR UPDATE`;
      const request = await lockWithdrawalRequest(transaction, reference);
      const [clock] = await transaction.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS now`;
      if (clock === undefined) throw new Error("Missing database clock");
      const [eligible] = await transaction.$queryRaw<
        { id: string }[]
      >`SELECT r.id FROM withdrawal_requests r JOIN users u ON u.id=r.employee_id JOIN withdrawal_destinations d ON d.id=r.destination_id
      WHERE r.id=${requestId}::uuid AND r.state='SCHEDULED' AND r.schedule_version=${scheduleVersion} AND r.dispatch_at<=${clock.now}
      AND (r.next_check_at IS NULL OR r.next_check_at<=${clock.now}) AND extract(isodow FROM ${clock.now}::timestamptz AT TIME ZONE 'Asia/Baghdad') NOT IN (6,7)
      AND u.role='USER' AND u.status='ACTIVE' AND u.email_verified_at IS NOT NULL AND NOT u.withdrawals_blocked
      AND d.address_version=r.address_version AND d.address=r.recipient`;
      if (eligible === undefined) return false;
      const intent = payoutIntentSchema.parse({
        operation: "WITHDRAWAL_PAYOUT",
        requestId,
        attemptId: randomUUID(),
        employeeId: request.employeeId,
        walletId: request.walletId,
        reservationId: request.reservationId,
        treasuryKeyId: key.id,
        network: request.network,
        tokenContract: key.tokenContract,
        source: key.source,
        recipient: request.recipient,
        addressVersion: request.addressVersion,
        netUnits: String(request.netUnits),
        termsHash: request.termsHash,
        policy: {
          maximumPayoutUnits: "500000000",
          energyFeeLimitSun: "1000000",
          maximumCompanyCostSun: "2000000",
        },
      });
      await transaction.withdrawalRequest.update({
        where: { id: requestId },
        data: { state: "SIGNING", version: { increment: 1 } },
      });
      await transaction.withdrawalAttempt.create({
        data: {
          id: intent.attemptId,
          withdrawalId: requestId,
          employeeId: request.employeeId,
          walletId: request.walletId,
          treasuryKeyId: key.id,
          network: request.network,
          tokenContract: key.tokenContract,
          source: key.source,
          recipient: request.recipient,
          addressVersion: request.addressVersion,
          grossUnits: request.grossUnits,
          feeUnits: request.feeUnits,
          netUnits: request.netUnits,
          termsHash: request.termsHash,
          intentHash: payoutIntentHash(intent),
          policySnapshot: intent.policy,
          initialFloorNumber: 100n,
          initialFloorId: "b".repeat(64),
          nextCheckAt: clock.now,
          createdAt: clock.now,
        },
      });
      await transaction.withdrawalAction.create({
        data: {
          requestId,
          kind: "CLAIM",
          actorProcessId: "p08-non-signing-test",
          actorScope: "process:p08-non-signing-test",
          intentHash: withdrawalTermsHash([requestId, scheduleVersion]),
          expectedVersion: request.version,
          committedVersion: request.version + 1,
          occurredAt: clock.now,
          beforeState: "SCHEDULED",
          afterState: "SIGNING",
          beforeDueAt: request.dueAt,
          afterDueAt: request.dueAt,
          beforeScheduleVersion: request.scheduleVersion,
          afterScheduleVersion: request.scheduleVersion,
        },
      });
      return true;
    },
    { maxWait: 5000, timeout: 10000 },
  );
}

type WithdrawalRole =
  "p06_api" | "p06_deposit_worker" | "p06_signer" | "p06_recovery_operator";

// Membership uses the migration's production grants; rejection scaffolding never widens them.
export async function withWithdrawalRole<T>(
  authority: {
    database: DatabaseClient;
    databaseUrl: string;
    role: WithdrawalRole;
  },
  work: (database: DatabaseClient, runtimeUrl: string) => Promise<T>,
): Promise<T> {
  const databaseName = new URL(authority.databaseUrl).pathname.slice(1);
  if (!/^(?:p02_identity|p08_snapshot)_[0-9a-f]{32}$/u.test(databaseName))
    throw new Error(
      "Withdrawal roles require an isolated identity fixture database.",
    );
  const login = `p08_test_${randomUUID().replaceAll("-", "")}`;
  const password = randomUUID();
  await authority.database.$executeRawUnsafe(
    `CREATE ROLE "${login}" LOGIN PASSWORD '${password}'`,
  );
  let runtime: DatabaseClient | undefined;
  try {
    await authority.database.$executeRawUnsafe(
      `GRANT ${authority.role} TO "${login}"`,
    );
    const runtimeUrl = new URL(authority.databaseUrl);
    runtimeUrl.username = login;
    runtimeUrl.password = password;
    runtime = createDatabaseClient(runtimeUrl.toString());
    return await work(runtime, runtimeUrl.toString());
  } finally {
    await runtime?.$disconnect();
    await authority.database.$executeRawUnsafe(`DROP ROLE "${login}"`);
  }
}
