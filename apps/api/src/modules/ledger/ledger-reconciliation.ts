import type { WalletComponents } from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";
import { z } from "zod";
import { AppError } from "../../core/errors/app.error.js";
import { runAuthorityGuard } from "./ledger.effects.js";
import { LedgerError } from "./ledger.errors.js";
import { mapWalletComponents } from "./ledger.mapper.js";
import { checkActorAccount, ledgerActorSchema } from "./ledger.transaction.js";
import type { LedgerObservationContext, LedgerPolicy } from "./ledger.types.js";
import {
  checkOperation,
  compareMoney,
  components,
  operationEvidence,
  type ReportFault,
  type LedgerReconciliation,
} from "./ledger-reconciliation.evidence.js";

export type {
  LedgerDiscrepancy,
  LedgerReconciliation,
} from "./ledger-reconciliation.evidence.js";

const PAGE_SIZE = 100;
const MAX_DISCREPANCIES = 200;
const observationSchema = z
  .object({
    actor: ledgerActorSchema,
    observe: z.custom<LedgerObservationContext["observe"]>(
      (candidate) => typeof candidate === "function",
    ),
  })
  .strict();

const integerTextSchema = z.string().regex(/^-?(?:0|[1-9][0-9]*)$/u);
const exactAggregate = (raw: unknown): bigint => {
  const parsed = integerTextSchema.safeParse(raw);
  if (!parsed.success) throw new LedgerError("LEDGER_INTERNAL");
  return BigInt(parsed.data);
};
const checkAggregates = async (
  transaction: Prisma.TransactionClient,
  walletId: string,
  wallet: WalletComponents,
  report: ReportFault,
) => {
  const sums = await transaction.$queryRaw<
    {
      availableNonReferral: string;
      reservedNonReferral: string;
      availableReferral: string;
      reservedReferral: string;
    }[]
  >(Prisma.sql`
    SELECT COALESCE(SUM(available_delta_units::numeric) FILTER (WHERE source='NON_REFERRAL'),0)::text AS "availableNonReferral",
      COALESCE(SUM(reserved_delta_units::numeric) FILTER (WHERE source='NON_REFERRAL'),0)::text AS "reservedNonReferral",
      COALESCE(SUM(available_delta_units::numeric) FILTER (WHERE source='REFERRAL'),0)::text AS "availableReferral",
      COALESCE(SUM(reserved_delta_units::numeric) FILTER (WHERE source='REFERRAL'),0)::text AS "reservedReferral"
    FROM ledger_postings WHERE wallet_id=${walletId}::uuid`);
  const sum = sums[0];
  if (sum === undefined) throw new LedgerError("LEDGER_INTERNAL");
  const actual = components(wallet);
  for (const component of Object.keys(actual) as (keyof typeof actual)[])
    compareMoney(
      report,
      { category: "PROJECTION_MISMATCH", component },
      exactAggregate(sum[component]),
      actual[component],
    );
  const allocations = await transaction.$queryRaw<
    { nonReferral: string; referral: string }[]
  >(
    Prisma.sql`SELECT COALESCE(SUM(non_referral_units::numeric),0)::text AS "nonReferral", COALESCE(SUM(referral_units::numeric),0)::text AS "referral" FROM reservation_allocations WHERE wallet_id=${walletId}::uuid AND state='ACTIVE'`,
  );
  const allocation = allocations[0];
  if (allocation === undefined) throw new LedgerError("LEDGER_INTERNAL");
  compareMoney(
    report,
    { category: "ALLOCATION_MISMATCH", component: "reservedNonReferral" },
    exactAggregate(allocation.nonReferral),
    actual.reservedNonReferral,
  );
  compareMoney(
    report,
    { category: "ALLOCATION_MISMATCH", component: "reservedReferral" },
    exactAggregate(allocation.referral),
    actual.reservedReferral,
  );
};

export const reconcileWallet = async (
  database: DatabaseClient,
  policy: LedgerPolicy,
  rawWalletId: unknown,
  rawContext: unknown,
): Promise<LedgerReconciliation> => {
  const walletId = z.uuid().safeParse(rawWalletId);
  const context = observationSchema.safeParse(rawContext);
  if (
    !walletId.success ||
    !context.success ||
    (context.data.actor.type === "PROCESS" &&
      !policy.processIds.includes(context.data.actor.processId))
  )
    throw new LedgerError("LEDGER_FORBIDDEN");
  try {
    return await database.$transaction(
      async (transaction) => {
        await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
        const wallet = await transaction.wallet.findUnique({
          where: { id: walletId.data },
        });
        if (wallet === null) throw new LedgerError("LEDGER_FORBIDDEN");
        const accounts =
          context.data.actor.type === "USER"
            ? await transaction.user.findMany({
                where: { id: context.data.actor.userId },
              })
            : [];
        const actorAccount = checkActorAccount(context.data, accounts);
        await runAuthorityGuard(() =>
          context.data.observe({
            transaction,
            wallet: Object.freeze({ ...wallet }),
            actor: context.data.actor,
            actorAccount,
          }),
        );
        const reconciliation: LedgerReconciliation = {
          walletId: wallet.id,
          consistent: true,
          discrepancies: [],
          truncated: false,
        };
        const report: ReportFault = (fault) => {
          reconciliation.consistent = false;
          if (reconciliation.discrepancies.length < MAX_DISCREPANCIES)
            reconciliation.discrepancies.push(fault);
          else reconciliation.truncated = true;
        };
        await checkAggregates(
          transaction,
          wallet.id,
          mapWalletComponents(wallet),
          report,
        );
        let cursor: string | undefined;
        for (;;) {
          // Start from operations, preserving empty posting sets just as a LEFT JOIN would.
          const operations = await transaction.financialOperation.findMany({
            where: { walletId: wallet.id },
            include: operationEvidence,
            orderBy: { id: "asc" },
            take: PAGE_SIZE,
            ...(cursor === undefined
              ? {}
              : { cursor: { id: cursor }, skip: 1 }),
          });
          for (const operation of operations) checkOperation(operation, report);
          if (operations.length < PAGE_SIZE) break;
          cursor = operations.at(-1)?.id;
        }
        return reconciliation;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: 5000,
        timeout: 10000,
      },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new LedgerError("LEDGER_INTERNAL", { cause: error });
  }
};
