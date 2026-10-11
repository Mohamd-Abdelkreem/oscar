import type { z } from "zod";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { createDatabaseClient, type DatabaseClient } from "@template/database";
import { BusinessClock } from "../../src/core/business-calendar/business-clock.js";
import type { TronPublicPayoutCapability } from "../../src/core/config/tron.config.js";
import { formatUsdtAmount } from "../../src/core/financial/money.js";
import { createIdentityFixture } from "../../src/modules/auth/testing/identity-fixtures.js";
import {
  changeDispatchPause,
  FinancialRuntimeAdmission,
  acknowledgeFinancialBoot,
} from "../../src/modules/custody/runtime-control.js";
import {
  claimWithdrawalFixture,
  createWithdrawalClaimKeyFixture,
} from "../../src/modules/withdrawals/testing/withdrawal-authority-fixtures.js";
import { fundSubscriptionFixture } from "../../src/modules/subscriptions/testing/subscription-fixtures.js";
import { mapWalletComponents } from "../../src/modules/ledger/ledger.mapper.js";
import { withdrawalExecutionReady } from "../../src/modules/withdrawals/withdrawal-readiness.js";
import {
  p09FixturesSchema,
  p09StateSchema,
  type p09EmailSchema,
} from "./control.js";

type Email = z.infer<typeof p09EmailSchema>;

// Private funded Free accounts use real ledger admission. No payout key, worker,
// signer, confirmed destination, request or transaction is manufactured here.
export class P09WithdrawalScenario {
  private initialized = false;
  constructor(
    private readonly database: DatabaseClient,
    private readonly runtime: {
      databaseUrl: string;
      admission: FinancialRuntimeAdmission;
      capability: TronPublicPayoutCapability;
      clock: () => Date;
      setServiceClock: (instant: string) => void;
    },
  ) {}

  async fixtures(amounts: {
    referral?: string | undefined;
    nonReferral?: string | undefined;
  }) {
    if (this.initialized) throw new Error("P09_FIXTURES_ALREADY_CREATED");
    const location = new URL(this.runtime.databaseUrl);
    const [ownership] = await this.database.$queryRaw<
      { name: string; owner: string }[]
    >`
      SELECT current_database() AS name,current_user AS owner`;
    const expectedOwner =
      location.pathname === "/p03_e2e" ? "p03_test" : "p05_test";
    if (
      process.env["NODE_ENV"] !== "test" ||
      !["/p03_e2e", "/p05_e2e"].includes(location.pathname) ||
      !["localhost", "127.0.0.1", "host.docker.internal"].includes(
        location.hostname,
      ) ||
      ownership?.name !== location.pathname.slice(1) ||
      ownership.owner !== expectedOwner ||
      (await this.database.financialOperation.count()) !== 0 ||
      (await this.database.withdrawalDestination.count()) !== 0 ||
      (await this.database.withdrawalQuote.count()) !== 0 ||
      (await this.database.withdrawalRequest.count()) !== 0 ||
      (await this.database.withdrawalAttempt.count()) !== 0 ||
      (await this.database.transferAttempt.count()) !== 0 ||
      (await this.database.treasuryPayoutKey.count()) !== 0 ||
      (await this.database.depositAddressAssignment.count()) !== 0
    )
      throw new Error("P09_CLEAN_DISPOSABLE_REQUIRED");
    await changeDispatchPause(this.database, {
      action: "RESUME",
      operatorIdentity: "disposable-p09-e2e",
      reason:
        "Explicit private withdrawal capability after clean disposable validation",
    });
    const baseline = await this.database.user.findUniqueOrThrow({
      where: { email: "employee@p03.test" },
    });
    const create = async (email: Email) => {
      const account = await createIdentityFixture(this.database, {
        passwordHash: baseline.passwordHash,
        now: this.runtime.clock(),
      });
      await this.database.user.update({
        where: { id: account.user.id },
        data: { email, fullName: "P09 employee" },
      });
      await fundSubscriptionFixture(
        this.database,
        account,
        {
          referral: amounts.referral ?? "30",
          nonReferral: amounts.nonReferral ?? "100",
        },
        { now: this.runtime.clock(), admission: this.runtime.admission },
      );
      return account.user.id;
    };
    const employeeId = await create("employee@p09.test");
    const otherId = await create("other@p09.test");
    this.initialized = true;
    return p09FixturesSchema.parse({ employeeId, otherId });
  }

