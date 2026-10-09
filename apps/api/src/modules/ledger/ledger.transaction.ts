import { AsyncLocalStorage } from "node:async_hooks";

import {
  Prisma,
  UserStatus,
  type DatabaseClient,
  type User,
  type Wallet,
} from "@template/database";
import { z } from "zod";

import { AppError } from "../../core/errors/app.error.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerError } from "./ledger.errors.js";
import type { LedgerContext, LedgerPolicy } from "./ledger.types.js";

const TRANSACTION_MAX_WAIT_MS = 5000;
const TRANSACTION_TIMEOUT_MS = 10000;
const MAX_TRANSACTION_ATTEMPTS = 3;
const RETRYABLE_SQLSTATES = ["40001", "40P01"] as const;
const adapterConflictSchema = z.object({
  driverAdapterError: z.object({
    cause: z.object({ originalCode: z.enum(RETRYABLE_SQLSTATES) }),
  }),
});
const activeFinancialTransaction = new AsyncLocalStorage<boolean>();
const uuidSchema = z.uuid();
export const ledgerActorSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("USER"), userId: uuidSchema }).strict(),
  z
    .object({
      type: z.literal("PROCESS"),
      processId: z.string().min(1).max(64),
    })
    .strict(),
]);
const contextSchema = z
  .object({
    actor: ledgerActorSchema,
    walletIds: z.array(uuidSchema).min(1),
    authorityUserIds: z.array(uuidSchema).optional(),
    clock: z.custom<LedgerContext["clock"]>(
      (candidate) => typeof candidate === "function",
    ),
    observe: z.custom<LedgerContext["observe"]>(
      (candidate) => typeof candidate === "function",
    ),
    mutate: z.custom<LedgerContext["mutate"]>(
      (candidate) => typeof candidate === "function",
    ),
    eligibleSources: z
      .custom<NonNullable<LedgerContext["eligibleSources"]>>(
        (candidate) => typeof candidate === "function",
      )
      .optional(),
    releaseSafety: z
      .custom<NonNullable<LedgerContext["releaseSafety"]>>(
        (candidate) => typeof candidate === "function",
      )
      .optional(),
    settlementSafety: z
      .custom<NonNullable<LedgerContext["settlementSafety"]>>(
        (candidate) => typeof candidate === "function",
      )
      .optional(),
  })
  .strict();

export const validateLedgerContext = (
  rawContext: unknown,
  policy: LedgerPolicy,
): LedgerContext => {
  const parsed = contextSchema.safeParse(rawContext);
  if (!parsed.success) throw new LedgerError("LEDGER_FORBIDDEN");
  const context = parsed.data;
  if (
    context.actor.type === "PROCESS" &&
    !policy.processIds.includes(context.actor.processId)
  )
    throw new LedgerError("LEDGER_FORBIDDEN");
  return {
    actor: Object.freeze(context.actor),
    clock: context.clock,
    observe: context.observe,
    mutate: context.mutate,
    walletIds: Object.freeze([...context.walletIds]),
    ...(context.authorityUserIds === undefined
      ? {}
      : { authorityUserIds: Object.freeze([...context.authorityUserIds]) }),
    ...(context.eligibleSources === undefined
      ? {}
      : { eligibleSources: context.eligibleSources }),
    ...(context.releaseSafety === undefined
      ? {}
      : { releaseSafety: context.releaseSafety }),
    ...(context.settlementSafety === undefined
      ? {}
      : { settlementSafety: context.settlementSafety }),
  };
};

export const checkActorAccount = (
  context: Pick<LedgerContext, "actor">,
  accounts: readonly User[],
): User | null => {
  if (context.actor.type === "PROCESS") return null;
  const actorId = context.actor.userId;
  const account = accounts.find((candidate) => candidate.id === actorId);
  if (
    account === undefined ||
    account.status !== UserStatus.ACTIVE ||
    account.emailVerifiedAt === null
  )
    throw new LedgerError("LEDGER_FORBIDDEN");
  return account;
};

