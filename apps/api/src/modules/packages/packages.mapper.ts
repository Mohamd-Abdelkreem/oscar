import {
  configurationResultSchema,
  referralSettingsSchema,
  packageTermsSchema,
  type PackageTerms,
} from "@template/contracts";
import type {
  ConfigurationChange,
  ReferralSettings,
  Package,
} from "@template/database";
import { formatUsdtAmount } from "../../core/financial/money.js";

export function mapPackageTerms(configured: Package): PackageTerms {
  return packageTermsSchema.parse({
    code: configured.code,
    tierOrder: configured.tierOrder,
    version: configured.version,
    price: formatUsdtAmount(configured.priceUnits),
    dailyReward: formatUsdtAmount(configured.dailyRewardUnits),
    countedWorkDates: configured.countedWorkDates,
    withdrawalFeeBps: configured.withdrawalFeeBps,
    conditionalGross: formatUsdtAmount(
      configured.dailyRewardUnits * BigInt(configured.countedWorkDates),
    ),
    calendar: {
      zone: "Asia/Baghdad",
      workdays: [1, 2, 3, 4, 5],
      firstDateCutoff: "18:00",
      expiryBoundary: "EXCLUSIVE_NEXT_CALENDAR_DATE_START",
    },
  });
}

export const savedTermColumns = (configured: Package) => ({
  packageCode: configured.code,
  tierOrder: configured.tierOrder,
  packageVersion: configured.version,
  priceUnits: configured.priceUnits,
  dailyRewardUnits: configured.dailyRewardUnits,
  countedWorkDates: configured.countedWorkDates,
  withdrawalFeeBps: configured.withdrawalFeeBps,
  acceptedTerms: mapPackageTerms(configured),
});

export function mapReferralSettings(configured: ReferralSettings) {
  return referralSettingsSchema.parse({
    version: configured.version,
    ratesBps: [
      configured.level1Bps,
      configured.level2Bps,
      configured.level3Bps,
      configured.level4Bps,
      configured.level5Bps,
    ],
  });
}

export function mapConfigurationChange(saved: ConfigurationChange) {
  return configurationResultSchema.parse({
    changeId: saved.id,
    commandId: saved.commandId,
    target:
      saved.targetKind === "PACKAGE"
        ? { kind: "PACKAGE", packageCode: saved.packageCode }
        : { kind: saved.targetKind },
    occurredAt: saved.occurredAt.toISOString(),
    reason: saved.reason,
    expectedVersion: saved.expectedVersion,
    committedVersion: saved.committedVersion,
    before: saved.beforeSnapshot,
    after: saved.afterSnapshot,
    replayed: true,
  });
}
