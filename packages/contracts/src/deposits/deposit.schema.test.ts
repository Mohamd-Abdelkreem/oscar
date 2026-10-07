import { describe, expect, it } from "vitest";
import {
  depositAddressDataSchema,
  depositProvisionRequestSchema,
  depositHistoryQuerySchema,
  adminDepositHistoryQuerySchema,
  depositHistoryRowSchema,
  manualCreditBodySchema,
  manualCreditEnvelopeSchema,
  depositHistoryEnvelopeSchema,
  adminDepositHistoryEnvelopeSchema,
} from "./deposit.schema.ts";

const now = "2026-10-06T12:00:00.000Z";
const id = "668ee04c-1d57-4230-a0da-c4a2cc9c82e9";
const metadata = {
  serverNow: now,
  network: "TRON_NILE",
  token: {
    symbol: "USDT",
    contract: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
    decimals: 6,
  },
};
const ready = {
  ...metadata,
  state: "READY",
  assignmentId: id,
  address: "TJRabPrwbZy45sbavfcjinPJC18kjpRTv8",
  readyAt: now,
  activationState: "UNKNOWN",
  resourceCheckedAt: null,
  detection: {
    status: "NOT_STARTED",
    lastSuccessfulScanAt: null,
    serverNow: now,
  },
};
describe("deposit publication boundary", () => {
  it.each([
    { ...metadata, state: "UNASSIGNED" },
    {
      ...metadata,
      state: "PROVISIONING",
      assignmentId: id,
      readiness: "KEY_STORED",
    },
    {
      ...metadata,
      state: "UNAVAILABLE",
      assignmentId: id,
      reasonCode: "RECOVERY_UNAVAILABLE",
      retryable: true,
    },
    ready,
  ])(
    "accepts truthful $state with separate activation/detection facts",
    (projection) => {
      expect(depositAddressDataSchema.parse(projection)).toEqual(projection);
    },
  );
  it.each([
    "employeeId",
    "walletId",
    "privateKey",
    "keyEnvelopeDigest",
    "storageRoot",
    "recoveryAckId",
  ])(
    "rejects forged/private %s in public output and provisioning input",
    (field) => {
      expect(
        depositAddressDataSchema.safeParse({ ...ready, [field]: "secret" })
          .success,
      ).toBe(false);
      expect(
        depositProvisionRequestSchema.safeParse({ [field]: "secret" }).success,
      ).toBe(false);
    },
  );
  it.each(["UNASSIGNED", "PROVISIONING", "UNAVAILABLE"])(
    "never exposes a usable address while %s",
    (state) => {
      expect(
        depositAddressDataSchema.safeParse({
          ...metadata,
          state,
          assignmentId: id,
          address: ready.address,
        }).success,
      ).toBe(false);
    },
  );
  it.each([
    { ...ready, token: { ...ready.token, decimals: 18 } },
    { ...ready, token: { ...ready.token, symbol: "TRX" } },
    { ...ready, network: "unknown" },
    { ...ready, address: "../private" },
    { ...ready, readyAt: "2026-10-07T12:00:00.000Z" },
    { ...ready, detection: { ...ready.detection, privateKey: "secret" } },
  ])("rejects invalid public metadata and readiness evidence", (projection) => {
    expect(depositAddressDataSchema.safeParse(projection).success).toBe(false);
  });
  it("accepts only an empty request; the server derives owner and network", () => {
    expect(depositProvisionRequestSchema.parse({})).toEqual({});
    expect(
      depositProvisionRequestSchema.safeParse({ address: ready.address })
        .success,
    ).toBe(false);
  });
});

