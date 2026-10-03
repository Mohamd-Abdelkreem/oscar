import { randomUUID } from "node:crypto";

import type { DatabaseClient } from "@template/database";

import {
  ConflictException,
  ServiceUnavailableException,
} from "../../core/errors/index.js";
import type { EmailService } from "../../infrastructure/email/email.service.js";
import {
  generateHash,
  generateVerificationToken,
  sha256,
} from "../../infrastructure/security/index.js";
import { VERIFICATION_TOKEN_TTL_MS } from "../auth/auth.constants.js";
import { runIdentityTransaction } from "../auth/session-authority.js";
import { writeIdentityAudit } from "./identity-audit.js";
import {
  bootstrapInputSchema,
  type BootstrapInput,
  type BootstrapOperator,
} from "./admin-bootstrap.input.js";

export class AdminBootstrapService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly email: EmailService,
  ) {}

  async provision(
    input: BootstrapInput,
    operator: BootstrapOperator,
  ): Promise<{ userId: string }> {
    const command = bootstrapInputSchema.parse(input);
    const passwordHash = await generateHash(command.password);
    const provisioned = await runIdentityTransaction(
      this.database,
      { userIds: [], adminPopulation: true },
      async (transaction, now) => {
        const setup = await transaction.adminSetupState.findUniqueOrThrow({
          where: { id: 1 },
        });
        if (
          setup.completedAt !== null ||
          (await transaction.user.findFirst({
            where: { role: "ADMIN" },
            select: { id: true },
          })) !== null
        )
          throw new ConflictException(
            "Administrator setup is permanently complete.",
          );
        if (
          (await transaction.user.findUnique({
            where: { email: command.email },
            select: { id: true },
          })) !== null
        )
          throw new ConflictException("Email is already in use.");
        const userId = randomUUID();
        const expiresAt = new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS);
        const token = generateVerificationToken(
          command.email,
          userId,
          expiresAt,
        );
        await transaction.user.create({
          data: {
            id: userId,
            fullName: command.fullName,
            email: command.email,
            passwordHash,
            role: "ADMIN",
            status: "PENDING_VERIFICATION",
            verificationTokenHash: sha256(token),
            verificationTokenExpiresAt: expiresAt,
          },
        });
        await transaction.adminSetupState.update({
          where: { id: 1 },
          data: {
            firstAdminUserId: userId,
            completedAt: now,
            completionSource: "BOOTSTRAP",
          },
        });
        await writeIdentityAudit(
          transaction,
          {
            action: "BOOTSTRAP",
            actorKind: "OPERATOR",
            operatorIdentity: `${String(operator.uid)}:${operator.username}`,
            targetUserId: userId,
            reason: command.reason,
            afterSnapshot: {
              firstAdminUserId: userId,
              completedAt: now.toISOString(),
              completionSource: "BOOTSTRAP",
            },
          },
          now,
        );
        return { userId, token };
      },
    );
    try {
      await this.email.sendVerificationEmail(
        command.fullName,
        command.email,
        provisioned.token,
      );
    } catch {
      throw new ServiceUnavailableException(
        "Setup is complete; pending email proof requires a new verification request.",
      );
    }
    return { userId: provisioned.userId };
  }
}
