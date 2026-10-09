import { describe, expect, it } from "vitest";
import { once } from "node:events";
import { z } from "zod";
import type { DatabaseClient } from "@template/database";
import { withWithdrawalDatabase } from "./testing/withdrawal-fixtures.js";
import { withWithdrawalRedis } from "./testing/redis-harness.js";
import {
  reservationEmployee,
  reservationServices,
  RESERVATION_NOW,
} from "./testing/withdrawal-reservation-fixtures.js";
import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { parseWithdrawalQueueEnvironment } from "../../core/config/withdrawal.config.js";
import {
  WithdrawalWakeups,
  WithdrawalWakeupConsumer,
} from "../../infrastructure/queue/withdrawal-wakeups.js";
import { WithdrawalScheduler } from "./withdrawal-scheduler.js";
import {
  withWithdrawalRole,
  admitWithdrawalRuntimeFixture,
} from "./testing/withdrawal-authority-fixtures.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { WithdrawalsService } from "./withdrawals.service.js";

async function dueWithdrawal(database: DatabaseClient) {
  const acceptedAt = new Date(Date.now() - 7 * 86400000);
  const employee = await reservationEmployee(database, {
    nonReferral: "100",
    now: acceptedAt,
  });
  const services = reservationServices(database, () => acceptedAt);
  const quote = await services.quotes.create(employee.identity, {
    gross: "100",
  });
  const accepted = await services.reservations.accept(employee.identity, {
    quoteId: quote.quoteId,
    confirmed: true,
  });
  return { employee, accepted };
}