const grant = {
  actionId: id,
  employeeId: id,
  amount: "1.000001",
  confirmed: true,
  reason: "Initial administrative grant",
  reference: { kind: "EXTERNAL", value: "Ticket 123" },
};
describe("deposit history and manual intent boundary", () => {
  it("validates admin/outcome envelopes and rejects pagination disagreement or leaked employee fields", () => {
    const manual = {
      id,
      kind: "MANUAL_CREDIT",
      operationId: id,
      amount: "1.000001",
      source: "NON_REFERRAL",
      recordedAt: now,
      actionId: id,
      state: "RECORDED",
    };
    const person = { id, name: "Administrator", email: "admin@example.com" };
    const pagination = {
      page: 1,
      limit: 25,
      total: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    };
    const envelope = {
      success: true,
      statusCode: 200,
      message: "Loaded",
      requestId: id,
      timestamp: now,
      path: "/deposits/me/history",
    };
    const history = {
      ...envelope,
      paginationMeta: pagination,
      data: {
        items: [manual],
        pagination,
        serverNow: now,
        detection: ready.detection,
      },
    };
    expect(depositHistoryEnvelopeSchema.safeParse(history).success).toBe(true);
    expect(
      depositHistoryEnvelopeSchema.safeParse({
        ...history,
        paginationMeta: { ...pagination, total: 2 },
      }).success,
    ).toBe(false);
    const administrative = {
      ...manual,
      employee: person,
      actor: person,
      reason: grant.reason,
      reference: grant.reference,
    };
    expect(
      adminDepositHistoryEnvelopeSchema.safeParse({
        ...envelope,
        paginationMeta: pagination,
        data: { items: [administrative], pagination, serverNow: now },
      }).success,
    ).toBe(true);
    expect(
      depositHistoryEnvelopeSchema.safeParse({
        ...history,
        data: { ...history.data, items: [administrative] },
      }).success,
    ).toBe(false);
    const outcome = {
      actionId: id,
      employeeId: id,
      operationId: id,
      amount: "1.000001",
      source: "NON_REFERRAL",
      recordedAt: now,
      state: "RECORDED",
      actor: person,
      reason: grant.reason,
      reference: grant.reference,
      walletAfter: {
        availableReferral: "0",
        reservedReferral: "0",
        availableNonReferral: "1.000001",
        reservedNonReferral: "0",
        total: "1.000001",
      },
      replayed: false,
    };
    expect(
      manualCreditEnvelopeSchema.safeParse({
        ...envelope,
        statusCode: 201,
        data: outcome,
      }).success,
    ).toBe(true);
    expect(
      manualCreditEnvelopeSchema.safeParse({
        ...envelope,
        data: { ...outcome, confirmedAt: now },
      }).success,
    ).toBe(false);
  });
  it("normalizes reason/reference and accepts initial and ledger references", () => {
    expect(
      manualCreditBodySchema.parse({
        ...grant,
        reason: " Initial grant ",
        reference: { kind: "EXTERNAL", value: " Ticket 123 " },
      }),
    ).toMatchObject({
      reason: "Initial grant",
      reference: { value: "Ticket 123" },
    });
    expect(
      manualCreditBodySchema.parse({
        ...grant,
        reference: { kind: "LEDGER_OPERATION", operationId: id },
      }).reference.kind,
    ).toBe("LEDGER_OPERATION");
  });
  it.each([
    "source",
    "origin",
    "actorUserId",
    "walletId",
    "transactionId",
    "recordedAt",
    "balance",
    "audit",
  ])("rejects caller %s authority", (field) => {
    expect(
      manualCreditBodySchema.safeParse({ ...grant, [field]: "forged" }).success,
    ).toBe(false);
  });
  it.each([
    { actionId: undefined },
    { confirmed: false },
    { reason: " " },
    { amount: "0" },
    { amount: "1.000000" },
    { amount: "1e3" },
    { amount: 1 },
    { amount: "1.0000001" },
    { reference: { kind: "EXTERNAL", value: "---" } },
    { reference: { kind: "EXTERNAL", value: "abc\n123" } },
    { reference: { kind: "EXTERNAL", value: "abc", operationId: id } },
  ])("rejects ambiguous or incomplete grants", (patch) => {
    expect(
      manualCreditBodySchema.safeParse({ ...grant, ...patch }).success,
    ).toBe(false);
  });
  it("bounds history and validates recorded-time and chain-only filters", () => {
    expect(depositHistoryQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
    expect(
      adminDepositHistoryQuerySchema.parse({ q: " name ", employeeId: id }).q,
    ).toBe("name");
    for (const query of [
      { limit: "101" },
      { page: "0" },
      { page: Number.MAX_SAFE_INTEGER, limit: 100 },
      { kind: ["CHAIN_DEPOSIT"] },
      { sort: "amount" },
      { from: now, to: "2026-10-05T00:00:00Z" },
      { from: "invalid" },
    ])
      expect(depositHistoryQuerySchema.safeParse(query).success).toBe(false);
    expect(
      adminDepositHistoryQuerySchema.safeParse({
        kind: "MANUAL_CREDIT",
        transactionId: "a".repeat(64),
      }).success,
    ).toBe(false);
  });
  it("excludes private administrative fields and manual chain finality", () => {
    const row = {
      id,
      kind: "MANUAL_CREDIT",
      operationId: id,
      amount: "1.000001",
      source: "NON_REFERRAL",
      recordedAt: now,
      actionId: id,
      state: "RECORDED",
    };
    expect(depositHistoryRowSchema.parse(row)).toEqual(row);
    for (const field of [
      "reason",
      "reference",
      "actor",
      "confirmedAt",
      "transactionId",
      "keyEnvelopeDigest",
    ])
      expect(
        depositHistoryRowSchema.safeParse({ ...row, [field]: "private" })
          .success,
      ).toBe(false);
  });
});
