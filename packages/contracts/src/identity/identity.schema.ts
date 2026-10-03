import { z } from "zod";

import { safeUserSchema } from "../account/account.schema.ts";
import { nonEmptyBoundedString } from "../http/http.schema.ts";

export const referralCodeSchema = z.string().regex(/^[0-9a-f]{32}$/u);
export const optionalReferralCodeSchema = z.preprocess((input) => {
  if (typeof input !== "string") return input;
  const normalized = input.trim().toLowerCase();
  return normalized === "" ? undefined : normalized;
}, referralCodeSchema.optional());

export const employeeStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
  "BANNED",
]);
export const adminIdentityStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "DEACTIVATED",
]);
export const accountVersionSchema = z.number().int().min(0).max(2_147_483_647);
export const confirmedReasonShape = {
  confirmed: z.literal(true),
  reason: nonEmptyBoundedString(500),
};
export const versionedControlShape = {
  ...confirmedReasonShape,
  expectedVersion: accountVersionSchema,
};

export const identityUserSchema = safeUserSchema
  .extend({
    status: z.enum([
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "BANNED",
      "DEACTIVATED",
    ]),
    referralCode: referralCodeSchema.nullable(),
    tasksBlocked: z.boolean(),
    withdrawalsBlocked: z.boolean(),
    accountVersion: accountVersionSchema,
  })
  .superRefine((user, context) => {
    const roleStatus =
      user.role === "ADMIN" ? adminIdentityStatusSchema : employeeStatusSchema;
    if (!roleStatus.safeParse(user.status).success)
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Status is incompatible with role.",
      });
    if ((user.role === "ADMIN") !== (user.referralCode === null))
      context.addIssue({
        code: "custom",
        path: ["referralCode"],
        message: "Referral visibility is incompatible with role.",
      });
    if (user.role === "ADMIN" && (user.tasksBlocked || user.withdrawalsBlocked))
      context.addIssue({
        code: "custom",
        message: "Administrator partial controls are unsupported.",
      });
  });
export const identityUserDataSchema = z
  .object({ user: identityUserSchema })
  .strict();
export const identitySessionDataSchema = z
  .object({
    user: identityUserSchema,
    tokens: z.object({ accessToken: z.string().min(1) }).strict(),
  })
  .strict();

export const employeeRestrictionsSchema = z
  .object({
    id: z.uuid(),
    status: employeeStatusSchema,
    tasksBlocked: z.boolean(),
    withdrawalsBlocked: z.boolean(),
    accountVersion: accountVersionSchema,
  })
  .strict();
export const employeeRestrictionsDataSchema = z
  .object({ employee: employeeRestrictionsSchema })
  .strict();
export const employeeRestrictionsBodySchema = z
  .object({
    ...versionedControlShape,
    status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]).optional(),
    tasksBlocked: z.boolean().optional(),
    withdrawalsBlocked: z.boolean().optional(),
  })
  .strict()
  .refine(
    (command) =>
      command.status !== undefined ||
      command.tasksBlocked !== undefined ||
      command.withdrawalsBlocked !== undefined,
    {
      message: "At least one supported control must be provided.",
    },
  );
export const identityUserParamsSchema = z.object({ userId: z.uuid() }).strict();

const decimalQueryInteger = (maximum: number, fallback: number) =>
  z.preprocess((input) => {
    if (typeof input !== "string" || !/^[0-9]+$/u.test(input)) return input;
    return Number(input);
  }, z.number().int().min(1).max(maximum).default(fallback));
export const identityListQuerySchema = z
  .object({
    page: decimalQueryInteger(Number.MAX_SAFE_INTEGER, 1),
    limit: decimalQueryInteger(100, 25),
  })
  .strict()
  .refine((query) => Number.isSafeInteger((query.page - 1) * query.limit), {
    message: "Pagination offset exceeds the supported range.",
    path: ["page"],
  });

export type IdentityUser = z.infer<typeof identityUserSchema>;
export type IdentityUserData = z.infer<typeof identityUserDataSchema>;
export type IdentitySessionData = z.infer<typeof identitySessionDataSchema>;
export type EmployeeRestrictions = z.infer<typeof employeeRestrictionsSchema>;
export type EmployeeRestrictionsBody = z.infer<
  typeof employeeRestrictionsBodySchema
>;
export type IdentityListQuery = z.infer<typeof identityListQuerySchema>;
