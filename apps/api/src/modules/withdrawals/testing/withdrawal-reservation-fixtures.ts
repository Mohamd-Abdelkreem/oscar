import { TronWeb } from "tronweb";
import type { DatabaseClient } from "@template/database";
import { createIdentityFixture } from "../../auth/testing/identity-fixtures.js";
import {
  activateSubscriptionFixture,
  fundSubscriptionFixture,
} from "../../subscriptions/testing/subscription-fixtures.js";
import { financialFixtureAdmission } from "../../ledger/testing/financial-fixtures.js";
import { WithdrawalQuoteService } from "../withdrawal-quote.service.js";
import { WithdrawalReservationService } from "../withdrawal-reservation.service.js";
import { parseWithdrawalEnvironment } from "../../../core/config/withdrawal.config.js";
import { EmailService } from "../../../infrastructure/email/email.service.js";
import { WithdrawalDestinationService } from "../withdrawal-destination.service.js";
import { formatUsdtAmount } from "../../../core/financial/money.js";
import { LedgerService } from "../../ledger/ledger.service.js";

export const RESERVATION_NOW = new Date("2026-10-08T09:00:00Z");
export async function reservationEmployee(
  database: DatabaseClient,
  options: {
    paid?: boolean;
    nonReferral?: string;
    referral?: string;
    now?: Date;
  } = {},
) {
  const now = options.now ?? RESERVATION_NOW;
  const account = await createIdentityFixture(database, {
    now,
  });
  const admission = financialFixtureAdmission(database);
  if (options.paid) {
    const configured = await database.package.findUniqueOrThrow({
      where: { code: "S1" },
    });
    await fundSubscriptionFixture(
      database,
      account,
      { nonReferral: formatUsdtAmount(configured.priceUnits), referral: "0" },
      { now, admission },
    );
    await activateSubscriptionFixture(database, account, "S1", {
      now,
      admission,
    });
  }
  await fundSubscriptionFixture(
    database,
    account,
    {
      nonReferral: options.nonReferral ?? "100",
      referral: options.referral ?? "0",
    },
    { now, admission },
  );
  let credential: string | undefined;
  const email = new EmailService(
    {
      provider: "resend",
      send: async (mail) => {
        await mail.assertCanDispatch?.();
        credential = /#withdrawal-confirmation=([A-Za-z0-9_-]{43})/u.exec(
          mail.html,
        )?.[1];
        return { providerMessageId: "fixture-ack" };
      },
    },
    "sender@company.test",
    "Company",
    "",
    "https://company.test",
    null,
    "https://company.test/employee/account",
  );
  const destinations = new WithdrawalDestinationService(database, email, {
    network: "TRON_NILE",
    clock: () => now,
    admission,
  });
  const identity = { userId: account.user.id, sessionId: account.session.id };
  await destinations.issue(identity, {
    address: TronWeb.address.fromHex(`41${"22".repeat(20)}`),
  });
  if (credential === undefined) throw new Error("Missing fixture proof");
  await destinations.consume(identity, { token: credential });
  return {
    ...account,
    identity: { userId: account.user.id, sessionId: account.session.id },
  };
}
export function reservationServices(
  database: DatabaseClient,
  clock: () => Date = () => RESERVATION_NOW,
  ttl = 600,
) {
  const config = parseWithdrawalEnvironment({
    WITHDRAWAL_QUOTE_TTL_SECONDS: String(ttl),
  });
  const admission = financialFixtureAdmission(database);
  return {
    quotes: new WithdrawalQuoteService(database, {
      clock,
      admission,
      network: "TRON_NILE",
      config,
    }),
    reservations: new WithdrawalReservationService(database, {
      clock,
      admission,
      network: "TRON_NILE",
    }),
  };
}
export async function reservationState(
  database: DatabaseClient,
  employeeId: string,
) {
  return {
    wallet: await database.wallet.findUniqueOrThrow({
      where: { ownerUserId: employeeId },
    }),
    requests: await database.withdrawalRequest.findMany(),
    allocations: await database.reservationAllocation.findMany(),
    actions: await database.withdrawalAction.findMany(),
    operations: await database.financialOperation.findMany({
      where: { businessNamespace: "p08.withdrawal.reserve" },
    }),
    postings: await database.ledgerPosting.findMany({
      where: { operation: { businessNamespace: "p08.withdrawal.reserve" } },
    }),
    audit: await database.auditRecord.findMany({
      where: { operation: { businessNamespace: "p08.withdrawal.reserve" } },
    }),
  };
}

// Disposable fixture closure exercises real release accounting, not a new product endpoint.
export async function closeReservationFixture(
  database: DatabaseClient,
  quoteId: string,
) {
  const request = await database.withdrawalRequest.findUniqueOrThrow({
    where: { quoteId },
  });
  const admin = await createIdentityFixture(database, {
    role: "ADMIN",
    now: RESERVATION_NOW,
  });
  const ledger = new LedgerService(
    database,
    { businessNamespaces: ["p08.withdrawal.release"], processIds: [] },
    financialFixtureAdmission(database),
  );
  await ledger.execute(
    {
      kind: "RELEASE",
      walletId: request.walletId,
      reservationId: request.reservationId,
      businessNamespace: "p08.withdrawal.release",
      businessKey: request.id,
    },
    {
      actor: { type: "USER", userId: admin.user.id },
      walletIds: [request.walletId],
      clock: () => RESERVATION_NOW,
      observe: async () => {},
      mutate: async () => {},
      releaseSafety: async () => {},
    },
    async (transaction, operation) => {
      await transaction.withdrawalRequest.update({
        where: { id: request.id },
        data: {
          state: "REJECTED",
          version: 2,
          releaseOperationId: operation.operationId,
          finalizedAt: RESERVATION_NOW,
        },
      });
      await transaction.withdrawalAction.create({
        data: {
          requestId: request.id,
          actorUserId: admin.user.id,
          actorScope: `user:${admin.user.id}`,
          kind: "REJECT",
          intentHash: request.termsHash,
          expectedVersion: 1,
          committedVersion: 2,
          occurredAt: RESERVATION_NOW,
          beforeState: "SCHEDULED",
          afterState: "REJECTED",
          beforeDueAt: request.dueAt,
          afterDueAt: request.dueAt,
          beforeScheduleVersion: 1,
          afterScheduleVersion: 1,
          confirmed: true,
          reason: "Disposable safe closure",
          financialOperationId: operation.operationId,
        },
      });
    },
  );
}
