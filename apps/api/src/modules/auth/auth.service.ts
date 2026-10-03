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
  UserRole,
  type DatabaseClient,
  type User,
} from "@template/database";

import { z } from "zod";

import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ConflictException } from "../../core/errors/conflict.error.js";
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
  generateVerificationToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
} from "../../infrastructure/security/index.js";
import { mapSafeUser, SAFE_USER_SELECT } from "../users/users.mapper.js";
import type { AuthenticatedSession } from "../../core/types/request-context.types.js";
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
} from "./types/auth.types.js";

import {
  runIdentityTransaction,
  readSessionAuthority,
  assertCurrentPasswordHash,
} from "./session-authority.js";
import { AuthSessionService } from "./auth-session.service.js";
import { writeIdentityAudit } from "../admins/identity-audit.js";

const uniqueFieldSchema = z.union([
  z
    .object({ target: z.array(z.string()) })
    .transform((metadata) => metadata.target),
  z
    .object({
      driverAdapterError: z.object({
        cause: z.object({
          constraint: z.object({ fields: z.array(z.string()) }),
        }),
      }),
    })
    .transform(
      (metadata) => metadata.driverAdapterError.cause.constraint.fields,
    ),
]);
const isUserUniqueField = (failure: unknown, field: string): boolean => {
  if (
    !(failure instanceof Prisma.PrismaClientKnownRequestError) ||
    failure.code !== "P2002"
  )
    return false;
  const metadata = uniqueFieldSchema.safeParse(failure.meta);
  return (
    metadata.success && metadata.data.length === 1 && metadata.data[0] === field
  );
};
const invalidVerification = () =>
  new BadRequestException("Invalid or expired verification token.");

export class AuthService {
  private readonly sessions = new AuthSessionService();
  constructor(
    private readonly database: DatabaseClient,
    private readonly emailService: EmailService,
    private readonly createReferralCode: () => string = () =>
      randomUUID().replaceAll("-", ""),
  ) {}

