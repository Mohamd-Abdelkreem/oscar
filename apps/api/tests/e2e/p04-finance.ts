import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@template/database";
import type { FinancialRuntimeAdmission } from "../../src/modules/custody/runtime-control.js";
import { formatUsdtAmount } from "../../src/core/financial/money.js";
import { createIdentityFixture } from "../../src/modules/auth/testing/identity-fixtures.js";
import { fundSubscriptionFixture } from "../../src/modules/subscriptions/testing/subscription-fixtures.js";
import { PurchaseQuoteService } from "../../src/modules/subscriptions/purchase-quote.service.js";
import { SubscriptionPurchaseService } from "../../src/modules/subscriptions/subscription-purchase.service.js";
import { PackageConfigurationService } from "../../src/modules/packages/package-configuration.service.js";
import { LedgerService } from "../../src/modules/ledger/ledger.service.js";
import type { LedgerContext } from "../../src/modules/ledger/ledger.types.js";
import { p04StateSchema } from "./control.js";

type Account = Awaited<ReturnType<typeof createIdentityFixture>>;
export class P04FinanceScenario {
  private instant = new Date();
  readonly clock = () => new Date(this.instant);
  private accounts = new Map<string, Account>();
  constructor(
    private readonly database: DatabaseClient,
    private readonly admission: FinancialRuntimeAdmission,
  ) {}
  setClock(instant: string) {
    this.instant = new Date(instant);
  }
  async fund(
    email: string,
    amounts: { referral: string; nonReferral: string },
  ) {
    const account = this.accounts.get(email);
    if (!account) throw new Error("P04_UNKNOWN_FIXTURE");
    await fundSubscriptionFixture(this.database, account, amounts, {
      now: this.clock(),
      admission: this.admission,
    });
  }
  async release(email: string) {
    const wallet = this.accounts.get(email)?.wallet;
    if (!wallet) throw new Error("P04_UNKNOWN_FIXTURE");
    const allocation =
      await this.database.reservationAllocation.findFirstOrThrow({
        where: { walletId: wallet.id, state: "ACTIVE" },
        orderBy: { grossUnits: "desc" },
      });
    const guard = () => Promise.resolve();
    await new LedgerService(
      this.database,
      {
        businessNamespaces: ["p04.e2e.release"],
        processIds: ["p04-e2e"],
      },
      this.admission,
    ).execute(
      {
        kind: "RELEASE",
        walletId: wallet.id,
        reservationId: allocation.id,
        businessNamespace: "p04.e2e.release",
        businessKey: randomUUID(),
      },
      {
        actor: { type: "PROCESS", processId: "p04-e2e" },
        walletIds: [wallet.id],
        clock: this.clock,
        observe: guard,
        mutate: guard,
        releaseSafety: guard,
      },
    );
  }
  private async buy(account: Account) {
    const identity = { userId: account.user.id, sessionId: account.session.id };
    const quote = await new PurchaseQuoteService(
      this.database,
      this.clock,
    ).create(identity, { packageCode: "S1" });
    await new SubscriptionPurchaseService(
      this.database,
      this.clock,
      this.admission,
    ).purchase(
      identity,
      { quoteId: quote.quoteId, confirmed: true },
      quote.quoteId,
    );
  }
  async referralPurchase(event: "after-rate" | "after-expiry") {
    const buyer = this.accounts.get("buyer@p04.test");
    if (!buyer) throw new Error("P04_UNKNOWN_FIXTURE");
    const email = `${event}@p04.test`;
    if (this.accounts.has(email)) throw new Error("P04_EVENT_ALREADY_CREATED");
    const child = await createIdentityFixture(this.database, {
      passwordHash: buyer.user.passwordHash,
      sponsorUserId: buyer.user.id,
      now: this.clock(),
    });
    child.user = await this.database.user.update({
      where: { id: child.user.id },
      data: { email, fullName: `P04 ${event}` },
    });
    this.accounts.set(email, child);
    await this.fund(email, { referral: "0", nonReferral: "60" });
    await this.buy(child);
  }
  async fixtures(profile: "purchase" | "wallet" | "referrals") {
    if (this.accounts.size !== 0)
      throw new Error("P04_FIXTURES_ALREADY_CREATED");
    const admin = await this.database.user.findUniqueOrThrow({
      where: { email: "admin@p03.test" },
      select: { passwordHash: true },
    });
    const editor = await createIdentityFixture(this.database, {
      role: "ADMIN",
      passwordHash: admin.passwordHash,
      now: this.clock(),
    });
    const configuration = new PackageConfigurationService(
      this.database,
      this.clock,
    );
    for (const terms of await this.database.package.findMany({
      orderBy: { tierOrder: "asc" },
    })) {
      await configuration.editPackage(
        { userId: editor.user.id, sessionId: editor.session.id },
        terms.code,
        {
          commandId: randomUUID(),
          expectedVersion: terms.version,
          countedWorkDates: 2,
          reason: "P04 finite isolated acceptance terms",
          confirmed: true,
        },
      );
    }
    const create = async (
      email: string,
      name: string,
      sponsorUserId?: string,
    ) => {
      const account = await createIdentityFixture(this.database, {
        passwordHash: admin.passwordHash,
        now: this.clock(),
        ...(sponsorUserId ? { sponsorUserId } : {}),
      });
      account.user = await this.database.user.update({
        where: { id: account.user.id },
        data: { email, fullName: name },
      });
      this.accounts.set(email, account);
      return account;
    };
    let sponsor: Account | undefined;
    const ancestors: Account[] = [];
    for (let level = 0; level < 5; level++) {
      const ancestor = await create(
        `ancestor-${String(level)}@p04.test`,
        `P04 ancestor ${String(level)}`,
        sponsor?.user.id,
      );
      await this.fund(ancestor.user.email, {
        referral: "0",
        nonReferral: "1000",
      });
      await this.buy(ancestor);
      ancestors.push(ancestor);
      sponsor = ancestor;
    }
    const buyer = await create("buyer@p04.test", "P04 buyer", sponsor?.user.id);
    const other = await create("other@p04.test", "P04 other root");
    await this.fund(buyer.user.email, { referral: "200", nonReferral: "1000" });
    if (profile === "referrals") {
      await this.buy(buyer);
      for (let index = 0; index < 28; index++) {
        const child = await create(
          `child-${String(index)}@p04.test`,
          `P04 descendant ${String(index)}`,
          buyer.user.id,
        );
        await this.fund(child.user.email, { referral: "0", nonReferral: "60" });
        await this.buy(child);
      }
      let parent = buyer;
      for (let depth = 1; depth <= 6; depth++) {
        parent = await create(
          `deep-${String(depth)}@p04.test`,
          `P04 deep ${String(depth)}`,
          parent.user.id,
        );
      }
    }
    if (profile === "wallet") {
      const wallet = buyer.wallet;
      if (wallet === null) throw new Error("P04_WALLET_REQUIRED");
      const ledger = new LedgerService(
        this.database,
        {
          businessNamespaces: ["p04.e2e.reserve"],
          processIds: ["p04-e2e"],
        },
        this.admission,
      );
      const guard = () => Promise.resolve();
      const context: LedgerContext = {
        actor: { type: "PROCESS", processId: "p04-e2e" },
        walletIds: [wallet.id],
        clock: this.clock,
        observe: guard,
        mutate: guard,
        eligibleSources: () => Promise.resolve(["REFERRAL", "NON_REFERRAL"]),
      };
      for (let index = 0; index < 28; index++)
        await ledger.execute(
          {
            kind: "RESERVE",
            walletId: wallet.id,
            businessNamespace: "p04.e2e.reserve",
            businessKey: randomUUID(),
            reservationId: randomUUID(),
            amount: index === 0 ? "1001" : "1",
          },
          context,
        );
    }
    const root = ancestors[0];
    if (!root) throw new Error("P04_ROOT_REQUIRED");
    return {
      buyerId: buyer.user.id,
      rootId: root.user.id,
      otherId: other.user.id,
    };
  }
  async state(email: string) {
    const user = await this.database.user.findUniqueOrThrow({
      where: { email },
      select: { id: true },
    });
    const wallet = await this.database.wallet.findUniqueOrThrow({
      where: { ownerUserId: user.id },
    });
    const purchases = await this.database.purchase.findMany({
      where: { buyerId: user.id },
      orderBy: { buyerSequence: "asc" },
      take: 20,
      select: { priceUnits: true, countedWorkDates: true },
    });
    const term = await this.database.subscription.findFirst({
      where: { ownerUserId: user.id, state: "CURRENT" },
      select: { expiresAt: true },
    });
    const total =
      wallet.availableReferralUnits +
      wallet.availableNonReferralUnits +
      wallet.reservedReferralUnits +
      wallet.reservedNonReferralUnits;
    return p04StateSchema.parse({
      employeeId: user.id,
      purchases: await this.database.purchase.count({
        where: { buyerId: user.id },
      }),
      subscriptions: await this.database.subscription.count({
        where: { ownerUserId: user.id },
      }),
      awards: await this.database.referralDecision.count({
        where: { recipientUserId: user.id, decision: "AWARDED" },
      }),
      skipped: await this.database.referralDecision.count({
        where: { recipientUserId: user.id, decision: "SKIPPED" },
      }),
      operations: await this.database.financialOperation.count({
        where: { walletId: wallet.id },
      }),
      postings: await this.database.ledgerPosting.count({
        where: { walletId: wallet.id },
      }),
      configurationChanges: await this.database.configurationChange.count(),
      wallet: {
        availableReferral: formatUsdtAmount(wallet.availableReferralUnits),
        availableNonReferral: formatUsdtAmount(
          wallet.availableNonReferralUnits,
        ),
        reservedReferral: formatUsdtAmount(wallet.reservedReferralUnits),
        reservedNonReferral: formatUsdtAmount(wallet.reservedNonReferralUnits),
        total: formatUsdtAmount(total),
      },
      savedPrices: purchases.map((purchase) =>
        formatUsdtAmount(purchase.priceUnits),
      ),
      savedCountedDates: purchases.map((purchase) => purchase.countedWorkDates),
      expiresAt: term?.expiresAt.toISOString() ?? null,
    });
  }
}
