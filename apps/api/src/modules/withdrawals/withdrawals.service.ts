import { Prisma, type DatabaseClient } from "@template/database";
import type { TronPublicPayoutCapability } from "../../core/config/tron.config.js";
import { withdrawalExecutionReady } from "./withdrawal-readiness.js";
import {
  withdrawalHistorySchema,
  withdrawalFilterSchema,
  adminWithdrawalFilterSchema,
  withdrawalQuoteOutcomeSchema,
  withdrawalStatusSchema,
  withdrawalExtensionBodySchema,
  withdrawalRejectionBodySchema,
  withdrawalCommandResultSchema,
  financialRequestKeySchema,
  adminWithdrawalHistorySchema,
  adminWithdrawalActionOutcomeQuerySchema,
  adminWithdrawalActionOutcomeSchema,
} from "@template/contracts";
import { NotFoundException } from "../../core/errors/index.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import {
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";
import {
  mapWithdrawalDestination,
  mapWithdrawalRequest,
  withdrawalReadInclude,
  adminWithdrawalReadInclude,
  mapAdminWithdrawalRequest,
  mapObservedWithdrawalAction,
} from "./withdrawals.mapper.js";
import {
  mapWithdrawalQuote,
  ACTIVE_WITHDRAWAL_STATES,
} from "./withdrawal-quote.service.js";
import type { WithdrawalIdentity } from "./withdrawal-destination.service.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { ValidationException } from "../../core/errors/index.js";
import { WithdrawalError } from "./withdrawals.errors.js";
import { withdrawalTermsHash } from "./withdrawal-quote.service.js";
import {
  cancelScheduledWithdrawal,
  lockWithdrawalRequest,
  withdrawalReleaseContext,
} from "./withdrawal-cancellation.service.js";
import {
  publishWithdrawalWakeup,
  type WithdrawalWakeupPublisher,
} from "../../infrastructure/queue/withdrawal-wakeups.js";

