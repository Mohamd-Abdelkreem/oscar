import { Prisma } from "@template/database";
import { z } from "zod";
import {
  accountVersionSchema,
  nonEmptyBoundedString,
} from "@template/contracts";

const instant = z.iso.datetime({ offset: true });
const snapshotSchema = z
  .object({
    id: z.uuid().optional(),
    role: z.enum(["USER", "ADMIN"]).optional(),
    status: z
      .enum([
        "PENDING_VERIFICATION",
        "ACTIVE",
        "SUSPENDED",
        "BANNED",
        "DEACTIVATED",
      ])
      .optional(),
    tasksBlocked: z.boolean().optional(),
    withdrawalsBlocked: z.boolean().optional(),
    accountVersion: accountVersionSchema.optional(),
    issuerUserId: z.uuid().optional(),
    tokenVersion: accountVersionSchema.min(1).optional(),
    issuedAt: instant.optional(),
    expiresAt: instant.optional(),
    acceptedAt: instant.nullable().optional(),
    acceptedUserId: z.uuid().nullable().optional(),
    revokedAt: instant.nullable().optional(),
    revokedByUserId: z.uuid().nullable().optional(),
    disposition: z
      .enum(["PENDING", "ACCEPTED", "REVOKED", "EXPIRED"])
      .optional(),
    firstAdminUserId: z.uuid().optional(),
    completedAt: instant.optional(),
    completionSource: z.enum(["BOOTSTRAP", "LEGACY_PRESENT"]).optional(),
  })
  .strict();
const adminActions = [
  "INVITATION_ISSUE",
  "INVITATION_REISSUE",
  "INVITATION_REVOKE",
  "EMPLOYEE_CONTROL",
  "ADMIN_ACTIVATE",
  "ADMIN_DEACTIVATE",
] as const;
export const identityAuditInputSchema = z
  .object({
    action: z.enum([
      "BOOTSTRAP",
      ...adminActions,
      "INVITATION_ACCEPT",
      "ADMIN_EMAIL_ACTIVATE",
    ]),
    actorKind: z.enum([
      "OPERATOR",
      "ADMIN",
      "INVITED_RECIPIENT",
      "VERIFIED_EMAIL_RECIPIENT",
    ]),
    actorUserId: z.uuid().optional(),
    operatorIdentity: nonEmptyBoundedString(160).optional(),
    targetUserId: z.uuid().optional(),
    invitationId: z.uuid().optional(),
    issuerUserId: z.uuid().optional(),
    tokenVersion: accountVersionSchema.min(1).optional(),
    reason: nonEmptyBoundedString(500).optional(),
    beforeSnapshot: snapshotSchema.nullable().optional(),
    afterSnapshot: snapshotSchema.nullable().optional(),
  })
  .strict()
  .superRefine((audit, context) => {
    const operator =
      audit.action === "BOOTSTRAP" &&
      audit.actorKind === "OPERATOR" &&
      audit.operatorIdentity !== undefined &&
      audit.actorUserId === undefined &&
      audit.targetUserId !== undefined;
    const admin =
      adminActions.some((action) => action === audit.action) &&
      audit.actorKind === "ADMIN" &&
      audit.actorUserId !== undefined &&
      audit.operatorIdentity === undefined;
    const recipient =
      ((audit.action === "INVITATION_ACCEPT" &&
        audit.actorKind === "INVITED_RECIPIENT") ||
        (audit.action === "ADMIN_EMAIL_ACTIVATE" &&
          audit.actorKind === "VERIFIED_EMAIL_RECIPIENT")) &&
      audit.actorUserId !== undefined &&
      audit.actorUserId === audit.targetUserId &&
      audit.operatorIdentity === undefined;
    if (
      !(operator || admin || recipient) ||
      (operator || admin) !== (audit.reason !== undefined)
    )
      context.addIssue({
        code: "custom",
        message: "Audit actor/action/reason is incompatible.",
      });
    const invitation = audit.action.startsWith("INVITATION_");
    if (
      invitation
        ? audit.invitationId === undefined ||
          audit.issuerUserId === undefined ||
          audit.tokenVersion === undefined
        : audit.invitationId !== undefined ||
          audit.issuerUserId !== undefined ||
          audit.tokenVersion !== undefined ||
          audit.targetUserId === undefined
    )
      context.addIssue({
        code: "custom",
        message: "Audit attribution is incomplete.",
      });
  });
export type IdentityAuditInput = z.infer<typeof identityAuditInputSchema>;

export async function writeIdentityAudit(
  transaction: Prisma.TransactionClient,
  input: IdentityAuditInput,
  now: Date,
): Promise<void> {
  const audit = identityAuditInputSchema.parse(input);
  await transaction.identityAuditRecord.create({
    data: {
      action: audit.action,
      actorKind: audit.actorKind,
      occurredAt: now,
      outcome: "COMMITTED",
      actorUserId: audit.actorUserId ?? null,
      operatorIdentity: audit.operatorIdentity ?? null,
      targetUserId: audit.targetUserId ?? null,
      invitationId: audit.invitationId ?? null,
      issuerUserId: audit.issuerUserId ?? null,
      tokenVersion: audit.tokenVersion ?? null,
      reason: audit.reason ?? null,
      beforeSnapshot: audit.beforeSnapshot ?? Prisma.DbNull,
      afterSnapshot: audit.afterSnapshot ?? Prisma.DbNull,
    },
  });
}
