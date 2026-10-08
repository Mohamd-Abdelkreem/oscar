import {
  depositAddressDataSchema,
  depositHistoryDataSchema,
  adminDepositHistoryDataSchema,
} from "@template/contracts";
import { actorId, otherId, now, pagination } from "./p04-network";
import { wallet } from "./p04-network";

export const manualCreditBody = {
  actionId: actorId,
  employeeId: otherId,
  confirmed: true as const,
  amount: "1.000001",
  reason: "Reviewed adjustment",
  reference: { kind: "EXTERNAL" as const, value: "same-reference" },
};
export const manualCreditOutcome = {
  actionId: actorId,
  employeeId: otherId,
  amount: "1.000001",
  reason: manualCreditBody.reason,
  reference: manualCreditBody.reference,
  operationId: otherId,
  source: "NON_REFERRAL" as const,
  recordedAt: now,
  state: "RECORDED" as const,
  actor: { id: actorId, name: "Changed Admin", email: "changed@example.test" },
  walletAfter: wallet.walletComponents,
  replayed: false,
};
export const manualCreditTargets = {
  items: [
    { id: otherId, name: "First Credit Employee", email: "first@example.test" },
  ],
  pagination: { ...pagination, limit: 25, total: 1, totalPages: 1 },
};

export const receivingAddress = "T" + "A".repeat(33);
export const secondAddress = "T" + "B".repeat(33);
export const depositMetadata = {
  serverNow: now,
  network: "TRON_NILE" as const,
  token: {
    symbol: "USDT" as const,
    contract: secondAddress,
    decimals: 6 as const,
  },
};
export const detection = {
  status: "SCANNING" as const,
  serverNow: now,
  lastSuccessfulScanAt: now,
};
export const readyAssignment = depositAddressDataSchema.parse({
  ...depositMetadata,
  state: "READY",
  assignmentId: actorId,
  address: receivingAddress,
  readyAt: now,
  activationState: "UNKNOWN",
  detection,
});
export const provisioningAssignment = depositAddressDataSchema.parse({
  ...depositMetadata,
  state: "PROVISIONING",
  assignmentId: actorId,
  readiness: "REQUESTED",
});
export const emptyDepositHistory = depositHistoryDataSchema.parse({
  items: [],
  pagination,
  serverNow: now,
  detection,
});
export const recordedDepositHistory = depositHistoryDataSchema.parse({
  ...emptyDepositHistory,
  pagination: { ...pagination, total: 2, totalPages: 1 },
  items: [
    {
      id: actorId,
      operationId: actorId,
      kind: "CHAIN_DEPOSIT",
      amount: "1.000001",
      source: "NON_REFERRAL",
      recordedAt: now,
      network: "TRON_NILE",
      tokenContract: secondAddress,
      transactionId: "a".repeat(64),
      logIndex: 0,
      address: receivingAddress,
      confirmedAt: now,
      state: "CONFIRMED",
    },
    {
      id: actorId,
      operationId: otherId,
      kind: "MANUAL_CREDIT",
      amount: "2.000002",
      source: "NON_REFERRAL",
      recordedAt: now,
      actionId: otherId,
      state: "RECORDED",
    },
  ],
});

export const emptyAdminDepositHistory = adminDepositHistoryDataSchema.parse({
  items: [],
  pagination: { ...pagination, limit: 10 },
  serverNow: now,
});
export const recordedAdminDepositHistory = adminDepositHistoryDataSchema.parse({
  ...emptyAdminDepositHistory,
  pagination: {
    ...emptyAdminDepositHistory.pagination,
    total: 2,
    totalPages: 1,
  },
  items: recordedDepositHistory.items.map((row) => ({
    ...row,
    employee: {
      id: actorId,
      name: "Real Employee",
      email: "employee@example.test",
    },
    ...(row.kind === "MANUAL_CREDIT"
      ? {
          actor: {
            id: otherId,
            name: "Real Admin",
            email: "admin@example.test",
          },
          reason: "Verified external adjustment",
          reference: { kind: "EXTERNAL", value: "External reference" },
        }
      : {}),
  })),
});

export function employeeDepositPage(page: number) {
  const manual = recordedDepositHistory.items.find(
    (row) => row.kind === "MANUAL_CREDIT",
  );
  if (manual === undefined) throw new Error("P07_MANUAL_FIXTURE_REQUIRED");
  const rows = [
    ...recordedDepositHistory.items,
    ...Array.from({ length: 24 }, (_, index) => ({
      ...manual,
      operationId: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      amount: "3",
    })),
  ];
  return depositHistoryDataSchema.parse({
    ...recordedDepositHistory,
    items: rows.slice((page - 1) * 25, page * 25),
    pagination: {
      page,
      limit: 25,
      total: 26,
      totalPages: 2,
      hasNextPage: page < 2,
      hasPreviousPage: page > 1,
    },
  });
}
