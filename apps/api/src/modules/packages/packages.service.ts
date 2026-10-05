import {
  adminCatalogSchema,
  catalogSchema,
  referralSettingsDataSchema,
} from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import { readSessionAuthority } from "../auth/session-authority.js";
import type { SubscriptionIdentity } from "../subscriptions/subscriptions.service.js";
import { mapPackageTerms, mapReferralSettings } from "./packages.mapper.js";

export class PackagesService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async catalog(identity: SubscriptionIdentity) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now);
        const configured = await transaction.package.findMany({
          orderBy: { tierOrder: "asc" },
        });
        return catalogSchema.parse({
          items: configured.map(mapPackageTerms),
          serverNow: now.toISOString(),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async adminCatalog(identity: SubscriptionIdentity) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        const configured = await transaction.package.findMany({
          orderBy: { tierOrder: "asc" },
        });
        const counts = await transaction.subscription.groupBy({
          by: ["packageCode"],
          where: {
            state: "CURRENT",
            activationAt: { lte: now },
            expiresAt: { gt: now },
          },
          _count: { _all: true },
        });
        const byCode = new Map(
          counts.map((group) => [group.packageCode, group._count._all]),
        );
        return adminCatalogSchema.parse({
          items: configured.map((row) => ({
            terms: mapPackageTerms(row),
            activeSubscriptionsCount: byCode.get(row.code) ?? 0,
          })),
          serverNow: now.toISOString(),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async referralSettings(identity: SubscriptionIdentity) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        const configured = await transaction.referralSettings.findUniqueOrThrow(
          { where: { id: 1 } },
        );
        return referralSettingsDataSchema.parse({
          ...mapReferralSettings(configured),
          serverNow: now.toISOString(),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
