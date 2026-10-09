import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { TronWeb } from "tronweb";
import {
  withdrawalConsumeBodySchema,
  withdrawalDestinationBodySchema,
  withdrawalResendBodySchema,
} from "@template/contracts";
import {
  Prisma,
  type DatabaseClient,
  type WithdrawalDestination,
} from "@template/database";
import {
  withdrawalConfig,
  type WithdrawalConfig,
} from "../../core/config/withdrawal.config.js";
import { TooManyRequestsException } from "../../core/errors/index.js";
import { EmailDeliveryError } from "../../infrastructure/email/email-delivery.js";
import type { EmailService } from "../../infrastructure/email/email.service.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import {
  isRetryableIdentityConflict,
  lockIdentityUsers,
  readSessionAuthority,
} from "../auth/session-authority.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import type { TronNetworkName } from "../../core/config/tron.config.js";
import { mapWithdrawalDestination } from "./withdrawals.mapper.js";
import { WithdrawalError } from "./withdrawals.errors.js";
import { WithdrawalsService } from "./withdrawals.service.js";

export type WithdrawalIdentity = Readonly<{
  userId: string;
  sessionId: string;
}>;
type Options = Readonly<{
  network: TronNetworkName | undefined;
  admission?: FinancialRuntimeAdmission;
  clock: () => Date;
  config?: WithdrawalConfig;
}>;
type IssuedProof = Readonly<{
  destination: WithdrawalDestination;
  token: string;
  email: string;
  fullName: string;
  address: string;
}>;

function proofHash(
  destination: Pick<
    WithdrawalDestination,
    "employeeId" | "network" | "pendingAddress" | "proofGeneration" | "proofId"
  >,
  token: string,
): string {
  return sha256(
    JSON.stringify([
      "WITHDRAWAL_FIRST_DESTINATION",
      destination.employeeId,
      destination.network,
      destination.pendingAddress,
      destination.proofGeneration,
      destination.proofId,
      token,
    ]),
  );
}

export class WithdrawalDestinationService {
  private readonly config: WithdrawalConfig;
  readonly reads: WithdrawalsService;
  constructor(
    private readonly database: DatabaseClient,
    private readonly email: EmailService,
    private readonly options: Options,
  ) {
    this.config = options.config ?? withdrawalConfig;
    this.reads = new WithdrawalsService(
      database,
      options.clock,
      options.admission,
    );
  }

  async issue(identity: WithdrawalIdentity, rawBody: unknown) {
    const { address } = withdrawalDestinationBodySchema.parse(rawBody);
    if (!TronWeb.isAddress(address))
      throw new WithdrawalError("WITHDRAWAL_ADDRESS_INVALID");
    return this.issueProof(identity, { address });
  }

  async resend(identity: WithdrawalIdentity, rawBody: unknown) {
    const { expectedVersion } = withdrawalResendBodySchema.parse(rawBody);
    return this.issueProof(identity, { expectedVersion });
  }

  private async issueProof(
    identity: WithdrawalIdentity,
    command: { address: string } | { expectedVersion: number },
  ) {
    const network = this.options.network;
    if (network === undefined)
      throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
    try {
      this.email.assertWithdrawalConfirmationAvailable();
    } catch {
      throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
    }
    const token = randomBytes(32).toString("base64url");
    const proofId = randomUUID();
    const issued = await this.mutation(identity, async (transaction, now) => {
      const user = await this.commandAuthority(transaction, identity, now);
      const current = await transaction.withdrawalDestination.findUnique({
        where: { employeeId: identity.userId },
      });
      if (current !== null && current.address !== null)
        throw new WithdrawalError("WITHDRAWAL_DESTINATION_FIXED");
      if (
        "expectedVersion" in command &&
        (current === null || current.version !== command.expectedVersion)
      )
        throw new WithdrawalError("WITHDRAWAL_DESTINATION_STALE");
      if (
        current !== null &&
        (current.network !== network || now < (current.nextIssuanceAt ?? now))
      ) {
        if (current.network !== network)
          throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
        throw new TooManyRequestsException(
          "Withdrawal proof resend cooldown is active.",
        );
      }
      const pendingAddress =
        "address" in command ? command.address : current?.pendingAddress;
      if (pendingAddress === null || pendingAddress === undefined)
        throw new WithdrawalError("WITHDRAWAL_DESTINATION_STALE");
      const authority = {
        employeeId: identity.userId,
        network,
        pendingAddress,
        proofId,
        proofGeneration: (current?.proofGeneration ?? 0) + 1,
      };
      const savedFields = {
        ...authority,
        proofHash: proofHash(authority, token),
        issuedAt: now,
        expiresAt: new Date(
          now.getTime() + this.config.addressTokenTtlSeconds * 1000,
        ),
        nextIssuanceAt: new Date(
          now.getTime() + this.config.addressResendCooldownSeconds * 1000,
        ),
        deliveryStatus: "NOT_ATTEMPTED",
        deliveryAttemptedAt: null,
        deliveryAcknowledgedAt: null,
        deliveryFailureCode: null,
        version: (current?.version ?? 0) + 1,
      };
      const destination =
        current === null
          ? await transaction.withdrawalDestination.create({
              data: savedFields,
            })
          : await transaction.withdrawalDestination.update({
              where: { id: current.id },
              data: savedFields,
            });
      await transaction.withdrawalDestinationAudit.create({
        data: {
          destinationId: destination.id,
          actorUserId: identity.userId,
          kind: "PROOF_ISSUED",
          proofId,
          proofGeneration: destination.proofGeneration,
          network,
          address: pendingAddress,
          occurredAt: now,
          committedDestinationVersion: destination.version,
        },
      });
      return {
        destination,
        token,
        email: user.email,
        fullName: user.fullName,
        address: pendingAddress,
      };
    });
    await this.deliver(identity, issued);
    return this.reads.destination(identity);
  }

