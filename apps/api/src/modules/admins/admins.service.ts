import {
  identityListQuerySchema,
  type IdentityListQuery,
} from "@template/contracts";
import { Prisma, type DatabaseClient } from "@template/database";

import { NotFoundException } from "../../core/errors/index.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import type { AuthenticatedSession } from "../../core/types/request-context.types.js";
import {
  runIdentityTransaction,
  readSessionAuthority,
} from "../auth/session-authority.js";
import {
  ADMIN_SELECT,
  INVITATION_SELECT,
  mapAdmin,
  mapInvitation,
} from "./admins.mapper.js";
import { AuthSessionService } from "../auth/auth-session.service.js";

export class AdminsService {
  private readonly sessions = new AuthSessionService();
  constructor(private readonly database: DatabaseClient) {}

  private read<T>(
    actor: AuthenticatedSession,
    query: (transaction: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return runIdentityTransaction(
      this.database,
      {
        userIds: [actor.userId],
        adminPopulation: false,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
      async (transaction) => {
        // Detect revocation committed after this snapshot began; bounded retry then observes current authority.
        await this.sessions.lockSessions(transaction, actor.userId);
        await readSessionAuthority(transaction, actor, new Date(), "ADMIN");
        return query(transaction);
      },
    );
  }

  listAdmins(actor: AuthenticatedSession, input: IdentityListQuery) {
    const query = identityListQuerySchema.parse(input);
    return this.read(actor, async (transaction) => {
      const where = { role: "ADMIN" as const };
      const admins = await transaction.user.findMany({
        where,
        select: ADMIN_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.user.count({ where });
      return {
        items: admins.map(mapAdmin),
        pagination: buildPaginationMeta({ ...query, total }),
      };
    });
  }

  getAdmin(actor: AuthenticatedSession, userId: string) {
    return this.read(actor, async (transaction) => {
      const admin = await transaction.user.findFirst({
        where: { id: userId, role: "ADMIN" },
        select: ADMIN_SELECT,
      });
      if (admin === null)
        throw new NotFoundException("Administrator not found.");
      return mapAdmin(admin);
    });
  }

  listInvitations(actor: AuthenticatedSession, input: IdentityListQuery) {
    const query = identityListQuerySchema.parse(input);
    return this.read(actor, async (transaction) => {
      const invitations = await transaction.adminInvitation.findMany({
        select: INVITATION_SELECT,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      });
      const total = await transaction.adminInvitation.count();
      const now = new Date();
      return {
        items: invitations.map((invitation) => mapInvitation(invitation, now)),
        pagination: buildPaginationMeta({ ...query, total }),
      };
    });
  }

  getInvitation(actor: AuthenticatedSession, invitationId: string) {
    return this.read(actor, async (transaction) => {
      const invitation = await transaction.adminInvitation.findUnique({
        where: { id: invitationId },
        select: INVITATION_SELECT,
      });
      if (invitation === null)
        throw new NotFoundException("Invitation not found.");
      return mapInvitation(invitation, new Date());
    });
  }
}
