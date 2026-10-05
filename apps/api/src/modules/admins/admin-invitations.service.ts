import { randomUUID } from "node:crypto";

import {
  adminInvitationIssueBodySchema,
  adminInvitationCommandBodySchema,
  adminInvitationAcceptBodySchema,
  type AdminInvitationIssueBody,
  type AdminInvitationCommandBody,
  type AdminInvitationAcceptBody,
  type AdminInvitation as InvitationProjection,
  type IdentityUserData,
} from "@template/contracts";
import {
  Prisma,
  type DatabaseClient,
  type AdminInvitation,
} from "@template/database";

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
} from "../../core/errors/index.js";
import type { AuthenticatedSession } from "../../core/types/request-context.types.js";
import { EmailDeliveryError } from "../../infrastructure/email/email-delivery.js";
import type { EmailService } from "../../infrastructure/email/email.service.js";
import {
  generateAdminInvitationToken,
  verifyAdminInvitationToken,
} from "../../infrastructure/security/jwt.service.js";
import { generateHash, sha256 } from "../../infrastructure/security/index.js";
import { mapSafeUser } from "../users/users.mapper.js";
import {
  runIdentityTransaction,
  lockIdentityUsers,
  readSessionAuthority,
} from "../auth/session-authority.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import {
  VERIFICATION_TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
} from "../auth/auth.constants.js";
import { writeIdentityAudit } from "./identity-audit.js";
import { invitationDisposition, mapInvitation } from "./admins.mapper.js";

const invalidInvitation = () =>
  new BadRequestException("Invalid or expired administrator invitation.");
type InvitationGrant = Readonly<{ invitation: AdminInvitation; token: string }>;

export function invitationSnapshot(invitation: AdminInvitation, now: Date) {
  return {
    id: invitation.id,
    issuerUserId: invitation.issuerUserId,
    tokenVersion: invitation.tokenVersion,
    issuedAt: invitation.issuedAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    acceptedUserId: invitation.acceptedUserId,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
    revokedByUserId: invitation.revokedByUserId,
    disposition: invitationDisposition(invitation, now),
  };
}

export async function revokeInvitation(
  transaction: Prisma.TransactionClient,
  invitation: AdminInvitation,
  actorUserId: string,
  reason: string,
  now: Date,
): Promise<AdminInvitation> {
  const revoked = await transaction.adminInvitation.update({
    where: { id: invitation.id },
    data: {
      revokedAt: now,
      revokedByUserId: actorUserId,
      revocationReason: reason,
    },
  });
  await writeIdentityAudit(
    transaction,
    {
      action: "INVITATION_REVOKE",
      actorKind: "ADMIN",
      actorUserId,
      invitationId: invitation.id,
      issuerUserId: invitation.issuerUserId,
      tokenVersion: invitation.tokenVersion,
      reason,
      beforeSnapshot: invitationSnapshot(invitation, now),
      afterSnapshot: invitationSnapshot(revoked, now),
    },
    now,
  );
  return revoked;
}

export class AdminInvitationsService {
  private readonly sessions = new AuthSessionService();
  constructor(
    private readonly database: DatabaseClient,
    private readonly email: EmailService,
  ) {}

  private withActor<T>(
    actor: AuthenticatedSession,
    invitationId: string | null,
    work: (
      transaction: Prisma.TransactionClient,
      invitation: AdminInvitation | null,
      now: Date,
    ) => Promise<T>,
  ): Promise<T> {
    return runIdentityTransaction(
      this.database,
      { userIds: [], adminPopulation: true },
      async (transaction) => {
        const invitation =
          invitationId === null
            ? null
            : await transaction.adminInvitation.findUnique({
                where: { id: invitationId },
              });
        if (invitationId !== null && invitation === null)
          throw new NotFoundException("Invitation not found.");
        await lockIdentityUsers(transaction, {
          userIds: [
            actor.userId,
            ...(invitation === null ? [] : [invitation.issuerUserId]),
          ],
          adminPopulation: false,
        });
        for (const userId of [
          ...new Set([
            actor.userId,
            ...(invitation === null ? [] : [invitation.issuerUserId]),
          ]),
        ].sort())
          await this.sessions.lockSessions(transaction, userId);
        if (invitation !== null)
          await transaction.$queryRaw(
            Prisma.sql`SELECT id FROM admin_invitations WHERE id=${invitation.id}::uuid FOR UPDATE`,
          );
        const now = new Date();
        await readSessionAuthority(transaction, actor, now, "ADMIN");
        return work(transaction, invitation, now);
      },
    );
  }

