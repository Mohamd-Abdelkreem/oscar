import {
  employeeRestrictionsSchema,
  type EmployeeRestrictions,
  adminSchema,
  adminInvitationSchema,
  type Admin,
  type AdminInvitation as InvitationProjection,
} from "@template/contracts";
import type { User, AdminInvitation } from "@template/database";

export const EMPLOYEE_RESTRICTIONS_SELECT = {
  id: true,
  role: true,
  status: true,
  tasksBlocked: true,
  withdrawalsBlocked: true,
  accountVersion: true,
} as const;

export function mapEmployeeRestrictions(
  employee: Pick<
    User,
    "id" | "status" | "tasksBlocked" | "withdrawalsBlocked" | "accountVersion"
  >,
): EmployeeRestrictions {
  return employeeRestrictionsSchema.parse({
    id: employee.id,
    status: employee.status,
    tasksBlocked: employee.tasksBlocked,
    withdrawalsBlocked: employee.withdrawalsBlocked,
    accountVersion: employee.accountVersion,
  });
}

export const ADMIN_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  accountVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;
export const INVITATION_SELECT = {
  id: true,
  email: true,
  fullName: true,
  issuerUserId: true,
  tokenVersion: true,
  issuedAt: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
  deliveryStatus: true,
} as const;
type AdminRecord = Pick<User, keyof typeof ADMIN_SELECT>;
type InvitationRecord = Pick<AdminInvitation, keyof typeof INVITATION_SELECT>;

export function mapAdmin(admin: AdminRecord): Admin {
  return adminSchema.parse({
    id: admin.id,
    fullName: admin.fullName,
    email: admin.email,
    phone: admin.phone,
    role: admin.role,
    status: admin.status,
    emailVerifiedAt: admin.emailVerifiedAt?.toISOString() ?? null,
    accountVersion: admin.accountVersion,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  });
}

export function invitationDisposition(
  invitation: Pick<AdminInvitation, "acceptedAt" | "revokedAt" | "expiresAt">,
  now: Date,
): InvitationProjection["status"] {
  if (invitation.acceptedAt !== null) return "ACCEPTED";
  if (invitation.revokedAt !== null) return "REVOKED";
  return now.getTime() >= invitation.expiresAt.getTime()
    ? "EXPIRED"
    : "PENDING";
}

export function mapInvitation(
  invitation: InvitationRecord,
  now: Date,
): InvitationProjection {
  return adminInvitationSchema.parse({
    id: invitation.id,
    email: invitation.email,
    fullName: invitation.fullName,
    issuerUserId: invitation.issuerUserId,
    tokenVersion: invitation.tokenVersion,
    issuedAt: invitation.issuedAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    status: invitationDisposition(invitation, now),
    deliveryStatus: invitation.deliveryStatus,
  });
}
