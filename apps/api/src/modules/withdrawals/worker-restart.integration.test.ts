import { describe, expect, it } from "vitest";
import {
  withPayoutFixture,
  admitPayoutPeer,
  interruptBroadcastRecord,
} from "./testing/withdrawal-payout-fixtures.js";
import { withWithdrawalRedis } from "./testing/redis-harness.js";
import { WithdrawalPayoutRuntime } from "./withdrawal-runtime.js";
import { WithdrawalRecovery } from "./withdrawal-recovery.js";
import { RuntimeSignals } from "../../infrastructure/logger/runtime-signals.js";
import { createLogger } from "../../infrastructure/logger/logger.js";
import {
  parseWithdrawalQueueEnvironment,
  parseWithdrawalSignerEnvironment,
} from "../../core/config/withdrawal.config.js";
import { WithdrawalWakeups } from "../../infrastructure/queue/withdrawal-wakeups.js";
import { withWithdrawalRole } from "./testing/withdrawal-authority-fixtures.js";
import { withdrawalRaceBarrier } from "./testing/withdrawal-fixtures.js";
import {
  fenceFinancialRuntime,
  changeDispatchPause,
} from "../custody/runtime-control.js";
import { WithdrawalAttempts } from "./withdrawal-attempts.js";
import { WithdrawalScheduler } from "./withdrawal-scheduler.js";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import { z } from "zod";
import { retainedSignedPayout } from "./withdrawal-payout.records.js";

function signalSink(clock: () => Date) {
  const output: string[] = [];
  const signals = new RuntimeSignals(
    createLogger({
      level: "info",
      pretty: false,
      destination: {
        write(chunk) {
          output.push(chunk);
        },
      },
    }),
    clock,
  );
  return { signals, output };
}
const signalEvents = (output: string[]) =>
  output.map((line) =>
    z
      .object({
        level: z.number(),
        time: z.number(),
        pid: z.number(),
        hostname: z.string(),
        msg: z.string(),
        event: z.string(),
        state: z.string(),
        timestamp: z.string(),
        processKind: z.literal("SIGNER"),
        withdrawalId: z.uuid().optional(),
        code: z.string().optional(),
        ageMs: z.number().optional(),
      })
      .strict()
      .parse(JSON.parse(line)),
  );

function runtime(
  fixture: Parameters<Parameters<typeof withPayoutFixture>[0]>[0],
  clock: () => Date = () => new Date(),
  attempts: WithdrawalAttempts = fixture.attempts(),
  options: {
    signals?: RuntimeSignals;
    config?: ReturnType<typeof parseWithdrawalSignerEnvironment>;
  } = {},
) {
  return new WithdrawalPayoutRuntime({
    database: fixture.signer,
    admission: fixture.admission,
    attempts,
    recovery: new WithdrawalRecovery(fixture.signer, fixture.stores),
    archive: fixture.stores.archive,
    treasuryKeyId: fixture.key.id,
    config: options.config ?? parseWithdrawalSignerEnvironment({}),
    signals:
      options.signals ??
      new RuntimeSignals(createLogger({ level: "silent" }), clock),
    clock,
  });
}