  async register(input: RegisterBodyDto): Promise<AuthResponseWithoutTokens> {
    const email = input.email.trim().toLowerCase();
    const passwordHash = await generateHash(input.password);
    const userId = randomUUID();
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const referralCode = this.createReferralCode();
      let provisioned;
      try {
        provisioned = await this.provisionEmployee(input, passwordHash, {
          userId,
          referralCode,
          email,
        });
      } catch (failure) {
        if (isUserUniqueField(failure, "email"))
          throw new ConflictException("Email is already in use.");
        if (!isUserUniqueField(failure, "referral_code")) throw failure;
        if (attempt === 3)
          throw new ServiceUnavailableException(
            "Employee provisioning is temporarily unavailable.",
          );
        continue;
      }
      try {
        await this.emailService.sendVerificationEmail(
          provisioned.user.fullName,
          provisioned.user.email,
          provisioned.token,
        );
      } catch {
        // Provider uncertainty never undoes the committed identity and wallet.
        throw new ServiceUnavailableException(
          "A pending account may exist. Request a new verification link to continue.",
        );
      }
      return { user: mapSafeUser(provisioned.user) };
    }
    throw new ServiceUnavailableException(
      "Employee provisioning is temporarily unavailable.",
    );
  }

  private provisionEmployee(
    input: RegisterBodyDto,
    passwordHash: string,
    identity: Readonly<{ userId: string; referralCode: string; email: string }>,
  ): Promise<{ user: User; token: string }> {
    const { userId, referralCode, email } = identity;
    return runIdentityTransaction(
      this.database,
      { userIds: [], adminPopulation: false },
      async (transaction, now) => {
        const sponsor =
          input.referralCode === undefined
            ? null
            : await transaction.user.findUnique({
                where: { referralCode: input.referralCode },
                select: { id: true, role: true },
              });
        if (
          input.referralCode !== undefined &&
          (sponsor === null ||
            sponsor.role !== UserRole.USER ||
            sponsor.id === userId)
        )
          throw new BadRequestException("Invalid referral code.");
        const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS);
        const token = generateVerificationToken(email, userId, expiresAt);
        const user = await transaction.user.create({
          data: {
            id: userId,
            email,
            fullName: input.fullName.trim(),
            phone: input.phone,
            passwordHash,
            role: UserRole.USER,
            status: UserStatus.PENDING_VERIFICATION,
            referralCode,
            sponsorUserId: sponsor?.id ?? null,
            verificationTokenHash: sha256(token),
            verificationTokenExpiresAt: expiresAt,
          },
        });
        await transaction.wallet.create({
          data: {
            ownerUserId: user.id,
            availableNonReferralUnits: 0n,
            reservedNonReferralUnits: 0n,
            availableReferralUnits: 0n,
            reservedReferralUnits: 0n,
          },
        });
        return { user, token };
      },
    );
  }

  async resendVerification(
    input: EmailRequestBodyDto,
  ): Promise<typeof RESEND_NEUTRAL_RESPONSE> {
    const candidate = await this.database.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (candidate === null) return RESEND_NEUTRAL_RESPONSE;
    const issuance = await runIdentityTransaction(
      this.database,
      { userIds: [candidate.id], adminPopulation: false },
      async (transaction, now) => {
        const user = await transaction.user.findUnique({
          where: { id: candidate.id },
        });
        if (
          user === null ||
          user.status !== UserStatus.PENDING_VERIFICATION ||
          user.emailVerifiedAt !== null
        )
          return null;
        if (
          user.verificationTokenExpiresAt !== null &&
          now.getTime() -
            (user.verificationTokenExpiresAt.getTime() -
              VERIFICATION_TOKEN_TTL_MS) <
            RESEND_COOLDOWN_MS
        )
          return null;
        const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS);
        const token = generateVerificationToken(user.email, user.id, expiresAt);
        await transaction.user.update({
          where: { id: user.id },
          data: {
            verificationTokenHash: sha256(token),
            verificationTokenExpiresAt: expiresAt,
          },
        });
        return { user, token };
      },
    );
    if (issuance !== null) {
      try {
        await this.emailService.sendVerificationEmail(
          issuance.user.fullName,
          issuance.user.email,
          issuance.token,
        );
      } catch {
        logger.error(
          { userId: issuance.user.id, outcome: "verification_resend_failed" },
          "Failed to resend verification email.",
        );
      }
    }
    return RESEND_NEUTRAL_RESPONSE;
  }

  async validateVerificationToken(token: string): Promise<{ valid: true }> {
    const verified = verifyVerificationToken(token);
    if (!verified.valid) throw invalidVerification();
    const user = await this.database.user.findUnique({
      where: { id: verified.payload.userId },
    });
    this.assertVerificationCredential(
      user,
      verified.payload.email,
      sha256(token),
      new Date(),
    );
    return { valid: true };
  }

  async verifyEmail(token: string): Promise<AuthResponseWithoutTokens> {
    const verified = verifyVerificationToken(token);
    if (!verified.valid) throw invalidVerification();
    const candidate = await this.database.user.findUnique({
      where: { id: verified.payload.userId },
      select: { id: true, role: true },
    });
    if (candidate === null) throw invalidVerification();
    const updated = await runIdentityTransaction(
      this.database,
      {
        userIds: [candidate.id],
        adminPopulation: candidate.role === UserRole.ADMIN,
      },
      async (transaction, now) => {
        const user = await transaction.user.findUnique({
          where: { id: candidate.id },
        });
        this.assertVerificationCredential(
          user,
          verified.payload.email,
          sha256(token),
          now,
        );
        const activated = await transaction.user.update({
          where: { id: candidate.id },
          data: {
            status: UserStatus.ACTIVE,
            emailVerifiedAt: now,
            verificationTokenHash: null,
            verificationTokenExpiresAt: null,
            accountVersion: { increment: 1 },
          },
          select: SAFE_USER_SELECT,
        });
        if (activated.role === UserRole.ADMIN)
          await writeIdentityAudit(
            transaction,
            {
              action: "ADMIN_EMAIL_ACTIVATE",
              actorKind: "VERIFIED_EMAIL_RECIPIENT",
              actorUserId: activated.id,
              targetUserId: activated.id,
              beforeSnapshot: {
                id: user.id,
                status: user.status,
                accountVersion: user.accountVersion,
              },
              afterSnapshot: {
                id: activated.id,
                status: activated.status,
                accountVersion: activated.accountVersion,
              },
            },
            now,
          );
        return activated;
      },
    );
    return { user: mapSafeUser(updated) };
  }

  private assertVerificationCredential(
    user: User | null,
    email: string,
    tokenHash: string,
    now: Date,
  ): asserts user is User {
    if (
      user === null ||
      user.email !== email ||
      user.status !== UserStatus.PENDING_VERIFICATION ||
      user.emailVerifiedAt !== null ||
      user.verificationTokenHash !== tokenHash ||
      user.verificationTokenExpiresAt === null ||
      now.getTime() >= user.verificationTokenExpiresAt.getTime()
    )
      throw invalidVerification();
  }

  async login(data: LoginBodyDto): Promise<AuthResponseWithTokens> {
    return this.signIn(data);
  }

  async adminLogin(data: LoginBodyDto): Promise<AuthResponseWithTokens> {
    return this.signIn(data, UserRole.ADMIN);
  }

  private async signIn(
    data: LoginBodyDto,
    requiredRole?: UserRole,
  ): Promise<AuthResponseWithTokens> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (user === null) throw new UnauthorizedException("Invalid credentials.");

    const passwordMatches = await compareHash(data.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    return runIdentityTransaction(
      this.database,
      { userIds: [user.id], adminPopulation: false },
      async (transaction, now) => {
        const current = await transaction.user.findUnique({
          where: { id: user.id },
        });
        if (
          current === null ||
          current.status !== UserStatus.ACTIVE ||
          current.emailVerifiedAt === null ||
          current.passwordHash !== user.passwordHash ||
          (requiredRole !== undefined && current.role !== requiredRole)
        )
          throw new UnauthorizedException("Invalid credentials.");
        const tokens = await this.sessions.createSession(
          transaction,
          current,
          data.rememberMe,
          now,
        );
        return {
          user: mapSafeUser(current),
          tokens,
          rememberMe: data.rememberMe,
        };
      },
    );
  }

  async logout(identity: AuthenticatedSession): Promise<void> {
    await runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, identity.userId);
        const now = new Date();
        await readSessionAuthority(transaction, identity, now);
        await this.sessions.revokeSession(transaction, identity, now);
      },
    );
  }

  async logoutAll(identity: AuthenticatedSession): Promise<void> {
    await runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, identity.userId);
        const now = new Date();
        await readSessionAuthority(transaction, identity, now);
        await this.sessions.revokeAll(transaction, identity.userId, now);
      },
    );
  }

  async refresh(refreshToken: string): Promise<AuthResponseWithTokens> {
    if (refreshToken.length === 0) {
      throw new BadRequestException("Refresh token is required.");
    }

    const verified = verifyRefreshToken(refreshToken);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const claims = verified.payload;
    return runIdentityTransaction(
      this.database,
      { userIds: [claims.userId], adminPopulation: false },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, claims.userId);
        const now = new Date();
        const user = await readSessionAuthority(transaction, claims, now);
        const tokens = await this.sessions.rotate(transaction, user, {
          claims,
          tokenHash: sha256(refreshToken),
        });
        return {
          user: mapSafeUser(user),
          tokens,
          rememberMe: claims.rememberMe,
        };
      },
    );
  }

  async forgotPassword(
    data: EmailRequestBodyDto,
  ): Promise<typeof FORGOT_PASSWORD_NEUTRAL_RESPONSE> {
    const candidate = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (candidate === null) return FORGOT_PASSWORD_NEUTRAL_RESPONSE;
    const issuance = await runIdentityTransaction(
      this.database,
      { userIds: [candidate.id], adminPopulation: false },
      async (transaction, now) => {
        const user = await transaction.user.findUnique({
          where: { id: candidate.id },
        });
        if (!this.isRecoveryEligible(user)) return null;
        const expiresAt = new Date(now.getTime() + RESET_TOKEN_TTL_MS);
        const token = generateResetToken(user.email, user.id, expiresAt);
        await transaction.user.update({
          where: { id: user.id },
          data: {
            resetTokenHash: sha256(token),
            resetTokenExpiresAt: expiresAt,
          },
        });
        return { user, token };
      },
    );
    if (issuance !== null) {
      try {
        await this.emailService.sendPasswordResetEmail(
          issuance.user.fullName,
          issuance.user.email,
          issuance.token,
        );
      } catch {
        // Public recovery stays neutral; the committed credential can be replaced.
        logger.error(
          { outcome: "password_reset_email_failed" },
          "Failed to send password reset email.",
        );
      }
    }
    return FORGOT_PASSWORD_NEUTRAL_RESPONSE;
  }

  async resetPassword(
    data: ResetPasswordBodyDto,
    token: string,
  ): Promise<AuthResponseWithoutTokens> {
    const user = await this.findUserByResetToken(token);
    await this.assertNewPasswordDiffers(data.newPassword, user.passwordHash);
    const passwordHash = await generateHash(data.newPassword);

    const updated = await runIdentityTransaction(
      this.database,
      { userIds: [user.id], adminPopulation: false },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, user.id);
        const now = new Date();
        const current = await transaction.user.findUnique({
          where: { id: user.id },
        });
        this.assertResetCredential(current, token, now);
        assertCurrentPasswordHash(current, user.passwordHash);
        return this.replacePassword(transaction, current.id, passwordHash, now);
      },
    );
    return { user: mapSafeUser(updated) };
  }

  async validateResetToken(token: string): Promise<{ valid: true }> {
    await this.findUserByResetToken(token);
    return { valid: true };
  }

  async changePassword(
    identity: AuthenticatedSession,
    data: ChangePasswordBodyDto,
  ): Promise<AuthResponseWithoutTokens> {
    const user = await this.database.user.findUnique({
      where: { id: identity.userId },
    });
    if (user === null) throw new UnauthorizedException("User not found.");
    if (!this.isRecoveryEligible(user)) throw new UnauthorizedException();

    if (!(await compareHash(data.currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is not correct.");
    }
    await this.assertNewPasswordDiffers(data.newPassword, user.passwordHash);
    const passwordHash = await generateHash(data.newPassword);
    const updated = await runIdentityTransaction(
      this.database,
      { userIds: [user.id], adminPopulation: false },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, user.id);
        const now = new Date();
        const current = await readSessionAuthority(transaction, identity, now);
        assertCurrentPasswordHash(current, user.passwordHash);
        return this.replacePassword(transaction, current.id, passwordHash, now);
      },
    );
    return { user: mapSafeUser(updated) };
  }

  private async findUserByResetToken(token: string): Promise<User> {
    const verified = verifyResetToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    const user = await this.database.user.findUnique({
      where: { id: verified.payload.userId },
    });
    this.assertResetCredential(user, token, new Date());
    return user;
  }

  private isRecoveryEligible(user: User | null): user is User {
    return (
      user !== null &&
      user.status === UserStatus.ACTIVE &&
      user.emailVerifiedAt !== null
    );
  }

  private assertResetCredential(
    user: User | null,
    token: string,
    now: Date,
  ): asserts user is User {
    const verified = verifyResetToken(token);
    if (
      !verified.valid ||
      !this.isRecoveryEligible(user) ||
      user.id !== verified.payload.userId ||
      user.email !== verified.payload.email ||
      user.resetTokenHash !== sha256(token) ||
      user.resetTokenExpiresAt === null ||
      now.getTime() >= user.resetTokenExpiresAt.getTime()
    )
      throw new UnauthorizedException("Invalid or expired reset token.");
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

  private async replacePassword(
    transaction: Prisma.TransactionClient,
    userId: string,
    passwordHash: string,
    now: Date,
  ): Promise<User> {
    const updated = await transaction.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });
    await this.sessions.revokeAll(transaction, userId, now);
    return updated;
  }
}
