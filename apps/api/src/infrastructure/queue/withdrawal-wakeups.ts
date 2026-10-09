import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import type { WithdrawalQueueConfig } from "../../core/config/withdrawal.config.js";
import { logger } from "../logger/logger.js";

export const withdrawalWakeupSchema = z
  .object({
    requestId: z.uuid(),
    scheduleVersion: z.number().int().positive().max(2147483647),
  })
  .strict();
export type WithdrawalWakeup = z.infer<typeof withdrawalWakeupSchema>;
export type ScheduledWakeup = WithdrawalWakeup & { dispatchAt: string };
export type WithdrawalWakeupPublisher = {
  publish: (wakeup: ScheduledWakeup) => Promise<void>;
};
const QUEUE_NAME = "withdrawal-wakeups";
const queueFailure = () => {
  logger.warn(
    { code: "WITHDRAWAL_WAKEUP_UNAVAILABLE" },
    "Withdrawal wakeup unavailable; database repair remains authoritative.",
  );
};

async function boundedReady(
  readiness: Promise<unknown>,
  timeoutMs: number,
): Promise<void> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      readiness,
      new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error("WITHDRAWAL_WAKEUP_UNAVAILABLE"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

// Postcommit publication cannot revoke a committed reservation or extension.
export async function publishWithdrawalWakeup(
  publisher: WithdrawalWakeupPublisher | undefined,
  request: { id: string; scheduleVersion: number; dispatchAt: string },
): Promise<void> {
  if (publisher === undefined) return;
  try {
    await publisher.publish({
      requestId: request.id,
      scheduleVersion: request.scheduleVersion,
      dispatchAt: request.dispatchAt,
    });
  } catch {
    queueFailure();
  }
}

export class WithdrawalWakeups implements WithdrawalWakeupPublisher {
  readonly queue: Queue<WithdrawalWakeup>;
  private readonly connection: Redis;
  constructor(private readonly config: WithdrawalQueueConfig) {
    this.connection = new Redis(config.redisUrl, {
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: config.producerTimeoutMs,
      commandTimeout: config.producerTimeoutMs,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2000),
    });
    this.connection.on("error", queueFailure);
    this.queue = new Queue<WithdrawalWakeup>(QUEUE_NAME, {
      connection: this.connection,
      prefix: config.prefix,
    });
    this.queue.on("error", queueFailure);
  }
  async ready(): Promise<void> {
    await boundedReady(
      this.queue.waitUntilReady(),
      this.config.producerTimeoutMs,
    );
  }
  async publish(wakeup: ScheduledWakeup): Promise<void> {
    const payload = withdrawalWakeupSchema.parse({
      requestId: wakeup.requestId,
      scheduleVersion: wakeup.scheduleVersion,
    });
    const timestamp = z.iso.datetime().parse(wakeup.dispatchAt);
    await this.ready();
    await this.queue.add("due", payload, {
      jobId: `withdrawal-${payload.requestId}-${String(payload.scheduleVersion)}`,
      delay: Math.max(0, new Date(timestamp).getTime() - Date.now()),
      attempts: this.config.jobAttempts,
      backoff: { type: "exponential", delay: this.config.retryDelayMs },
      removeOnComplete: { count: this.config.retainedJobs },
      removeOnFail: { count: this.config.retainedJobs },
    });
  }
  async close(): Promise<void> {
    this.connection.disconnect();
    await this.queue.close();
  }
}

export class WithdrawalWakeupConsumer {
  readonly worker: Worker<WithdrawalWakeup, boolean>;
  private readonly connection: Redis;
  private stopping = false;
  private readonly discoveries = new Set<Promise<boolean>>();
  constructor(
    private readonly config: WithdrawalQueueConfig,
    discover: (payload: unknown) => Promise<boolean>,
  ) {
    this.connection = new Redis(config.redisUrl, {
      maxRetriesPerRequest: null,
      connectTimeout: config.producerTimeoutMs,
      retryStrategy: (attempt) => Math.min(attempt * 100, 2000),
    });
    this.connection.on("error", queueFailure);
    this.worker = new Worker<WithdrawalWakeup, boolean>(
      QUEUE_NAME,
      async (job) => {
        if (this.stopping) return false;
        const discovery = discover(job.data);
        this.discoveries.add(discovery);
        try {
          return await discovery;
        } finally {
          this.discoveries.delete(discovery);
        }
      },
      { connection: this.connection, prefix: config.prefix, concurrency: 1 },
    );
    this.worker.on("error", queueFailure);
    this.worker.on("failed", queueFailure);
  }
  async ready(): Promise<void> {
    await boundedReady(
      this.worker.waitUntilReady(),
      this.config.producerTimeoutMs,
    );
  }
  async close(): Promise<void> {
    this.stopping = true;
    try {
      // Finish owned database transactions before closing Redis, including during outage.
      await Promise.allSettled([...this.discoveries]);
      await this.worker.close(true);
    } finally {
      this.connection.disconnect();
    }
  }
}
