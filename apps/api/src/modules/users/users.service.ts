import type { SafeUser } from "@template/contracts";
import { UserStatus, type DatabaseClient } from "@template/database";

import { ForbiddenException } from "../../core/errors/forbidden.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import type { UpdateProfileBodyDto } from "./dto/update-profile.dto.js";
import { mapSafeUser, SAFE_USER_SELECT } from "./users.mapper.js";

export class UsersService {
  constructor(private readonly database: DatabaseClient) {}

  async getCurrentUser(userId: string): Promise<SafeUser> {
    return mapSafeUser(await this.findActiveUser(userId));
  }

  async updateCurrentUser(
    userId: string,
    data: UpdateProfileBodyDto,
  ): Promise<SafeUser> {
    const user = await this.findActiveUser(userId);
    const updates: { fullName?: string; phone?: string | null } = {};

    if (data.fullName !== undefined) updates.fullName = data.fullName.trim();
    if (data.phone !== undefined) updates.phone = data.phone;

    if (
      (updates.fullName === undefined || updates.fullName === user.fullName) &&
      (updates.phone === undefined || updates.phone === user.phone)
    ) {
      return mapSafeUser(user);
    }

    const updated = await this.database.user.update({
      where: { id: userId },
      data: updates,
      select: SAFE_USER_SELECT,
    });
    return mapSafeUser(updated);
  }

  private async findActiveUser(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (user === null) throw new UnauthorizedException("User not found.");
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("Account is suspended.");
    }
    if (user.status !== UserStatus.ACTIVE || user.emailVerifiedAt === null) {
      throw new ForbiddenException("Account is not active and verified.");
    }
    return user;
  }
}
