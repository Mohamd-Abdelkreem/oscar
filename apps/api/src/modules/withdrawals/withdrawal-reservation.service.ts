import { randomUUID } from "node:crypto";
import {
  financialRequestKeySchema,
  withdrawalAcceptBodySchema,
  withdrawalCommandResultSchema,
} from "@template/contracts";
import type { DatabaseClient, Prisma } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import type { TronNetworkName } from "../../core/config/tron.config.js";
import { NotFoundException } from "../../core/errors/index.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import type { LedgerGuardScope } from "../ledger/ledger.types.js";
import type { WithdrawalIdentity } from "./withdrawal-destination.service.js";
import {
  readWithdrawalFacts,
  withdrawalTermsHash,
  WITHDRAWAL_CALENDAR,
} from "./withdrawal-quote.service.js";
import {
  mapWithdrawalRequest,
  withdrawalReadInclude,
} from "./withdrawals.mapper.js";
import { WithdrawalError } from "./withdrawals.errors.js";
import {
  publishWithdrawalWakeup,
  type WithdrawalWakeupPublisher,
} from "../../infrastructure/queue/withdrawal-wakeups.js";

export class WithdrawalReservationService {
  private readonly ledger: LedgerService;
  private readonly clock: () => Date;
  private readonly network: TronNetworkName | undefined;
  constructor(
    private readonly database: DatabaseClient,
    private readonly options: {
      clock: () => Date;
      admission: FinancialRuntimeAdmission | undefined;
      network: TronNetworkName | undefined;
      wakeups?: WithdrawalWakeupPublisher;
    },
  ) {
    this.clock = options.clock;
    this.network = options.network;
    this.ledger = new LedgerService(
      database,
      { businessNamespaces: ["p08.withdrawal.reserve"], processIds: [] },
      options.admission,
    );
  }
  async accept(
    identity: WithdrawalIdentity,
    rawBody: unknown,
    rawKey?: string,
  ) {
    const body = withdrawalAcceptBodySchema.parse(rawBody);
    if (
      this.options.admission === undefined ||
      this.options.admission.processKind !== "API"
    )
      throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
    const key =
      rawKey === undefined
        ? undefined
        : financialRequestKeySchema.parse(rawKey);
    const quote = await this.database.withdrawalQuote.findFirst({
      where: { id: body.quoteId, employeeId: identity.userId },
    });
    if (quote === null) throw new NotFoundException();
    let eventTime: Date | undefined;
    let paid = false;
    const guard = (scope: LedgerGuardScope): Promise<void> => {
      if (
        scope.intent.kind !== "RESERVE" ||
        scope.wallet.id !== quote.walletId ||
        scope.intent.businessKey !== quote.id ||
        scope.intent.businessNamespace !== "p08.withdrawal.reserve" ||
        scope.actor.type !== "USER" ||
        scope.actor.userId !== identity.userId
      )
        throw new LedgerError("LEDGER_FORBIDDEN");
      return Promise.resolve();
    };
    const outcome = await this.ledger.runInTransaction(
      {
        actor: { type: "USER", userId: identity.userId },
        walletIds: [quote.walletId],
        clock: () => {
          if (!eventTime) throw new LedgerError("LEDGER_INTERNAL");
          return eventTime;
        },
        observe: guard,
        mutate: guard,
        eligibleSources: () =>
          Promise.resolve(
            paid ? ["NON_REFERRAL", "REFERRAL"] : ["NON_REFERRAL"],
          ),
      },
      async (transaction, ledger) => {
        await new AuthSessionService().lockSessions(
          transaction,
          identity.userId,
        );
        await transaction.$queryRaw`SELECT id FROM withdrawal_policy WHERE id=1 FOR SHARE`;
        await transaction.$queryRaw`SELECT id FROM withdrawal_destinations WHERE id=${quote.destinationId}::uuid FOR SHARE`;
        await transaction.$queryRaw`SELECT id FROM withdrawal_quotes WHERE id=${quote.id}::uuid FOR SHARE`;
        await transaction.$queryRaw`SELECT id FROM withdrawal_requests WHERE employee_id=${identity.userId}::uuid AND (quote_id=${quote.id}::uuid OR state IN ('SCHEDULED','SIGNING','SIGNED','SUBMITTED','UNKNOWN')) ORDER BY id FOR UPDATE`;
        const now = this.clock();
        eventTime = now;
        const employee = await readSessionAuthority(
          transaction,
          identity,
          now,
          "USER",
        );
        if (key !== undefined) {
          const alias = await transaction.requestIdentity.findUnique({
            where: {
              actorScope_kind_requestKey: {
                actorScope: `USER:${identity.userId}`,
                kind: "RESERVE",
                requestKey: key,
              },
            },
            include: { operation: true },
          });
          if (
            alias !== null &&
            (alias.operation.businessNamespace !== "p08.withdrawal.reserve" ||
              alias.operation.businessKey !== quote.id)
          )
            throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
        }
        const existing = await transaction.withdrawalRequest.findUnique({
          where: { quoteId: quote.id },
          include: withdrawalReadInclude,
        });
        const reservationId = existing?.reservationId ?? randomUUID();
        const intent = {
          kind: "RESERVE" as const,
          walletId: quote.walletId,
          businessNamespace: "p08.withdrawal.reserve",
          businessKey: quote.id,
          amount: formatUsdtAmount(quote.grossUnits),
          reservationId,
          ...(key === undefined ? {} : { requestKey: key }),
        };
        if (existing !== null) {
          const replay = await ledger.reserveForWithdrawal(intent);
          if (!replay.replayed) throw new LedgerError("LEDGER_INTERNAL");
          return withdrawalCommandResultSchema.parse({
            withdrawal: mapWithdrawalRequest(existing, now),
            replayed: true,
          });
        }
        if (employee.withdrawalsBlocked)
          throw new WithdrawalError("WITHDRAWAL_BLOCKED");
        if (now >= quote.expiresAt || now < quote.createdAt || !quote.canAccept)
          throw new WithdrawalError("WITHDRAWAL_QUOTE_STALE");
        if (this.network !== quote.network)
          throw new WithdrawalError("WITHDRAWAL_QUOTE_STALE");
        const fresh = await this.readReviewedFacts(
          transaction,
          identity.userId,
          intent.amount,
          now,
        );
        if (fresh.material.blockReason === "WITHDRAWAL_ACTIVE")
          throw new WithdrawalError("WITHDRAWAL_ACTIVE");
        if (withdrawalTermsHash(fresh.material) !== quote.termsHash)
          throw new WithdrawalError("WITHDRAWAL_QUOTE_STALE");
        paid = fresh.calculated.paid;
        const businessClock = new BusinessClock(this.clock);
        const dueAt = new Date(
          businessClock.initialWithdrawalDeadline(now.toISOString()),
        );
        await ledger.reserveForWithdrawal(
          intent,
          async (domainTransaction, operation) => {
            const request = await domainTransaction.withdrawalRequest.create({
              data: {
                quoteId: quote.id,
                employeeId: identity.userId,
                walletId: quote.walletId,
                reservationId,
                destinationId: quote.destinationId,
                network: quote.network,
                recipient: quote.recipient,
                addressVersion: quote.addressVersion,
                grossUnits: quote.grossUnits,
                feeBps: quote.feeBps,
                feeUnits: quote.feeUnits,
                netUnits: quote.netUnits,
                acceptedTerms: fresh.material,
                termsHash: quote.termsHash,
                eligibilitySnapshot: fresh.eligibility,
                nonReferralUnits: quote.fundedNonReferralUnits,
                referralUnits: quote.fundedReferralUnits,
                acceptedAt: now,
                originalDueAt: dueAt,
                dueAt,
                dispatchAt: new Date(
                  businessClock.normalizeNewDispatch(dueAt.toISOString()),
                ),
                schedulePolicy: WITHDRAWAL_CALENDAR,
              },
            });
            await domainTransaction.withdrawalAction.create({
              data: {
                requestId: request.id,
                actorUserId: identity.userId,
                actorScope: `user:${identity.userId}`,
                kind: "ACCEPT",
                ...(key === undefined ? {} : { requestKey: key }),
                intentHash: withdrawalTermsHash([identity.userId, body]),
                expectedVersion: 0,
                committedVersion: 1,
                occurredAt: now,
                afterState: "SCHEDULED",
                afterDueAt: dueAt,
                afterScheduleVersion: 1,
                confirmed: true,
                financialOperationId: operation.operationId,
              },
            });
          },
        );
        const request = await transaction.withdrawalRequest.findUniqueOrThrow({
          where: { quoteId: quote.id },
          include: withdrawalReadInclude,
        });
        return withdrawalCommandResultSchema.parse({
          withdrawal: mapWithdrawalRequest(request, now),
          replayed: false,
        });
      },
    );
    if (outcome.withdrawal.state === "SCHEDULED")
      await publishWithdrawalWakeup(this.options.wakeups, outcome.withdrawal);
    return outcome;
  }

  private async readReviewedFacts(
    transaction: Prisma.TransactionClient,
    employeeId: string,
    gross: string,
    now: Date,
  ) {
    try {
      return await readWithdrawalFacts(
        transaction,
        employeeId,
        gross,
        now,
        this.network,
      );
    } catch (error) {
      if (
        error instanceof WithdrawalError &&
        [
          "WITHDRAWAL_AMOUNT_INVALID",
          "WITHDRAWAL_DESTINATION_REQUIRED",
        ].includes(error.code)
      )
        throw new WithdrawalError("WITHDRAWAL_QUOTE_STALE");
      throw error;
    }
  }
}
