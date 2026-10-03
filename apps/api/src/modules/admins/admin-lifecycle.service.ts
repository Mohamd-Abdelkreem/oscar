import {
  adminStatusBodySchema,
  type AdminStatusBody,
  type Admin,
} from "@template/contracts";
import type { DatabaseClient, Prisma } from "@template/database";

import {
  ConflictException,
  NotFoundException,
} from "../../core/errors/index.js";
import type { AuthenticatedSession } from "../../core/types/request-context.types.js";
import {
  runIdentityTransaction,
  readSessionAuthority,
} from "../auth/session-authority.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import { revokeInvitation } from "./admin-invitations.service.js";
import { writeIdentityAudit } from "./identity-audit.js";
import { ADMIN_SELECT, mapAdmin } from "./admins.mapper.js";

export class AdminLifecycleService {
  private readonly sessions = new AuthSessionService();
  constructor(private readonly database: DatabaseClient) {}

  private async revokeIssuedInvitations(
    transaction: Prisma.TransactionClient,
    command: Readonly<{
      issuerUserId: string;
      actorUserId: string;
      reason: string;
    }>,
    now: Date,
  ): Promise<void> {
    for (;;) {
      const outstanding = await transaction.adminInvitation.findMany({
        where: {
          issuerUserId: command.issuerUserId,
          acceptedAt: null,
          revokedAt: null,
        },
        orderBy: { id: "asc" },
        take: 100,
      });
      if (outstanding.length === 0) return;
      for (const invitation of outstanding)
        await revokeInvitation(
          transaction,
          invitation,
          command.actorUserId,
          command.reason,
          now,
        );
    }
  }

  async updateStatus(
    actor: AuthenticatedSession,
    userId: string,
    input: AdminStatusBody,
  ): Promise<Admin> {
    const command = adminStatusBodySchema.parse(input);
    const target = await this.database.user.findFirst({
      where: { id: userId, role: "ADMIN" },
      select: { id: true },
    });
    if (target === null)
      throw new NotFoundException("Administrator not found.");
    return runIdentityTransaction(
      this.database,
      { userIds: [actor.userId, userId], adminPopulation: true },
      async (transaction) => {
        for (const participant of [...new Set([actor.userId, userId])].sort())
          await this.sessions.lockSessions(transaction, participant);
        const now = new Date();
        await readSessionAuthority(transaction, actor, now, "ADMIN");
        const admin = await transaction.user.findFirstOrThrow({
          where: { id: userId, role: "ADMIN" },
          select: ADMIN_SELECT,
        });
        if (
          admin.emailVerifiedAt === null ||
          !["ACTIVE", "DEACTIVATED"].includes(admin.status)
        )
          throw new ConflictException(
            "Pending administrators require email proof.",
          );
        if (
          admin.accountVersion !== command.expectedVersion ||
          admin.accountVersion === 2147483647
        )
          throw new ConflictException("Administrator status has changed.");
        if (command.status === admin.status)
          throw new ConflictException("Administrator status is unchanged.");
        if (command.status === "DEACTIVATED") {
          if (actor.userId === userId)
            throw new ConflictException("Self-deactivation is not permitted.");
          const eligible = await transaction.user.count({
            where: {
              role: "ADMIN",
              status: "ACTIVE",
              emailVerifiedAt: { not: null },
            },
          });
          if (eligible <= 1)
            throw new ConflictException(
              "An eligible administrator must remain.",
            );
          await this.sessions.revokeAll(transaction, userId, now);
          await this.revokeIssuedInvitations(
            transaction,
            {
              issuerUserId: userId,
              actorUserId: actor.userId,
              reason: command.reason,
            },
            now,
          );
        }
        const updated = await transaction.user.update({
          where: { id: userId },
          data: {
            status: command.status,
            accountVersion: { increment: 1 },
            ...(command.status === "DEACTIVATED"
              ? {
                  verificationTokenHash: null,
                  verificationTokenExpiresAt: null,
                  resetTokenHash: null,
                  resetTokenExpiresAt: null,
                }
              : {}),
          },
          select: ADMIN_SELECT,
        });
        await writeIdentityAudit(
          transaction,
          {
            action:
              command.status === "ACTIVE"
                ? "ADMIN_ACTIVATE"
                : "ADMIN_DEACTIVATE",
            actorKind: "ADMIN",
            actorUserId: actor.userId,
            targetUserId: userId,
            reason: command.reason,
            beforeSnapshot: {
              id: userId,
              role: "ADMIN",
              status: admin.status,
              accountVersion: admin.accountVersion,
            },
            afterSnapshot: {
              id: userId,
              role: "ADMIN",
              status: updated.status,
              accountVersion: updated.accountVersion,
            },
          },
          now,
        );
        return mapAdmin(updated);
      },
    );
  }
}