  setClock(instant: string) {
    if (!this.initialized) throw new Error("P09_FIXTURES_REQUIRED");
    // Changes only the supported application clock, never PostgreSQL payout time.
    this.runtime.setServiceClock(instant);
    return null;
  }

  async claimFixture(withdrawalId: string) {
    if (!this.initialized || process.env["NODE_ENV"] !== "test")
      throw new Error("P09_FIXTURES_REQUIRED");
    const location = new URL(this.runtime.databaseUrl);
    const [ownership] = await this.database.$queryRaw<
      { name: string; owner: string }[]
    >`SELECT current_database() AS name,current_user AS owner`;
    if (
      location.pathname !== "/p03_e2e" ||
      ownership?.name !== "p03_e2e" ||
      ownership.owner !== "p03_test" ||
      !["localhost", "127.0.0.1", "host.docker.internal"].includes(
        location.hostname,
      )
    )
      throw new Error("P09_CLEAN_DISPOSABLE_REQUIRED");
    const request = await this.database.withdrawalRequest.findUniqueOrThrow({
      where: { id: withdrawalId },
    });
    const employee = await this.database.user.findUniqueOrThrow({
      where: { id: request.employeeId },
      select: { email: true },
    });
    if (
      employee.email !== "employee@p09.test" ||
      request.state !== "SCHEDULED" ||
      (await this.database.withdrawalAttempt.count()) !== 0 ||
      (await this.database.treasuryPayoutKey.count()) !== 0
    )
      throw new Error("P09_UNCLAIMED_FIXTURE_REQUIRED");
    // Control only this validated disposable database's clock. The actual SQL
    // due/admission/account/destination/weekday guards still decide every claim.
    const login = `p09_claim_${randomUUID().replaceAll("-", "")}`;
    const password = randomUUID();
    await this.database.$executeRawUnsafe(
      `CREATE ROLE "${login}" LOGIN PASSWORD '${password}'`,
    );
    let signer: DatabaseClient | undefined;
    let originalClock: string | undefined;
    try {
      await this.database.$executeRawUnsafe(`GRANT p06_signer TO "${login}"`);
      const signerUrl = new URL(this.runtime.databaseUrl);
      signerUrl.username = login;
      signerUrl.password = password;
      signer = createDatabaseClient(signerUrl.toString());
      const admission = new FinancialRuntimeAdmission(signer, "SIGNER");
      await admission.register();
      const cutoff = new Date(),
        reference = `p09-non-signing:${admission.bootId}`;
      await acknowledgeFinancialBoot(this.database, {
        bootId: admission.bootId,
        operatorIdentity: "disposable-p09-e2e",
        reason: "Isolated non-signing readonly administration fixture",
        evidence: {
          financialHistoryReference: reference,
          assignmentInventoryReference: reference,
          attemptInventoryReference: reference,
          reconciliationReference: reference,
          reconciliationCutoff: cutoff,
          financialHistoryRecoveredThrough: cutoff,
        },
      });
      const [original] = await this.database.$queryRaw<
        { definition: string }[]
      >`SELECT pg_get_functiondef('pg_catalog.clock_timestamp()'::regprocedure) AS definition`;
      if (original === undefined) throw new Error("P09_SQL_CLOCK_REQUIRED");
      originalClock = original.definition;
      const key = await createWithdrawalClaimKeyFixture(this.database);
      const earliest = new Date(
        Math.max(
          Date.now(),
          request.dispatchAt.getTime(),
          request.nextCheckAt?.getTime() ?? 0,
        ),
      );
      const eligibleAt = new Date(
        new BusinessClock(() => earliest).normalizeNewDispatch(
          earliest.toISOString(),
        ),
      );
      const local = DateTime.fromJSDate(eligibleAt, { zone: "Asia/Baghdad" });
      const weekend = local.plus({ days: 6 - local.weekday }).toJSDate();
      for (const [instant, expected] of [
        [new Date(request.dispatchAt.getTime() - 1), false],
        [weekend, false],
        [eligibleAt, true],
      ] as const) {
        await this.database.$executeRawUnsafe(
          `CREATE OR REPLACE FUNCTION pg_catalog.clock_timestamp() RETURNS timestamptz LANGUAGE sql VOLATILE AS $$ SELECT '${instant.toISOString()}'::timestamptz $$`,
        );
        const claimed = await claimWithdrawalFixture(
          { owner: this.database, runtime: signer },
          admission,
          request.id,
          request.scheduleVersion,
          key,
        );
        if (claimed !== expected)
          throw new Error("P09_SQL_CLAIM_GUARD_MISMATCH");
        if (!expected) {
          const unchanged =
            await this.database.withdrawalRequest.findUniqueOrThrow({
              where: { id: request.id },
            });
          if (
            unchanged.state !== "SCHEDULED" ||
            unchanged.version !== request.version ||
            (await this.database.withdrawalAttempt.count()) !== 0
          )
            throw new Error("P09_REJECTED_CLAIM_CHANGED_STATE");
        }
      }
    } finally {
      try {
        if (originalClock !== undefined)
          await this.database.$executeRawUnsafe(originalClock);
      } finally {
        try {
          await signer?.$disconnect();
        } finally {
          await this.database.$executeRawUnsafe(`DROP ROLE "${login}"`);
        }
      }
    }
    return null;
  }

