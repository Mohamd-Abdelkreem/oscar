import { createHash } from "node:crypto";
import type { TronNetworkName } from "../../core/config/tron.config.js";
import { z } from "zod";
import {
  withdrawalExecutionReady,
  type WithdrawalCapabilityContext,
} from "./withdrawal-readiness.js";
import {
  withdrawalQuoteBodySchema,
  withdrawalQuoteSchema,
} from "@template/contracts";
import type {
  DatabaseClient,
  Prisma,
  WithdrawalQuote,
} from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import {
  withdrawalConfig,
  type WithdrawalConfig,
} from "../../core/config/withdrawal.config.js";
import { formatUsdtAmount } from "../../core/financial/money.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { currentSubscription } from "../subscriptions/subscriptions.service.js";
import { calculateWithdrawalPolicy } from "./withdrawal-policy.js";
import type { WithdrawalIdentity } from "./withdrawal-destination.service.js";
import { WithdrawalError } from "./withdrawals.errors.js";

export const ACTIVE_WITHDRAWAL_STATES = [
  "SCHEDULED",
  "SIGNING",
  "SIGNED",
  "SUBMITTED",
  "UNKNOWN",
];
export const WITHDRAWAL_CALENDAR = {
  zone: "Asia/Baghdad",
  countedHours: "72",
  excludedWeekdays: [6, 7],
} as const;
export const withdrawalTermsHash = (facts: unknown) =>
  createHash("sha256").update(JSON.stringify(facts)).digest("hex");

export async function readWithdrawalFacts(
  transaction: Prisma.TransactionClient,
  employeeId: string,
  gross: string,
  now: Date,
  network: TronNetworkName | undefined,
) {
  if (network === undefined)
    throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
  const wallet = await transaction.wallet.findUniqueOrThrow({
    where: { ownerUserId: employeeId },
  });
  const policy = await transaction.withdrawalPolicy.findUniqueOrThrow({
    where: { id: 1 },
  });
  const destination = await transaction.withdrawalDestination.findUnique({
    where: { employeeId },
  });
  const subscription = await currentSubscription(transaction, employeeId);
  const employee = await transaction.user.findUniqueOrThrow({
    where: { id: employeeId },
  });
  const active = await transaction.withdrawalRequest.findFirst({
    where: { employeeId, state: { in: ACTIVE_WITHDRAWAL_STATES } },
  });
  if (
    destination?.address === null ||
    destination === null ||
    destination.addressVersion === null ||
    destination.network !== network
  )
    throw new WithdrawalError("WITHDRAWAL_DESTINATION_REQUIRED");
  const calculated = calculateWithdrawalPolicy(
    gross,
    policy,
    wallet,
    subscription,
    now,
  );
  const eligibility = {
    effectiveMembership: calculated.paid ? "PAID" : "FREE",
    subscriptionId: calculated.paid ? (subscription?.id ?? null) : null,
    subscriptionVersion: calculated.paid
      ? (subscription?.packageVersion ?? null)
      : null,
    subscriptionExpiresAt: calculated.paid
      ? (subscription?.expiresAt.toISOString() ?? null)
      : null,
    feeBasis: calculated.paid ? "SUBSCRIPTION" : "FREE_POLICY",
    policyVersion: policy.version,
  };
  const blockReason = employee.withdrawalsBlocked
    ? "WITHDRAWAL_BLOCKED"
    : active !== null
      ? "WITHDRAWAL_ACTIVE"
      : calculated.topUp > 0n
        ? "INSUFFICIENT_FUNDS"
        : null;
  const material = {
    gross,
    feeBps: calculated.feeBps,
    fee: formatUsdtAmount(calculated.fee),
    net: formatUsdtAmount(calculated.net),
    ...eligibility,
    network,
    recipient: destination.address,
    addressVersion: destination.addressVersion,
    minimumGross: formatUsdtAmount(policy.minimumGrossUnits),
    maximumGross: formatUsdtAmount(policy.maximumGrossUnits),
    eligibleNonReferral: formatUsdtAmount(wallet.availableNonReferralUnits),
    eligibleReferral: formatUsdtAmount(calculated.eligibleReferral),
    fundedAllocation: {
      nonReferral: formatUsdtAmount(calculated.nonReferral),
      referral: formatUsdtAmount(calculated.referral),
      total: formatUsdtAmount(calculated.nonReferral + calculated.referral),
    },
    requiredTopUp: formatUsdtAmount(calculated.topUp),
    canAccept: blockReason === null,
    blockReason,
  };
  return { material, eligibility, calculated, wallet, destination };
}

