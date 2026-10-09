import type {
  Subscription,
  Wallet,
  WithdrawalPolicy,
} from "@template/database";
import { feeAndNetUnits, parseUsdtAmount } from "../../core/financial/money.js";
import { WithdrawalError } from "./withdrawals.errors.js";

export function calculateWithdrawalPolicy(
  rawGross: unknown,
  policy: Pick<
    WithdrawalPolicy,
    "minimumGrossUnits" | "maximumGrossUnits" | "freeFeeBps" | "version"
  >,
  wallet: Pick<Wallet, "availableNonReferralUnits" | "availableReferralUnits">,
  subscription: Pick<
    Subscription,
    | "id"
    | "state"
    | "activationAt"
    | "expiresAt"
    | "packageVersion"
    | "withdrawalFeeBps"
  > | null,
  now: Date,
) {
  const gross = parseUsdtAmount(rawGross);
  if (gross < policy.minimumGrossUnits || gross > policy.maximumGrossUnits)
    throw new WithdrawalError("WITHDRAWAL_AMOUNT_INVALID");
  const paid =
    subscription !== null &&
    subscription.state === "CURRENT" &&
    now >= subscription.activationAt &&
    now < subscription.expiresAt;
  const feeBps = paid ? subscription.withdrawalFeeBps : policy.freeFeeBps;
  const money = feeAndNetUnits(gross, feeBps);
  if (money.net === 0n) throw new WithdrawalError("WITHDRAWAL_AMOUNT_INVALID");
  const eligibleReferral = paid ? wallet.availableReferralUnits : 0n;
  const nonReferral =
    gross < wallet.availableNonReferralUnits
      ? gross
      : wallet.availableNonReferralUnits;
  const neededReferral = gross - nonReferral;
  const referral =
    neededReferral < eligibleReferral ? neededReferral : eligibleReferral;
  return {
    ...money,
    feeBps,
    paid,
    eligibleReferral,
    nonReferral,
    referral,
    topUp: gross - nonReferral - referral,
  };
}
