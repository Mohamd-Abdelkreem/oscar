import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { MAX_USDT_AMOUNT } from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { LedgerService } from "../ledger/ledger.service.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import {
  activateSubscriptionFixture,
  fundSubscriptionFixture,
} from "../subscriptions/testing/subscription-fixtures.js";
import { DepositVerifier } from "./deposit-verifier.js";
import { DepositCreditService } from "./deposit-credit.service.js";
import {
  financialFixtureAdmission,
  createFinancialAccount,
  withAdmittedFinancialDatabase,
} from "../ledger/testing/financial-fixtures.js";
import {
  createDepositAssignment,
  depositClock,
  rawDeposit,
  transferLog,
  withDepositProvider,
  bindDepositAssignment,
  depositRecipient,
  depositToken,
} from "./testing/deposit-fixtures.js";

async function depositState(database: DatabaseClient) {
  const orderBy = { id: "asc" as const };
  return {
    receipts: await database.depositReceipt.findMany({ orderBy }),
    operations: await database.financialOperation.findMany({ orderBy }),
    postings: await database.ledgerPosting.findMany({ orderBy }),
    audit: await database.auditRecord.findMany({ orderBy }),
    wallets: await database.wallet.findMany({ orderBy }),
    aliases: await database.requestIdentity.findMany({ orderBy }),
    allocations: await database.reservationAllocation.findMany({ orderBy }),
  };
}
const fixtureLedger = (database: DatabaseClient) =>
  new LedgerService(
    database,
    { businessNamespaces: ["p06.fixture"], processIds: ["fixture"] },
    financialFixtureAdmission(database),
  );
const fixtureContext = (walletId: string) => ({
  actor: { type: "PROCESS" as const, processId: "fixture" },
  walletIds: [walletId],
  clock: depositClock,
  observe: async () => {},
  mutate: async () => {},
  eligibleSources: () => Promise.resolve(["REFERRAL", "NON_REFERRAL"] as const),
});

