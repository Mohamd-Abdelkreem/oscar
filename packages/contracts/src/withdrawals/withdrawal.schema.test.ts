import { describe, expect, it } from "vitest";
import { employeeLedgerDetailSchema } from "../wallet/wallet.schema.ts";
import {
  withdrawalAcceptBodySchema,
  withdrawalConsumeBodySchema,
  withdrawalCountdownSchema,
  withdrawalDestinationBodySchema,
  withdrawalDestinationSchema,
  withdrawalExtensionBodySchema,
  withdrawalFilterSchema,
  withdrawalHistorySchema,
  withdrawalQuoteOutcomeSchema,
  withdrawalQuoteSchema,
  withdrawalRejectionBodySchema,
  withdrawalRequestSchema,
  withdrawalStateSchema,
  withdrawalStatusSchema,
  withdrawalSettlementTermsSchema,
  adminWithdrawalRequestSchema,
  adminWithdrawalActionOutcomeSchema,
  adminWithdrawalActionOutcomeQuerySchema,
} from "./withdrawal.schema.ts";

const id = "8f4be6e1-6b22-4c54-b9ec-9af1ba7bff15";
const now = "2026-10-08T09:00:00.000Z";
const address = "T" + "1".repeat(33);
const calendar = {
  zone: "Asia/Baghdad",
  countedHours: "72",
  excludedWeekdays: [6, 7],
};
const quote = {
  quoteId: id,
  quotedAt: now,
  quoteExpiresAt: "2026-10-08T09:10:00.000Z",
  serverNow: now,
  gross: "80",
  feeBps: 2100,
  fee: "16.8",
  net: "63.2",
  effectiveMembership: "PAID",
  subscriptionId: id,
  subscriptionVersion: 1,
  subscriptionExpiresAt: "2027-01-01T00:00:00.000Z",
  feeBasis: "SUBSCRIPTION",
  policyVersion: 1,
  network: "TRON_NILE",
  recipient: address,
  addressVersion: 1,
  minimumGross: "16",
  maximumGross: "500",
  eligibleNonReferral: "70",
  eligibleReferral: "30",
  fundedAllocation: { nonReferral: "70", referral: "10", total: "80" },
  requiredTopUp: "0",
  canAccept: true,
  blockReason: null,
  preview: {
    dueAt: "2026-10-13T09:00:00.000Z",
    dispatchAt: "2026-10-13T09:00:00.000Z",
    calendar,
  },
};
const request = {
  id,
  quoteId: id,
  acceptedAt: now,
  version: 1,
  scheduleVersion: 1,
  state: "SCHEDULED",
  gross: "80",
  feeBps: 2100,
  fee: "16.8",
  net: "63.2",
  effectiveMembership: "PAID",
  subscriptionId: id,
  subscriptionVersion: 1,
  subscriptionExpiresAt: quote.subscriptionExpiresAt,
  feeBasis: "SUBSCRIPTION",
  policyVersion: 1,
  network: "TRON_NILE",
  recipient: address,
  addressVersion: 1,
  sourceAllocation: { nonReferral: "70", referral: "10", gross: "80" },
  calendar,
  originalDueAt: quote.preview.dueAt,
  dueAt: quote.preview.dueAt,
  dispatchAt: quote.preview.dispatchAt,
  serverNow: now,
  remainingCountedMilliseconds: "259200000",
  remainingCountedHours: "72",
  actions: [],
  finalizedAt: null,
  release: null,
};
describe("withdrawal wire boundaries", () => {
  it("keeps admin identity and action availability out of employee projections", () => {
    const admin = {
      ...request,
      employee: { id, fullName: "Employee", email: "employee@example.test" },
      canExtend: true,
      canReject: true,
    };
    expect(adminWithdrawalRequestSchema.parse(admin).employee.id).toBe(id);
    expect(withdrawalRequestSchema.safeParse(admin).success).toBe(false);
    for (const patch of [
      { net: "1" },
      { employee: { ...admin.employee, role: "ADMIN" } },
      { state: "UNKNOWN" },
      { version: 2147483647 },
      { scheduleVersion: 2147483647 },
    ]) {
      expect(
        adminWithdrawalRequestSchema.safeParse({ ...admin, ...patch }).success,
      ).toBe(false);
    }
  });
  it("binds exact keyed admin outcomes to original target and version", () => {
    const withdrawal = {
      ...request,
      version: 2,
      scheduleVersion: 2,
      dueAt: "2026-10-13T10:00:00.000Z",
      dispatchAt: "2026-10-13T10:00:00.000Z",
      employee: { id, fullName: "Employee", email: "employee@example.test" },
      canExtend: true,
      canReject: true,
    };
    const outcome = {
      status: "SUPERSEDED",
      kind: "EXTEND",
      requestKey: "p09-observation",
      withdrawalId: id,
      expectedVersion: 1,
      serverNow: now,
      withdrawal,
    };
    expect(adminWithdrawalActionOutcomeSchema.safeParse(outcome).success).toBe(
      true,
    );
    const committed = {
      ...outcome,
      status: "COMMITTED",
      action: {
        id,
        kind: "EXTEND",
        actorUserId: id,
        occurredAt: now,
        reason: "Reviewed extension",
        expectedVersion: 1,
        committedVersion: 2,
        beforeDueAt: request.dueAt,
        afterDueAt: withdrawal.dueAt,
        beforeScheduleVersion: 1,
        afterScheduleVersion: 2,
      },
    };
    expect(
      adminWithdrawalActionOutcomeSchema.safeParse(committed).success,
    ).toBe(true);
    for (const action of [
      { ...committed.action, kind: "REJECT" },
      { ...committed.action, expectedVersion: 2 },
      { ...committed.action, committedVersion: 3 },
      { ...committed.action, afterScheduleVersion: 1 },
      { ...committed.action, afterScheduleVersion: 3 },
      { ...committed.action, afterDueAt: request.dueAt },
      { ...committed.action, privateKey: "sentinel" },
    ])
      expect(
        adminWithdrawalActionOutcomeSchema.safeParse({ ...committed, action })
          .success,
      ).toBe(false);
    for (const patch of [
      { status: "NOT_OBSERVED" },
      { expectedVersion: 3 },
      { withdrawalId: "63b2e122-72c3-4845-98a8-802a32bf1234" },
      { secret: "private" },
    ])
      expect(
        adminWithdrawalActionOutcomeSchema.safeParse({ ...outcome, ...patch })
          .success,
      ).toBe(false);
    expect(
      adminWithdrawalActionOutcomeQuerySchema.parse({
        kind: "EXTEND",
        requestKey: "p09-observation",
        expectedVersion: "1",
      }).expectedVersion,
    ).toBe(1);
    expect(
      adminWithdrawalActionOutcomeQuerySchema.safeParse({
        kind: "EXTEND",
        requestKey: "p09-observation",
        expectedVersion: "1",
        actorUserId: id,
      }).success,
    ).toBe(false);
  });
  it.each([
    { gross: "not-money" },
    { fee: "not-money" },
    { net: "not-money" },
    { feeBps: 2100.5 },
  ])(
    "rejects malformed settlement %j without throwing through its consumers",
    (patch) => {
      const settlement = {
        withdrawalId: id,
        attemptId: id,
        network: request.network,
        tokenContract: address,
        source: address,
        recipient: address,
        addressVersion: 1,
        gross: request.gross,
        feeBps: request.feeBps,
        fee: request.fee,
        net: request.net,
        sourceAllocation: request.sourceAllocation,
        transactionId: "a".repeat(64),
        blockId: "b".repeat(64),
        blockNumber: "101",
        ...patch,
      };
      expect(
        withdrawalSettlementTermsSchema.safeParse(settlement).success,
      ).toBe(false);
      expect(
        withdrawalRequestSchema.safeParse({
          ...request,
          state: "COMPLETED",
          finalizedAt: now,
          transactionId: settlement.transactionId,
          settlement,
        }).success,
      ).toBe(false);
      expect(
        employeeLedgerDetailSchema.safeParse({
          operationId: id,
          recordedAt: now,
          kind: "SETTLE",
          origin: "WITHDRAWAL_SETTLEMENT",
          direction: "DEBIT",
          magnitude: request.gross,
          signedOwnershipDelta: "-80",
          sourceMovements: [
            {
              source: "NON_REFERRAL",
              availableDelta: "0",
              reservedDelta: "-70",
            },
            { source: "REFERRAL", availableDelta: "0", reservedDelta: "-10" },
          ],
          referenceLabel: "Original withdrawal settlement",
          savedTerms: null,
          withdrawalTerms: settlement,
        }).success,
      ).toBe(false);
      expect(
        withdrawalQuoteSchema.safeParse({ ...quote, ...patch }).success,
      ).toBe(false);
    },
  );

  it("requires complete public original terms for a completed request", () => {
    const settlement = {
      withdrawalId: id,
      attemptId: id,
      network: request.network,
      tokenContract: address,
      source: address,
      recipient: address,
      addressVersion: 1,
      gross: request.gross,
      feeBps: request.feeBps,
      fee: request.fee,
      net: request.net,
      sourceAllocation: request.sourceAllocation,
      transactionId: "a".repeat(64),
      blockId: "b".repeat(64),
      blockNumber: "101",
    };
    const completed = {
      ...request,
      state: "COMPLETED",
      finalizedAt: now,
      transactionId: settlement.transactionId,
      settlement,
    };
    expect(withdrawalRequestSchema.safeParse(completed).success).toBe(true);
    for (const patch of [
      { settlement: null },
      { transactionId: "b".repeat(64) },
      { settlement: { ...settlement, recipient: `T${"2".repeat(33)}` } },
      {
        settlement: {
          ...settlement,
          withdrawalId: "63b2e122-72c3-4845-98a8-802a32bf1234",
        },
      },
    ])
      expect(
        withdrawalRequestSchema.safeParse({ ...completed, ...patch }).success,
      ).toBe(false);
  });
  it("preserves exact original gross 100=79+21 settlement and rejects changed sources or private data", () => {
    const terms = {
      withdrawalId: id,
      attemptId: id,
      network: "TRON_NILE",
      tokenContract: address,
      source: address,
      recipient: address,
      addressVersion: 1,
      gross: "100",
      feeBps: 2100,
      fee: "21",
      net: "79",
      sourceAllocation: { nonReferral: "70", referral: "30", gross: "100" },
      transactionId: "a".repeat(64),
      blockId: "b".repeat(64),
      blockNumber: "101",
    };
    expect(withdrawalSettlementTermsSchema.parse(terms)).toEqual(terms);
    for (const patch of [
      { net: "80" },
      { fee: "20" },
      { sourceAllocation: { nonReferral: "70", referral: "10", gross: "100" } },
      { signedBytes: "private" },
      { treasuryKeyId: id },
    ])
      expect(
        withdrawalSettlementTermsSchema.safeParse({ ...terms, ...patch })
          .success,
      ).toBe(false);
  });
  it("reports a safe terminal release with identical sources and zero charged fee", () => {
    const released = {
      ...request,
      state: "REJECTED",
      finalizedAt: now,
      release: {
        gross: request.gross,
        sourceAllocation: request.sourceAllocation,
        chargedFee: "0",
        releasedAt: now,
      },
    };
    expect(withdrawalRequestSchema.safeParse(released).success).toBe(true);
    for (const patch of [
      { release: null },
      { release: { ...released.release, chargedFee: "16.8" } },
      {
        release: {
          ...released.release,
          sourceAllocation: { nonReferral: "60", referral: "20", gross: "80" },
        },
      },
      { state: "SCHEDULED" },
    ])
      expect(
        withdrawalRequestSchema.safeParse({ ...released, ...patch }).success,
      ).toBe(false);
  });
  it.each([
    "",
    "abc",
    "-1",
    "01",
    "1.1",
    "1e3",
    "315537897600000",
    "999999999999999999999",
  ])(
    "rejects malformed countdown %s without throwing",
    (remainingCountedMilliseconds) => {
      expect(
        withdrawalCountdownSchema.safeParse({
          remainingCountedMilliseconds,
          remainingCountedHours: "0",
        }).success,
      ).toBe(false);
    },
  );
  it.each(["0", "01", "16.000000", "1e2", "-16", "16.0000001", 16])(
    "rejects unsupported gross %s",
    (gross) => {
      expect(withdrawalQuoteSchema.safeParse({ ...quote, gross }).success).toBe(
        false,
      );
    },
  );
  it("allows exact partial funding without granting acceptance or spending referral-first", () => {
    expect(withdrawalQuoteSchema.parse(quote).fundedAllocation).toEqual({
      nonReferral: "70",
      referral: "10",
      total: "80",
    });
    const partial = {
      ...quote,
      effectiveMembership: "FREE",
      subscriptionId: null,
      subscriptionVersion: null,
      subscriptionExpiresAt: null,
      feeBasis: "FREE_POLICY",
      eligibleReferral: "0",
      fundedAllocation: { nonReferral: "70", referral: "0", total: "70" },
      requiredTopUp: "10",
      canAccept: false,
      blockReason: "INSUFFICIENT_FUNDS",
    };
    expect(withdrawalQuoteSchema.parse(partial).requiredTopUp).toBe("10");
    for (const patch of [
      { canAccept: true, blockReason: null },
      { requiredTopUp: "0" },
      { fundedAllocation: { nonReferral: "60", referral: "10", total: "70" } },
      { eligibleReferral: "1" },
      { net: "63.200001" },
      { fee: "16.800001" },
    ])
      expect(
        withdrawalQuoteSchema.safeParse({ ...partial, ...patch }).success,
      ).toBe(false);
    expect(
      withdrawalQuoteSchema.safeParse({
        ...quote,
        quoteExpiresAt: "2026-10-08T09:01:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      withdrawalQuoteSchema.safeParse({
        ...quote,
        quoteExpiresAt: "2026-10-08T10:00:00.001Z",
      }).success,
    ).toBe(false);
  });
  it("rejects privileged commands and requires positive exact extension plus confirmation and reason", () => {
    expect(
      withdrawalAcceptBodySchema.parse({ quoteId: id, confirmed: true }),
    ).toEqual({ quoteId: id, confirmed: true });
    expect(withdrawalDestinationBodySchema.parse({ address }).address).toBe(
      address,
    );
    expect(
      withdrawalConsumeBodySchema.parse({ token: "a".repeat(43) }).token,
    ).toHaveLength(43);
    for (const patch of [
      { gross: "80" },
      { employeeId: id },
      { feeBps: 0 },
      { confirmed: false },
    ])
      expect(
        withdrawalAcceptBodySchema.safeParse({
          quoteId: id,
          confirmed: true,
          ...patch,
        }).success,
      ).toBe(false);
    const extension = {
      expectedVersion: 1,
      countedHours: "0.0000025",
      confirmed: true,
      reason: "Schedule extension",
    };
    expect(withdrawalExtensionBodySchema.safeParse(extension).success).toBe(
      true,
    );
    for (const countedHours of ["0", "-1", "0.0000001", 1])
      expect(
        withdrawalExtensionBodySchema.safeParse({ ...extension, countedHours })
          .success,
      ).toBe(false);
    expect(
      withdrawalRejectionBodySchema.safeParse({
        expectedVersion: 1,
        confirmed: true,
        reason: " ",
      }).success,
    ).toBe(false);
    expect(
      withdrawalDestinationBodySchema.safeParse({ address: ` ${address}` })
        .success,
    ).toBe(false);
    expect(
      withdrawalConsumeBodySchema.safeParse({ token: "a".repeat(44) }).success,
    ).toBe(false);
  });
  it("distinguishes unset, current pending and confirmed destinations without secrets", () => {
    expect(
      withdrawalDestinationSchema.safeParse({ state: "UNSET", serverNow: now })
        .success,
    ).toBe(true);
    const pending = {
      state: "PENDING",
      serverNow: now,
      network: "TRON_NILE",
      address,
      version: 1,
      issuedAt: now,
      expiresAt: "2026-10-08T09:30:00.000Z",
      nextIssuanceAt: "2026-10-08T09:01:00.000Z",
      proofStatus: "PENDING",
      deliveryStatus: "UNKNOWN",
    };
    expect(withdrawalDestinationSchema.safeParse(pending).success).toBe(true);
    expect(
      withdrawalDestinationSchema.safeParse({
        ...pending,
        serverNow: pending.expiresAt,
        proofStatus: "EXPIRED",
      }).success,
    ).toBe(true);
    expect(
      withdrawalDestinationSchema.safeParse({
        ...pending,
        serverNow: pending.expiresAt,
      }).success,
    ).toBe(false);
    const saved = {
      state: "CONFIRMED",
      serverNow: now,
      network: "TRON_NILE",
      address,
      addressVersion: 1,
      confirmedAt: now,
    };
    expect(withdrawalDestinationSchema.safeParse(saved).success).toBe(true);
    for (const patch of [
      { proofHash: "sentinel" },
      { token: "sentinel" },
      { pendingAddress: address },
      { emailUrl: "sentinel" },
    ])
      expect(
        withdrawalDestinationSchema.safeParse({ ...saved, ...patch }).success,
      ).toBe(false);
  });
  it.each([
    ["0", "0"],
    ["1", "0"],
    ["9", "0.000002"],
    ["3600000", "1"],
    ["259200000", "72"],
  ])(
    "preserves %s exact milliseconds with display %s",
    (milliseconds, hours) => {
      expect(
        withdrawalCountdownSchema.parse({
          remainingCountedMilliseconds: milliseconds,
          remainingCountedHours: hours,
        }).remainingCountedMilliseconds,
      ).toBe(milliseconds);
      expect(
        withdrawalCountdownSchema.safeParse({
          remainingCountedMilliseconds: milliseconds,
          remainingCountedHours: "1.000001",
        }).success,
      ).toBe(false);
    },
  );
  it("retains active public states independently from boolean execution readiness", () => {
    for (const state of [
      "SCHEDULED",
      "SIGNING",
      "SIGNED",
      "SUBMITTED",
      "UNKNOWN",
    ])
      expect(
        withdrawalRequestSchema.safeParse({ ...request, state }).success,
      ).toBe(true);
    expect(withdrawalStateSchema.safeParse("HELD").success).toBe(false);
    const status = {
      serverNow: now,
      withdrawalExecutionReady: false,
      network: null,
      destination: { state: "UNSET", serverNow: now },
      activeWithdrawal: null,
      withdrawalsBlocked: false,
    };
    expect(withdrawalStatusSchema.safeParse(status).success).toBe(true);
    for (const patch of [
      { network: undefined },
      { network: "OTHER" },
      { withdrawalExecutionReady: "true" },
      { treasuryKeyId: id },
    ])
      expect(
        withdrawalStatusSchema.safeParse({ ...status, ...patch }).success,
      ).toBe(false);
    expect(
      withdrawalStatusSchema.safeParse({
        ...status,
        withdrawalExecutionReady: true,
        network: "TRON_NILE",
      }).success,
    ).toBe(true);
    for (const patch of [
      { privateKey: "sentinel" },
      { signedPayload: {} },
      { actions: Array(101).fill({}) },
      { sourceAllocation: { nonReferral: "70", referral: "9", gross: "80" } },
      { finalizedAt: now },
    ])
      expect(
        withdrawalRequestSchema.safeParse({ ...request, ...patch }).success,
      ).toBe(false);
  });
  it("bounds history and binds lost-reply outcomes to permanent quote identity", () => {
    expect(withdrawalFilterSchema.parse({})).toEqual({ page: 1, limit: 25 });
    expect(withdrawalFilterSchema.safeParse({ limit: "101" }).success).toBe(
      false,
    );
    expect(
      withdrawalFilterSchema.safeParse({ sort: "privateKey" }).success,
    ).toBe(false);
    const outcome = {
      status: "COMMITTED",
      quoteId: id,
      withdrawal: request,
      serverNow: now,
    };
    expect(withdrawalQuoteOutcomeSchema.safeParse(outcome).success).toBe(true);
    expect(
      withdrawalQuoteOutcomeSchema.safeParse({
        ...outcome,
        quoteId: "58105394-50a9-4c80-a11c-efab2fc5b58a",
      }).success,
    ).toBe(false);
    expect(
      withdrawalQuoteOutcomeSchema.safeParse({
        status: "NOT_OBSERVED",
        quoteId: id,
        quote,
        serverNow: quote.quoteExpiresAt,
      }).success,
    ).toBe(false);
    expect(
      withdrawalQuoteOutcomeSchema.safeParse({
        status: "EXPIRED_UNCOMMITTED",
        quoteId: id,
        quote,
        serverNow: quote.quoteExpiresAt,
      }).success,
    ).toBe(true);
    expect(
      withdrawalHistorySchema.safeParse({
        items: [],
        pagination: {
          page: 1,
          limit: 25,
          total: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      }).success,
    ).toBe(true);
  });
});
