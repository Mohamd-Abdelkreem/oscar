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
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import { LedgerService } from "../ledger/ledger.service.js";
import {
  cancelScheduledWithdrawal,
  lockWithdrawalRequest,
  withdrawalReleaseContext,
} from "../withdrawals/withdrawal-cancellation.service.js";
import {
  withdrawalTermsHash,
  ACTIVE_WITHDRAWAL_STATES,
} from "../withdrawals/withdrawal-quote.service.js";
import { WithdrawalError } from "../withdrawals/withdrawals.errors.js";
import { LedgerError } from "../ledger/ledger.errors.js";

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
  constructor(
    private readonly database: DatabaseClient,
    private readonly admission?: FinancialRuntimeAdmission,
    private readonly clock: () => Date = () => new Date(),
  ) {}

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
    if (this.admission === undefined || this.admission.processKind !== "API")
      throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
    const wallet = await this.database.wallet.findUniqueOrThrow({
      where: { ownerUserId: userId },
      select: { id: true },
    });
    const ledger = new LedgerService(
      this.database,
      { businessNamespaces: ["p08.withdrawal.release"], processIds: [] },
      this.admission,
    );
    let eventTime: Date | undefined;
    return ledger.runInTransaction(
      withdrawalReleaseContext(actor.userId, wallet.id, () => {
        if (eventTime === undefined) throw new LedgerError("LEDGER_INTERNAL");
        return eventTime;
      }),
      async (transaction, transactionalLedger) => {
        for (const participantId of [...new Set([actor.userId, userId])].sort())
          await this.sessions.lockSessions(transaction, participantId);
        const active = await transaction.withdrawalRequest.findFirst({
          where: {
            employeeId: userId,
            state: { in: ACTIVE_WITHDRAWAL_STATES },
          },
        });
        const request =
          active === null
            ? null
            : await lockWithdrawalRequest(transaction, active);
        const now = this.clock();
        eventTime = now;
        await readSessionAuthority(transaction, actor, now, UserRole.ADMIN);
        const employee = await transaction.user.findFirst({
          where: { id: userId, role: UserRole.USER },
        });
        if (employee === null)
          throw new NotFoundException("Employee not found.");
        const updates = employeeUpdates(employee, command);
        if (
          request !== null &&
          (command.status === "BANNED" ||
            command.status === "SUSPENDED" ||
            command.withdrawalsBlocked === true)
        ) {
          await cancelScheduledWithdrawal(
            transaction,
            transactionalLedger,
            request,
            {
              actorUserId: actor.userId,
              kind: "RESTRICTION_CANCEL",
              intentHash: withdrawalTermsHash([userId, command]),
              reason: command.reason,
              now,
            },
          );
        }
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
