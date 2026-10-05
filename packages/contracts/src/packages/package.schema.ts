import { z } from "zod";

import {
  basisPointsSchema,
  canonicalAmountUnits,
  financialInstantSchema,
  positiveUsdtAmountSchema,
} from "../financial/financial.schema.ts";
import { confirmedReasonShape } from "../identity/identity.schema.ts";

export const packageCodeSchema = z.enum(["S1", "S2", "O1", "O2", "A1"]);
export const configurationVersionSchema = z
  .number()
  .int()
  .min(1)
  .max(2147483647);
export const countedWorkDatesSchema = configurationVersionSchema;
export const expectedConfigurationVersionSchema =
  configurationVersionSchema.max(2147483646);
export const safeCountSchema = z
  .number()
  .int()
  .min(0)
  .max(Number.MAX_SAFE_INTEGER);
export const referralRatesSchema = z.tuple([
  basisPointsSchema,
  basisPointsSchema,
  basisPointsSchema,
  basisPointsSchema,
  basisPointsSchema,
]);
export const packageCalendarSchema = z
  .object({
    zone: z.literal("Asia/Baghdad"),
    workdays: z.tuple([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
    ]),
    firstDateCutoff: z.literal("18:00"),
    expiryBoundary: z.literal("EXCLUSIVE_NEXT_CALENDAR_DATE_START"),
  })
  .strict();

export const packageTermsSchema = z
  .object({
    code: packageCodeSchema,
    tierOrder: z.number().int().min(1).max(5),
    version: configurationVersionSchema,
    price: positiveUsdtAmountSchema,
    dailyReward: positiveUsdtAmountSchema,
    countedWorkDates: countedWorkDatesSchema,
    withdrawalFeeBps: basisPointsSchema,
    conditionalGross: positiveUsdtAmountSchema,
    calendar: packageCalendarSchema,
  })
  .strict()
  .superRefine((terms, context) => {
    if (packageCodeSchema.options.indexOf(terms.code) + 1 !== terms.tierOrder)
      context.addIssue({
        code: "custom",
        path: ["tierOrder"],
        message: "Tier must match stable package code.",
      });
    if (
      positiveUsdtAmountSchema.safeParse(terms.dailyReward).success &&
      positiveUsdtAmountSchema.safeParse(terms.conditionalGross).success &&
      countedWorkDatesSchema.safeParse(terms.countedWorkDates).success &&
      canonicalAmountUnits(terms.dailyReward) *
        BigInt(terms.countedWorkDates) !==
        canonicalAmountUnits(terms.conditionalGross)
    )
      context.addIssue({
        code: "custom",
        path: ["conditionalGross"],
        message: "Gross must equal reward times counted work dates.",
      });
  });
export const adminCatalogItemSchema = z
  .object({
    terms: packageTermsSchema,
    activeSubscriptionsCount: safeCountSchema,
  })
  .strict();
export const catalogSchema = z
  .object({
    items: z.array(packageTermsSchema).length(5),
    serverNow: financialInstantSchema,
  })
  .strict()
  .refine(
    (catalog) =>
      catalog.items.every((terms, index) => terms.tierOrder === index + 1),
    "Catalog must contain the five ordered tiers.",
  );
export const adminCatalogSchema = z
  .object({
    items: z.array(adminCatalogItemSchema).length(5),
    serverNow: financialInstantSchema,
  })
  .strict()
  .refine(
    (catalog) =>
      catalog.items.every(
        (entry, index) => entry.terms.tierOrder === index + 1,
      ),
    "Catalog must contain the five ordered tiers.",
  );
export const referralSettingsSchema = z
  .object({
    version: configurationVersionSchema,
    ratesBps: referralRatesSchema,
  })
  .strict();
export const referralSettingsDataSchema = referralSettingsSchema
  .extend({ serverNow: financialInstantSchema })
  .strict();

const configurationCommandShape = {
  commandId: z.uuid(),
  expectedVersion: expectedConfigurationVersionSchema,
  ...confirmedReasonShape,
};
export const packageEditSchema = z
  .object({
    ...configurationCommandShape,
    price: positiveUsdtAmountSchema.optional(),
    dailyReward: positiveUsdtAmountSchema.optional(),
    countedWorkDates: countedWorkDatesSchema.optional(),
    withdrawalFeeBps: basisPointsSchema.optional(),
  })
  .strict()
  .refine(
    (edit) =>
      [
        edit.price,
        edit.dailyReward,
        edit.countedWorkDates,
        edit.withdrawalFeeBps,
      ].some((field) => field !== undefined),
    "At least one package field is required.",
  );
export const referralEditSchema = z
  .object({ ...configurationCommandShape, ratesBps: referralRatesSchema })
  .strict();
const changeShape = {
  changeId: z.uuid(),
  commandId: z.uuid(),
  occurredAt: financialInstantSchema,
  expectedVersion: expectedConfigurationVersionSchema,
  committedVersion: configurationVersionSchema,
  reason: confirmedReasonShape.reason,
  replayed: z.boolean(),
};
export const configurationResultSchema = z
  .union([
    z
      .object({
        ...changeShape,
        target: z
          .object({
            kind: z.literal("PACKAGE"),
            packageCode: packageCodeSchema,
          })
          .strict(),
        before: packageTermsSchema,
        after: packageTermsSchema,
      })
      .strict()
      .refine(
        (change) =>
          change.before.code === change.target.packageCode &&
          change.after.code === change.target.packageCode,
        "Package target must agree.",
      ),
    z
      .object({
        ...changeShape,
        target: z.object({ kind: z.literal("REFERRAL_SETTINGS") }).strict(),
        before: referralSettingsSchema,
        after: referralSettingsSchema,
      })
      .strict(),
  ])
  .refine(
    (change) =>
      change.committedVersion === change.expectedVersion + 1 &&
      change.before.version === change.expectedVersion &&
      change.after.version === change.committedVersion,
    "Configuration versions must agree.",
  );
export const configurationOutcomeSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("COMMITTED"),
      commandId: z.uuid(),
      change: configurationResultSchema,
      serverNow: financialInstantSchema,
    })
    .strict()
    .refine(
      (outcome) => outcome.commandId === outcome.change.commandId,
      "Command identity must agree.",
    ),
  z
    .object({
      status: z.literal("NOT_OBSERVED"),
      commandId: z.uuid(),
      serverNow: financialInstantSchema,
    })
    .strict(),
]);
export const configurationErrorCodeSchema = z.enum([
  "CONFIGURATION_STALE",
  "CONFIGURATION_SUPERSEDED",
]);

export type PackageCode = z.infer<typeof packageCodeSchema>;
export type PackageTerms = z.infer<typeof packageTermsSchema>;
export type AdminCatalogItem = z.infer<typeof adminCatalogItemSchema>;
export type PackageEdit = z.infer<typeof packageEditSchema>;
export type ReferralEdit = z.infer<typeof referralEditSchema>;
export type ConfigurationResult = z.infer<typeof configurationResultSchema>;
export type ConfigurationOutcome = z.infer<typeof configurationOutcomeSchema>;
export type ReferralSettings = z.infer<typeof referralSettingsSchema>;