export class WithdrawalsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date,
    private readonly admission?: FinancialRuntimeAdmission,
    private readonly runtime: {
      wakeups?: WithdrawalWakeupPublisher | undefined;
      capability?: TronPublicPayoutCapability | undefined;
    } = {},
  ) {}

  extend(
    identity: WithdrawalIdentity,
    requestId: string,
    rawBody: unknown,
    rawKey?: string,
  ) {
    return this.administer(
      identity,
      requestId,
      { kind: "EXTEND", body: withdrawalExtensionBodySchema.parse(rawBody) },
      rawKey,
    );
  }

  reject(
    identity: WithdrawalIdentity,
    requestId: string,
    rawBody: unknown,
    rawKey?: string,
  ) {
    return this.administer(
      identity,
      requestId,
      { kind: "REJECT", body: withdrawalRejectionBodySchema.parse(rawBody) },
      rawKey,
    );
  }

  private async administer(
    identity: WithdrawalIdentity,
    requestId: string,
    command:
      | {
          kind: "EXTEND";
          body: ReturnType<typeof withdrawalExtensionBodySchema.parse>;
        }
      | {
          kind: "REJECT";
          body: ReturnType<typeof withdrawalRejectionBodySchema.parse>;
        },
    rawKey?: string,
  ) {
    const key =
      rawKey === undefined
        ? undefined
        : financialRequestKeySchema.parse(rawKey);
    if (this.admission === undefined || this.admission.processKind !== "API")
      throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
    const reference = await this.database.withdrawalRequest.findUnique({
      where: { id: requestId },
    });
    if (reference === null) throw new NotFoundException();
    const ledger = new LedgerService(
      this.database,
      { businessNamespaces: ["p08.withdrawal.release"], processIds: [] },
      this.admission,
    );
    let eventTime: Date | undefined;
    const outcome = await ledger.runInTransaction(
      withdrawalReleaseContext(identity.userId, reference.walletId, () => {
        if (eventTime === undefined) throw new LedgerError("LEDGER_INTERNAL");
        return eventTime;
      }),
      async (transaction, transactionalLedger) => {
        await new AuthSessionService().lockSessions(
          transaction,
          identity.userId,
        );
        const request = await lockWithdrawalRequest(transaction, reference);
        const now = this.clock();
        eventTime = now;
        await readSessionAuthority(transaction, identity, now, "ADMIN");
        const hash = withdrawalTermsHash([requestId, command]);
        const existing =
          key === undefined
            ? await transaction.withdrawalAction.findFirst({
                where: {
                  requestId,
                  actorUserId: identity.userId,
                  kind: command.kind,
                  expectedVersion: command.body.expectedVersion,
                  requestKey: null,
                },
              })
            : await transaction.withdrawalAction.findUnique({
                where: {
                  actorScope_kind_requestKey: {
                    actorScope: `user:${identity.userId}`,
                    kind: command.kind,
                    requestKey: key,
                  },
                },
              });
        if (
          existing !== null &&
          (existing.requestId !== requestId || existing.intentHash !== hash)
        )
          throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
        if (existing === null) {
          if (
            request.version !== command.body.expectedVersion ||
            request.version === 2147483647 ||
            request.scheduleVersion === 2147483647
          )
            throw new WithdrawalError("WITHDRAWAL_VERSION_CONFLICT");
          if (request.state !== "SCHEDULED")
            throw new WithdrawalError("WITHDRAWAL_STATE_CONFLICT");
          if (command.kind === "REJECT") {
            await cancelScheduledWithdrawal(
              transaction,
              transactionalLedger,
              request,
              {
                actorUserId: identity.userId,
                kind: "REJECT",
                intentHash: hash,
                reason: command.body.reason,
                now,
                ...(key === undefined ? {} : { requestKey: key }),
              },
            );
          } else {
            const calendar = new BusinessClock(this.clock);
            let dueAt: Date;
            let dispatchAt: Date;
            try {
              dueAt = new Date(
                calendar.extendDeadline(
                  request.dueAt.toISOString(),
                  command.body.countedHours,
                ),
              );
              dispatchAt = new Date(
                calendar.normalizeNewDispatch(dueAt.toISOString()),
              );
            } catch (failure) {
              if (!(failure instanceof RangeError)) throw failure;
              throw new ValidationException([
                {
                  field: "body.countedHours",
                  message: "Unsupported resulting withdrawal deadline.",
                },
              ]);
            }
            await transaction.withdrawalRequest.update({
              where: { id: requestId },
              data: {
                dueAt,
                dispatchAt,
                version: { increment: 1 },
                scheduleVersion: { increment: 1 },
                nextCheckAt: null,
              },
            });
            await transaction.withdrawalAction.create({
              data: {
                requestId,
                actorUserId: identity.userId,
                actorScope: `user:${identity.userId}`,
                kind: "EXTEND",
                intentHash: hash,
                ...(key === undefined ? {} : { requestKey: key }),
                expectedVersion: request.version,
                committedVersion: request.version + 1,
                occurredAt: now,
                beforeState: "SCHEDULED",
                afterState: "SCHEDULED",
                beforeDueAt: request.dueAt,
                afterDueAt: dueAt,
                beforeScheduleVersion: request.scheduleVersion,
                afterScheduleVersion: request.scheduleVersion + 1,
                confirmed: true,
                reason: command.body.reason,
              },
            });
          }
        }
        const saved = await transaction.withdrawalRequest.findUniqueOrThrow({
          where: { id: requestId },
          include: withdrawalReadInclude,
        });
        return withdrawalCommandResultSchema.parse({
          withdrawal: mapWithdrawalRequest(saved, now),
          replayed: existing !== null,
        });
      },
    );
    if (outcome.withdrawal.state === "SCHEDULED")
      await publishWithdrawalWakeup(this.runtime.wakeups, outcome.withdrawal);
    return outcome;
  }

  async destination(identity: WithdrawalIdentity) {
    return runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "USER");
        const destination = await transaction.withdrawalDestination.findUnique({
          where: { employeeId: identity.userId },
        });
        return mapWithdrawalDestination(destination, now);
      },
    );
  }

  private read<T>(
    identity: WithdrawalIdentity,
    role: "USER" | "ADMIN",
    work: (transaction: Prisma.TransactionClient, now: Date) => Promise<T>,
    isolationLevel: Prisma.TransactionIsolationLevel = Prisma
      .TransactionIsolationLevel.RepeatableRead,
  ) {
    return runIdentityTransaction(
      this.database,
      {
        userIds: [identity.userId],
        // Reads lock the acting identity; only administrator population writes need its singleton guard.
        adminPopulation: false,
        isolationLevel,
      },
      async (transaction) => {
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, role);
        return work(transaction, now);
      },
    );
  }

  status(identity: WithdrawalIdentity) {
    return this.read(identity, "USER", async (transaction, now) => {
      const destination = await transaction.withdrawalDestination.findUnique({
        where: { employeeId: identity.userId },
      });
      const employee = await transaction.user.findUniqueOrThrow({
        where: { id: identity.userId },
      });
      const active = await transaction.withdrawalRequest.findFirst({
        where: {
          employeeId: identity.userId,
          state: { in: ACTIVE_WITHDRAWAL_STATES },
        },
        include: withdrawalReadInclude,
      });
      return withdrawalStatusSchema.parse({
        serverNow: now.toISOString(),
        withdrawalExecutionReady: await withdrawalExecutionReady(transaction, {
          capability: this.runtime.capability,
          admission: this.admission,
        }),
        network: this.runtime.capability?.network ?? null,
        withdrawalsBlocked: employee.withdrawalsBlocked,
        destination: mapWithdrawalDestination(destination, now),
        activeWithdrawal:
          active === null ? null : mapWithdrawalRequest(active, now),
      });
    });
  }

  outcome(identity: WithdrawalIdentity, quoteId: string) {
    return this.read(
      identity,
      "USER",
      async (transaction, now) => {
        const quote = await transaction.withdrawalQuote.findFirst({
          where: { id: quoteId, employeeId: identity.userId },
        });
        if (quote === null) throw new NotFoundException();
        const request = await transaction.withdrawalRequest.findUnique({
          where: { quoteId },
          include: withdrawalReadInclude,
        });
        return withdrawalQuoteOutcomeSchema.parse(
          request === null
            ? {
                status:
                  now >= quote.expiresAt
                    ? "EXPIRED_UNCOMMITTED"
                    : "NOT_OBSERVED",
                quoteId,
                quote: mapWithdrawalQuote(quote, now),
                serverNow: now.toISOString(),
              }
            : {
                status: "COMMITTED",
                quoteId,
                withdrawal: mapWithdrawalRequest(request, now),
                serverNow: now.toISOString(),
              },
        );
        // Identity locks serialize acceptance; refresh the snapshot after a waited lock.
      },
      Prisma.TransactionIsolationLevel.ReadCommitted,
    );
  }

  adminActionOutcome(
    identity: WithdrawalIdentity,
    withdrawalId: string,
    rawQuery: unknown,
  ) {
    const query = adminWithdrawalActionOutcomeQuerySchema.parse(rawQuery);
    return this.read(identity, "ADMIN", async (transaction, now) => {
      const request = await transaction.withdrawalRequest.findUnique({
        where: { id: withdrawalId },
        include: adminWithdrawalReadInclude,
      });
      if (request === null) throw new NotFoundException();
      const action = await transaction.withdrawalAction.findUnique({
        where: {
          actorScope_kind_requestKey: {
            actorScope: `user:${identity.userId}`,
            kind: query.kind,
            requestKey: query.requestKey,
          },
        },
      });
      if (
        action !== null &&
        (action.requestId !== withdrawalId ||
          action.expectedVersion !== query.expectedVersion)
      )
        throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
      if (request.version < query.expectedVersion)
        throw new WithdrawalError("WITHDRAWAL_VERSION_CONFLICT");
      const admission = await this.admission?.readApiAdmission(transaction);
      const common = {
        ...query,
        withdrawalId,
        serverNow: now.toISOString(),
        withdrawal: mapAdminWithdrawalRequest(
          request,
          now,
          admission?.mutationAdmitted ?? false,
        ),
      };
      return adminWithdrawalActionOutcomeSchema.parse(
        action === null
          ? {
              ...common,
              status:
                request.version === query.expectedVersion
                  ? "NOT_OBSERVED"
                  : "SUPERSEDED",
            }
          : {
              ...common,
              status: "COMMITTED",
              action: mapObservedWithdrawalAction(action),
            },
      );
    });
  }

  detail(identity: WithdrawalIdentity, withdrawalId: string, admin = false) {
    return this.read(
      identity,
      admin ? "ADMIN" : "USER",
      async (transaction, now) => {
        if (admin) {
          const request = await transaction.withdrawalRequest.findUnique({
            where: { id: withdrawalId },
            include: adminWithdrawalReadInclude,
          });
          if (request === null) throw new NotFoundException();
          const admission = await this.admission?.readApiAdmission(transaction);
          return mapAdminWithdrawalRequest(
            request,
            now,
            admission?.mutationAdmitted ?? false,
          );
        }
        const request = await transaction.withdrawalRequest.findFirst({
          where: {
            id: withdrawalId,
            employeeId: identity.userId,
          },
          include: withdrawalReadInclude,
        });
        if (request === null) throw new NotFoundException();
        return mapWithdrawalRequest(request, now);
      },
    );
  }

  history(identity: WithdrawalIdentity, rawQuery: unknown, admin = false) {
    const adminFilter = admin
      ? adminWithdrawalFilterSchema.parse(rawQuery)
      : null;
    const filter = adminFilter ?? withdrawalFilterSchema.parse(rawQuery);
    return this.read(
      identity,
      admin ? "ADMIN" : "USER",
      async (transaction, now) => {
        const where: Prisma.WithdrawalRequestWhereInput = {
          ...(admin ? {} : { employeeId: identity.userId }),
          ...(filter.state === undefined ? {} : { state: filter.state }),
          ...(adminFilter?.employeeId === undefined
            ? {}
            : { employeeId: adminFilter.employeeId }),
          ...(adminFilter?.from === undefined && adminFilter?.to === undefined
            ? {}
            : {
                acceptedAt: {
                  ...(adminFilter.from === undefined
                    ? {}
                    : { gte: new Date(adminFilter.from) }),
                  ...(adminFilter.to === undefined
                    ? {}
                    : { lt: new Date(adminFilter.to) }),
                },
              }),
          ...(adminFilter?.q === undefined
            ? {}
            : {
                destination: {
                  employee: {
                    OR: [
                      {
                        fullName: {
                          contains: adminFilter.q,
                          mode: "insensitive",
                        },
                      },
                      {
                        email: { contains: adminFilter.q, mode: "insensitive" },
                      },
                    ],
                  },
                },
              }),
        };
        const total = await transaction.withdrawalRequest.count({ where });
        const pagination = buildPaginationMeta({
          page: filter.page,
          limit: filter.limit,
          total,
        });
        if (admin) {
          const requests = await transaction.withdrawalRequest.findMany({
            where,
            orderBy: [{ acceptedAt: "desc" }, { id: "desc" }],
            skip: (filter.page - 1) * filter.limit,
            take: filter.limit,
            include: adminWithdrawalReadInclude,
          });
          const admission = await this.admission?.readApiAdmission(transaction);
          return adminWithdrawalHistorySchema.parse({
            items: requests.map((request) =>
              mapAdminWithdrawalRequest(
                request,
                now,
                admission?.mutationAdmitted ?? false,
              ),
            ),
            pagination,
          });
        }
        const requests = await transaction.withdrawalRequest.findMany({
          where,
          orderBy: [{ acceptedAt: "desc" }, { id: "desc" }],
          skip: (filter.page - 1) * filter.limit,
          take: filter.limit,
          include: withdrawalReadInclude,
        });
        return withdrawalHistorySchema.parse({
          items: requests.map((request) => mapWithdrawalRequest(request, now)),
          pagination,
        });
      },
    );
  }
}
