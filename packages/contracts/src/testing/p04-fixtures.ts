export const p04Id = "e06d6df0-9003-4ab1-9c94-71b7cbb380ee";
export const p04OtherId = "e06d6df0-9003-4ab1-9c94-71b7cbb380ef";
export const p04Now = "2026-10-05T09:00:00.000Z";
export const p04Terms = {
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
export const p04Wallet = {
  availableReferral: "10",
  reservedReferral: "3",
  availableNonReferral: "30",
  reservedNonReferral: "2",
  total: "45",
};
export const p04Subscription = {
  id: p04Id,
  purchaseId: p04OtherId,
  terms: p04Terms,
  activationAt: p04Now,
  firstWorkDate: "2026-10-05",
  finalWorkDate: "2028-02-25",
  expiresAt: "2028-02-25T21:00:00.000Z",
  state: "CURRENT",
};
export const p04Quote = {
  quoteId: p04Id,
  packageCode: "S1",
  action: "PURCHASE",
  terms: p04Terms,
  quotedAt: p04Now,
  quoteExpiresAt: "2026-10-05T09:10:00.000Z",
  serverNow: p04Now,
  previousSubscriptionId: null,
  fullDebit: "60",
  usableFunds: "40",
  fundedAllocation: { referral: "10", nonReferral: "30", total: "40" },
  requiredTopUp: "20",
  canPurchase: false,
  blockReason: "INSUFFICIENT_FUNDS",
  preview: {
    firstWorkDate: p04Subscription.firstWorkDate,
    finalWorkDate: p04Subscription.finalWorkDate,
    expiresAt: p04Subscription.expiresAt,
  },
};
export const p04EmptyPagination = {
  page: 1,
  limit: 25,
  total: 0,
  totalPages: 0,
  hasNextPage: false,
  hasPreviousPage: false,
};
