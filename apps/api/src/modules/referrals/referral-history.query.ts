import type { adminCommissionFilterSchema } from "@template/contracts";
import { safeCountSchema } from "@template/contracts";
import { Prisma } from "@template/database";
import type { z } from "zod";
import { formatAggregateUsdtAmount } from "../../core/financial/money.js";

type CommissionFilter = z.infer<typeof adminCommissionFilterSchema>;

function commissionPredicate(
  query: CommissionFilter,
  beneficiaryId: string,
  employee: boolean,
) {
  const predicates = [Prisma.sql`d.recipient_user_id=${beneficiaryId}::uuid`];
  if (employee)
    predicates.push(Prisma.sql`d.decision IN ('AWARDED','ELIGIBLE_ZERO')`);
  else if (query.decision !== undefined)
    predicates.push(Prisma.sql`d.decision=${query.decision}`);
  if (query.level !== undefined)
    predicates.push(Prisma.sql`d.level=${query.level}`);
  if (query.from !== undefined)
    predicates.push(Prisma.sql`d.occurred_at>=${new Date(query.from)}`);
  if (query.to !== undefined)
    predicates.push(Prisma.sql`d.occurred_at<${new Date(query.to)}`);
  if (query.buyerId !== undefined)
    predicates.push(Prisma.sql`p.buyer_id=${query.buyerId}::uuid`);
  return Prisma.sql`${Prisma.join(predicates, " AND ")}`;
}

export async function readCommissionHistory(
  transaction: Prisma.TransactionClient,
  scope: { query: CommissionFilter; beneficiaryId: string; employee: boolean },
) {
  const { query, beneficiaryId, employee } = scope;
  const where = commissionPredicate(query, beneficiaryId, employee);
  const totals = await transaction.$queryRaw<
    { total: bigint; units: string }[]
  >(
    Prisma.sql`SELECT COUNT(*) total, COALESCE(SUM(d.award_units::numeric),0)::text units FROM referral_decisions d JOIN purchases p ON p.id=d.purchase_id WHERE ${where}`,
  );
  const aggregate = totals[0];
  if (aggregate === undefined)
    throw new Error("Commission aggregate is missing.");
  const rows = await transaction.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT d.id FROM referral_decisions d JOIN purchases p ON p.id=d.purchase_id WHERE ${where} ORDER BY d.occurred_at DESC,d.id DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
  );
  return {
    ids: rows.map((row) => row.id),
    total: safeCountSchema.parse(Number(aggregate.total)),
    awarded: formatAggregateUsdtAmount(BigInt(aggregate.units)),
  };
}
