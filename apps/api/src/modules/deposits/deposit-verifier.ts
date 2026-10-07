import type { DatabaseClient } from "@template/database";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { parseTronPublicEnvironment } from "../../core/config/tron.config.js";
import {
  type TronProvider,
  TronProviderError,
} from "../../infrastructure/tron/tron-provider.js";
import {
  decodeCanonicalReceipt,
  TronReceiptError,
  type CanonicalMovement,
} from "../../infrastructure/tron/tron-receipt.js";

export type OwnedDepositMovement = CanonicalMovement &
  Readonly<{ assignmentId: string; walletId: string; employeeId: string }>;
export type DepositVerification =
  | { state: "VERIFIED"; movements: OwnedDepositMovement[] }
  | {
      state:
        | "UNAVAILABLE"
        | "UNFINALIZED"
        | "INELIGIBLE"
        | "CONFLICT"
        | "UNRESOLVED";
      code: string;
      evidenceDigest?: string;
    };
const heightSchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export class DepositVerifier {
  constructor(
    private readonly database: DatabaseClient,
    private readonly provider: TronProvider,
    private readonly config: ReturnType<typeof parseTronPublicEnvironment>,
    private readonly clock: () => Date,
  ) {}
  async verify(rawId: unknown): Promise<DepositVerification> {
    const identity = z
      .string()
      .regex(/^[0-9a-f]{64}$/u)
      .safeParse(rawId);
    if (!identity.success)
      return { state: "UNRESOLVED", code: "DEPOSIT_MALFORMED" };
    try {
      return await this.canonicalMovements(identity.data);
    } catch (error) {
      if (error instanceof TronProviderError)
        return {
          state:
            error.code === "TRON_UNFINALIZED"
              ? "UNFINALIZED"
              : error.code === "TRON_IDENTITY_CONFLICT"
                ? "CONFLICT"
                : "UNAVAILABLE",
          code: error.code,
        };
      if (error instanceof TronReceiptError) {
        if (
          error.code === "DEPOSIT_INELIGIBLE" &&
          (await this.database.depositReceipt.count({
            where: {
              network: this.config.network,
              transactionId: identity.data,
            },
          })) > 0
        )
          return { state: "CONFLICT", code: "DEPOSIT_EVIDENCE_CONFLICT" };
        return {
          state:
            error.code === "DEPOSIT_UNFINALIZED"
              ? "UNFINALIZED"
              : error.code === "DEPOSIT_EVIDENCE_CONFLICT"
                ? "CONFLICT"
                : error.code === "DEPOSIT_INELIGIBLE"
                  ? "INELIGIBLE"
                  : "UNRESOLVED",
          code: error.code,
        };
      }
      throw error;
    }
  }
  private async canonicalMovements(
    transactionId: string,
  ): Promise<DepositVerification> {
    const canonical = await this.readCanonicalMovements(transactionId);
    if (!Array.isArray(canonical)) return canonical;
    return this.attributeMovements(transactionId, canonical);
  }
  private async readCanonicalMovements(transactionId: string) {
    await this.provider.verifyIdentity(this.config);
    const transaction = await this.provider.transaction(transactionId);
    const info = await this.provider.transactionInfo(transactionId);
    const height = heightSchema.safeParse(info["blockNumber"]);
    if (!height.success) throw new TronReceiptError("DEPOSIT_MALFORMED");
    const block = await this.provider.transactionBlock(height.data);
    const solidified = await this.provider.solidifiedFloor();
    const boundary = {
      transactionId,
      transaction,
      info,
      block,
      solidified,
      network: this.config.network,
      tokenContract: this.config.token.contract,
      verifiedAt: this.clock(),
    };
    try {
      return decodeCanonicalReceipt(boundary);
    } catch (failure) {
      if (
        !(failure instanceof TronReceiptError) ||
        failure.code !== "DEPOSIT_INELIGIBLE"
      )
        throw failure;
      if (
        (await this.database.depositReceipt.count({
          where: { network: this.config.network, transactionId },
        })) > 0
      )
        return {
          state: "CONFLICT" as const,
          code: "DEPOSIT_EVIDENCE_CONFLICT",
        };
      return {
        state: "INELIGIBLE" as const,
        code: failure.code,
        evidenceDigest: createHash("sha256")
          .update(
            JSON.stringify({
              network: this.config.network,
              transactionId,
              info,
              block,
            }),
          )
          .digest("hex"),
      };
    }
  }
  private async attributeMovements(
    transactionId: string,
    canonical: CanonicalMovement[],
  ): Promise<DepositVerification> {
    const recorded = await this.database.depositReceipt.findMany({
      where: { network: this.config.network, transactionId },
      select: {
        logIndex: true,
        evidenceDigest: true,
        assignmentId: true,
        walletId: true,
      },
      take: 10001,
    });
    const canonicalByIndex = new Map(
      canonical.map((movement) => [movement.logIndex, movement]),
    );
    const recordedByIndex = new Map(
      recorded.map((receipt) => [receipt.logIndex, receipt]),
    );
    if (
      recorded.some(
        (receipt) =>
          canonicalByIndex.get(receipt.logIndex)?.evidenceDigest !==
          receipt.evidenceDigest,
      )
    )
      throw new TronReceiptError("DEPOSIT_EVIDENCE_CONFLICT");
    const movements: OwnedDepositMovement[] = [];
    const assignments = await this.database.depositAddressAssignment.findMany({
      where: {
        network: this.config.network,
        address: {
          in: [...new Set(canonical.map((movement) => movement.recipient))],
        },
      },
      select: {
        id: true,
        walletId: true,
        employeeId: true,
        state: true,
        address: true,
      },
      take: 10000,
    });
    const assignmentsByAddress = new Map(
      assignments.map((assignment) => [assignment.address, assignment]),
    );
    for (const movement of canonical) {
      const assignment = assignmentsByAddress.get(movement.recipient);
      const receipt = recordedByIndex.get(movement.logIndex);
      if (assignment === undefined) {
        if (receipt !== undefined)
          return {
            state: "UNRESOLVED",
            code: "DEPOSIT_ASSIGNMENT_UNAVAILABLE",
          };
        continue;
      }
      if (assignment.state !== "READY")
        return { state: "UNRESOLVED", code: "DEPOSIT_ASSIGNMENT_UNAVAILABLE" };
      if (
        receipt !== undefined &&
        (receipt.assignmentId !== assignment.id ||
          receipt.walletId !== assignment.walletId)
      )
        throw new TronReceiptError("DEPOSIT_EVIDENCE_CONFLICT");
      movements.push(
        Object.freeze({
          ...movement,
          assignmentId: assignment.id,
          walletId: assignment.walletId,
          employeeId: assignment.employeeId,
        }),
      );
    }
    return movements.length === 0
      ? {
          state: "INELIGIBLE",
          code: "DEPOSIT_NO_OWNED_MOVEMENTS",
          evidenceDigest: createHash("sha256")
            .update(
              JSON.stringify({
                transactionId,
                movements: canonical.map((movement) => movement.evidenceDigest),
              }),
            )
            .digest("hex"),
        }
      : { state: "VERIFIED", movements };
  }
}
