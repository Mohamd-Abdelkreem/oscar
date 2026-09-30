import { z } from "zod";

import { nonEmptyBoundedString } from "../http/http.schema.ts";

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email().max(320),
);

export const phoneSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(30).nullable());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH);

export const registerBodySchema = z
  .object({
    fullName: nonEmptyBoundedString(150),
    email: emailSchema,
    phone: phoneSchema.optional().default(null),
    password: passwordSchema,
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    rememberMe: z.boolean(),
  })
  .strict();

export const emailRequestBodySchema = z.object({ email: emailSchema }).strict();

export const tokenQuerySchema = z.object({ token: z.string().min(1) }).strict();

export const resetPasswordBodySchema = z
  .object({
    newPassword: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.passwordConfirmation, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirmation"],
  });

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.passwordConfirmation, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirmation"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "New password must differ from current password.",
    path: ["newPassword"],
  });

export const updateProfileBodySchema = z
  .object({
    fullName: nonEmptyBoundedString(150).optional(),
    phone: phoneSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.fullName !== undefined || value.phone !== undefined,
    {
      message: "At least one supported field must be provided.",
      path: ["body"],
    },
  );

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type EmailRequestBody = z.infer<typeof emailRequestBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
