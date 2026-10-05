import { describe, expect, it } from "vitest";
import {
  confirmedPurchaseBodySchema,
  fundedAllocationSchema,
  membershipSchema,
  purchaseQuoteBodySchema,
  purchaseQuoteSchema,
  purchaseResultSchema,
  quoteOutcomeSchema,
  subscriptionSchema,
} from "./subscription.schema.ts";
import {
  p04Id,
  p04Now,
  p04OtherId,
  p04Quote,
  p04Subscription,
  p04Wallet,
} from "../testing/p04-fixtures.ts";

describe("owned subscription and purchase contracts", () => {
  it("keeps partial quote funding distinct from a full debit", () => {
    expect(purchaseQuoteSchema.parse(p04Quote).requiredTopUp).toBe("20");
    expect(
      purchaseQuoteSchema.safeParse({
        ...p04Quote,
        quoteExpiresAt: "2026-10-05T09:11:00Z",
      }).success,
    ).toBe(false);
    expect(
      fundedAllocationSchema.parse({
        referral: "0",
        nonReferral: "0",
        total: "0",
      }).total,
    ).toBe("0");
    for (const patch of [
      { requiredTopUp: "0" },
      { fullDebit: "40" },
      { usableFunds: "bad" },
      { terms: { ...p04Quote.terms, price: "bad" } },
      { fundedAllocation: { referral: "10", nonReferral: "30", total: "39" } },
      { canPurchase: true },
      { preview: { ...p04Quote.preview, finalWorkDate: "2026-10-04" } },
    ])
      expect(
        purchaseQuoteSchema.safeParse({ ...p04Quote, ...patch }).success,
      ).toBe(false);
    expect(
      purchaseQuoteSchema.parse({
        ...p04Quote,
        usableFunds: "100",
        fundedAllocation: { referral: "60", nonReferral: "0", total: "60" },
        requiredTopUp: "0",
        canPurchase: true,
        blockReason: null,
      }).fullDebit,
    ).toBe("60");
  });
  it("rejects submitted ownership and money authority", () => {
    expect(
      purchaseQuoteBodySchema.parse({ packageCode: "O1" }).packageCode,
    ).toBe("O1");
    expect(
      confirmedPurchaseBodySchema.parse({ quoteId: p04Id, confirmed: true })
        .quoteId,
    ).toBe(p04Id);
    for (const field of [
      "buyerId",
      "ownerId",
      "fullDebit",
      "sourceAllocation",
      "subscriptionId",
      "price",
    ])
      expect(
        confirmedPurchaseBodySchema.safeParse({
          quoteId: p04Id,
          confirmed: true,
          [field]: "forged",
        }).success,
      ).toBe(false);
    expect(
      confirmedPurchaseBodySchema.safeParse({
        quoteId: p04Id,
        confirmed: false,
      }).success,
    ).toBe(false);
  });
  it("derives live membership at exclusive expiry while preserving saved history", () => {
    const membership = {
      employeeId: p04Id,
      serverNow: p04Now,
      effective: "PAID",
      subscription: p04Subscription,
    };
    expect(membershipSchema.parse(membership).effective).toBe("PAID");
    expect(
      membershipSchema.parse({
        ...membership,
        serverNow: p04Subscription.expiresAt,
        effective: "FREE",
      }).subscription?.state,
    ).toBe("CURRENT");
    expect(
      membershipSchema.safeParse({
        ...membership,
        serverNow: p04Subscription.expiresAt,
      }).success,
    ).toBe(false);
    expect(
      membershipSchema.safeParse({ ...membership, subscription: null }).success,
    ).toBe(false);
    expect(
      subscriptionSchema.safeParse({
        ...p04Subscription,
        terms: { ...p04Subscription.terms, activeSubscriptionsCount: 1 },
      }).success,
    ).toBe(false);
  });
  it("preserves purchase-time CURRENT independently of mutable lifecycle and reconciles only matching quotes", () => {
    const { state: _state, ...saved } = p04Subscription;
    const purchase = {
      purchaseId: p04OtherId,
      quoteId: p04Id,
      action: "PURCHASE",
      purchasedAt: p04Now,
      packageCode: "S1",
      fullDebit: "60",
      sourceAllocation: { referral: "10", nonReferral: "50", gross: "60" },
      commissionBase: "60",
      subscriptionAtPurchase: { ...saved, stateAtPurchase: "CURRENT" },
      walletAfter: p04Wallet,
    };
    expect(
      purchaseResultSchema.parse(purchase).subscriptionAtPurchase
        .stateAtPurchase,
    ).toBe("CURRENT");
    expect(
      purchaseResultSchema.safeParse({
        ...purchase,
        subscriptionAtPurchase: p04Subscription,
      }).success,
    ).toBe(false);
    expect(
      quoteOutcomeSchema.parse({
        status: "COMMITTED",
        quoteId: p04Id,
        purchase,
        serverNow: "2030-01-01T00:00:00Z",
      }).status,
    ).toBe("COMMITTED");
    for (const [status, serverNow, valid] of [
      ["NOT_OBSERVED", p04Now, true],
      ["NOT_OBSERVED", p04Quote.quoteExpiresAt, false],
      ["EXPIRED_UNCOMMITTED", p04Quote.quoteExpiresAt, true],
      ["EXPIRED_UNCOMMITTED", p04Now, false],
    ] as const)
      expect(
        quoteOutcomeSchema.safeParse({
          status,
          quoteId: p04Id,
          quote: p04Quote,
          serverNow,
        }).success,
      ).toBe(valid);
    expect(
      quoteOutcomeSchema.safeParse({
        status: "NOT_OBSERVED",
        quoteId: p04OtherId,
        quote: p04Quote,
        serverNow: p04Now,
      }).success,
    ).toBe(false);
  });
});
