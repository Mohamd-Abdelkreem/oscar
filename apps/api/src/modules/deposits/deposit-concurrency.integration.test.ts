import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { LedgerService } from "../ledger/ledger.service.js";
import { DepositVerifier } from "./deposit-verifier.js";
import { DepositCreditService } from "./deposit-credit.service.js";
import { ManualCreditService } from "./manual-credit.service.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import {
  depositIdentity,
  manualGrant,
} from "./testing/deposit-http-fixtures.js";
import { PurchaseQuoteService } from "../subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../subscriptions/subscription-purchase.service.js";
import { fundSubscriptionFixture } from "../subscriptions/testing/subscription-fixtures.js";
import { parseUsdtAmount } from "../../core/financial/money.js";
import { PurchaseError } from "../subscriptions/subscriptions.errors.js";
import {
  financialFixtureAdmission,
  financialRaceBarrier,
  withAdmittedFinancialDatabase,
  withAdmittedIndependentFinancialClients,
} from "../ledger/testing/financial-fixtures.js";
import {
  createDepositAssignment,
  depositClock,
  rawDeposit,
  withDepositProvider,
  bindDepositAssignment,
} from "./testing/deposit-fixtures.js";

describe("direct deposit concurrency", () => {
  it.each(["deposit", "purchase"] as const)(
    "preserves exact grants racing an actual %s service",
    async (competitor) =>
      withAdmittedFinancialDatabase(async (database, url) => {
        const employee = await createIdentityFixture(database, {
          now: depositClock(),
        });
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now: depositClock(),
        });
        if (employee.wallet === null)
          throw new Error("Employee wallet required");
        await fundSubscriptionFixture(
          database,
          employee,
          { referral: "10", nonReferral: "100" },
          depositClock(),
        );
        const quote = await new PurchaseQuoteService(
          database,
          depositClock,
        ).create(depositIdentity(employee), { packageCode: "S1" });
        const purchaseCommitted = await withAdmittedIndependentFinancialClients(
          url,
          async (grantClient, otherClient) => {
            if (employee.wallet === null)
              throw new Error("Employee wallet required");
            await bindDepositAssignment(database, {
              ownerUserId: employee.user.id,
              wallet: employee.wallet,
            });
            const start = financialRaceBarrier(2);
            const body = { ...manualGrant(employee.user.id), amount: "2" };
            const grant = async () => {
              await start();
              return new ManualCreditService(
                grantClient,
                depositClock,
                financialFixtureAdmission(grantClient),
              ).create(depositIdentity(admin), body, randomUUID());
            };
            const raw = rawDeposit();
            return withDepositProvider(raw, async (provider, config) => {
              const compete = async () => {
                await start();
                if (competitor === "purchase")
                  return new SubscriptionPurchaseService(
                    otherClient,
                    depositClock,
                    financialFixtureAdmission(otherClient),
                  ).purchase(
                    depositIdentity(employee),
                    { quoteId: quote.quoteId, confirmed: true },
                    randomUUID(),
                  );
                return new DepositCreditService(
                  otherClient,
                  new DepositVerifier(
                    otherClient,
                    provider,
                    config,
                    depositClock,
                  ),
                  financialFixtureAdmission(otherClient),
                  depositClock,
                ).process(raw.transactionId);
              };
              const [grantReply, competitorReply] = await Promise.allSettled([
                grant(),
                compete(),
              ]);
              expect(grantReply.status).toBe("fulfilled");
              if (grantReply.status !== "fulfilled") throw grantReply.reason;
              expect(grantReply.value.amount).toBe("2");
              if (competitorReply.status === "rejected") {
                // A preceding grant invalidates the reviewed wallet snapshot; it must never be silently requoted/debited.
                expect(competitor).toBe("purchase");
                expect(competitorReply.reason).toBeInstanceOf(PurchaseError);
                expect(competitorReply.reason).toMatchObject({
                  code: "PURCHASE_QUOTE_STALE",
                });
              } else if (competitor === "deposit") {
                expect(competitorReply.value).toMatchObject({
                  state: "ACCOUNTED",
                });
              }
              return (
                competitor === "purchase" &&
                competitorReply.status === "fulfilled"
              );
            });
          },
        );
        const wallet = await database.wallet.findUniqueOrThrow({
          where: { id: employee.wallet.id },
        });
        const expected =
          competitor === "deposit"
            ? 113000001n
            : 112000000n -
              (purchaseCommitted ? parseUsdtAmount(quote.fullDebit) : 0n);
        expect(
          wallet.availableNonReferralUnits + wallet.availableReferralUnits,
        ).toBe(expected);
        expect(
          wallet.reservedNonReferralUnits + wallet.reservedReferralUnits,
        ).toBe(0n);
        expect(await database.manualCredit.count()).toBe(1);
        expect(await database.purchase.count()).toBe(purchaseCommitted ? 1 : 0);
        expect(await database.depositReceipt.count()).toBe(
          competitor === "deposit" ? 1 : 0,
        );
        const report = await new LedgerService(
          database,
          {
            businessNamespaces: [
              "p06.manual-credit",
              "p06.deposit",
              "p04.purchase",
              "p04.fixture.funding",
            ],
            processIds: ["fixture"],
          },
          financialFixtureAdmission(database),
        ).reconcileWallet(wallet.id, {
          actor: { type: "USER", userId: admin.user.id },
          observe: async () => {},
        });
        expect(report.consistent).toBe(true);
      }),
  );
  it("preserves exact available and reserved provenance while credit competes with reservation", async () =>
    withAdmittedFinancialDatabase(async (database, url) => {
      await withAdmittedIndependentFinancialClients(
        url,
        async (depositor, reserver) => {
          const owner = await createDepositAssignment(database);
          const ledger = new LedgerService(
            reserver,
            { businessNamespaces: ["p06.fixture"], processIds: ["fixture"] },
            financialFixtureAdmission(reserver),
          );
          const context = {
            actor: { type: "PROCESS" as const, processId: "fixture" },
            walletIds: [owner.wallet.id],
            clock: depositClock,
            observe: async () => {},
            mutate: async () => {},
            eligibleSources: () =>
              Promise.resolve(["NON_REFERRAL", "REFERRAL"] as const),
          };
          for (const [source, amount] of [
            ["NON_REFERRAL", "40"],
            ["REFERRAL", "20"],
          ] as const)
            await ledger.execute(
              {
                kind: "CREDIT",
                walletId: owner.wallet.id,
                businessNamespace: "p06.fixture",
                businessKey: randomUUID(),
                amount,
                source,
                origin:
                  source === "REFERRAL" ? "REFERRAL_COMMISSION" : "DEPOSIT",
              },
              context,
            );
          const raw = rawDeposit();
          await withDepositProvider(raw, async (provider, config) => {
            const start = financialRaceBarrier(2);
            const deposit = async () => {
              await start();
              return new DepositCreditService(
                depositor,
                new DepositVerifier(depositor, provider, config, depositClock),
                financialFixtureAdmission(depositor),
                depositClock,
              ).process(raw.transactionId);
            };
            const reserve = async () => {
              await start();
              return ledger.execute(
                {
                  kind: "RESERVE",
                  walletId: owner.wallet.id,
                  businessNamespace: "p06.fixture",
                  businessKey: randomUUID(),
                  amount: "50",
                  reservationId: randomUUID(),
                },
                context,
              );
            };
            expect(
              (await Promise.all([deposit(), reserve()]))[0],
            ).toMatchObject({ state: "ACCOUNTED" });
          });
          const wallet = await database.wallet.findUniqueOrThrow({
            where: { id: owner.wallet.id },
          });
          const allocation =
            await database.reservationAllocation.findFirstOrThrow();
          // Either valid lock order conserves 61.000001 and the reservation's exact source allocation.
          expect(
            wallet.availableNonReferralUnits + wallet.availableReferralUnits,
          ).toBe(11000001n);
          expect(wallet.reservedNonReferralUnits).toBe(
            allocation.nonReferralUnits,
          );
          expect(wallet.reservedReferralUnits).toBe(allocation.referralUnits);
          expect(
            wallet.availableNonReferralUnits + wallet.reservedNonReferralUnits,
          ).toBe(41000001n);
          expect(
            wallet.availableReferralUnits + wallet.reservedReferralUnits,
          ).toBe(20000000n);
          expect(allocation.grossUnits).toBe(50000000n);
          expect(await database.depositReceipt.count()).toBe(1);
          expect(await database.financialOperation.count()).toBe(4);
          expect(await database.auditRecord.count()).toBe(4);
        },
      );
    }));
  it("converges independent simultaneous credits to one receipt and source effect", async () =>
    withAdmittedFinancialDatabase(async (database, url) => {
      await withAdmittedIndependentFinancialClients(
        url,
        async (first, second) => {
          const owner = await createDepositAssignment(database);
          const raw = rawDeposit();
          await withDepositProvider(raw, async (provider, config) => {
            const ready = financialRaceBarrier(2);
            const credit = async (client: typeof first) => {
              const service = new DepositCreditService(
                client,
                new DepositVerifier(client, provider, config, depositClock),
                financialFixtureAdmission(client),
                depositClock,
              );
              await ready();
              return service.process(raw.transactionId);
            };
            expect(
              await Promise.all([credit(first), credit(second)]),
            ).toMatchObject([{ state: "ACCOUNTED" }, { state: "ACCOUNTED" }]);
          });
          expect(await database.depositReceipt.count()).toBe(1);
          expect(await database.financialOperation.count()).toBe(1);
          expect(await database.ledgerPosting.count()).toBe(1);
          expect(await database.auditRecord.count()).toBe(1);
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { id: owner.wallet.id },
            }),
          ).toMatchObject({
            availableNonReferralUnits: 1000001n,
            reservedNonReferralUnits: 0n,
            reservedReferralUnits: 0n,
          });
        },
      );
    }));
});
