import { z } from "zod";

import { emailSchema, resetPasswordBodySchema } from "../auth/auth.schema.ts";
import {
  nonEmptyBoundedString,
  paginationMetaSchema,
} from "../http/http.schema.ts";
import {
  accountVersionSchema,
  adminIdentityStatusSchema,
  confirmedReasonShape,
  versionedControlShape,
} from "../identity/identity.schema.ts";
import { safeUserSchema } from "../account/account.schema.ts";

export const adminSchema = safeUserSchema.extend({
  role: z.literal("ADMIN"),
  status: adminIdentityStatusSchema,
  accountVersion: accountVersionSchema,
});
export const adminDataSchema = z.object({ admin: adminSchema }).strict();
export const adminListDataSchema = z
  .object({
    items: z.array(adminSchema).max(100),
    pagination: paginationMetaSchema,
  })
  .strict();
export const adminStatusBodySchema = z
  .object({
    ...versionedControlShape,
    status: z.enum(["ACTIVE", "DEACTIVATED"]),
  })
  .strict();
export const adminInvitationIssueBodySchema = z
  .object({
    ...confirmedReasonShape,
    fullName: nonEmptyBoundedString(150),
    email: emailSchema,
  })
  .strict();
export const adminInvitationCommandBodySchema = z
  .object({
    ...confirmedReasonShape,
    expectedVersion: accountVersionSchema.min(1),
  })
  .strict();
export const adminInvitationAcceptBodySchema = resetPasswordBodySchema;
export const adminInvitationParamsSchema = z
  .object({ invitationId: z.uuid() })
  .strict();
export const adminInvitationStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "REVOKED",
  "EXPIRED",
]);
export const emailDeliveryStatusSchema = z.enum([
  "NOT_ATTEMPTED",
  "UNKNOWN",
  "ACKNOWLEDGED",
  "REJECTED",
]);
export const adminInvitationSchema = z
  .object({
    id: z.uuid(),
    email: z.email().max(320),
    fullName: nonEmptyBoundedString(150),
    issuerUserId: z.uuid(),
    tokenVersion: accountVersionSchema.min(1),
    issuedAt: z.iso.datetime({ offset: true }),
    expiresAt: z.iso.datetime({ offset: true }),
    acceptedAt: z.iso.datetime({ offset: true }).nullable(),
    revokedAt: z.iso.datetime({ offset: true }).nullable(),
    status: adminInvitationStatusSchema,
    deliveryStatus: emailDeliveryStatusSchema,
  })
  .strict()
  .refine(
    (invitation) =>
      !(invitation.acceptedAt !== null && invitation.revokedAt !== null),
    { message: "Invitation terminal dispositions are mutually exclusive." },
  )
  .refine(
    (invitation) =>
      invitation.acceptedAt !== null
        ? invitation.status === "ACCEPTED"
        : invitation.revokedAt !== null
          ? invitation.status === "REVOKED"
          : invitation.status === "PENDING" || invitation.status === "EXPIRED",
    { message: "Invitation disposition must match terminal evidence." },
  );
export const adminInvitationDataSchema = z
  .object({ invitation: adminInvitationSchema })
  .strict();
export const adminInvitationListDataSchema = z
  .object({
    items: z.array(adminInvitationSchema).max(100),
    pagination: paginationMetaSchema,
  })
  .strict();

export type Admin = z.infer<typeof adminSchema>;
export type AdminStatusBody = z.infer<typeof adminStatusBodySchema>;
export type AdminInvitation = z.infer<typeof adminInvitationSchema>;
export type AdminInvitationIssueBody = z.infer<
  typeof adminInvitationIssueBodySchema
>;
export type AdminInvitationCommandBody = z.infer<
  typeof adminInvitationCommandBodySchema
>;
export type AdminInvitationAcceptBody = z.infer<
  typeof adminInvitationAcceptBodySchema
>;
