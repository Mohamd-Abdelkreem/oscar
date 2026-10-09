import { describe, expect, it } from "vitest";
import { paginatedFinancialEnvelopeSchema } from "../http/http.schema.ts";
import {
  adminFinancePageSchema,
  adminLedgerFilterSchema,
  adminWalletViewSchema,
  employeeLedgerDetailSchema,
  ledgerFilterSchema,
  ledgerRowSchema,
  walletViewSchema,
} from "./wallet.schema.ts";
import {
  p04EmptyPagination,
  p04Id,
  p04Now,
  p04Wallet,
} from "../testing/p04-fixtures.ts";

const walletView = {
  employeeId: p04Id,
  serverNow: p04Now,
  walletComponents: p04Wallet,
  membership: {
    employeeId: p04Id,
    serverNow: p04Now,
    effective: "FREE",
    subscription: null,
  },
  purchaseEligibleAmount: "40",
  withdrawalFunds: {
    eligibleNonReferral: "30",
    eligibleReferral: "0",
    total: "30",
    lockedReferral: "10",
  },
  restrictions: { accountUnavailable: false, withdrawalsBlocked: true },
  withdrawalExecutionReady: false,
};
const neutralRow = {
  operationId: p04Id,
  recordedAt: p04Now,
  kind: "RESERVE",
  origin: "WITHDRAWAL_RESERVATION",
  direction: "NEUTRAL",
  magnitude: "2",
  signedOwnershipDelta: "0",
  sourceMovements: [
    { source: "NON_REFERRAL", availableDelta: "-2", reservedDelta: "2" },
  ],
  referenceLabel: "reservation",
};
const finance = {
  items: [],
  pagination: p04EmptyPagination,
  summary: {
    scope: "FILTERED_OPERATIONS",
    credits: "18446744073709.551614",
    debits: "0",
    net: "18446744073709.551614",
    neutralOperationsCount: 0,
  },
  serverNow: p04Now,
  walletTotalsScope: { kind: "ALL_EMPLOYEES" },
  walletTotals: {
    available: "40",
    reserved: "5",
    referral: "13",
    nonReferral: "32",
    owned: "45",
  },
};
describe("source-aware wallet and finance boundaries", () => {
  it("keeps original withdrawal sources in reserve/release history and denies premature settlement", () => {
    for (const kind of ["RESERVE", "RELEASE"]) {
      const row = {
        ...neutralRow,
        kind,
        sourceMovements: [
          {
            source: "NON_REFERRAL",
            availableDelta: kind === "RESERVE" ? "-2" : "2",
            reservedDelta: kind === "RESERVE" ? "2" : "-2",
          },
        ],
        savedTerms: null,
      };
      expect(employeeLedgerDetailSchema.parse(row).signedOwnershipDelta).toBe(
        "0",
      );
    }
    expect(
      ledgerRowSchema.safeParse({
        ...neutralRow,
        kind: "SETTLE",
        origin: "WITHDRAWAL_SETTLEMENT",
      }).success,
    ).toBe(false);
    expect(
      walletViewSchema.safeParse({
        ...walletView,
        withdrawalExecutionReady: null,
      }).success,
    ).toBe(false);
  });
  it("retains all ownership while separating locked funds and execution readiness", () => {
    expect(walletViewSchema.parse(walletView).walletComponents.total).toBe(
      "45",
    );
    for (const patch of [
      { purchaseEligibleAmount: "45" },
      { withdrawalExecutionReady: true },
      {
        withdrawalFunds: {
          ...walletView.withdrawalFunds,
          eligibleReferral: "10",
        },
      },
      { walletComponents: { ...p04Wallet, reservedReferral: "4" } },
      { privateKey: "sentinel" },
    ])
      expect(
        walletViewSchema.safeParse({ ...walletView, ...patch }).success,
      ).toBe(false);
    const employee = {
      id: p04Id,
      fullName: "Employee",
      email: "employee@example.test",
    };
    expect(
      adminWalletViewSchema.parse({ ...walletView, employee }).employee.id,
    ).toBe(p04Id);
    expect(
      walletViewSchema.safeParse({ ...walletView, employee }).success,
    ).toBe(false);
  });
  it("checks signed ownership and full movements without counting reservations as income", () => {
    expect(ledgerRowSchema.parse(neutralRow).signedOwnershipDelta).toBe("0");
    expect(
      employeeLedgerDetailSchema.parse({ ...neutralRow, savedTerms: null })
        .sourceMovements,
    ).toHaveLength(1);
    for (const patch of [
      { signedOwnershipDelta: "2" },
      { direction: "CREDIT" },
      {
        sourceMovements: [
          { source: "NON_REFERRAL", availableDelta: "-1", reservedDelta: "2" },
        ],
      },
      { intentHash: "private" },
    ])
      expect(
        employeeLedgerDetailSchema.safeParse({
          ...neutralRow,
          savedTerms: null,
          ...patch,
        }).success,
      ).toBe(false);
    expect(
      ledgerRowSchema.parse({
        ...neutralRow,
        kind: "PURCHASE_DEBIT",
        origin: "PACKAGE_PURCHASE",
        direction: "DEBIT",
        signedOwnershipDelta: "-2",
        sourceMovements: [
          { source: "NON_REFERRAL", availableDelta: "-2", reservedDelta: "0" },
        ],
      }).direction,
    ).toBe("DEBIT");
  });
  it("requires exact aggregate scopes and a real neutral count before paging", () => {
    expect(adminFinancePageSchema.parse(finance).summary.credits).toBe(
      finance.summary.credits,
    );
    for (const neutralOperationsCount of [
      undefined,
      null,
      -1,
      0.5,
      "0",
      Number.MAX_SAFE_INTEGER + 1,
    ])
      expect(
        adminFinancePageSchema.safeParse({
          ...finance,
          summary: { ...finance.summary, neutralOperationsCount },
        }).success,
      ).toBe(false);
    expect(
      adminFinancePageSchema.safeParse({
        ...finance,
        summary: { ...finance.summary, net: "0" },
      }).success,
    ).toBe(false);
    const envelope = {
      success: true,
      statusCode: 200,
      message: "ok",
      data: finance,
      paginationMeta: p04EmptyPagination,
      requestId: "test",
      timestamp: p04Now,
      path: "/admin/finance",
    };
    const schema = paginatedFinancialEnvelopeSchema(adminFinancePageSchema);
    expect(schema.parse(envelope).data.summary.neutralOperationsCount).toBe(0);
    expect(schema.safeParse({ ...envelope, statusCode: 600 }).success).toBe(
      false,
    );
    expect(
      schema.safeParse({
        ...envelope,
        paginationMeta: {
          ...p04EmptyPagination,
          page: 2,
          hasPreviousPage: true,
        },
      }).success,
    ).toBe(false);
    expect(
      adminFinancePageSchema.safeParse({ ...finance, items: [neutralRow] })
        .success,
    ).toBe(false);
  });
  it("bounds filters and separates employee/admin searches", () => {
    expect(
      ledgerFilterSchema.parse({ page: "2", limit: "100", source: "REFERRAL" })
        .page,
    ).toBe(2);
    expect(adminLedgerFilterSchema.parse({ q: "  employee  " }).q).toBe(
      "employee",
    );
    for (const query of [
      { page: ["1"] },
      { page: "01" },
      { limit: "101" },
      { page: Number.MAX_SAFE_INTEGER, limit: 100 },
      { from: "2026-10-06T00:00:00Z", to: p04Now },
      { direction: "credit" },
      { q: "private" },
      { ownerId: p04Id },
    ])
      expect(ledgerFilterSchema.safeParse(query).success).toBe(false);
    expect(
      adminLedgerFilterSchema.safeParse({ q: "x".repeat(151) }).success,
    ).toBe(false);
  });
});