const lockParticipants = async (
  transaction: Prisma.TransactionClient,
  context: LedgerContext,
): Promise<{ participantIds: string[]; actorAccounts: User[] }> => {
  const walletIds = [...new Set(context.walletIds)].sort();
  const owners = await transaction.wallet.findMany({
    where: { id: { in: walletIds } },
    select: { ownerUserId: true },
  });
  if (owners.length !== walletIds.length)
    throw new LedgerError("LEDGER_FORBIDDEN");
  const actorIds = context.actor.type === "USER" ? [context.actor.userId] : [];
  const accountIds = [
    ...new Set([
      ...owners.map((wallet) => wallet.ownerUserId),
      ...actorIds,
      ...(context.authorityUserIds ?? []),
    ]),
  ].sort();
  const accounts = await transaction.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM users WHERE id IN (${Prisma.join(accountIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  // Read models after locks: SQL column names intentionally stay out of the authority contract.
  if (accounts.length !== accountIds.length)
    throw new LedgerError("LEDGER_FORBIDDEN");
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM wallets WHERE id IN (${Prisma.join(walletIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  await transaction.$queryRaw(
    Prisma.sql`SELECT id FROM reservation_allocations WHERE wallet_id IN (${Prisma.join(walletIds.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`,
  );
  // Process actors have no actor account; participant locks still serialize employee authority.
  const actorAccounts =
    context.actor.type === "PROCESS"
      ? []
      : await transaction.user.findMany({ where: { id: { in: accountIds } } });
  return { participantIds: accountIds, actorAccounts };
};

export type LockedLedgerTransaction = {
  transaction: Prisma.TransactionClient;
  wallet: (id: string) => Promise<Wallet>;
  assertActive: () => void;
};

const runLockedLedgerTransaction = async <T>(
  database: DatabaseClient,
  context: LedgerContext,
  work: (scope: LockedLedgerTransaction) => Promise<T>,
  admission?: FinancialRuntimeAdmission,
): Promise<T> => {
  if (activeFinancialTransaction.getStore() === true)
    throw new LedgerError("LEDGER_INVALID_TRANSACTION");
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await database.$transaction(
        async (transaction) => {
          await admission?.assertMutationAdmission(transaction);
          const participants = await lockParticipants(transaction, context);
          checkActorAccount(context, participants.actorAccounts);
          let active = true;
          const assertActive = () => {
            if (!active) throw new LedgerError("LEDGER_INVALID_TRANSACTION");
          };
          const wallet = async (id: string) => {
            assertActive();
            if (!context.walletIds.includes(id))
              throw new LedgerError("LEDGER_INVALID_TRANSACTION");
            const walletRecord = await transaction.wallet.findUnique({
              where: { id },
            });
            if (
              walletRecord === null ||
              !participants.participantIds.includes(walletRecord.ownerUserId)
            )
              throw new LedgerError("LEDGER_FORBIDDEN");
            return walletRecord;
          };
          try {
            return await activeFinancialTransaction.run(true, () =>
              work({ transaction, wallet, assertActive }),
            );
          } finally {
            active = false;
          }
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === "P2034" ||
          (error.code === "P2010" &&
            adapterConflictSchema.safeParse(error.meta).success))
      ) {
        if (attempt < MAX_TRANSACTION_ATTEMPTS) continue;
        throw new LedgerError("LEDGER_UNRESOLVED", { cause: error });
      }
      if (error instanceof AppError) throw error;
      // Known identity uniqueness stays typed until the standalone facade can recover it.
      if (isIdentityUniqueConflict(error)) throw error;
      throw new LedgerError("LEDGER_INTERNAL", { cause: error });
    }
  }
  throw new LedgerError("LEDGER_UNRESOLVED");
};

export const runLedgerTransaction = async <T>(
  database: DatabaseClient,
  context: LedgerContext,
  work: (scope: LockedLedgerTransaction) => Promise<T>,
  admission?: FinancialRuntimeAdmission,
): Promise<T> => {
  if (admission === undefined)
    throw new AppError(
      "Financial recovery admission is closed.",
      409,
      "FINANCIAL_WRITES_FENCED",
    );
  return runLockedLedgerTransaction(database, context, work, admission);
};

export const runLedgerObservation = async <T>(
  database: DatabaseClient,
  context: LedgerContext,
  observation: (scope: LockedLedgerTransaction) => Promise<T>,
): Promise<T> => runLockedLedgerTransaction(database, context, observation);

const BUSINESS_IDENTITY_CONSTRAINT = "financial_operations_business_key";
const REQUEST_IDENTITY_CONSTRAINT = "financial_request_identities_scope_key";
const BUSINESS_IDENTITY_FIELDS = "kind,business_namespace,business_key";
const REQUEST_IDENTITY_FIELDS = "actor_scope,kind,request_key";
const adapterUniqueSchema = z.object({
  driverAdapterError: z.object({
    cause: z.object({
      originalCode: z.literal("23505"),
      kind: z.literal("UniqueConstraintViolation"),
      constraint: z.object({ fields: z.array(z.string()) }),
    }),
  }),
});
export const isIdentityUniqueConflict = (
  error: unknown,
): error is Prisma.PrismaClientKnownRequestError => {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  )
    return false;
  const target = error.meta?.["target"];
  const adapter = adapterUniqueSchema.safeParse(error.meta);
  const fields = adapter.success
    ? adapter.data.driverAdapterError.cause.constraint.fields.join(",")
    : undefined;
  return (
    target === BUSINESS_IDENTITY_CONSTRAINT ||
    target === REQUEST_IDENTITY_CONSTRAINT ||
    (Array.isArray(target) &&
      (target.join(",") === BUSINESS_IDENTITY_FIELDS ||
        target.join(",") === REQUEST_IDENTITY_FIELDS)) ||
    fields === BUSINESS_IDENTITY_FIELDS ||
    fields === REQUEST_IDENTITY_FIELDS
  );
};
