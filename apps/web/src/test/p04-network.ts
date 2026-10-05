import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { apiClient } from "@/services/api/api-client";
import { getSessionRuntime } from "@/services/api/session-runtime";

export const actorId = "00000000-0000-4000-8000-000000000001";
export const otherId = "00000000-0000-4000-8000-000000000002";
export const now = "2026-10-05T09:00:00.000Z";
export const terms = {
  code: "S1",
  tierOrder: 1,
  version: 1,
  price: "60",
  dailyReward: "2",
  countedWorkDates: 365,
  withdrawalFeeBps: 2100,
  conditionalGross: "730",
  calendar: {
    zone: "Asia/Baghdad",
    workdays: [1, 2, 3, 4, 5],
    firstDateCutoff: "18:00",
    expiryBoundary: "EXCLUSIVE_NEXT_CALENDAR_DATE_START",
  },
};
export const pagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};
export const membership = {
  employeeId: actorId,
  serverNow: now,
  effective: "FREE",
  subscription: null,
};
export const wallet = {
  employeeId: actorId,
  serverNow: now,
  walletComponents: {
    availableReferral: "10",
    availableNonReferral: "30",
    reservedReferral: "3",
    reservedNonReferral: "2",
    total: "45",
  },
  membership,
  purchaseEligibleAmount: "40",
  withdrawalFunds: {
    eligibleNonReferral: "30",
    eligibleReferral: "0",
    total: "30",
    lockedReferral: "10",
  },
  restrictions: { accountUnavailable: false, withdrawalsBlocked: false },
  withdrawalExecutionReady: false,
};
export const quote = {
  quoteId: actorId,
  packageCode: "S1",
  action: "PURCHASE",
  terms,
  quotedAt: now,
  quoteExpiresAt: "2026-10-05T09:10:00.000Z",
  serverNow: now,
  previousSubscriptionId: null,
  fullDebit: "60",
  usableFunds: "40",
  fundedAllocation: { referral: "10", nonReferral: "30", total: "40" },
  requiredTopUp: "20",
  canPurchase: false,
  blockReason: "INSUFFICIENT_FUNDS",
  preview: {
    firstWorkDate: "2026-10-05",
    finalWorkDate: "2028-02-25",
    expiresAt: "2028-02-25T21:00:00.000Z",
  },
};
export const purchase = {
  purchaseId: otherId,
  quoteId: actorId,
  action: "PURCHASE",
  purchasedAt: now,
  packageCode: "S1",
  fullDebit: "60",
  sourceAllocation: { referral: "10", nonReferral: "50", gross: "60" },
  commissionBase: "60",
  subscriptionAtPurchase: {
    id: actorId,
    purchaseId: otherId,
    terms,
    activationAt: now,
    firstWorkDate: quote.preview.firstWorkDate,
    finalWorkDate: quote.preview.finalWorkDate,
    expiresAt: quote.preview.expiresAt,
    stateAtPurchase: "CURRENT",
  },
  walletAfter: {
    availableReferral: "0",
    availableNonReferral: "0",
    reservedReferral: "3",
    reservedNonReferral: "2",
    total: "5",
  },
};
export const summary = {
  serverNow: now,
  root: { id: actorId, fullName: "Employee", referralCode: "a".repeat(32) },
  currentRates: { version: 1, ratesBps: [1200, 600, 400, 200, 200] },
  levelCounts: [1, 2, 3, 4, 5].map((level) => ({
    level,
    members: 0,
    paidMembers: 0,
  })),
  ownEarned: { byLevel: ["0", "0", "0", "0", "0"], total: "0" },
};
export const adminSummary = {
  ...summary,
  root: { ...summary.root, email: "employee@example.test", joinedAt: now },
  levelCountsScope: "ROOT_UNFILTERED",
  deeperDescendantCount: 0,
};
export const ledger = {
  items: [],
  pagination,
  summary: {
    scope: "FILTERED_OPERATIONS",
    credits: "0",
    debits: "0",
    net: "0",
  },
  serverNow: now,
};
export const finance = {
  ...ledger,
  summary: { ...ledger.summary, neutralOperationsCount: 0 },
  walletTotalsScope: { kind: "ALL_EMPLOYEES" },
  walletTotals: {
    available: "40",
    reserved: "5",
    referral: "13",
    nonReferral: "32",
    owned: "45",
  },
};
export const change = {
  changeId: otherId,
  commandId: actorId,
  occurredAt: now,
  expectedVersion: 1,
  committedVersion: 2,
  reason: "Reviewed future terms",
  replayed: false,
  target: { kind: "PACKAGE", packageCode: "S1" },
  before: terms,
  after: { ...terms, version: 2, price: "61.000001" },
};

