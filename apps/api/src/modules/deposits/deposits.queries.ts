import { Prisma, type TronNetwork } from "@template/database";
import type { AdminDepositHistoryQuery } from "@template/contracts";
import { depositOperationSelect } from "./deposits.mapper.js";
import { AppError } from "../../core/errors/app.error.js";

function historySelection(query: AdminDepositHistoryQuery, ownerId?: string) {
  const employeeId = ownerId ?? query.employeeId;
  const filters = [
    employeeId === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`w.owner_user_id = ${employeeId}::uuid`,
    query.kind === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`h.kind = ${query.kind}`,
    query.from === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`o.created_at >= ${new Date(query.from)}`,
    query.to === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`o.created_at <= ${new Date(query.to)}`,
    query.transactionId === undefined
      ? Prisma.sql`TRUE`
      : Prisma.sql`h.transaction_id = ${query.transactionId}`,
    query.q === undefined || query.q === ""
      ? Prisma.sql`TRUE`
      : Prisma.sql`(strpos(lower(u.full_name), lower(${query.q})) > 0 OR strpos(lower(u.email), lower(${query.q})) > 0)`,
  ];
  return Prisma.sql`WITH h AS (
    SELECT id, financial_operation_id, 'CHAIN_DEPOSIT'::text AS kind, transaction_id FROM deposit_receipts
    UNION ALL SELECT id, financial_operation_id, 'MANUAL_CREDIT'::text, NULL::text FROM manual_credits
  ), history AS (
    SELECT h.id, o.id AS operation_id, o.created_at FROM h
    JOIN financial_operations o ON o.id = h.financial_operation_id
    JOIN wallets w ON w.id = o.wallet_id JOIN users u ON u.id = w.owner_user_id
    WHERE ${Prisma.join(filters, " AND ")}
  )`;
}
export async function readDepositHistory(
  transaction: Prisma.TransactionClient,
  query: AdminDepositHistoryQuery,
  ownerId?: string,
) {
  const selection = historySelection(query, ownerId);
  const counts = await transaction.$queryRaw<{ total: bigint }[]>(
    Prisma.sql`${selection} SELECT count(*) AS total FROM history`,
  );
  const rows = await transaction.$queryRaw<
    { id: string; operation_id: string }[]
  >(
    Prisma.sql`${selection} SELECT id, operation_id FROM history ORDER BY created_at DESC, id DESC, operation_id DESC LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`,
  );
  const operations = await transaction.financialOperation.findMany({
    where: { id: { in: rows.map((row) => row.operation_id) } },
    select: depositOperationSelect,
  });
  const byId = new Map(
    operations.map((operation) => [operation.id, operation]),
  );
  const total = Number(counts[0]?.total);
  if (!Number.isSafeInteger(total))
    throw new AppError(
      "Deposit history is unresolved.",
      409,
      "DEPOSIT_UNRESOLVED",
    );
  return {
    total,
    operations: rows.map((row) => {
      const operation = byId.get(row.operation_id);
      if (operation === undefined)
        throw new AppError(
          "Deposit history is unresolved.",
          409,
          "DEPOSIT_UNRESOLVED",
        );
      return operation;
    }),
  };
}
const retryableCandidateCodes = [
  "TRON_UNAVAILABLE",
  "TRON_UNFINALIZED",
  "TRON_THROTTLED",
  "DEPOSIT_UNFINALIZED",
];
async function readCandidateDetection(
  transaction: Prisma.TransactionClient,
  assignmentId: string,
) {
  const discoveries = { some: { assignmentId } };
  const unresolved = await transaction.depositCandidate.findFirst({
    where: {
      discoveries,
      OR: [
        { state: "CONFLICT" },
        {
          state: "UNRESOLVED",
          OR: [
            { lastErrorCode: null },
            { lastErrorCode: { notIn: retryableCandidateCodes } },
          ],
        },
      ],
    },
    select: { id: true },
  });
  if (unresolved !== null) return "UNRESOLVED";
  const retrying = await transaction.depositCandidate.findFirst({
    where: { discoveries, state: "UNRESOLVED" },
    select: { id: true },
  });
  return retrying === null ? null : "RETRYING";
}
const conflictCode = (code: string | null | undefined) =>
  [
    "EVIDENCE_CONFLICT",
    "TRON_IDENTITY_CONFLICT",
    "DEPOSIT_EVIDENCE_CONFLICT",
    "CUSTODY_EVIDENCE_CONFLICT",
  ].includes(code ?? "");
export async function readDepositDetection(
  transaction: Prisma.TransactionClient,
  employeeId: string,
  network: TronNetwork,
  now: Date,
) {
  const assignment = await transaction.depositAddressAssignment.findFirst({
    where: { employeeId, network },
    select: {
      id: true,
      lastErrorCode: true,
      scans: {
        where: { mode: "HOT" },
        select: { lastCompletedAt: true, lastErrorCode: true },
        take: 1,
      },
    },
  });
  const progress = assignment?.scans[0];
  const candidateStatus =
    assignment === null
      ? null
      : await readCandidateDetection(transaction, assignment.id);
  const control = await transaction.financialRuntimeControl.findUnique({
    where: { id: 1 },
    select: { financialWritesFenced: true },
  });
  const unresolved =
    candidateStatus === "UNRESOLVED" ||
    conflictCode(assignment?.lastErrorCode) ||
    conflictCode(progress?.lastErrorCode);
  const retrying =
    candidateStatus === "RETRYING" ||
    assignment?.lastErrorCode != null ||
    progress?.lastErrorCode != null;
  return {
    status: unresolved
      ? "UNRESOLVED"
      : assignment === null
        ? "NOT_STARTED"
        : control?.financialWritesFenced
          ? "PAUSED"
          : retrying
            ? "RETRYING"
            : progress === undefined
              ? "NOT_STARTED"
              : "SCANNING",
    lastSuccessfulScanAt: progress?.lastCompletedAt?.toISOString() ?? null,
    serverNow: now.toISOString(),
  };
}
