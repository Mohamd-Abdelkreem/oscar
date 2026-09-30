import { randomUUID } from "node:crypto";

import type {
  EmailRequestBodyDto,
  LoginBodyDto,
  RegisterBodyDto,
  ResetPasswordBodyDto,
  ChangePasswordBodyDto,
} from "./dto/index.js";
import {
  Prisma,
  UserStatus,
  type DatabaseClient,
  type User,
} from "@template/database";

import { authConfig } from "../../core/config/auth.config.js";
import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ConflictException } from "../../core/errors/conflict.error.js";
import { ForbiddenException } from "../../core/errors/forbidden.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import type { EmailService } from "../../infrastructure/email/index.js";
import { logger } from "../../infrastructure/logger/logger.js";
import {
  compareHash,
  generateHash,
  sha256,
} from "../../infrastructure/security/index.js";
import {
  generateResetToken,
  generateTokenPair,
  generateVerificationToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
} from "../../infrastructure/security/index.js";
import { mapSafeUser, SAFE_USER_SELECT } from "../users/users.mapper.js";
import {
  FORGOT_PASSWORD_NEUTRAL_RESPONSE,
  RESET_TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
  RESEND_NEUTRAL_RESPONSE,
  VERIFICATION_TOKEN_TTL_MS,
} from "./auth.constants.js";
import type {
  AuthResponseWithTokens,
  AuthResponseWithoutTokens,
  TokenPair,
} from "./types/auth.types.js";