describe("verified direct deposits", () => {
  it.each(["missing", "corrupt"])(
    "rejects %s linked receipt evidence rather than manufacturing a replay",
    async (fault) =>
      withAdmittedFinancialDatabase(async (database) => {
        const owner = await createDepositAssignment(database);
        const raw = rawDeposit();
        await withDepositProvider(raw, async (provider, config) => {
          const service = new DepositCreditService(
            database,
            new DepositVerifier(database, provider, config, depositClock),
            financialFixtureAdmission(database),
            depositClock,
          );
          expect((await service.process(raw.transactionId)).state).toBe(
            "ACCOUNTED",
          );
          await database.$transaction(async (tx) => {
            // Simulate externally corrupted restore history; normal writes remain guarded.
            await tx.$executeRaw`SET LOCAL session_replication_role = replica`;
            if (fault === "missing") await tx.depositReceipt.deleteMany();
            else
              await tx.depositReceipt.updateMany({
                data: { evidenceDigest: "f".repeat(64) },
              });
          });
          const before = await depositState(database);
          expect(await service.process(raw.transactionId)).toMatchObject({
            state: fault === "missing" ? "UNRESOLVED" : "CONFLICT",
          });
          expect(await depositState(database)).toEqual(before);
          const report = await fixtureLedger(database).reconcileWallet(
            owner.wallet.id,
            {
              actor: { type: "PROCESS", processId: "fixture" },
              observe: async () => {},
            },
          );
          expect(report.consistent).toBe(false);
          expect(report.discrepancies).toContainEqual(
            expect.objectContaining({ category: "RECEIPT_MISMATCH" }),
          );
        });
      }),
  );
  it("retains the winning verification and recording timestamps on later matching replay", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      await createDepositAssignment(database);
      const raw = rawDeposit();
      let now = depositClock();
      await withDepositProvider(raw, async (provider, config) => {
        const clock = () => new Date(now);
        const service = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, clock),
          financialFixtureAdmission(database),
          clock,
        );
        const first = await service.process(raw.transactionId);
        const receipt = await database.depositReceipt.findFirstOrThrow();
        now = new Date(now.getTime() + 60000);
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "ACCOUNTED",
          credits: [{ replayed: true }],
        });
        expect(await database.depositReceipt.findFirstOrThrow()).toEqual(
          receipt,
        );
        expect(first).toMatchObject({
          state: "ACCOUNTED",
          credits: [
            { result: { recordedAt: receipt.recordedAt.toISOString() } },
          ],
        });
      });
    }));
  it.each([
    [
      "unfinalized",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.solidified.block_header.raw_data.number = 122;
      },
    ],
    [
      "failed",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.receipt.result = "REVERT";
      },
    ],
    [
      "disappeared",
      (raw: ReturnType<typeof rawDeposit>) => {
        for (const key of Object.keys(raw.info))
          Reflect.deleteProperty(raw.info, key);
      },
    ],
    [
      "malformed",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [{ ...transferLog(), data: "0.0000001" }];
      },
    ],
    [
      "wrong token",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [{ ...transferLog(), address: "44".repeat(20) }];
      },
    ],
    [
      "unowned recipient",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.log = [transferLog(depositToken)];
      },
    ],
    [
      "unfinalized height",
      (raw: ReturnType<typeof rawDeposit>) => {
        raw.info.blockNumber = 124;
      },
    ],
  ])("leaves all money unchanged for %s evidence", async (_name, alter) =>
    withAdmittedFinancialDatabase(async (database) => {
      await createDepositAssignment(database);
      const before = await depositState(database);
      const raw = rawDeposit();
      alter(raw);
      await withDepositProvider(raw, async (provider, config) => {
        const service = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, depositClock),
          financialFixtureAdmission(database),
          depositClock,
        );
        expect((await service.process(raw.transactionId)).state).not.toBe(
          "ACCOUNTED",
        );
        expect(
          (
            await service.process({
              transactionId: raw.transactionId,
              amount: "1.000001",
              employeeId: randomUUID(),
            })
          ).state,
        ).toBe("UNRESOLVED");
      });
      expect(await depositState(database)).toEqual(before);
    }),
  );
  it("rejects network/token mismatches and nonready ownership without a partial credit", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const owner = await createDepositAssignment(database);
      const before = await depositState(database);
      await withDepositProvider(rawDeposit(), async (provider, config) => {
        for (const incorrect of [
          { ...config, network: "TRON_SHASTA" as const },
          { ...config, token: { ...config.token, contract: depositRecipient } },
        ]) {
          const service = new DepositCreditService(
            database,
            new DepositVerifier(database, provider, incorrect, depositClock),
            financialFixtureAdmission(database),
            depositClock,
          );
          expect(
            await service.process(rawDeposit().transactionId),
          ).toMatchObject({ state: "CONFLICT" });
        }
        const pendingAccount = await createFinancialAccount(database);
        await database.depositAddressAssignment.create({
          data: {
            employeeId: pendingAccount.ownerUserId,
            walletId: pendingAccount.wallet.id,
            network: "TRON_NILE",
            keyRecordId: randomUUID(),
            address: depositToken,
            state: "KEY_STORED",
            keyEnvelopeDigest: "a".repeat(64),
            keyVersion: 1,
            scanBoundaryBlockNumber: 100n,
            scanBoundaryBlockId: "a".repeat(64),
            scanBoundaryTimestamp: 1n,
          },
        });
        const raw = rawDeposit([transferLog(depositToken)]);
        await withDepositProvider(
          raw,
          async (pendingProvider, pendingConfig) => {
            const pending = new DepositCreditService(
              database,
              new DepositVerifier(
                database,
                pendingProvider,
                pendingConfig,
                depositClock,
              ),
              financialFixtureAdmission(database),
              depositClock,
            );
            expect(await pending.process(raw.transactionId)).toMatchObject({
              state: "UNRESOLVED",
              code: "DEPOSIT_ASSIGNMENT_UNAVAILABLE",
            });
          },
        );
      });
      expect(await database.depositReceipt.count()).toBe(0);
      expect(
        await database.wallet.findUniqueOrThrow({
          where: { id: owner.wallet.id },
        }),
      ).toEqual(before.wallets[0]);
    }));
  it("rolls back the receipt, audit and credit on total wallet overflow", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const owner = await createDepositAssignment(database);
      await fixtureLedger(database).execute(
        {
          kind: "CREDIT",
          walletId: owner.wallet.id,
          businessNamespace: "p06.fixture",
          businessKey: randomUUID(),
          amount: MAX_USDT_AMOUNT,
          source: "REFERRAL",
          origin: "REFERRAL_COMMISSION",
        },
        fixtureContext(owner.wallet.id),
      );
      const before = await depositState(database);
      const raw = rawDeposit();
      await withDepositProvider(raw, async (provider, config) => {
        const service = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, depositClock),
          financialFixtureAdmission(database),
          depositClock,
        );
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "UNRESOLVED",
          code: "LEDGER_AMOUNT_BOUNDS",
        });
      });
      expect(await depositState(database)).toEqual(before);
    }));
  it("rolls back every earlier write after an actual late receipt insert failure", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      await createDepositAssignment(database);
      const before = await depositState(database);
      await database.$executeRaw`CREATE FUNCTION fixture_receipt_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled late receipt failure'; END $$`;
      await database.$executeRaw`CREATE TRIGGER fixture_receipt_failure AFTER INSERT ON deposit_receipts FOR EACH ROW EXECUTE FUNCTION fixture_receipt_failure()`;
      const raw = rawDeposit();
      await withDepositProvider(raw, async (provider, config) => {
        const service = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, depositClock),
          financialFixtureAdmission(database),
          depositClock,
        );
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "UNRESOLVED",
          code: "LEDGER_INTERNAL",
        });
      });
      expect(await depositState(database)).toEqual(before);
    }));
  it.each(["Free", "expired", "banned", "blocked"])(
    "credits a %s employee at a closed weekend window without restoring authority",
    async (lifecycle) =>
      withAdmittedFinancialDatabase(async (database) => {
        const account = await createIdentityFixture(database);
        let clock = depositClock;
        if (account.wallet === null) throw new Error("Missing fixture wallet");
        if (lifecycle === "expired") {
          await fundSubscriptionFixture(database, account, {
            referral: "0",
            nonReferral: "60",
          });
          const active = await activateSubscriptionFixture(database, account);
          const expiredWeekend = new Date(active.subscription.expiresAt);
          while (expiredWeekend.getUTCDay() !== 6)
            expiredWeekend.setUTCDate(expiredWeekend.getUTCDate() + 1);
          expiredWeekend.setUTCHours(20, 0, 0, 0);
          clock = () => new Date(expiredWeekend);
        }
        if (lifecycle === "banned")
          await database.user.update({
            where: { id: account.user.id },
            data: { status: "BANNED" },
          });
        if (lifecycle === "blocked")
          await database.user.update({
            where: { id: account.user.id },
            data: { withdrawalsBlocked: true, tasksBlocked: true },
          });
        await bindDepositAssignment(
          database,
          {
            ownerUserId: account.user.id,
            wallet: account.wallet,
          },
          depositRecipient,
          clock(),
        );
        const before = await database.user.findUniqueOrThrow({
          where: { id: account.user.id },
        });
        const subscriptions = await database.subscription.findMany();
        const raw = rawDeposit();
        await withDepositProvider(raw, async (provider, config) => {
          const service = new DepositCreditService(
            database,
            new DepositVerifier(database, provider, config, clock),
            financialFixtureAdmission(database),
            clock,
          );
          expect(await service.process(raw.transactionId)).toMatchObject({
            state: "ACCOUNTED",
          });
        });
        expect(
          await database.user.findUniqueOrThrow({
            where: { id: account.user.id },
          }),
        ).toEqual(before);
        expect(await database.subscription.findMany()).toEqual(subscriptions);
        expect(
          await database.wallet.findUniqueOrThrow({
            where: { id: account.wallet.id },
          }),
        ).toMatchObject({ availableNonReferralUnits: 1000001n });
        if (lifecycle === "banned")
          await expect(
            readSessionAuthority(
              database,
              { userId: account.user.id, sessionId: account.session.id },
              depositClock(),
              "USER",
            ),
          ).rejects.toThrow();
      }),
  );
  it("credits 1.000001 once across 100 repeats and retains separate raw logs", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const owner = await createDepositAssignment(database);
      const raw = rawDeposit([
        { address: "44".repeat(20), topics: [], data: "" },
        transferLog(),
        transferLog(undefined, 1n),
      ]);
      await withDepositProvider(raw, async (provider, config) => {
        const service = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, depositClock),
          financialFixtureAdmission(database),
          depositClock,
        );
        for (let repeat = 0; repeat < 100; repeat++)
          expect((await service.process(raw.transactionId)).state).toBe(
            "ACCOUNTED",
          );
      });
      expect(
        await database.depositReceipt.findMany({
          orderBy: { logIndex: "asc" },
        }),
      ).toMatchObject([
        { logIndex: 1, amountUnits: 1000001n },
        { logIndex: 2, amountUnits: 1n },
      ]);
      expect(await database.financialOperation.count()).toBe(2);
      expect(await database.ledgerPosting.count()).toBe(2);
      expect(await database.auditRecord.count()).toBe(2);
      expect(
        await database.wallet.findUniqueOrThrow({
          where: { id: owner.wallet.id },
        }),
      ).toMatchObject({
        availableNonReferralUnits: 1000002n,
        availableReferralUnits: 0n,
        reservedNonReferralUnits: 0n,
        reservedReferralUnits: 0n,
      });
    }));
  it("keeps changed evidence unresolved without overwriting a receipt", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      await createDepositAssignment(database);
      const raw = rawDeposit();
      await withDepositProvider(raw, async (provider, config) => {
        const service = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, depositClock),
          financialFixtureAdmission(database),
          depositClock,
        );
        await service.process(raw.transactionId);
        const original = await database.depositReceipt.findFirstOrThrow();
        raw.info.log = [transferLog(undefined, 2000000n)];
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "CONFLICT",
        });
        raw.info.log = [transferLog(depositToken)];
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "CONFLICT",
        });
        raw.info.log = [];
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "CONFLICT",
        });
        raw.info.receipt.result = "REVERT";
        expect(await service.process(raw.transactionId)).toMatchObject({
          state: "CONFLICT",
        });
        expect(await database.depositReceipt.findFirstOrThrow()).toEqual(
          original,
        );
        expect(await database.financialOperation.count()).toBe(1);
      });
    }));
});
