import {
  membershipSchema,
  purchaseHistorySchema,
  subscriptionHistorySchema,
  boundedPageQuerySchema,
} from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import { NotFoundException } from "../../core/errors/index.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import {
  isEffectiveSubscription,
  mapPurchase,
  mapSubscription,
  purchaseOutcomeInclude,
  subscriptionViewSelect,
} from "./subscriptions.mapper.js";

export type SubscriptionIdentity = Readonly<{
  userId: string;
  sessionId: string;
}>;

export const currentSubscription = (
  transaction: Prisma.TransactionClient,
  userId: string,
) =>
  transaction.subscription.findFirst({
    where: { ownerUserId: userId, state: "CURRENT" },
  });

export class SubscriptionsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async membership(identity: SubscriptionIdentity) {
    return this.readMembership(identity, identity.userId, "USER");
  }

  async employeeMembership(identity: SubscriptionIdentity, employeeId: string) {
    return this.readMembership(identity, employeeId, "ADMIN");
  }

  private async readMembership(
    identity: SubscriptionIdentity,
    employeeId: string,
    role: "USER" | "ADMIN",
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, role);
        if (role === "ADMIN") {
          const employee = await transaction.user.findFirst({
            where: { id: employeeId, role: "USER" },
            select: { id: true },
          });
          if (employee === null) throw new NotFoundException();
        }
        const subscription = await transaction.subscription.findFirst({
          where: { ownerUserId: employeeId, state: "CURRENT" },
          select: subscriptionViewSelect,
        });
        return membershipSchema.parse({
          employeeId,
          serverNow: now.toISOString(),
          effective: isEffectiveSubscription(subscription, now)
            ? "PAID"
            : "FREE",
          subscription:
            subscription === null ? null : mapSubscription(subscription),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async subscriptionHistory(identity: SubscriptionIdentity, rawQuery: unknown) {
    const query = boundedPageQuerySchema.parse(rawQuery);
    return this.database.$transaction(
      async (transaction) => {
        await readSessionAuthority(transaction, identity, this.clock(), "USER");
        const where = { ownerUserId: identity.userId };
        const total = await transaction.subscription.count({ where });
        const subscriptions = await transaction.subscription.findMany({
          where,
          select: subscriptionViewSelect,
          orderBy: [{ activationAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        return subscriptionHistorySchema.parse({
          items: subscriptions.map(mapSubscription),
          pagination: buildPaginationMeta({ ...query, total }),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async purchaseHistory(identity: SubscriptionIdentity, rawQuery: unknown) {
    const query = boundedPageQuerySchema.parse(rawQuery);
    return this.database.$transaction(
      async (transaction) => {
        await readSessionAuthority(transaction, identity, this.clock(), "USER");
        const where = { buyerId: identity.userId };
        const total = await transaction.purchase.count({ where });
        const purchases = await transaction.purchase.findMany({
          where,
          include: purchaseOutcomeInclude,
          orderBy: [{ purchasedAt: "desc" }, { id: "desc" }],
          skip: (query.page - 1) * query.limit,
          take: query.limit,
        });
        return purchaseHistorySchema.parse({
          items: purchases.map(mapPurchase),
          pagination: buildPaginationMeta({ ...query, total }),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async purchaseDetail(identity: SubscriptionIdentity, purchaseId: string) {
    return this.database.$transaction(
      async (transaction) => {
        await readSessionAuthority(transaction, identity, this.clock(), "USER");
        const purchase = await transaction.purchase.findFirst({
          where: { id: purchaseId, buyerId: identity.userId },
          include: purchaseOutcomeInclude,
        });
        if (purchase === null) throw new NotFoundException();
        return mapPurchase(purchase);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
