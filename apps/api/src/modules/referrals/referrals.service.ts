import {
  employeeTeamSummarySchema,
  adminTeamSummarySchema,
  employeeMemberPageSchema,
  adminMemberPageSchema,
  employeeMemberFilterSchema,
  adminMemberFilterSchema,
  rootSearchFilterSchema,
  rootIdentityPageSchema,
  commissionFilterSchema,
  adminCommissionFilterSchema,
  employeeCommissionPageSchema,
  adminCommissionPageSchema,
  safeCountSchema,
  type EmployeeTeamSummary,
  type AdminTeamSummary,
} from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import type { z } from "zod";
import {
  ForbiddenException,
  NotFoundException,
} from "../../core/errors/index.js";
import { formatAggregateUsdtAmount } from "../../core/financial/money.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import type { SubscriptionIdentity } from "../subscriptions/subscriptions.service.js";
import {
  mapAdminCommission,
  mapEmployeeCommission,
  savedCommissionInclude,
  mapReferralRoot,
  referralRootSelect,
} from "./referrals.mapper.js";
import { memberPredicate, relativeTree } from "./referral-tree.query.js";
import { readCommissionHistory } from "./referral-history.query.js";

type EmployeeMemberPage = z.infer<typeof employeeMemberPageSchema>;
type AdminMemberPage = z.infer<typeof adminMemberPageSchema>;
type EmployeeCommissionPage = z.infer<typeof employeeCommissionPageSchema>;
type AdminCommissionPage = z.infer<typeof adminCommissionPageSchema>;