export const catalog = {
  serverNow: now,
  items: (["S1", "S2", "O1", "O2", "A1"] as const).map((code, index) => ({
    ...terms,
    code,
    tierOrder: index + 1,
  })),
};
export const adminCatalog = {
  ...catalog,
  items: catalog.items.map((entry) => ({
    terms: entry,
    activeSubscriptionsCount: 37,
  })),
};
export const operation = {
  operationId: otherId,
  recordedAt: now,
  kind: "RESERVE",
  origin: "WITHDRAWAL_RESERVATION",
  direction: "NEUTRAL",
  magnitude: "1.000001",
  signedOwnershipDelta: "0",
  sourceMovements: [
    {
      source: "NON_REFERRAL",
      availableDelta: "-1.000001",
      reservedDelta: "1.000001",
    },
  ],
  referenceLabel: "Persisted reservation",
};

const originalAdapter = apiClient.defaults.adapter;
export function networkSession(role: "USER" | "ADMIN" = "USER") {
  const heldLocks = new Set<string>();
  Object.defineProperty(navigator, "locks", {
    configurable: true,
    value: {
      request: (
        _name: string,
        options: (() => Promise<unknown>) | { ifAvailable: boolean },
        callback?: (lock: { name: string } | null) => Promise<unknown>,
      ) => {
        if (typeof options === "function") return options();
        if (callback === undefined)
          return Promise.reject(new Error("Missing lock callback"));
        if (heldLocks.has(_name)) return callback(null);
        heldLocks.add(_name);
        return Promise.resolve(callback({ name: _name })).finally(() => {
          heldLocks.delete(_name);
        });
      },
    },
  });
  const runtime = getSessionRuntime();
  runtime.admitIdentity(runtime.scope(), { id: actorId, role });
  return runtime;
}
export function reply(
  config: InternalAxiosRequestConfig,
  payload: unknown,
  status = 200,
) {
  return {
    config,
    status,
    statusText: "OK",
    headers: new AxiosHeaders(),
    data: {
      success: true,
      statusCode: status,
      message: "OK",
      requestId: "test",
      timestamp: now,
      path: config.url,
      data: payload,
      ...(typeof payload === "object" &&
      payload !== null &&
      "pagination" in payload
        ? { paginationMeta: payload.pagination }
        : {}),
    },
  };
}
export function reject(
  config: InternalAxiosRequestConfig,
  code: string,
  status = 409,
  valid = true,
): never {
  const response = {
    ...reply(config, null, status),
    data: valid
      ? {
          success: false,
          statusCode: status,
          code,
          message: "SENTINEL PRIVATE MESSAGE",
          requestId: "test",
          timestamp: now,
          path: config.url,
        }
      : { success: false, statusCode: status, code },
  };
  throw new AxiosError(
    "SENTINEL",
    "ERR_BAD_RESPONSE",
    config,
    undefined,
    response,
  );
}
export function cleanupNetwork() {
  afterEach(() => {
    cleanup();
    if (originalAdapter !== undefined)
      apiClient.defaults.adapter = originalAdapter;
    getSessionRuntime().dispose();
    Object.keys(localStorage).forEach((key) => {
      localStorage.removeItem(key);
    });
  });
}