export class AuthService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly emailService: EmailService,
  ) {}

  async register(data: RegisterBodyDto): Promise<AuthResponseWithoutTokens> {
    const email = data.email.trim().toLowerCase();
    const verificationToken = generateVerificationToken(email);
    const verificationTokenHash = sha256(verificationToken);
    const passwordHash = await generateHash(data.password);
    let user: User;

    try {
      user = await this.database.user.create({
        data: {
          email,
          fullName: data.fullName.trim(),
          phone: data.phone,
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          verificationTokenHash,
          verificationTokenExpiresAt: new Date(
            Date.now() + VERIFICATION_TOKEN_TTL_MS,
          ),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Email is already in use.");
      }
      throw error;
    }

    try {
      await this.emailService.sendVerificationEmail(
        user.fullName,
        user.email,
        verificationToken,
      );
    } catch {
      await this.removeUndeliverablePendingUser(user.id, verificationTokenHash);
      throw new ServiceUnavailableException(
        "Registration is temporarily unavailable. Please try again.",
      );
    }

    return { user: mapSafeUser(user) };
  }

  async resendVerification(
    data: EmailRequestBodyDto,
  ): Promise<typeof RESEND_NEUTRAL_RESPONSE> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        verificationTokenHash: true,
        verificationTokenExpiresAt: true,
      },
    });

    if (
      user === null ||
      user.status !== UserStatus.PENDING_VERIFICATION ||
      user.emailVerifiedAt !== null ||
      user.verificationTokenHash === null ||
      user.verificationTokenExpiresAt === null
    ) {
      return RESEND_NEUTRAL_RESPONSE;
    }

    const issuedAt =
      user.verificationTokenExpiresAt.getTime() - VERIFICATION_TOKEN_TTL_MS;
    if (Date.now() - issuedAt < RESEND_COOLDOWN_MS) {
      return RESEND_NEUTRAL_RESPONSE;
    }

    const token = generateVerificationToken(user.email);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    const replaced = await this.database.user.updateMany({
      where: {
        id: user.id,
        verificationTokenHash: user.verificationTokenHash,
        verificationTokenExpiresAt: user.verificationTokenExpiresAt,
      },
      data: {
        verificationTokenHash: sha256(token),
        verificationTokenExpiresAt: expiresAt,
      },
    });

    if (replaced.count === 1) {
      void this.emailService
        .sendVerificationEmail(user.fullName, user.email, token)
        .catch((_error: unknown) => {
          logger.error(
            { userId: user.id, outcome: "verification_resend_failed" },
            "Failed to resend verification email.",
          );
        });
    }

    return RESEND_NEUTRAL_RESPONSE;
  }

  async verifyEmail(token: string): Promise<AuthResponseWithoutTokens> {
    const verified = verifyVerificationToken(token);

    if (!verified.valid) {
      throw new BadRequestException("Invalid or expired verification token.");
    }

    const normalizedEmail = verified.payload.email.trim().toLowerCase();
    const tokenHash = sha256(token);
    const now = new Date();

    const updated = await this.database.$transaction(async (transaction) => {
      const candidate = await transaction.user.findFirst({
        where: {
          email: normalizedEmail,
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: { gt: now },
        },
        select: {
          id: true,
          status: true,
          emailVerifiedAt: true,
        },
      });

      if (candidate === null) {
        throw new BadRequestException("Invalid or expired verification token.");
      }

      if (candidate.status === UserStatus.SUSPENDED) {
        throw new ForbiddenException("Account is suspended.");
      }

      if (
        candidate.status !== UserStatus.PENDING_VERIFICATION ||
        candidate.emailVerifiedAt !== null
      ) {
        throw new BadRequestException("Invalid or expired verification token.");
      }

      const consumed = await transaction.user.updateMany({
        where: {
          id: candidate.id,
          email: normalizedEmail,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
          verificationTokenHash: tokenHash,
          verificationTokenExpiresAt: { gt: now },
        },
        data: {
          status: UserStatus.ACTIVE,
          emailVerifiedAt: now,
          verificationTokenHash: null,
          verificationTokenExpiresAt: null,
        },
      });

      if (consumed.count !== 1) {
        throw new BadRequestException("Invalid or expired verification token.");
      }

      const activated = await transaction.user.findUnique({
        where: { id: candidate.id },
        select: SAFE_USER_SELECT,
      });

      if (activated === null) {
        throw new BadRequestException("Invalid or expired verification token.");
      }

      return activated;
    });

    return { user: mapSafeUser(updated) };
  }

  async login(data: LoginBodyDto): Promise<AuthResponseWithTokens> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (user === null) throw new UnauthorizedException("Invalid credentials.");

    const passwordMatches = await compareHash(data.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    this.validateActiveUser(user);

    const generated = this.buildTokenPair(user, data.rememberMe);
    await this.database.refreshToken.create({ data: generated.record });
    return {
      user: mapSafeUser(user),
      tokens: generated.tokens,
      rememberMe: data.rememberMe,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    if (refreshToken.length === 0) return;
    await this.database.refreshToken.deleteMany({
      where: { userId, tokenHash: sha256(refreshToken) },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.database.refreshToken.deleteMany({ where: { userId } });
  }

  async refresh(refreshToken: string): Promise<AuthResponseWithTokens> {
    if (refreshToken.length === 0) {
      throw new BadRequestException("Refresh token is required.");
    }

    const verified = verifyRefreshToken(refreshToken);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const oldTokenHash = sha256(refreshToken);
    const now = new Date();
    const oldToken = await this.database.refreshToken.findFirst({
      where: {
        id: verified.payload.tokenId,
        userId: verified.payload.userId,
        tokenHash: oldTokenHash,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });
    if (oldToken === null) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    this.validateActiveUser(oldToken.user);

    const absoluteExpiry = new Date(verified.payload.expiresAt * 1_000);
    if (absoluteExpiry <= now) {
      throw new UnauthorizedException("Refresh token has expired.");
    }
    const replacement = this.buildTokenPairWithExpiry(
      oldToken.user,
      verified.payload.rememberMe,
      absoluteExpiry,
    );

    await this.database.$transaction(async (transaction) => {
      const deleted = await transaction.refreshToken.deleteMany({
        where: {
          id: oldToken.id,
          userId: oldToken.userId,
          tokenHash: oldTokenHash,
        },
      });
      if (deleted.count !== 1) {
        throw new UnauthorizedException("Refresh token has already been used.");
      }
      await transaction.refreshToken.create({ data: replacement.record });
    });

    return {
      user: mapSafeUser(oldToken.user),
      tokens: replacement.tokens,
      rememberMe: verified.payload.rememberMe,
    };
  }

  async forgotPassword(
    data: EmailRequestBodyDto,
  ): Promise<typeof FORGOT_PASSWORD_NEUTRAL_RESPONSE> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (
      user === null ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt === null
    ) {
      return FORGOT_PASSWORD_NEUTRAL_RESPONSE;
    }

    const token = generateResetToken(user.email);
    await this.database.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: sha256(token),
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    void this.emailService
      .sendPasswordResetEmail(user.fullName, user.email, token)
      .catch((_error: unknown) => {
        logger.error(
          { userId: user.id, outcome: "password_reset_email_failed" },
          "Failed to send password reset email.",
        );
      });
    return FORGOT_PASSWORD_NEUTRAL_RESPONSE;
  }

  async resetPassword(
    data: ResetPasswordBodyDto,
    token: string,
  ): Promise<AuthResponseWithoutTokens> {
    const verified = verifyResetToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }

    const tokenHash = sha256(token);
    const now = new Date();
    const user = await this.database.user.findFirst({
      where: {
        email: verified.payload.email.trim().toLowerCase(),
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { gt: now },
      },
    });
    if (user === null) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    this.validateActiveUser(user);
    await this.assertNewPasswordDiffers(data.newPassword, user.passwordHash);
    const passwordHash = await generateHash(data.newPassword);

    const updated = await this.database.$transaction(async (transaction) => {
      const consumed = await transaction.user.updateMany({
        where: {
          id: user.id,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: { not: null },
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: { gt: now },
        },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException("Invalid or expired reset token.");
      }
      await transaction.refreshToken.deleteMany({
        where: { userId: user.id },
      });
      const safeUser = await transaction.user.findUnique({
        where: { id: user.id },
        select: SAFE_USER_SELECT,
      });
      if (safeUser === null) {
        throw new UnauthorizedException("Invalid or expired reset token.");
      }
      return safeUser;
    });
    return { user: mapSafeUser(updated) };
  }

  async validateResetToken(token: string): Promise<{ valid: true }> {
    const user = await this.findUserByResetToken(token);
    this.validateActiveUser(user);
    return { valid: true };
  }

  async changePassword(
    userId: string,
    data: ChangePasswordBodyDto,
  ): Promise<AuthResponseWithoutTokens> {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (user === null) throw new UnauthorizedException("User not found.");
    this.validateActiveUser(user);

    if (!(await compareHash(data.currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is not correct.");
    }
    await this.assertNewPasswordDiffers(data.newPassword, user.passwordHash);
    const updated = await this.updatePasswordAndRevokeTokens(
      user.id,
      data.newPassword,
    );
    return { user: mapSafeUser(updated) };
  }

  private async findUserByResetToken(token: string): Promise<User> {
    const verified = verifyResetToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    const user = await this.database.user.findFirst({
      where: {
        email: verified.payload.email.trim().toLowerCase(),
        resetTokenHash: sha256(token),
        resetTokenExpiresAt: { gt: new Date() },
      },
    });
    if (user === null) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    return user;
  }

  private async assertNewPasswordDiffers(
    newPassword: string,
    passwordHash: string,
  ): Promise<void> {
    if (await compareHash(newPassword, passwordHash)) {
      throw new BadRequestException(
        "New password must differ from current password.",
      );
    }
  }

  private async updatePasswordAndRevokeTokens(
    userId: string,
    newPassword: string,
  ): Promise<User> {
    const passwordHash = await generateHash(newPassword);
    return this.database.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });
      await transaction.refreshToken.deleteMany({ where: { userId } });
      return updated;
    });
  }

  private buildTokenPair(
    user: User,
    rememberMe: boolean,
  ): {
    tokens: TokenPair;
    record: Prisma.RefreshTokenUncheckedCreateInput;
  } {
    const ttlSeconds = rememberMe
      ? authConfig.refreshRememberedTtlSeconds
      : authConfig.refreshFamilyTtlSeconds;
    return this.buildTokenPairWithExpiry(
      user,
      rememberMe,
      new Date(Date.now() + ttlSeconds * 1_000),
    );
  }

  private buildTokenPairWithExpiry(
    user: User,
    rememberMe: boolean,
    expiresAt: Date,
  ): {
    tokens: TokenPair;
    record: Prisma.RefreshTokenUncheckedCreateInput;
  } {
    const tokenId = randomUUID();
    const tokens = generateTokenPair({
      userId: user.id,
      tokenId,
      role: user.role,
      email: user.email,
      rememberMe,
      absoluteExpiresAt: expiresAt,
    });
    return {
      tokens,
      record: {
        id: tokenId,
        userId: user.id,
        tokenHash: sha256(tokens.refreshToken),
        expiresAt,
      },
    };
  }

  private validateActiveUser(
    user: Pick<User, "status" | "emailVerifiedAt">,
  ): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("Account is suspended.");
    }
    if (user.status !== UserStatus.ACTIVE || user.emailVerifiedAt === null) {
      throw new BadRequestException("Verify your email before signing in.");
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private async removeUndeliverablePendingUser(
    userId: string,
    verificationTokenHash: string,
  ): Promise<void> {
    try {
      const deleted = await this.database.user.deleteMany({
        where: {
          id: userId,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
          verificationTokenHash,
        },
      });
      if (deleted.count !== 1) {
        logger.error(
          { userId, outcome: "registration_delivery_rollback_missed" },
          "Pending registration could not be removed after email delivery failure.",
        );
      }
    } catch {
      logger.error(
        { userId, outcome: "registration_delivery_rollback_failed" },
        "Pending registration cleanup failed after email delivery failure.",
      );
    }
  }
}