export class ReferralsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}
  private observe<T>(
    identity: SubscriptionIdentity,
    rootId: string | undefined,
    work: (
      transaction: Prisma.TransactionClient,
      now: Date,
      rootId: string,
    ) => Promise<T>,
  ) {
    return this.database.$transaction(
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(
          transaction,
          identity,
          now,
          rootId === undefined ? "USER" : "ADMIN",
        );
        const selected = rootId ?? identity.userId;
        if (
          (await transaction.user.count({
            where: { id: selected, role: "USER" },
          })) !== 1
        )
          throw new NotFoundException();
        return work(transaction, now, selected);
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  summary(identity: SubscriptionIdentity): Promise<EmployeeTeamSummary>;
  summary(
    identity: SubscriptionIdentity,
    rootId: string,
  ): Promise<AdminTeamSummary>;
  summary(identity: SubscriptionIdentity, rootId?: string) {
    return this.observe(
      identity,
      rootId,
      async (transaction, now, selected) => {
        const root = await transaction.user.findUniqueOrThrow({
          where: { id: selected },
          select: referralRootSelect,
        });
        const rates = await transaction.referralSettings.findUniqueOrThrow({
          where: { id: 1 },
          select: {
            version: true,
            level1Bps: true,
            level2Bps: true,
            level3Bps: true,
            level4Bps: true,
            level5Bps: true,
          },
        });
        const counts = await transaction.$queryRaw<
          { level: number; members: bigint; paid: bigint }[]
        >(Prisma.sql`${relativeTree(selected, { maximumDepth: rootId === undefined ? 5 : null })}
        SELECT LEAST(t.level,6) level,COUNT(*) members,COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM subscriptions s WHERE s.owner_user_id=t.id AND s.state='CURRENT' AND s.activation_at<=${now} AND s.expires_at>${now})) paid FROM tree t GROUP BY LEAST(t.level,6)`);
        const earned = await transaction.$queryRaw<
          { level: number; units: string }[]
        >(
          Prisma.sql`SELECT level,SUM(award_units::numeric)::text units FROM referral_decisions WHERE recipient_user_id=${selected}::uuid GROUP BY level`,
        );
        const levelCounts = Array.from({ length: 5 }, (_, index) => {
          const row = counts.find((count) => count.level === index + 1);
          return {
            level: index + 1,
            members: safeCountSchema.parse(Number(row?.members ?? 0n)),
            paidMembers: safeCountSchema.parse(Number(row?.paid ?? 0n)),
          };
        });
        const levelUnits = Array.from({ length: 5 }, (_, index) =>
          BigInt(earned.find((row) => row.level === index + 1)?.units ?? "0"),
        );
        const fields = {
          serverNow: now.toISOString(),
          currentRates: {
            version: rates.version,
            ratesBps: [
              rates.level1Bps,
              rates.level2Bps,
              rates.level3Bps,
              rates.level4Bps,
              rates.level5Bps,
            ],
          },
          levelCounts,
          ownEarned: {
            byLevel: levelUnits.map(formatAggregateUsdtAmount),
            total: formatAggregateUsdtAmount(
              levelUnits.reduce((sum, units) => sum + units, 0n),
            ),
          },
        };
        return rootId === undefined
          ? employeeTeamSummarySchema.parse({
              ...fields,
              root: {
                id: root.id,
                fullName: root.fullName,
                referralCode: root.referralCode,
              },
            })
          : adminTeamSummarySchema.parse({
              ...fields,
              root: mapReferralRoot(root),
              levelCountsScope: "ROOT_UNFILTERED",
              deeperDescendantCount: safeCountSchema.parse(
                Number(
                  counts
                    .filter((row) => row.level > 5)
                    .reduce((sum, row) => sum + row.members, 0n),
                ),
              ),
            });
      },
    );
  }
  members(
    identity: SubscriptionIdentity,
    query: unknown,
  ): Promise<EmployeeMemberPage>;
  members(
    identity: SubscriptionIdentity,
    query: unknown,
    rootId: string,
  ): Promise<AdminMemberPage>;
  members(identity: SubscriptionIdentity, rawQuery: unknown, rootId?: string) {
    const query = (
      rootId === undefined
        ? employeeMemberFilterSchema
        : adminMemberFilterSchema
    ).parse(rawQuery);
    return this.observe(
      identity,
      rootId,
      async (transaction, now, selected) => {
        const where = memberPredicate(query);
        const totals = await transaction.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`${relativeTree(selected, { details: rootId !== undefined })} SELECT COUNT(*) total FROM tree t WHERE ${where}`,
        );
        const rows = await transaction.$queryRaw<
          {
            id: string;
            full_name: string;
            email: string;
            created_at: Date;
            level: number;
            path: unknown;
            package_code: string | null;
            earned: string;
          }[]
        >(Prisma.sql`${relativeTree(selected, { details: rootId !== undefined })}
        SELECT t.id,t.full_name,t.created_at,t.level ${rootId === undefined ? Prisma.empty : Prisma.sql`,t.email,t.path`},(SELECT s.package_code FROM subscriptions s WHERE s.owner_user_id=t.id AND s.state='CURRENT' AND s.activation_at<=${now} AND s.expires_at>${now}) package_code,
        COALESCE((SELECT SUM(d.award_units::numeric) FROM referral_decisions d JOIN purchases p ON p.id=d.purchase_id WHERE d.recipient_user_id=${selected}::uuid AND p.buyer_id=t.id),0)::text earned
        FROM tree t WHERE ${where} ORDER BY t.level,t.created_at DESC,t.id DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`);
        const total = totals[0];
        if (total === undefined) throw new Error("Member count is missing.");
        const page = {
          rootId: selected,
          memberCountScope: "FILTERED_MEMBERS",
          serverNow: now.toISOString(),
          pagination: buildPaginationMeta({
            ...query,
            total: safeCountSchema.parse(Number(total.total)),
          }),
          items: rows.map((row) => ({
            id: row.id,
            fullName: row.full_name,
            joinedAt: row.created_at.toISOString(),
            level: row.level,
            packageCode: row.package_code,
            viewerEarnedFromMember: formatAggregateUsdtAmount(
              BigInt(row.earned),
            ),
            ...(rootId === undefined
              ? {}
              : { email: row.email, path: row.path }),
          })),
        };
        return rootId === undefined
          ? employeeMemberPageSchema.parse(page)
          : adminMemberPageSchema.parse(page);
      },
    );
  }
  roots(identity: SubscriptionIdentity, rawQuery: unknown) {
    const query = rootSearchFilterSchema.parse(rawQuery);
    return this.database.$transaction(
      async (transaction) => {
        await readSessionAuthority(
          transaction,
          identity,
          this.clock(),
          "ADMIN",
        );
        const where: Prisma.UserWhereInput = {
          role: "USER",
          ...(query.q === undefined || query.q.length === 0
            ? {}
            : {
                OR: [
                  { fullName: { contains: query.q, mode: "insensitive" } },
                  { email: { contains: query.q, mode: "insensitive" } },
                  { referralCode: { contains: query.q, mode: "insensitive" } },
                ],
              }),
        };
        const total = await transaction.user.count({ where });
        const rows = await transaction.user.findMany({
          where,
          select: referralRootSelect,
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: query.limit,
          skip: (query.page - 1) * query.limit,
        });
        return rootIdentityPageSchema.parse({
          items: rows.map(mapReferralRoot),
          pagination: buildPaginationMeta({ ...query, total }),
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  commissions(
    identity: SubscriptionIdentity,
    query: unknown,
  ): Promise<EmployeeCommissionPage>;
  commissions(
    identity: SubscriptionIdentity,
    query: unknown,
    rootId: string,
  ): Promise<AdminCommissionPage>;
  commissions(
    identity: SubscriptionIdentity,
    rawQuery: unknown,
    rootId?: string,
  ) {
    const query = (
      rootId === undefined
        ? commissionFilterSchema
        : adminCommissionFilterSchema
    ).parse(rawQuery);
    return this.observe(
      identity,
      rootId,
      async (transaction, now, selected) => {
        const history = await readCommissionHistory(transaction, {
          query,
          beneficiaryId: selected,
          employee: rootId === undefined,
        });
        const rows = await transaction.referralDecision.findMany({
          where: { id: { in: history.ids }, recipientUserId: selected },
          include: savedCommissionInclude,
          orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        });
        const page = {
          beneficiaryId: selected,
          serverNow: now.toISOString(),
          summary: {
            scope: "FILTERED_BENEFICIARY_DECISIONS",
            awarded: history.awarded,
          },
          pagination: buildPaginationMeta({ ...query, total: history.total }),
        };
        if (rootId !== undefined)
          return adminCommissionPageSchema.parse({
            ...page,
            items: rows.map(mapAdminCommission),
          });
        return employeeCommissionPageSchema.parse({
          ...page,
          items: rows.map((row) => {
            const mapped = mapEmployeeCommission(row, selected);
            if (mapped === null) throw new ForbiddenException();
            return mapped;
          }),
        });
      },
    );
  }
}