describe("repairable withdrawal wakeups", () => {
  it("repairs database discovery and closes owned clients while Redis is unavailable", async () => {
    await withWithdrawalRedis(async (redis) =>
      withWithdrawalDatabase(async (database) => {
        const { accepted } = await dueWithdrawal(database);
        const config = parseWithdrawalQueueEnvironment({
          WITHDRAWAL_REDIS_URL: redis.url,
          WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
          WITHDRAWAL_PRODUCER_TIMEOUT_MS: "500",
        });
        const scheduler = new WithdrawalScheduler(
          database,
          financialFixtureAdmission(database),
          () => new Date(),
          1,
        );
        const producer = new WithdrawalWakeups(config);
        const consumer = new WithdrawalWakeupConsumer(config, (payload) =>
          scheduler.discover(payload),
        );
        try {
          await producer.ready();
          await consumer.ready();
          await redis.stop();
          await expect(
            producer.publish({
              requestId: accepted.withdrawal.id,
              scheduleVersion: 1,
              dispatchAt: accepted.withdrawal.dispatchAt,
            }),
          ).rejects.toThrow();
          expect(await scheduler.repair(producer)).toBe(1);
          expect(
            (
              await database.withdrawalRequest.findUniqueOrThrow({
                where: { id: accepted.withdrawal.id },
              })
            ).nextCheckAt,
          ).not.toBeNull();
          expect(
            await database.financialOperation.count({
              where: { kind: "RELEASE" },
            }),
          ).toBe(0);
        } finally {
          try {
            await consumer.close();
          } finally {
            await producer.close();
          }
        }
      }),
    );
  });
  it("repairs missing work after queue loss and Redis/consumer restart under real worker grants", async () => {
    await withWithdrawalRedis(async (redis) =>
      withWithdrawalDatabase(async (database, databaseUrl) => {
        const { accepted } = await dueWithdrawal(database);
        let config = parseWithdrawalQueueEnvironment({
          WITHDRAWAL_REDIS_URL: redis.url,
          WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
        });
        const original = new WithdrawalWakeups(config);
        try {
          await original.publish({
            requestId: accepted.withdrawal.id,
            scheduleVersion: 1,
            dispatchAt: new Date(Date.now() + 86400000).toISOString(),
          });
        } finally {
          await original.close();
        }
        await redis.flush();
        await redis.restart();
        config = parseWithdrawalQueueEnvironment({
          WITHDRAWAL_REDIS_URL: redis.url,
          WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
        });
        await withWithdrawalRole(
          { database, databaseUrl, role: "p06_deposit_worker" },
          async (worker) => {
            const admission = await admitWithdrawalRuntimeFixture(
              database,
              worker,
              "DEPOSIT_WORKER",
            );
            const scheduler = new WithdrawalScheduler(
              worker,
              admission,
              () => new Date(),
              config.batchSize,
            );
            const producer = new WithdrawalWakeups(config);
            const consumer = new WithdrawalWakeupConsumer(config, (payload) =>
              scheduler.discover(payload),
            );
            try {
              await consumer.ready();
              const completed = once(consumer.worker, "completed", {
                signal: AbortSignal.timeout(15000),
              });
              expect(await scheduler.repair(producer)).toBe(1);
              await completed;
              const request =
                await database.withdrawalRequest.findUniqueOrThrow({
                  where: { id: accepted.withdrawal.id },
                });
              expect(request.nextCheckAt).not.toBeNull();
              expect(request).toMatchObject({
                state: "SCHEDULED",
                version: 1,
                scheduleVersion: 1,
                recipient: accepted.withdrawal.recipient,
              });
              expect(await database.withdrawalAction.count()).toBe(1);
              expect(
                await database.financialOperation.count({
                  where: { kind: "RELEASE" },
                }),
              ).toBe(0);
              expect(
                await scheduler.discover({
                  requestId: request.id,
                  scheduleVersion: 1,
                }),
              ).toBe(false);
              await expect(
                worker.withdrawalRequest.update({
                  where: { id: request.id },
                  data: { state: "SIGNING", version: 2 },
                }),
              ).rejects.toThrow();
              await expect(
                worker.withdrawalAction.create({
                  data: {
                    requestId: request.id,
                    actorProcessId: "hostile-worker",
                    actorScope: "process:hostile-worker",
                    kind: "CLAIM",
                    intentHash: "a".repeat(64),
                    expectedVersion: 1,
                    committedVersion: 2,
                    occurredAt: new Date(),
                    afterState: "SIGNING",
                    afterDueAt: request.dueAt,
                    afterScheduleVersion: 1,
                  },
                }),
              ).rejects.toThrow();
              await expect(
                worker.withdrawalDestination.count(),
              ).rejects.toThrow();
              await expect(
                worker.user.findFirst({ select: { passwordHash: true } }),
              ).rejects.toThrow();
              await expect(
                worker.financialRuntimeControl.update({
                  where: { id: 1 },
                  data: { financialWritesFenced: false },
                }),
              ).rejects.toThrow();
              const job = await producer.queue.getJob(
                `withdrawal-${request.id}-1`,
              );
              expect(job?.data).toEqual({
                requestId: request.id,
                scheduleVersion: 1,
              });
            } finally {
              await consumer.close();
              await producer.close();
            }
          },
        );
      }),
    );
  });
  it("makes an old due job harmless after extension and preserves a future backoff", async () => {
    await withWithdrawalRedis(async (redis) =>
      withWithdrawalDatabase(async (database, databaseUrl) => {
        const { accepted } = await dueWithdrawal(database);
        const admin = await createIdentityFixture(database, { role: "ADMIN" });
        const config = parseWithdrawalQueueEnvironment({
          WITHDRAWAL_REDIS_URL: redis.url,
          WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
        });
        await withWithdrawalRole(
          { database, databaseUrl, role: "p06_deposit_worker" },
          async (worker) => {
            const admission = await admitWithdrawalRuntimeFixture(
              database,
              worker,
              "DEPOSIT_WORKER",
            );
            const scheduler = new WithdrawalScheduler(
              worker,
              admission,
              () => new Date(),
              config.batchSize,
            );
            const producer = new WithdrawalWakeups(config);
            const consumer = new WithdrawalWakeupConsumer(config, (payload) =>
              scheduler.discover(payload),
            );
            try {
              await producer.ready();
              await producer.queue.pause();
              await consumer.ready();
              await scheduler.repair(producer);
              const extended = await new WithdrawalsService(
                database,
                () => new Date(),
                financialFixtureAdmission(database),
                producer,
              ).extend(
                { userId: admin.user.id, sessionId: admin.session.id },
                accepted.withdrawal.id,
                {
                  expectedVersion: 1,
                  countedHours: "240",
                  confirmed: true,
                  reason: "New current deadline",
                },
                "extend-before-old-job",
              );
              const completed = once(consumer.worker, "completed", {
                signal: AbortSignal.timeout(15000),
              });
              await producer.queue.resume();
              expect(z.array(z.unknown()).parse(await completed)[1]).toBe(
                false,
              );
              const request =
                await database.withdrawalRequest.findUniqueOrThrow({
                  where: { id: accepted.withdrawal.id },
                });
              expect(request).toMatchObject({
                scheduleVersion: 2,
                nextCheckAt: null,
                dueAt: new Date(extended.withdrawal.dueAt),
                originalDueAt: new Date(accepted.withdrawal.originalDueAt),
              });
              const future = new Date(request.dispatchAt.getTime() + 3600000);
              // Future protected retry metadata is fixture input; no Group B retry workflow is implemented here.
              await database.$transaction(async (transaction) => {
                await transaction.$executeRawUnsafe(
                  "ALTER TABLE withdrawal_requests DISABLE TRIGGER guard_p08_request",
                );
                await transaction.withdrawalRequest.update({
                  where: { id: request.id },
                  data: { nextCheckAt: future },
                });
                await transaction.$executeRawUnsafe(
                  "SET CONSTRAINTS ALL IMMEDIATE",
                );
                await transaction.$executeRawUnsafe(
                  "ALTER TABLE withdrawal_requests ENABLE TRIGGER guard_p08_request",
                );
              });
              expect(
                await scheduler.discover({
                  requestId: request.id,
                  scheduleVersion: 2,
                }),
              ).toBe(false);
              await scheduler.repair(producer);
              expect(
                (
                  await database.withdrawalRequest.findUniqueOrThrow({
                    where: { id: request.id },
                  })
                ).nextCheckAt,
              ).toEqual(future);
              expect(
                await database.financialOperation.count({
                  where: { kind: "RELEASE" },
                }),
              ).toBe(0);
            } finally {
              await consumer.close();
              await producer.close();
            }
          },
        );
      }),
    );
  });
  it("duplicate independent workers discover once, and a fenced boot cannot write a hint", async () => {
    await withWithdrawalRedis(async (redis) =>
      withWithdrawalDatabase(async (database, databaseUrl) => {
        const { accepted } = await dueWithdrawal(database);
        const config = parseWithdrawalQueueEnvironment({
          WITHDRAWAL_REDIS_URL: redis.url,
          WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
        });
        await withWithdrawalRole(
          { database, databaseUrl, role: "p06_deposit_worker" },
          async (first) =>
            withWithdrawalRole(
              { database, databaseUrl, role: "p06_deposit_worker" },
              async (second) => {
                const firstAdmission = await admitWithdrawalRuntimeFixture(
                  database,
                  first,
                  "DEPOSIT_WORKER",
                );
                const secondAdmission = await admitWithdrawalRuntimeFixture(
                  database,
                  second,
                  "DEPOSIT_WORKER",
                );
                const one = new WithdrawalScheduler(
                  first,
                  firstAdmission,
                  () => new Date(),
                  1,
                );
                const two = new WithdrawalScheduler(
                  second,
                  secondAdmission,
                  () => new Date(),
                  1,
                );
                const producer = new WithdrawalWakeups(config);
                const consumerOne = new WithdrawalWakeupConsumer(
                  config,
                  (payload) => one.discover(payload),
                );
                const consumerTwo = new WithdrawalWakeupConsumer(
                  config,
                  (payload) => two.discover(payload),
                );
                const listening = new AbortController();
                try {
                  await Promise.all([consumerOne.ready(), consumerTwo.ready()]);
                  const completion = Promise.any([
                    once(consumerOne.worker, "completed", {
                      signal: listening.signal,
                    }),
                    once(consumerTwo.worker, "completed", {
                      signal: listening.signal,
                    }),
                  ]);
                  const start = (
                    await import("./testing/withdrawal-fixtures.js")
                  ).withdrawalRaceBarrier(2);
                  const counts = await Promise.all([
                    (async () => {
                      await start();
                      return one.repair(producer);
                    })(),
                    (async () => {
                      await start();
                      return two.repair(producer);
                    })(),
                  ]);
                  await completion;
                  expect(counts.reduce((sum, count) => sum + count, 0)).toBe(1);
                  expect(await database.withdrawalAction.count()).toBe(1);
                  await expect(
                    one.discover({
                      requestId: accepted.withdrawal.id,
                      scheduleVersion: 1,
                      state: "SIGNING",
                    }),
                  ).rejects.toThrow();
                  await database.financialRuntimeControl.update({
                    where: { id: 1 },
                    data: {
                      financialWritesFenced: true,
                      newDispatchPaused: true,
                      generation: { increment: 1 },
                      version: { increment: 1 },
                      operatorIdentity: "disposable-test-recovery",
                      reason: "Fence test",
                      updatedAt: new Date(),
                    },
                  });
                  await expect(
                    two.discover({
                      requestId: accepted.withdrawal.id,
                      scheduleVersion: 1,
                    }),
                  ).rejects.toMatchObject({ code: "FINANCIAL_WRITES_FENCED" });
                  expect(
                    (
                      await database.withdrawalRequest.findUniqueOrThrow({
                        where: { id: accepted.withdrawal.id },
                      })
                    ).state,
                  ).toBe("SCHEDULED");
                } finally {
                  listening.abort();
                  await consumerOne.close();
                  await consumerTwo.close();
                  await producer.close();
                }
              },
            ),
        );
      }),
    );
  });
  it("repairs future publication through real Redis without writing an early hint", async () => {
    await withWithdrawalRedis(async (redis) =>
      withWithdrawalDatabase(async (database) => {
        const employee = await reservationEmployee(database, {
          nonReferral: "100",
        });
        const services = reservationServices(database);
        const quote = await services.quotes.create(employee.identity, {
          gross: "100",
        });
        const accepted = await services.reservations.accept(employee.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        });
        const config = parseWithdrawalQueueEnvironment({
          WITHDRAWAL_REDIS_URL: redis.url,
          WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
        });
        const producer = new WithdrawalWakeups(config);
        const scheduler = new WithdrawalScheduler(
          database,
          financialFixtureAdmission(database),
          () => RESERVATION_NOW,
          config.batchSize,
        );
        try {
          expect(await producer.queue.getJobCounts()).toMatchObject({
            waiting: 0,
            delayed: 0,
          });
          await scheduler.repair(producer);
          const job = await producer.queue.getJob(
            `withdrawal-${accepted.withdrawal.id}-1`,
          );
          expect(job?.data).toEqual({
            requestId: accepted.withdrawal.id,
            scheduleVersion: 1,
          });
          expect(await scheduler.discover(job?.data)).toBe(false);
          expect(
            (
              await database.withdrawalRequest.findUniqueOrThrow({
                where: { id: accepted.withdrawal.id },
              })
            ).nextCheckAt,
          ).toBeNull();
          expect(
            await database.financialOperation.count({
              where: { kind: "RELEASE" },
            }),
          ).toBe(0);
        } finally {
          await producer.close();
        }
      }),
    );
  });
});