  private async assertUnusedEmail(
    transaction: Prisma.TransactionClient,
    email: string,
  ): Promise<void> {
    if (
      (await transaction.user.findUnique({
        where: { email },
        select: { id: true },
      })) !== null
    )
      throw new ConflictException("Email is already in use.");
  }

  async issue(
    actor: AuthenticatedSession,
    input: AdminInvitationIssueBody,
  ): Promise<InvitationProjection> {
    const command = adminInvitationIssueBodySchema.parse(input);
    const grant = await this.withActor(
      actor,
      null,
      async (transaction, _invitation, now) => {
        await this.assertUnusedEmail(transaction, command.email);
        if (
          (await transaction.adminInvitation.findUnique({
            where: { email: command.email },
            select: { id: true },
          })) !== null
        )
          throw new ConflictException(
            "Existing invitation requires explicit reissue.",
          );
        const generation = this.generation(randomUUID(), 1, command.email, now);
        const invitation = await transaction.adminInvitation.create({
          data: {
            id: generation.id,
            fullName: command.fullName,
            email: command.email,
            issuerUserId: actor.userId,
            ...generation.persistence,
          },
        });
        await writeIdentityAudit(
          transaction,
          {
            action: "INVITATION_ISSUE",
            actorKind: "ADMIN",
            actorUserId: actor.userId,
            invitationId: invitation.id,
            issuerUserId: actor.userId,
            tokenVersion: 1,
            reason: command.reason,
            afterSnapshot: invitationSnapshot(invitation, now),
          },
          now,
        );
        return { invitation, token: generation.token };
      },
    );
    return this.dispatch(grant);
  }

  async reissue(
    actor: AuthenticatedSession,
    invitationId: string,
    input: AdminInvitationCommandBody,
  ): Promise<InvitationProjection> {
    const command = adminInvitationCommandBodySchema.parse(input);
    const grant = await this.withActor(
      actor,
      invitationId,
      async (transaction, invitation, now) => {
        if (invitation === null) throw new NotFoundException();
        this.assertVersion(invitation, command.expectedVersion);
        if (
          invitation.acceptedAt !== null ||
          now.getTime() - invitation.issuedAt.getTime() < RESEND_COOLDOWN_MS
        )
          throw new ConflictException(
            "Invitation is accepted or replacement cooldown applies.",
          );
        await this.assertUnusedEmail(transaction, invitation.email);
        const generation = this.generation(
          invitation.id,
          invitation.tokenVersion + 1,
          invitation.email,
          now,
        );
        const replaced = await transaction.adminInvitation.update({
          where: { id: invitationId },
          data: {
            ...generation.persistence,
            issuerUserId: actor.userId,
            acceptedAt: null,
            acceptedUserId: null,
            revokedAt: null,
            revokedByUserId: null,
            revocationReason: null,
          },
        });
        await writeIdentityAudit(
          transaction,
          {
            action: "INVITATION_REISSUE",
            actorKind: "ADMIN",
            actorUserId: actor.userId,
            invitationId,
            issuerUserId: actor.userId,
            tokenVersion: replaced.tokenVersion,
            reason: command.reason,
            beforeSnapshot: invitationSnapshot(invitation, now),
            afterSnapshot: invitationSnapshot(replaced, now),
          },
          now,
        );
        return { invitation: replaced, token: generation.token };
      },
    );
    return this.dispatch(grant);
  }