  async consume(identity: WithdrawalIdentity, rawBody: unknown) {
    const { token } = withdrawalConsumeBodySchema.parse(rawBody);
    return this.mutation(identity, async (transaction, now) => {
      await this.commandAuthority(transaction, identity, now);
      const current = await transaction.withdrawalDestination.findUnique({
        where: { employeeId: identity.userId },
      });
      if (
        current === null ||
        current.address !== null ||
        current.proofHash === null ||
        current.proofId === null ||
        current.pendingAddress === null ||
        current.expiresAt === null ||
        now >= current.expiresAt ||
        !timingSafeEqual(
          Buffer.from(current.proofHash, "hex"),
          Buffer.from(proofHash(current, token), "hex"),
        )
      )
        throw new WithdrawalError("WITHDRAWAL_PROOF_INVALID");
      const saved = await transaction.withdrawalDestination.update({
        where: { id: current.id },
        data: {
          address: current.pendingAddress,
          addressVersion: 1,
          confirmedAt: now,
          version: current.version + 1,
          proofId: null,
          proofHash: null,
          pendingAddress: null,
          issuedAt: null,
          expiresAt: null,
          nextIssuanceAt: null,
          deliveryStatus: "NOT_ATTEMPTED",
          deliveryAttemptedAt: null,
          deliveryAcknowledgedAt: null,
          deliveryFailureCode: null,
        },
      });
      await transaction.withdrawalDestinationAudit.create({
        data: {
          destinationId: current.id,
          actorUserId: identity.userId,
          kind: "PROOF_CONSUMED",
          proofId: current.proofId,
          proofGeneration: current.proofGeneration,
          network: current.network,
          address: current.pendingAddress,
          occurredAt: now,
          committedDestinationVersion: saved.version,
        },
      });
      return mapWithdrawalDestination(saved, now);
    });
  }

  private async commandAuthority(
    transaction: Prisma.TransactionClient,
    identity: WithdrawalIdentity,
    now: Date,
  ) {
    const user = await readSessionAuthority(transaction, identity, now, "USER");
    if (user.withdrawalsBlocked)
      throw new WithdrawalError("WITHDRAWAL_BLOCKED");
    return user;
  }

  private async deliver(
    identity: WithdrawalIdentity,
    issued: IssuedProof,
  ): Promise<void> {
    const attemptedAt = this.options.clock();
    let deliveryStatus: "ACKNOWLEDGED" | "REJECTED" | "UNKNOWN" =
      "ACKNOWLEDGED";
    let failureCode: string | null = null;
    try {
      await this.email.sendWithdrawalConfirmation({
        fullName: issued.fullName,
        email: issued.email,
        address: issued.address,
        token: issued.token,
        assertCanDispatch: () =>
          this.mutation(identity, async (transaction, now) => {
            await this.commandAuthority(transaction, identity, now);
            const current = await transaction.withdrawalDestination.findUnique({
              where: { id: issued.destination.id },
            });
            if (
              current?.proofId !== issued.destination.proofId ||
              current.expiresAt === null ||
              now >= current.expiresAt
            )
              throw new WithdrawalError("WITHDRAWAL_PROOF_INVALID");
            // Persist uncertainty before external I/O so a crash cannot imply no dispatch.
            await transaction.withdrawalDestination.update({
              where: { id: current.id },
              data: {
                deliveryStatus: "UNKNOWN",
                deliveryAttemptedAt: attemptedAt,
              },
            });
          }),
      });
    } catch (failure) {
      // External delivery failures cannot undo an already committed credential generation.
      deliveryStatus =
        failure instanceof EmailDeliveryError ? failure.disposition : "UNKNOWN";
      failureCode =
        failure instanceof EmailDeliveryError ? failure.code : "TRANSPORT";
    }
    await this.mutation(identity, async (transaction) => {
      await transaction.withdrawalDestination.updateMany({
        where: {
          id: issued.destination.id,
          proofId: issued.destination.proofId,
          proofGeneration: issued.destination.proofGeneration,
        },
        data: {
          deliveryStatus,
          deliveryAttemptedAt: attemptedAt,
          deliveryAcknowledgedAt:
            deliveryStatus === "ACKNOWLEDGED" ? this.options.clock() : null,
          deliveryFailureCode: failureCode,
        },
      });
    });
  }

  private async mutation<T>(
    identity: WithdrawalIdentity,
    work: (transaction: Prisma.TransactionClient, now: Date) => Promise<T>,
  ): Promise<T> {
    const admission = this.options.admission;
    if (admission === undefined || admission.processKind !== "API")
      throw new WithdrawalError("WITHDRAWAL_UNAVAILABLE");
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.database.$transaction(
          async (transaction) => {
            await admission.assertMutationAdmission(transaction);
            await lockIdentityUsers(transaction, {
              userIds: [identity.userId],
              adminPopulation: false,
            });
            return work(transaction, this.options.clock());
          },
          { maxWait: 5000, timeout: 10000 },
        );
      } catch (failure) {
        if (isRetryableIdentityConflict(failure)) {
          if (attempt === 3) throw new WithdrawalError("WITHDRAWAL_UNRESOLVED");
          continue;
        }
        if (failure instanceof Prisma.PrismaClientKnownRequestError)
          throw new WithdrawalError("WITHDRAWAL_INTERNAL");
        throw failure;
      }
    }
    throw new WithdrawalError("WITHDRAWAL_UNRESOLVED");
  }
}
