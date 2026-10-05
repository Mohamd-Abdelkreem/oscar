import type {
  PackageEdit,
  ReferralEdit,
  ConfigurationResult,
} from "@template/contracts";

export function matchesEditedFields(
  body: PackageEdit | ReferralEdit,
  change: ConfigurationResult,
): boolean {
  if ("ratesBps" in body)
    return (
      "ratesBps" in change.after &&
      body.ratesBps.every(
        (rate, index) =>
          "ratesBps" in change.after && change.after.ratesBps[index] === rate,
      )
    );
  if (!("code" in change.after)) return false;
  const after = change.after;
  return (
    (body.price === undefined || body.price === after.price) &&
    (body.dailyReward === undefined ||
      body.dailyReward === after.dailyReward) &&
    (body.countedWorkDates === undefined ||
      body.countedWorkDates === after.countedWorkDates) &&
    (body.withdrawalFeeBps === undefined ||
      body.withdrawalFeeBps === after.withdrawalFeeBps)
  );
}
