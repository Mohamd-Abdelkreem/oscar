import type {
  EmployeeRestrictions,
  EmployeeRestrictionsBody,
} from "@template/contracts";
import {
  UserRole,
  type DatabaseClient,
  type User,
  type Prisma,
} from "@template/database";

import type { AuthenticatedSession } from "../../core/types/request-context.types.js";
import {
  ConflictException,
  NotFoundException,
} from "../../core/errors/index.js";
import {
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import { writeIdentityAudit } from "../admins/identity-audit.js";
import {
  EMPLOYEE_RESTRICTIONS_SELECT,
  mapEmployeeRestrictions,
} from "../admins/admins.mapper.js";

function employeeUpdates(
  employee: User,
  command: EmployeeRestrictionsBody,
): Prisma.UserUpdateInput {
  const status =
    command.status === "ACTIVE"
      ? employee.emailVerifiedAt === null
        ? "PENDING_VERIFICATION"
        : "ACTIVE"
      : (command.status ?? employee.status);
  const tasksBlocked = command.tasksBlocked ?? employee.tasksBlocked;
  const withdrawalsBlocked =
    command.withdrawalsBlocked ?? employee.withdrawalsBlocked;
  if (
    employee.accountVersion !== command.expectedVersion ||
    employee.accountVersion === 2_147_483_647
  )
    throw new ConflictException("Employee controls have changed.");
  if (
    status === employee.status &&
    tasksBlocked === employee.tasksBlocked &&
    withdrawalsBlocked === employee.withdrawalsBlocked
  )
    throw new ConflictException("Employee controls are unchanged.");
  return {
    status,
    tasksBlocked,
    withdrawalsBlocked,
    accountVersion: { increment: 1 },
  };
}

export class EmployeeRestrictionsService {
  private readonly sessions = new AuthSessionService();
  constructor(private readonly database: DatabaseClient) {}

  async getRestrictions(
    actor: AuthenticatedSession,
    userId: string,
  ): Promise<EmployeeRestrictions> {
    return runIdentityTransaction(
      this.database,
      { userIds: [actor.userId], adminPopulation: false },
      async (transaction, now) => {
        await readSessionAuthority(transaction, actor, now, UserRole.ADMIN);
        const employee = await transaction.user.findFirst({
          where: { id: userId, role: UserRole.USER },
          select: EMPLOYEE_RESTRICTIONS_SELECT,
        });
        if (employee === null)
          throw new NotFoundException("Employee not found.");
        return mapEmployeeRestrictions(employee);
      },
    );
  }

  async updateRestrictions(
    actor: AuthenticatedSession,
    userId: string,
    command: EmployeeRestrictionsBody,
  ): Promise<EmployeeRestrictions> {
    // Resolve immutable target role before choosing the lock participants; ADMIN targets never enter this control path.
    const target = await this.database.user.findFirst({
      where: { id: userId, role: UserRole.USER },
      select: { id: true },
    });
    if (target === null) throw new NotFoundException("Employee not found.");
    return runIdentityTransaction(
      this.database,
      { userIds: [actor.userId, userId], adminPopulation: false },
      async (transaction) => {
        for (const participantId of [...new Set([actor.userId, userId])].sort())
          await this.sessions.lockSessions(transaction, participantId);
        const now = new Date();
        await readSessionAuthority(transaction, actor, now, UserRole.ADMIN);
        const employee = await transaction.user.findFirst({
          where: { id: userId, role: UserRole.USER },
        });
        if (employee === null)
          throw new NotFoundException("Employee not found.");
        const updates = employeeUpdates(employee, command);
        if (command.status === "SUSPENDED" || command.status === "BANNED") {
          await this.sessions.revokeAll(transaction, userId, now);
          Object.assign(updates, {
            verificationTokenHash: null,
            verificationTokenExpiresAt: null,
            resetTokenHash: null,
            resetTokenExpiresAt: null,
          });
        }
        const updated = await transaction.user.update({
          where: { id: userId },
          data: updates,
          select: EMPLOYEE_RESTRICTIONS_SELECT,
        });
        await writeIdentityAudit(
          transaction,
          {
            action: "EMPLOYEE_CONTROL",
            actorKind: "ADMIN",
            actorUserId: actor.userId,
            targetUserId: userId,
            reason: command.reason,
            beforeSnapshot: {
              ...mapEmployeeRestrictions(employee),
              role: employee.role,
            },
            afterSnapshot: {
              ...mapEmployeeRestrictions(updated),
              role: updated.role,
            },
          },
          now,
        );
        return mapEmployeeRestrictions(updated);
      },
    );
  }
}
