import type { AdminLedgerFilter } from "@template/contracts";
import { Prisma } from "@template/database";
import { safeCountSchema } from "@template/contracts";
import {
  formatAggregateUsdtAmount,
  formatSignedAggregateUsdtDelta,
} from "../../core/financial/money.js";

const operationLabels = [
  {
    kind: "SETTLE",
    origin: "WITHDRAWAL_SETTLEMENT",
    labels: "withdrawal settlement completed سحب مكتمل",
  },
  { kind: "CREDIT", origin: "DEPOSIT", labels: "deposit إيداع رصيد" },
  {
    kind: "CREDIT",
    origin: "TASK_REWARD",
    labels: "task reward مكافأة مهمة",
  },
  {
    kind: "CREDIT",
    origin: "REFERRAL_COMMISSION",
    labels: "referral commission عمولة إحالة",
  },
  {
    kind: "PURCHASE_DEBIT",
    origin: "PACKAGE_PURCHASE",
    labels: "package purchase شراء باقة",
  },
  {
    kind: "CORRECTION",
    origin: "ADMIN_ADJUSTMENT",
    labels: "admin adjustment correction تسوية إدارية تعديل إداري",
  },
  {
    kind: "RESERVE",
    origin: "WITHDRAWAL_RESERVATION",
    labels: "withdrawal reservation حجز رصيد سحب",
  },
  {
    kind: "RELEASE",
    origin: "RESERVATION_RELEASE",
    labels: "reservation release فك حجز سحب تحرير حجز",
  },
] as const;
const containsLiteral = (value: string) =>
  `%${value.replace(/[\\%_]/gu, "\\$&")}%`;
