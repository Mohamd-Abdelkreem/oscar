import { randomUUID } from "node:crypto";
import type {
  DatabaseClient,
  DepositAddressAssignment,
} from "@template/database";
import {
  depositAddressDataSchema,
  type DepositAddressData,
} from "@template/contracts";
import { AppError } from "../../core/errors/app.error.js";
import {
  lockIdentityUsers,
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";
import type { FinancialRuntimeAdmission } from "./runtime-control.js";

export type CustodyMetadata = Readonly<{
  network: DepositAddressAssignment["network"];
  token: { symbol: "USDT"; contract: string; decimals: 6 };
}>;
type Identity = Readonly<{ userId: string; sessionId: string }>;
export class CustodyService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly metadata: CustodyMetadata,
    private readonly admission: FinancialRuntimeAdmission,
  ) {}
  async read(identity: Identity): Promise<DepositAddressData> {
    return runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction, now) => {
        await readSessionAuthority(transaction, identity, now, "USER");
        const assignment =
          await transaction.depositAddressAssignment.findUnique({
            where: {
              employeeId_network: {
                employeeId: identity.userId,
                network: this.metadata.network,
              },
            },
          });
        return this.projection(assignment, new Date());
      },
    );
  }
  async request(identity: Identity): Promise<DepositAddressData> {
    return this.database.$transaction(async (transaction) => {
      if (this.admission.processKind !== "API")
        throw new AppError(
          "Provisioning authority is unavailable.",
          403,
          "FORBIDDEN",
        );
      await this.admission.assertMutationAdmission(transaction);
      await lockIdentityUsers(transaction, {
        userIds: [identity.userId],
        adminPopulation: false,
      });
      const now = new Date();
      await readSessionAuthority(transaction, identity, now, "USER");
      const wallet = await transaction.wallet.findUniqueOrThrow({
        where: { ownerUserId: identity.userId },
      });
      const assignment = await transaction.depositAddressAssignment.upsert({
        where: {
          employeeId_network: {
            employeeId: identity.userId,
            network: this.metadata.network,
          },
        },
        create: {
          employeeId: identity.userId,
          walletId: wallet.id,
          network: this.metadata.network,
          keyRecordId: randomUUID(),
        },
        update: {},
      });
      return this.projection(assignment, new Date());
    });
  }
  private projection(
    assignment: DepositAddressAssignment | null,
    now: Date,
  ): DepositAddressData {
    const base = { ...this.metadata, serverNow: now.toISOString() };
    if (assignment === null)
      return depositAddressDataSchema.parse({ ...base, state: "UNASSIGNED" });
    if (assignment.network !== this.metadata.network)
      throw new AppError(
        "Deposit metadata is unavailable.",
        503,
        "DEPOSIT_UNAVAILABLE",
      );
    if (assignment.state === "READY")
      return depositAddressDataSchema.parse({
        ...base,
        state: "READY",
        assignmentId: assignment.id,
        address: assignment.address,
        readyAt: assignment.readyAt?.toISOString(),
        activationState: assignment.activationState,
        resourceCheckedAt: assignment.resourceCheckedAt?.toISOString() ?? null,
        detection: {
          status: "NOT_STARTED",
          lastSuccessfulScanAt: null,
          serverNow: base.serverNow,
        },
      });
    if (assignment.lastErrorCode !== null)
      return depositAddressDataSchema.parse({
        ...base,
        state: "UNAVAILABLE",
        assignmentId: assignment.id,
        reasonCode: assignment.lastErrorCode,
        retryable: assignment.lastErrorCode !== "EVIDENCE_CONFLICT",
      });
    return depositAddressDataSchema.parse({
      ...base,
      state: "PROVISIONING",
      assignmentId: assignment.id,
      readiness: assignment.state,
    });
  }
}
