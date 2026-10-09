import type { DatabaseClient } from "@template/database";
import type { FinancialRuntimeAdmission } from "../custody/runtime-control.js";
import {
  withdrawalWakeupSchema,
  type WithdrawalWakeupPublisher,
} from "../../infrastructure/queue/withdrawal-wakeups.js";
import { logger } from "../../infrastructure/logger/logger.js";

export class WithdrawalScheduler {
  private after: string | undefined;
  constructor(
    private readonly database: DatabaseClient,
    private readonly admission: FinancialRuntimeAdmission,
    private readonly clock: () => Date,
    private readonly batchSize: number,
  ) {}

  async discover(rawWakeup: unknown): Promise<boolean> {
    const wakeup = withdrawalWakeupSchema.parse(rawWakeup);
    const reference = await this.database.withdrawalRequest.findUnique({
      where: { id: wakeup.requestId },
      select: { employeeId: true, walletId: true },
    });
    if (reference === null) return false;
    return this.database.$transaction(
      async (transaction) => {
        await this.admission.assertMutationAdmission(transaction);
        await transaction.$queryRaw`SELECT id FROM users WHERE id=${reference.employeeId}::uuid FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM wallets WHERE id=${reference.walletId}::uuid FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM reservation_allocations WHERE wallet_id=${reference.walletId}::uuid ORDER BY id FOR UPDATE`;
        await transaction.$queryRaw`SELECT id FROM withdrawal_requests WHERE id=${wakeup.requestId}::uuid FOR UPDATE`;
        const now = this.clock();
        const [changed] = await transaction.$queryRaw<
          { id: string }[]
        >`UPDATE withdrawal_requests SET next_check_at=LEAST(${now},clock_timestamp())
        WHERE id=${wakeup.requestId}::uuid AND state='SCHEDULED' AND schedule_version=${wakeup.scheduleVersion}
        AND dispatch_at<=LEAST(${now},clock_timestamp()) AND next_check_at IS NULL RETURNING id`;
        return changed !== undefined;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  async repair(
    publisher: WithdrawalWakeupPublisher,
    stopping: () => boolean = () => false,
  ): Promise<number> {
    const candidates = await this.database.withdrawalRequest.findMany({
      where: {
        state: "SCHEDULED",
        ...(this.after === undefined ? {} : { id: { gt: this.after } }),
      },
      select: { id: true, scheduleVersion: true, dispatchAt: true },
      orderBy: { id: "asc" },
      take: this.batchSize,
    });
    this.after =
      candidates.length < this.batchSize ? undefined : candidates.at(-1)?.id;
    let discovered = 0;
    let publicationAvailable = true;
    for (const request of candidates) {
      if (stopping()) break;
      if (
        await this.discover({
          requestId: request.id,
          scheduleVersion: request.scheduleVersion,
        })
      )
        discovered++;
      if (publicationAvailable) {
        try {
          await publisher.publish({
            requestId: request.id,
            scheduleVersion: request.scheduleVersion,
            dispatchAt: request.dispatchAt.toISOString(),
          });
        } catch {
          publicationAvailable = false;
          logger.warn(
            { code: "WITHDRAWAL_WAKEUP_UNAVAILABLE" },
            "Withdrawal wakeup repair publication failed; database discovery continues.",
          );
        }
      }
    }
    return discovered;
  }
}