export function historyPredicate(
  filter: AdminLedgerFilter,
  employeeId?: string,
): Prisma.Sql {
  const clauses = [Prisma.sql`u.role::text = 'USER'`];
  const owner = employeeId ?? filter.employeeId;
  if (owner !== undefined)
    clauses.push(Prisma.sql`w.owner_user_id = ${owner}::uuid`);
  if (filter.kind !== undefined)
    clauses.push(Prisma.sql`o.kind::text = ${filter.kind}`);
  if (filter.origin !== undefined)
    clauses.push(Prisma.sql`o.origin::text = ${filter.origin}`);
  if (filter.source !== undefined)
    clauses.push(
      Prisma.sql`EXISTS (SELECT 1 FROM ledger_postings p WHERE p.operation_id=o.id AND p.source::text=${filter.source})`,
    );
  if (filter.from !== undefined)
    clauses.push(Prisma.sql`o.created_at >= ${new Date(filter.from)}`);
  if (filter.to !== undefined)
    clauses.push(Prisma.sql`o.created_at < ${new Date(filter.to)}`);
  if (filter.direction !== undefined) {
    const delta = Prisma.sql`(SELECT SUM(p.available_delta_units::numeric+p.reserved_delta_units::numeric) FROM ledger_postings p WHERE p.operation_id=o.id)`;
    clauses.push(
      filter.direction === "NEUTRAL"
        ? Prisma.sql`${delta}=0`
        : filter.direction === "CREDIT"
          ? Prisma.sql`${delta}>0`
          : Prisma.sql`${delta}<0`,
    );
  }
  if (filter.q !== undefined && filter.q.length > 0) {
    const pattern = containsLiteral(filter.q);
    const search = [
      Prisma.sql`u.full_name ILIKE ${pattern}`,
      Prisma.sql`o.id::text ILIKE ${pattern}`,
      Prisma.sql`o.kind::text ILIKE ${pattern}`,
      Prisma.sql`o.origin::text ILIKE ${pattern}`,
      Prisma.sql`EXISTS (SELECT 1 FROM financial_audit_records a WHERE a.operation_id=o.id AND a.reference_operation_id::text ILIKE ${pattern})`,
      Prisma.sql`EXISTS (SELECT 1 FROM ledger_postings p WHERE p.operation_id=o.id AND p.source::text ILIKE ${pattern})`,
    ];
    for (const label of operationLabels)
      if (
        label.labels.toLocaleLowerCase().includes(filter.q.toLocaleLowerCase())
      )
        search.push(
          Prisma.sql`(o.kind::text=${label.kind} AND o.origin::text=${label.origin})`,
        );
    for (const [source, labels] of [
      ["REFERRAL", "referral إحالة"],
      ["NON_REFERRAL", "non referral other أموال أخرى"],
    ] as const)
      if (labels.includes(filter.q.toLowerCase()))
        search.push(
          Prisma.sql`EXISTS (SELECT 1 FROM ledger_postings p WHERE p.operation_id=o.id AND p.source::text=${source})`,
        );
    clauses.push(Prisma.sql`(${Prisma.join(search, " OR ")})`);
  }
  return Prisma.sql`${Prisma.join(clauses, " AND ")}`;
}
export async function readHistory(
  transaction: Prisma.TransactionClient,
  filter: AdminLedgerFilter,
  employeeId?: string,
) {
  const where = historyPredicate(filter, employeeId);
  const aggregate = await transaction.$queryRaw<
    { total: bigint; neutral: bigint; credits: string; debits: string }[]
  >(Prisma.sql`
    WITH filtered AS (SELECT o.id,o.kind,(SELECT SUM(p.available_delta_units::numeric+p.reserved_delta_units::numeric) FROM ledger_postings p WHERE p.operation_id=o.id) delta FROM financial_operations o JOIN wallets w ON w.id=o.wallet_id JOIN users u ON u.id=w.owner_user_id WHERE ${where})
    SELECT COUNT(*) total,COUNT(*) FILTER (WHERE kind::text IN ('RESERVE','RELEASE')) neutral,COALESCE(SUM(GREATEST(delta,0)),0)::text credits,COALESCE(SUM(GREATEST(-delta,0)),0)::text debits FROM filtered`);
  const totals = aggregate[0];
  if (totals === undefined) throw new Error("History aggregate is missing.");
  const ids = await transaction.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT o.id FROM financial_operations o JOIN wallets w ON w.id=o.wallet_id JOIN users u ON u.id=w.owner_user_id WHERE ${where} ORDER BY o.created_at DESC,o.id DESC LIMIT ${filter.limit} OFFSET ${(filter.page - 1) * filter.limit}`,
  );
  const credits = BigInt(totals.credits),
    debits = BigInt(totals.debits);
  return {
    ids: ids.map((row) => row.id),
    total: safeCountSchema.parse(Number(totals.total)),
    summary: {
      scope: "FILTERED_OPERATIONS" as const,
      credits: formatAggregateUsdtAmount(credits),
      debits: formatAggregateUsdtAmount(debits),
      net: formatSignedAggregateUsdtDelta(credits - debits),
      neutralOperationsCount: safeCountSchema.parse(Number(totals.neutral)),
    },
  };
}
export async function readWalletTotals(
  transaction: Prisma.TransactionClient,
  employeeId?: string,
) {
  const rows = await transaction.$queryRaw<
    {
      available: string;
      reserved: string;
      referral: string;
      nonReferral: string;
      owned: string;
    }[]
  >(Prisma.sql`
    SELECT COALESCE(SUM(w.available_referral_units::numeric+w.available_non_referral_units::numeric),0)::text available,
    COALESCE(SUM(w.reserved_referral_units::numeric+w.reserved_non_referral_units::numeric),0)::text reserved,
    COALESCE(SUM(w.available_referral_units::numeric+w.reserved_referral_units::numeric),0)::text referral,
    COALESCE(SUM(w.available_non_referral_units::numeric+w.reserved_non_referral_units::numeric),0)::text "nonReferral",
    COALESCE(SUM(w.available_referral_units::numeric+w.available_non_referral_units::numeric+w.reserved_referral_units::numeric+w.reserved_non_referral_units::numeric),0)::text owned
    FROM wallets w JOIN users u ON u.id=w.owner_user_id WHERE u.role::text='USER' ${employeeId === undefined ? Prisma.empty : Prisma.sql`AND u.id=${employeeId}::uuid`}`);
  const row = rows[0];
  if (row === undefined) throw new Error("Wallet aggregate is missing.");
  return {
    available: formatAggregateUsdtAmount(BigInt(row.available)),
    reserved: formatAggregateUsdtAmount(BigInt(row.reserved)),
    referral: formatAggregateUsdtAmount(BigInt(row.referral)),
    nonReferral: formatAggregateUsdtAmount(BigInt(row.nonReferral)),
    owned: formatAggregateUsdtAmount(BigInt(row.owned)),
  };
}