  async revoke(
    actor: AuthenticatedSession,
    invitationId: string,
    input: AdminInvitationCommandBody,
  ): Promise<InvitationProjection> {
    const command = adminInvitationCommandBodySchema.parse(input);
    return this.withActor(
      actor,
      invitationId,
      async (transaction, invitation, now) => {
        if (invitation === null) throw new NotFoundException();
        this.assertVersion(invitation, command.expectedVersion);
        if (invitationDisposition(invitation, now) !== "PENDING")
          throw new ConflictException("Invitation is no longer outstanding.");
        return mapInvitation(
          await revokeInvitation(
            transaction,
            invitation,
            actor.userId,
            command.reason,
            now,
          ),
          now,
        );
      },
    );
  }

  private assertVersion(invitation: AdminInvitation, expected: number): void {
    if (
      invitation.tokenVersion !== expected ||
      invitation.tokenVersion === 2147483647
    )
      throw new ConflictException("Invitation generation has changed.");
  }

  private generation(
    id: string,
    tokenVersion: number,
    email: string,
    now: Date,
  ) {
    const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS);
    const token = generateAdminInvitationToken({
      invitationId: id,
      tokenVersion,
      email,
      expiresAt,
    });
    return {
      id,
      token,
      persistence: {
        tokenVersion,
        tokenHash: sha256(token),
        issuedAt: now,
        expiresAt,
        emailAttemptId: randomUUID(),
        deliveryStatus: "NOT_ATTEMPTED",
        emailAttemptedAt: null,
        emailAcknowledgedAt: null,
        failureCode: null,
      },
    };
  }

  private async dispatch(
    grant: InvitationGrant,
  ): Promise<InvitationProjection> {
    const { invitation, token } = grant;
    await this.assertDispatchable(invitation);
    const started = await this.database.adminInvitation.updateMany({
      where: this.attemptWhere(invitation),
      data: { deliveryStatus: "UNKNOWN", emailAttemptedAt: new Date() },
    });
    if (started.count !== 1)
      throw new ConflictException("Invitation generation has changed.");
    try {
      await this.email.sendAdminInvitation({
        fullName: invitation.fullName,
        email: invitation.email,
        token,
        assertCanDispatch: () => this.assertDispatchable(invitation),
      });
    } catch (failure) {
      if (failure instanceof ConflictException) throw failure;
      const disposition =
        failure instanceof EmailDeliveryError ? failure.disposition : "UNKNOWN";
      await this.database.adminInvitation.updateMany({
        where: this.attemptWhere(invitation),
        data: {
          deliveryStatus: disposition,
          failureCode:
            failure instanceof EmailDeliveryError ? failure.code : "TRANSPORT",
        },
      });
      throw new ServiceUnavailableException(
        "Invitation intent is retained. Inspect it before requesting a replacement.",
      );
    }
    const saved = await this.database.adminInvitation.updateMany({
      where: this.attemptWhere(invitation),
      data: {
        deliveryStatus: "ACKNOWLEDGED",
        emailAcknowledgedAt: new Date(),
        failureCode: null,
      },
    });
    if (saved.count !== 1)
      throw new ConflictException("Invitation generation has changed.");
    const current = await this.database.adminInvitation.findUniqueOrThrow({
      where: { id: invitation.id },
    });
    if (
      current.tokenVersion !== invitation.tokenVersion ||
      current.emailAttemptId !== invitation.emailAttemptId
    )
      throw new ConflictException("Invitation generation has changed.");
    return mapInvitation(current, new Date());
  }

  private attemptWhere(invitation: AdminInvitation) {
    return {
      id: invitation.id,
      tokenVersion: invitation.tokenVersion,
      emailAttemptId: invitation.emailAttemptId,
    };
  }

  private async assertDispatchable(grant: AdminInvitation): Promise<void> {
    const current = await this.database.adminInvitation.findUnique({
      where: { id: grant.id },
      include: {
        issuer: { select: { role: true, status: true, emailVerifiedAt: true } },
      },
    });
    if (
      current === null ||
      current.tokenVersion !== grant.tokenVersion ||
      current.emailAttemptId !== grant.emailAttemptId ||
      invitationDisposition(current, new Date()) !== "PENDING" ||
      current.issuer.role !== "ADMIN" ||
      current.issuer.status !== "ACTIVE" ||
      current.issuer.emailVerifiedAt === null
    )
      throw new ConflictException("Invitation is no longer dispatchable.");
  }

  async validate(token: string): Promise<{ valid: true }> {
    await this.readValidInvitation(this.database, token, new Date());
    return { valid: true };
  }

  private async readValidInvitation(
    database: Prisma.TransactionClient | DatabaseClient,
    token: string,
    now: Date,
  ): Promise<AdminInvitation> {
    const verified = verifyAdminInvitationToken(token);
    if (!verified.valid) throw invalidInvitation();
    const invitation = await database.adminInvitation.findUnique({
      where: { id: verified.payload.invitationId },
      include: {
        issuer: { select: { role: true, status: true, emailVerifiedAt: true } },
      },
    });
    if (
      invitation === null ||
      invitation.email !== verified.payload.email ||
      invitation.tokenVersion !== verified.payload.tokenVersion ||
      invitation.tokenHash !== sha256(token) ||
      invitationDisposition(invitation, now) !== "PENDING" ||
      invitation.issuer.role !== "ADMIN" ||
      invitation.issuer.status !== "ACTIVE" ||
      invitation.issuer.emailVerifiedAt === null
    )
      throw invalidInvitation();
    return invitation;
  }

  async accept(
    token: string,
    input: AdminInvitationAcceptBody,
  ): Promise<IdentityUserData> {
    const command = adminInvitationAcceptBodySchema.parse(input);
    const verified = verifyAdminInvitationToken(token);
    if (!verified.valid) throw invalidInvitation();
    const passwordHash = await generateHash(command.newPassword);
    return runIdentityTransaction(
      this.database,
      { userIds: [], adminPopulation: true },
      async (transaction) => {
        const candidate = await transaction.adminInvitation.findUnique({
          where: { id: verified.payload.invitationId },
        });
        if (candidate === null) throw invalidInvitation();
        await lockIdentityUsers(transaction, {
          userIds: [candidate.issuerUserId],
          adminPopulation: false,
        });
        await transaction.$queryRaw(
          Prisma.sql`SELECT id FROM admin_invitations WHERE id=${candidate.id}::uuid FOR UPDATE`,
        );
        const now = new Date();
        const invitation = await this.readValidInvitation(
          transaction,
          token,
          now,
        );
        await this.assertUnusedEmail(transaction, invitation.email);
        const user = await transaction.user.create({
          data: {
            fullName: invitation.fullName,
            email: invitation.email,
            passwordHash,
            role: "ADMIN",
            status: "ACTIVE",
            emailVerifiedAt: now,
          },
        });
        const accepted = await transaction.adminInvitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: now, acceptedUserId: user.id },
        });
        await writeIdentityAudit(
          transaction,
          {
            action: "INVITATION_ACCEPT",
            actorKind: "INVITED_RECIPIENT",
            actorUserId: user.id,
            targetUserId: user.id,
            invitationId: invitation.id,
            issuerUserId: invitation.issuerUserId,
            tokenVersion: invitation.tokenVersion,
            beforeSnapshot: invitationSnapshot(invitation, now),
            afterSnapshot: invitationSnapshot(accepted, now),
          },
          now,
        );
        return { user: mapSafeUser(user) };
      },
    );
  }
}