describe("payout discovery and owner restart", () => {
  it("keeps a committed pre-file intent blocked across restart until independent recovery admits its original bytes", async () =>
    withPayoutFixture(async (fixture) => {
      const original = await interruptBroadcastRecord(fixture);
      if (original.broadcastIntentId === null)
        throw new Error("Expected committed broadcast identity");
      const retained = await retainedSignedPayout(
        fixture.stores,
        fixture.request,
        original,
      );
      const sink = signalSink(() => new Date());
      await runtime(fixture, () => new Date(), fixture.attempts(), sink).tick(
        () => false,
      );
      expect(signalEvents(sink.output)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            event: "RECOVERY_UNAVAILABLE",
            state: "ACTIVE",
          }),
        ]),
      );
      expect(
        await fixture.stores.keys.readRecord(original.broadcastIntentId),
      ).toBeNull();
      expect(fixture.sent).toHaveLength(0);
      await fenceFinancialRuntime(fixture.operator, {
        operatorIdentity: "independent-restart",
        reason: "Complete original committed record",
      });
      await new WithdrawalRecovery(
        fixture.operator,
        fixture.stores,
      ).completeUnacknowledgedBroadcasts(await fixture.recoveredHistory());
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toEqual(original);
      expect(fixture.sent).toHaveLength(0);
      await admitPayoutPeer(fixture, fixture.signer, "SIGNER");
      let now = new Date();
      const restarted = runtime(fixture, () => now);
      await restarted.tick(() => false);
      expect(fixture.sent).toEqual([retained.record.transaction]);
      now = new Date(now.getTime() + 30001);
      await restarted.tick(() => false);
      const completed =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        });
      expect(completed).toMatchObject({
        state: "CONFIRMED_SUCCESS",
        transactionId: original.transactionId,
        recipient: original.recipient,
        broadcastIntentId: original.broadcastIntentId,
        broadcastAdmittedAt: original.broadcastAdmittedAt,
        signedDigest: original.signedDigest,
      });
      expect(fixture.built()).toBe(1);
      expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({
        state: "SETTLED",
        nonReferralUnits: 70000000n,
        referralUnits: 30000000n,
      });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE", businessKey: fixture.request.id },
        }),
      ).toBe(1);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE", businessKey: fixture.request.id },
        }),
      ).toBe(0);
      await runtime(fixture, () => now).tick(() => false);
      expect(fixture.sent).toHaveLength(1);
    }));
  it("alerts at the saved dispatch-age threshold, bounds reminders and clears pending work after settlement", async () =>
    withPayoutFixture(async (fixture) => {
      const attempts = fixture.attempts();
      await attempts.sign(fixture.request.id);
      fixture.loseReply();
      fixture.outcome("MISSING");
      await attempts.broadcast(fixture.request.id);
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      let now = new Date(fixture.request.dispatchAt.getTime() + 900);
      const sink = signalSink(() => now);
      const config = parseWithdrawalSignerEnvironment({
        WITHDRAWAL_PENDING_ALERT_AFTER_MS: "1000",
        WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS: "100",
        WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS: "1000",
      });
      const signer = runtime(fixture, () => now, attempts, { ...sink, config });
      const pending = () =>
        signalEvents(sink.output).filter(
          (entry) => entry.event === "PENDING_WORK",
        );
      await signer.tick(() => false);
      expect(pending()).toEqual([]);
      now = new Date(now.getTime() + 100);
      await signer.tick(() => false);
      expect(pending()).toEqual([
        expect.objectContaining({ state: "ACTIVE", ageMs: 1000 }),
      ]);
      now = new Date(now.getTime() + 299999);
      await signer.tick(() => false);
      expect(pending()).toHaveLength(1);
      now = new Date(now.getTime() + 100);
      await signer.tick(() => false);
      expect(pending().map((entry) => entry.state)).toEqual([
        "ACTIVE",
        "REMINDER",
      ]);
      now = new Date(now.getTime() + 100);
      await signer.tick(() => false);
      expect(pending()).toHaveLength(2);
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toEqual(original);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({
        dispatchAt: fixture.request.dispatchAt,
        state: "UNKNOWN",
        nextCheckAt: original.nextCheckAt,
      });
      fixture.outcome("SUCCESS");
      now = new Date(
        Math.max(now.getTime() + 100, original.nextCheckAt.getTime() + 1),
      );
      await signer.tick(() => false);
      now = new Date(now.getTime() + 100);
      await signer.tick(() => false);
      expect(pending().map((entry) => entry.state)).toEqual([
        "ACTIVE",
        "REMINDER",
        "REMINDER",
        "CLEARED",
      ]);
      now = new Date(now.getTime() + 100);
      await signer.tick(() => false);
      expect(pending()).toHaveLength(4);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({
        state: "COMPLETED",
        dispatchAt: fixture.request.dispatchAt,
      });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE" },
        }),
      ).toBe(1);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE" },
        }),
      ).toBe(0);
      expect(fixture.sent).toHaveLength(1);
      expect(fixture.sent[0]?.txID).toBe(original.transactionId);
      expect(fixture.built()).toBe(1);
      expect(sink.output.join("")).not.toMatch(
        /raw_data|signature|privateKey|proofHash|databaseUrl|password|https:\/\//u,
      );
    }));
  it.each(["LIQUIDITY_SHORTFALL", "RESOURCE_SHORTFALL"] as const)(
    "reports and independently clears %s alongside original payout uncertainty",
    async (blocker) =>
      withPayoutFixture(async (fixture) => {
        let now = new Date();
        const sink = signalSink(() => now);
        const signer = runtime(fixture, () => now, fixture.attempts(), sink);
        const states = (event: string) =>
          signalEvents(sink.output)
            .filter(
              (entry) =>
                entry.event === event &&
                entry.withdrawalId === fixture.request.id,
            )
            .map((entry) => entry.state);
        fixture.loseReply();
        fixture.outcome("MISSING");
        await signer.tick(() => false);
        const original =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        const account = fixture.provider.sweepAccount;
        if (blocker === "LIQUIDITY_SHORTFALL") fixture.liquidity(0n);
        else
          fixture.provider.sweepAccount = async (address) => ({
            ...(await account(address)),
            balance: 0,
          });
        now = new Date(original.nextCheckAt.getTime() + 1);
        await signer.tick(() => false);
        expect(states(blocker)).toEqual(["ACTIVE"]);
        expect(states("UNRESOLVED_ATTEMPT")).toEqual(["ACTIVE"]);
        const count = sink.output.length;
        now = new Date(now.getTime() + 1001);
        await signer.tick(() => false);
        expect(sink.output).toHaveLength(count);
        now = new Date(now.getTime() + 300000);
        await signer.tick(() => false);
        expect(states(blocker)).toEqual(["ACTIVE", "REMINDER"]);
        expect(states("UNRESOLVED_ATTEMPT")).toEqual(["ACTIVE", "REMINDER"]);
        fixture.liquidity(500000000n);
        fixture.provider.sweepAccount = account;
        now = new Date(now.getTime() + 1001);
        await signer.tick(() => false);
        expect(states(blocker)).toEqual(["ACTIVE", "REMINDER", "CLEARED"]);
        expect(states("UNRESOLVED_ATTEMPT")).toEqual(["ACTIVE", "REMINDER"]);
        expect(
          await fixture.database.withdrawalRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
          }),
        ).toMatchObject({
          state: "UNKNOWN",
          releaseOperationId: null,
          settlementOperationId: null,
        });
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({
          state: "ACTIVE",
          nonReferralUnits: 70000000n,
          referralUnits: 30000000n,
        });
        fixture.outcome("SUCCESS");
        now = new Date(now.getTime() + 1001);
        await signer.tick(() => false);
        expect(states(blocker)).toEqual(["ACTIVE", "REMINDER", "CLEARED"]);
        expect(states("UNRESOLVED_ATTEMPT")).toEqual([
          "ACTIVE",
          "REMINDER",
          "CLEARED",
        ]);
        expect(fixture.built()).toBe(1);
        expect(new Set(fixture.sent.map((signed) => signed.txID))).toEqual(
          new Set([original.transactionId]),
        );
        expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
        expect(
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { id: original.id },
          }),
        ).toMatchObject({
          state: "CONFIRMED_SUCCESS",
          transactionId: original.transactionId,
          signedDigest: original.signedDigest,
          recipient: fixture.request.recipient,
          netUnits: 79000000n,
        });
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: "SETTLE" },
          }),
        ).toBe(1);
        expect(
          await fixture.database.financialOperation.count({
            where: { kind: "RELEASE" },
          }),
        ).toBe(0);
        expect(sink.output.join("")).not.toMatch(
          /raw_data|signature|privateKey|proofHash|databaseUrl|password|https:\/\/|test-only-payout-provider/u,
        );
      }),
  );
  it("keeps the signer alive through malformed original receipt evidence and settles once after recovery", async () =>
    withPayoutFixture(async (fixture) => {
      let now = new Date();
      const signer = runtime(fixture, () => now);
      fixture.loseReply();
      fixture.outcome("MISSING");
      await signer.tick(() => false);
      const original =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      fixture.outcome("MALFORMED");
      now = new Date(original.nextCheckAt.getTime() + 1);
      const [failureClock] = await fixture.database.$queryRaw<
        { now: Date }[]
      >`SELECT clock_timestamp() AS now`;
      if (failureClock === undefined) throw new Error("Missing failure clock");
      await expect(signer.tick(() => false)).resolves.toBeUndefined();
      const blocked =
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        });
      expect(blocked).toMatchObject({
        state: "UNKNOWN",
        blocker: "EVIDENCE_CONFLICT",
        settlementOperationId: null,
        releaseOperationId: null,
      });
      expect(blocked.nextCheckAt?.getTime()).toBeGreaterThanOrEqual(
        Math.max(
          original.nextCheckAt.getTime(),
          failureClock.now.getTime() + 30000,
        ),
      );
      expect(
        await fixture.database.reservationAllocation.findUniqueOrThrow({
          where: { id: fixture.request.reservationId },
        }),
      ).toMatchObject({
        state: "ACTIVE",
        nonReferralUnits: 70000000n,
        referralUnits: 30000000n,
      });
      expect(
        await fixture.database.withdrawalAttempt.findMany({
          where: {
            treasuryKeyId: fixture.key.id,
            state: { notIn: ["CONFIRMED_SUCCESS", "CHAIN_FAILED"] },
          },
          select: { id: true },
        }),
      ).toEqual([{ id: original.id }]);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: { in: ["SETTLE", "RELEASE"] } },
        }),
      ).toBe(0);
      expect(fixture.sent).toHaveLength(1);
      expect(fixture.built()).toBe(1);
      fixture.outcome("SUCCESS");
      now = new Date(
        Math.max(now.getTime() + 1001, blocked.nextCheckAt?.getTime() ?? 0),
      );
      await signer.tick(() => false);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({
        state: "COMPLETED",
        recipient: fixture.request.recipient,
      });
      expect(
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { id: original.id },
        }),
      ).toMatchObject({
        state: "CONFIRMED_SUCCESS",
        transactionId: original.transactionId,
        signedDigest: original.signedDigest,
      });
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "SETTLE" },
        }),
      ).toBe(1);
      expect(
        await fixture.database.financialOperation.count({
          where: { kind: "RELEASE" },
        }),
      ).toBe(0);
      expect(fixture.sent).toHaveLength(1);
      expect(fixture.built()).toBe(1);
    }));
  it.each([
    { guard: "PAUSE", blocker: "DISPATCH_PAUSED" },
    { guard: "FENCE", blocker: "UNRESOLVED_ATTEMPT" },
    { guard: "WEEKEND", blocker: "DISPATCH_PAUSED" },
    { guard: "EXPIRED", blocker: "DISPATCH_PAUSED" },
    { guard: "CONFLICT", blocker: "EVIDENCE_CONFLICT" },
    { guard: "LIQUIDITY", blocker: "LIQUIDITY_SHORTFALL" },
    { guard: "RESOURCE", blocker: "RESOURCE_SHORTFALL" },
  ] as const)(
    "does not retransmit an acknowledged original during $guard and retains its reservation and lane",
    async ({ guard, blocker }) =>
      withPayoutFixture(async (fixture) => {
        if (guard === "WEEKEND")
          await fixture.setTime(new Date("2026-10-09T20:59:58Z"));
        let now = new Date();
        const attempts = fixture.attempts();
        const signer = runtime(fixture, () => now, attempts);
        fixture.loseReply();
        fixture.outcome("MISSING");
        await signer.tick(() => false);
        const original =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        expect(original.broadcastAckId).not.toBeNull();
        expect(original.expiration).not.toBeNull();
        expect(fixture.sent).toHaveLength(1);
        if (guard === "PAUSE")
          await changeDispatchPause(fixture.operator, {
            action: "PAUSE",
            operatorIdentity: "test-operator",
            reason: "Block original retransmission",
          });
        if (guard === "FENCE")
          await fenceFinancialRuntime(fixture.operator, {
            operatorIdentity: "test-operator",
            reason: "Deny retained attempt writes",
          });
        if (guard === "CONFLICT") fixture.outcome("WRONG_NET");
        if (guard === "LIQUIDITY") fixture.liquidity(0n);
        if (guard === "RESOURCE") {
          const account = fixture.provider.sweepAccount;
          fixture.provider.sweepAccount = async (address) => ({
            ...(await account(address)),
            balance: 0,
          });
        }
        if (guard === "WEEKEND" || guard === "EXPIRED") {
          // Cross Baghdad midnight during the original lifetime to isolate calendar denial.
          await fixture.setTime(
            guard === "WEEKEND"
              ? new Date(original.nextCheckAt.getTime() + 1)
              : new Date(Number(original.expiration)),
          );
          if (guard === "WEEKEND")
            expect(Date.now()).toBeLessThan(Number(original.expiration));
        }
        now = new Date(original.nextCheckAt.getTime() + 1);
        await signer.tick(() => false);
        now = new Date(now.getTime() + 1001);
        await signer.tick(() => false);
        expect(fixture.sent).toHaveLength(1);
        expect(fixture.built()).toBe(1);
        expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
        expect(
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { id: original.id },
          }),
        ).toMatchObject({
          state: "UNKNOWN",
          transactionId: original.transactionId,
          signedDigest: original.signedDigest,
          broadcastAckId: original.broadcastAckId,
        });
        expect(
          await fixture.database.withdrawalRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
          }),
        ).toMatchObject({
          state: "UNKNOWN",
          blocker,
          releaseOperationId: null,
          settlementOperationId: null,
        });
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({
          state: "ACTIVE",
          nonReferralUnits: 70000000n,
          referralUnits: 30000000n,
        });
      }),
  );

  it.each(["UNAVAILABLE", "REJECTED"] as const)(
    "retries the acknowledged original after a provider %s before acceptance and settles once",
    async (failure) =>
      withPayoutFixture(async (fixture) => {
        let now = new Date();
        const signer = runtime(fixture, () => now);
        const send = fixture.provider.broadcastTransfer;
        const bodies: string[] = [];
        fixture.provider.broadcastTransfer = async (signed) => {
          bodies.push(JSON.stringify(signed));
          if (bodies.length === 1) {
            if (failure === "UNAVAILABLE")
              throw new TronProviderError("TRON_UNAVAILABLE");
            return false;
          }
          return send(signed);
        };
        await signer.tick(() => false);
        const original =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        expect(original.broadcastAckId).not.toBeNull();
        expect(original.state).toBe("UNKNOWN");
        expect(fixture.sent).toHaveLength(0);
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({
          state: "ACTIVE",
          nonReferralUnits: 70000000n,
          referralUnits: 30000000n,
        });
        now = new Date(now.getTime() + 1000);
        await signer.tick(() => false);
        expect(bodies).toHaveLength(1);
        now = new Date(original.nextCheckAt.getTime() + 1);
        await signer.tick(() => false);
        expect(fixture.sent).toHaveLength(1);
        expect(bodies).toHaveLength(2);
        expect(new Set(bodies).size).toBe(1);
        const retried =
          await fixture.database.withdrawalAttempt.findUniqueOrThrow({
            where: { withdrawalId: fixture.request.id },
          });
        now = new Date(retried.nextCheckAt.getTime() + 1001);
        await signer.tick(() => false);
        expect(
          await fixture.database.withdrawalRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
          }),
        ).toMatchObject({ state: "COMPLETED", releaseOperationId: null });
        expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
        expect(fixture.built()).toBe(1);
        expect(fixture.sent[0]?.txID).toBe(original.transactionId);
        expect(
          await fixture.database.financialOperation.count({
            where: {
              kind: "SETTLE",
              businessNamespace: "p08.withdrawal.settle",
              businessKey: fixture.request.id,
            },
          }),
        ).toBe(1);
      }),
  );

  it("lets independently admitted signer owners race into one immutable attempt and treasury lane", async () =>
    withPayoutFixture(async (fixture) =>
      withWithdrawalRole(
        {
          database: fixture.database,
          databaseUrl: fixture.databaseUrl,
          role: "p06_signer",
        },
        async (peer) => {
          fixture.loseReply();
          fixture.outcome("MISSING");
          const admission = await admitPayoutPeer(fixture, peer, "SIGNER");
          const clock = () => new Date();
          const second = new WithdrawalPayoutRuntime({
            database: peer,
            admission,
            attempts: new WithdrawalAttempts(peer, admission, fixture.config, {
              stores: fixture.stores,
              provider: fixture.provider,
            }),
            recovery: new WithdrawalRecovery(peer, fixture.stores),
            archive: fixture.stores.archive,
            treasuryKeyId: fixture.key.id,
            config: parseWithdrawalSignerEnvironment({}),
            signals: new RuntimeSignals(
              createLogger({ level: "silent" }),
              clock,
            ),
            clock,
          });
          const barrier = withdrawalRaceBarrier(2);
          const floor = fixture.provider.solidifiedFloor;
          let arrivals = 0;
          fixture.provider.solidifiedFloor = async () => {
            if (++arrivals <= 2) await barrier();
            return floor();
          };
          await Promise.all([
            runtime(fixture).tick(() => false),
            second.tick(() => false),
          ]);
          const attempts = await fixture.database.withdrawalAttempt.findMany();
          expect(attempts).toHaveLength(1);
          expect(new Set(fixture.sent.map((signed) => signed.txID))).toEqual(
            new Set([attempts[0]?.transactionId]),
          );
          expect(
            await fixture.database.withdrawalAction.count({
              where: { kind: "CLAIM", requestId: fixture.request.id },
            }),
          ).toBe(1);
          expect(
            await fixture.database.reservationAllocation.findUniqueOrThrow({
              where: { id: fixture.request.reservationId },
            }),
          ).toMatchObject({ state: "ACTIVE" });
        },
      ),
    ));

  it("rejects stale worker revisions and discovers a valid hint between authoritative repair scans", async () =>
    withPayoutFixture(async (fixture) =>
      withWithdrawalRole(
        {
          database: fixture.database,
          databaseUrl: fixture.databaseUrl,
          role: "p06_deposit_worker",
        },
        async (worker) => {
          const admission = await admitPayoutPeer(
            fixture,
            worker,
            "DEPOSIT_WORKER",
          );
          let now = new Date();
          const signer = runtime(fixture, () => now);
          let stopped = false;
          const list = fixture.stores.archive.list;
          fixture.stores.archive.list = async (cursor, type) => {
            const page = await list(cursor, type);
            if (type === "PAYOUT_BROADCAST_INTENT") stopped = true;
            return page;
          };
          await signer.tick(() => stopped);
          fixture.stores.archive.list = list;
          now = new Date(now.getTime() + 1000);
          await signer.tick(() => false);
          expect(fixture.sent).toHaveLength(0);
          const scheduler = new WithdrawalScheduler(
            worker,
            admission,
            () => new Date(),
            20,
          );
          expect(
            await scheduler.discover({
              requestId: fixture.request.id,
              scheduleVersion: fixture.request.scheduleVersion + 1,
            }),
          ).toBe(false);
          expect(
            await scheduler.discover({
              requestId: fixture.request.id,
              scheduleVersion: fixture.request.scheduleVersion,
            }),
          ).toBe(true);
          now = new Date(now.getTime() + 1000);
          await signer.tick(() => false);
          expect(fixture.sent).toHaveLength(1);
          expect(await fixture.database.withdrawalAttempt.count()).toBe(1);
        },
      ),
    ));
  it("dispatches an unhinted due request after actual Redis queue loss without creating a Redis client in the signer", async () =>
    withPayoutFixture(async (fixture) =>
      withWithdrawalRedis(async (redis) => {
        const queue = new WithdrawalWakeups(
          parseWithdrawalQueueEnvironment({
            WITHDRAWAL_REDIS_URL: redis.url,
            WITHDRAWAL_QUEUE_PREFIX: redis.prefix,
          }),
        );
        try {
          await queue.ready();
          await queue.publish({
            requestId: fixture.request.id,
            scheduleVersion: fixture.request.scheduleVersion,
            dispatchAt: fixture.request.dispatchAt.toISOString(),
          });
          await redis.flush();
        } finally {
          await queue.close();
        }
        expect(
          await fixture.database.withdrawalRequest.findUniqueOrThrow({
            where: { id: fixture.request.id },
          }),
        ).toMatchObject({ nextCheckAt: null, state: "SCHEDULED" });
        const signer = runtime(fixture);
        await signer.tick(() => false);
        expect(fixture.sent).toHaveLength(1);
        expect(
          await fixture.database.withdrawalAttempt.count({
            where: { withdrawalId: fixture.request.id },
          }),
        ).toBe(1);
        expect(
          await fixture.database.reservationAllocation.findUniqueOrThrow({
            where: { id: fixture.request.reservationId },
          }),
        ).toMatchObject({ state: "ACTIVE" });
      }),
    ));

  it("preserves future backoff across duplicate scans and a stopped owner without signing", async () =>
    withPayoutFixture(async (fixture) => {
      const future = new Date(Date.now() + 3600000);
      await fixture.database.withdrawalRequest.update({
        where: { id: fixture.request.id },
        data: { nextCheckAt: future },
      });
      const first = runtime(fixture);
      await first.tick(() => true);
      await Promise.all([
        first.tick(() => false),
        runtime(fixture).tick(() => false),
      ]);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "SCHEDULED", nextCheckAt: future });
      expect(await fixture.database.withdrawalAttempt.count()).toBe(0);
      expect(fixture.built()).toBe(0);
      expect(fixture.sent).toHaveLength(0);
    }));

  it("reconciles a retained lost reply before new claims after rebuilding the runtime owner", async () =>
    withPayoutFixture(async (fixture) => {
      fixture.loseReply();
      let now = new Date();
      await runtime(fixture, () => now).tick(() => false);
      expect(fixture.sent).toHaveLength(1);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "UNKNOWN" });
      const pending =
        await fixture.database.withdrawalAttempt.findUniqueOrThrow({
          where: { withdrawalId: fixture.request.id },
        });
      now = new Date(pending.nextCheckAt.getTime() + 1);
      await runtime(fixture, () => now).tick(() => false);
      expect(
        await fixture.database.withdrawalRequest.findUniqueOrThrow({
          where: { id: fixture.request.id },
        }),
      ).toMatchObject({ state: "COMPLETED" });
      expect(fixture.sent).toHaveLength(1);
      expect(fixture.built()).toBe(1);
    }));
});
