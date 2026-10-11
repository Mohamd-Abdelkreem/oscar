import {
  adminWalletViewSchema,
  adminFinancePageSchema,
  ledgerPageSchema,
  ledgerFilterSchema,
  adminLedgerFilterSchema,
  type EmployeeLedgerDetail,
  type AdminLedgerDetail,
} from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import { NotFoundException } from "../../core/errors/index.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import type { SubscriptionIdentity } from "../subscriptions/subscriptions.service.js";
import {
  walletOwnerSelect,
  mapWallet,
  mapLedgerRow,
  mapAdminLedgerRow,
  operationViewSelect,
  operationDetailSelect,
  mapLedgerDetail,
  mapAdminLedgerDetail,
} from "./wallets.mapper.js";
import { readHistory, readWalletTotals } from "./wallet-history.query.js";
import {
  withdrawalExecutionReady,
  type WithdrawalCapabilityContext,
} from "../withdrawals/withdrawal-readiness.js";

export class WalletsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
    private readonly withdrawalCapability: WithdrawalCapabilityContext = {},
  ) {}
  private observe<T>(
    identity: SubscriptionIdentity,
    role: "USER" | "ADMIN",
    work: (transaction: Prisma.TransactionClient, now: Date) => Promise<T>,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, role);
        return work(transaction, now);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  wallet(identity: SubscriptionIdentity) {
    return this.observe(identity, "USER", async (transaction, now) => {
      const owner = await transaction.user.findFirst({
        where: { id: identity.userId, role: "USER" },
        select: walletOwnerSelect,
      });
      if (owner === null) throw new NotFoundException();
      return mapWallet(
        owner,
        now,
        await withdrawalExecutionReady(transaction, this.withdrawalCapability),
      );
    });
  }
  employeeWallet(identity: SubscriptionIdentity, employeeId: string) {
    return this.observe(identity, "ADMIN", async (transaction, now) => {
      const owner = await transaction.user.findFirst({
        where: { id: employeeId, role: "USER" },
        select: walletOwnerSelect,
      });
      if (owner === null) throw new NotFoundException();
      return adminWalletViewSchema.parse({
        ...mapWallet(
          owner,
          now,
          await withdrawalExecutionReady(
            transaction,
            this.withdrawalCapability,
          ),
        ),
        employee: {
          id: owner.id,
          fullName: owner.fullName,
          email: owner.email,
        },
      });
    });
  }
  history(identity: SubscriptionIdentity, rawQuery: unknown) {
    const query = ledgerFilterSchema.parse(rawQuery);
    return this.observe(identity, "USER", async (transaction, now) => {
      const history = await readHistory(transaction, query, identity.userId);
      const rows = await transaction.financialOperation.findMany({
        where: {
          id: { in: history.ids },
          wallet: { ownerUserId: identity.userId },
        },
        select: operationViewSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      const { neutralOperationsCount: _neutral, ...summary } = history.summary;
      return ledgerPageSchema.parse({
        items: rows.map(mapLedgerRow),
        pagination: buildPaginationMeta({ ...query, total: history.total }),
        summary,
        serverNow: now.toISOString(),
      });
    });
  }
  finance(identity: SubscriptionIdentity, rawQuery: unknown) {
    const query = adminLedgerFilterSchema.parse(rawQuery);
    return this.observe(identity, "ADMIN", async (transaction, now) => {
      if (
        query.employeeId !== undefined &&
        (await transaction.user.count({
          where: { id: query.employeeId, role: "USER" },
        })) !== 1
      )
        throw new NotFoundException();
      const history = await readHistory(transaction, query);
      const rows = await transaction.financialOperation.findMany({
        where: { id: { in: history.ids }, wallet: { owner: { role: "USER" } } },
        select: operationViewSelect,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return adminFinancePageSchema.parse({
        items: rows.map(mapAdminLedgerRow),
        pagination: buildPaginationMeta({ ...query, total: history.total }),
        summary: history.summary,
        serverNow: now.toISOString(),
        walletTotalsScope:
          query.employeeId === undefined
            ? { kind: "ALL_EMPLOYEES" }
            : { kind: "EMPLOYEE", employeeId: query.employeeId },
        walletTotals: await readWalletTotals(transaction, query.employeeId),
      });
    });
  }
  detail(
    identity: SubscriptionIdentity,
    operationId: string,
    admin: true,
  ): Promise<AdminLedgerDetail>;
  detail(
    identity: SubscriptionIdentity,
    operationId: string,
    admin?: false,
  ): Promise<EmployeeLedgerDetail>;
  detail(identity: SubscriptionIdentity, operationId: string, admin = false) {
    return this.observe(
      identity,
      admin ? "ADMIN" : "USER",
      async (transaction) => {
        const operation = await transaction.financialOperation.findFirst({
          where: {
            id: operationId,
            wallet: admin
              ? { owner: { role: "USER" } }
              : { ownerUserId: identity.userId },
          },
          select: operationDetailSelect,
        });
        if (operation === null) throw new NotFoundException();
        return admin
          ? mapAdminLedgerDetail(operation)
          : mapLedgerDetail(operation);
      },
    );
  }
}