export function mapWithdrawalQuote(quote: WithdrawalQuote, now: Date) {
  return withdrawalQuoteSchema.parse({
    ...z.record(z.string(), z.unknown()).parse(quote.quotedTerms),
    quoteId: quote.id,
    quotedAt: quote.createdAt.toISOString(),
    quoteExpiresAt: quote.expiresAt.toISOString(),
    serverNow: now.toISOString(),
    preview: {
      dueAt: quote.previewDueAt.toISOString(),
      dispatchAt: quote.previewDispatchAt.toISOString(),
      calendar: WITHDRAWAL_CALENDAR,
    },
  });
}

export class WithdrawalQuoteService {
  private readonly ledger: LedgerService;
  private readonly clock: () => Date;
  private readonly config: WithdrawalConfig;
  constructor(
    private readonly database: DatabaseClient,
    private readonly options: WithdrawalCapabilityContext & {
      clock?: () => Date;
      admission?: FinancialRuntimeAdmission;
      network: TronNetworkName | undefined;
      config?: WithdrawalConfig;
    },
  ) {
    this.clock = options.clock ?? (() => new Date());
    this.config = options.config ?? withdrawalConfig;
    this.ledger = new LedgerService(
      database,
      { businessNamespaces: ["p08.withdrawal.reserve"], processIds: [] },
      options.admission,
    );
  }
  async create(identity: WithdrawalIdentity, rawBody: unknown) {
    const body = withdrawalQuoteBodySchema.parse(rawBody);
    const wallet = await this.database.wallet.findUniqueOrThrow({
      where: { ownerUserId: identity.userId },
    });
    const noFinancialEffect = (): Promise<void> =>
      Promise.reject(new WithdrawalError("WITHDRAWAL_INTERNAL"));
    return this.ledger.runInTransaction(
      {
        actor: { type: "USER", userId: identity.userId },
        walletIds: [wallet.id],
        clock: this.clock,
        observe: noFinancialEffect,
        mutate: noFinancialEffect,
      },
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM auth_sessions WHERE user_id=${identity.userId}::uuid ORDER BY id FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM withdrawal_policy WHERE id=1 FOR SHARE`;
        await transaction.$queryRaw`SELECT id FROM withdrawal_destinations WHERE employee_id=${identity.userId}::uuid FOR SHARE`;
        const now = this.clock();
        await readSessionAuthority(transaction, identity, now, "USER");
        if (!(await withdrawalExecutionReady(transaction, this.options)))
          throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
        const facts = await readWithdrawalFacts(
          transaction,
          identity.userId,
          body.gross,
          now,
          this.options.network,
        );
        const businessClock = new BusinessClock(this.clock);
        const dueAt = businessClock.initialWithdrawalDeadline(
          now.toISOString(),
        );
        const quote = await transaction.withdrawalQuote.create({
          data: {
            employeeId: identity.userId,
            walletId: wallet.id,
            destinationId: facts.destination.id,
            addressVersion: facts.material.addressVersion,
            network: facts.destination.network,
            recipient: facts.material.recipient,
            policyVersion: facts.material.policyVersion,
            createdAt: now,
            expiresAt: new Date(
              now.getTime() + this.config.quoteTtlSeconds * 1000,
            ),
            grossUnits: facts.calculated.gross,
            feeBps: facts.calculated.feeBps,
            feeUnits: facts.calculated.fee,
            netUnits: facts.calculated.net,
            termsHash: withdrawalTermsHash(facts.material),
            quotedTerms: facts.material,
            eligibilitySnapshot: facts.eligibility,
            availableNonReferralUnits: facts.wallet.availableNonReferralUnits,
            availableReferralUnits: facts.calculated.eligibleReferral,
            fundedNonReferralUnits: facts.calculated.nonReferral,
            fundedReferralUnits: facts.calculated.referral,
            requiredTopUpUnits: facts.calculated.topUp,
            canAccept: facts.material.canAccept,
            blockReason: facts.material.blockReason,
            previewDueAt: new Date(dueAt),
            previewDispatchAt: new Date(
              businessClock.normalizeNewDispatch(dueAt),
            ),
          },
        });
        return mapWithdrawalQuote(quote, now);
      },
    );
  }
}
