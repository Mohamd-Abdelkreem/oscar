import type { IdentityUser } from "@template/contracts";
import type { DatabaseClient } from "@template/database";

import type { AuthenticatedSession } from "../../core/types/request-context.types.js";
import {
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";
import type { UpdateProfileBodyDto } from "./dto/update-profile.dto.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import { mapSafeUser, SAFE_USER_SELECT } from "./users.mapper.js";

export class UsersService {
  private readonly sessions = new AuthSessionService();
  constructor(private readonly database: DatabaseClient) {}

  async getCurrentUser(identity: AuthenticatedSession): Promise<IdentityUser> {
    return runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction, now) =>
        mapSafeUser(await readSessionAuthority(transaction, identity, now)),
    );
  }

  async updateCurrentUser(
    identity: AuthenticatedSession,
    data: UpdateProfileBodyDto,
  ): Promise<IdentityUser> {
    return runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, identity.userId);
        const user = await readSessionAuthority(
          transaction,
          identity,
          new Date(),
        );
        const updates: { fullName?: string; phone?: string | null } = {};
        if (data.fullName !== undefined)
          updates.fullName = data.fullName.trim();
        if (data.phone !== undefined) updates.phone = data.phone;
        if (
          (updates.fullName === undefined ||
            updates.fullName === user.fullName) &&
          (updates.phone === undefined || updates.phone === user.phone)
        )
          return mapSafeUser(user);
        return mapSafeUser(
          await transaction.user.update({
            where: { id: identity.userId },
            data: updates,
            select: SAFE_USER_SELECT,
          }),
        );
      },
    );
  }
}
