import {
  depositHistoryQuerySchema,
  adminDepositHistoryQuerySchema,
  depositHistoryDataSchema,
  adminDepositHistoryDataSchema,
} from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { Prisma } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { buildPaginationMeta } from "../../core/pagination/pagination.js";
import {
  runIdentityTransaction,
  readSessionAuthority,
} from "../auth/session-authority.js";
import {
  CustodyService,
  type CustodyMetadata,
} from "../custody/custody.service.js";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import {
  readDepositHistory,
  readDepositDetection,
} from "./deposits.queries.js";
import { mapDepositHistory } from "./deposits.mapper.js";

type Identity = { userId: string; sessionId: string };
export class DepositsService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date,
    private readonly metadata?: CustodyMetadata,
    private readonly admission?: FinancialRuntimeAdmission,
  ) {}
  private custody() {
    if (this.metadata === undefined || this.admission === undefined)
      throw new AppError(
        "Deposit configuration is unavailable.",
        503,
        "DEPOSIT_UNAVAILABLE",
      );
    return new CustodyService(this.database, this.metadata, this.admission);
  }
  async address(identity: Identity, provision: boolean) {
    const address = await (provision
      ? this.custody().request(identity)
      : this.custody().read(identity));
    if (address.state !== "READY") return address;
    const metadata = this.metadata;
    if (metadata === undefined)
      throw new AppError(
        "Deposit configuration is unavailable.",
        503,
        "DEPOSIT_UNAVAILABLE",
      );
    return runIdentityTransaction(
      this.database,
      { userIds: [identity.userId], adminPopulation: false },
      async (transaction, now) => {
        await readSessionAuthority(transaction, identity, now, "USER");
        return {
          ...address,
          detection: await readDepositDetection(
            transaction,
            identity.userId,
            metadata.network,
            this.clock(),
          ),
        };
      },
    );
  }
  async history(identity: Identity, rawQuery: unknown, admin: boolean) {
    const query = (
      admin ? adminDepositHistoryQuerySchema : depositHistoryQuerySchema
    ).parse(rawQuery);
    if (!admin && this.metadata === undefined)
      throw new AppError(
        "Deposit configuration is unavailable.",
        503,
        "DEPOSIT_UNAVAILABLE",
      );
    return runIdentityTransaction(
      this.database,
      {
        userIds: [identity.userId],
        adminPopulation: false,
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      },
      async (transaction, now) => {
        await readSessionAuthority(
          transaction,
          identity,
          now,
          admin ? "ADMIN" : "USER",
        );
        const history = await readDepositHistory(
          transaction,
          query,
          admin ? undefined : identity.userId,
        );
        const page = {
          items: history.operations.map((operation) =>
            mapDepositHistory(operation, admin),
          ),
          pagination: buildPaginationMeta({ ...query, total: history.total }),
          serverNow: this.clock().toISOString(),
        };
        if (admin) return adminDepositHistoryDataSchema.parse(page);
        const metadata = this.metadata;
        if (metadata === undefined)
          throw new AppError(
            "Deposit configuration is unavailable.",
            503,
            "DEPOSIT_UNAVAILABLE",
          );
        return depositHistoryDataSchema.parse({
          ...page,
          detection: await readDepositDetection(
            transaction,
            identity.userId,
            metadata.network,
            this.clock(),
          ),
        });
      },
    );
  }
}