  async state(email: Email) {
    if (!this.initialized) throw new Error("P09_FIXTURES_REQUIRED");
    return this.database.$transaction(
      async (transaction) => {
        const employee = await transaction.user.findUniqueOrThrow({
          where: { email },
          include: { wallet: true },
        });
        const wallet = employee.wallet;
        if (wallet === null) throw new Error("P09_WALLET_REQUIRED");
        const now = this.runtime.clock();
        const executionReady = await withdrawalExecutionReady(transaction, {
          admission: this.runtime.admission,
          capability: this.runtime.capability,
        });
        const destination = await transaction.withdrawalDestination.findUnique({
          where: { employeeId: employee.id },
        });
        const requests = await transaction.withdrawalRequest.findMany({
          where: { employeeId: employee.id },
          orderBy: { id: "asc" },
          take: 100,
        });
        const reservations = await transaction.reservationAllocation.findMany({
          where: { walletId: wallet.id },
          orderBy: { id: "asc" },
          take: 100,
        });
        return p09StateSchema.parse({
          employeeId: employee.id,
          serverNow: now.toISOString(),
          wallet: mapWalletComponents(wallet),
          executionReady,
          destination:
            destination === null
              ? null
              : {
                  version: destination.version,
                  confirmed: destination.confirmedAt !== null,
                  proofIssued: destination.proofId !== null,
                },
          quotes: await transaction.withdrawalQuote.count({
            where: { employeeId: employee.id },
          }),
          actions: await transaction.withdrawalAction.count({
            where: { request: { employeeId: employee.id } },
          }),
          operations: await transaction.financialOperation.count({
            where: { walletId: wallet.id },
          }),
          postings: await transaction.ledgerPosting.count({
            where: { walletId: wallet.id },
          }),
          withdrawalAttempts: await transaction.withdrawalAttempt.count({
            where: { employeeId: employee.id },
          }),
          transferAttempts: await transaction.transferAttempt.count(),
          requests: requests.map((row) => ({
            id: row.id,
            quoteId: row.quoteId,
            version: row.version,
            state: row.state,
            gross: formatUsdtAmount(row.grossUnits),
            fee: formatUsdtAmount(row.feeUnits),
            net: formatUsdtAmount(row.netUnits),
            reservationId: row.reservationId,
            nonReferral: formatUsdtAmount(row.nonReferralUnits),
            referral: formatUsdtAmount(row.referralUnits),
          })),
          reservations: reservations.map((row) => ({
            id: row.id,
            state: row.state,
            gross: formatUsdtAmount(row.grossUnits),
            nonReferral: formatUsdtAmount(row.nonReferralUnits),
            referral: formatUsdtAmount(row.referralUnits),
          })),
        });
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
}
