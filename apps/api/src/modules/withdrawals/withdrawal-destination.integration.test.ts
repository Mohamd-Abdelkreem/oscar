import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { TronWeb } from "tronweb";
import type { DatabaseClient } from "@template/database";
import { EmailService } from "../../infrastructure/email/email.service.js";
import {
  EmailDeliveryError,
  type EmailSendRequest,
} from "../../infrastructure/email/email-delivery.js";
import { parseWithdrawalEnvironment } from "../../core/config/withdrawal.config.js";
import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { WithdrawalDestinationService } from "./withdrawal-destination.service.js";
import { withWithdrawalRole } from "./testing/withdrawal-authority-fixtures.js";
import {
  withWithdrawalDatabase,
  withWithdrawalRaceClients,
  withdrawalRaceBarrier,
} from "./testing/withdrawal-fixtures.js";

const address = TronWeb.address.fromHex(`41${"22".repeat(20)}`);
const otherAddress = TronWeb.address.fromHex(`41${"33".repeat(20)}`);
const identity = (
  account: Awaited<ReturnType<typeof createIdentityFixture>>,
) => ({ userId: account.user.id, sessionId: account.session.id });
const initial = new Date("2026-10-08T09:00:00Z");

function destinationHarness(
  database: DatabaseClient,
  options: {
    send?: (mail: EmailSendRequest) => Promise<void>;
    config?: ReturnType<typeof parseWithdrawalEnvironment>;
  } = {},
) {
  let now = initial;
  const credentials: string[] = [];
  const email = new EmailService(
    {
      provider: "resend",
      send: async (mail) => {
        await mail.assertCanDispatch?.();
        const proof = /#withdrawal-confirmation=([A-Za-z0-9_-]{43})/u.exec(
          mail.html,
        )?.[1];
        if (proof === undefined)
          throw new Error("Missing proof in test email boundary");
        credentials.push(proof);
        await options.send?.(mail);
        return { providerMessageId: "test-provider-ack" };
      },
    },
    "sender@company.test",
    "Company",
    "",
    "https://company.test",
    null,
    "https://company.test/employee/account",
  );
  return {
    service: new WithdrawalDestinationService(database, email, {
      network: "TRON_NILE",
      admission: financialFixtureAdmission(database),
      clock: () => now,
      config: options.config ?? parseWithdrawalEnvironment({}),
    }),
    credentials,
    at: (instant: Date) => {
      now = instant;
    },
  };
}

async function proofState(database: DatabaseClient) {
  return {
    destinations: await database.withdrawalDestination.findMany({
      orderBy: { id: "asc" },
    }),
    events: await database.withdrawalDestinationAudit.findMany({
      orderBy: { id: "asc" },
    }),
    wallets: await database.wallet.findMany({ orderBy: { id: "asc" } }),
    reservations: await database.reservationAllocation.count(),
    requests: await database.withdrawalRequest.count(),
  };
}

describe("first withdrawal recipient proof authority", () => {
  it("uses the production API grants for issuance and atomic consumption without broader fixture permissions", async () =>
    withWithdrawalDatabase(async (database, databaseUrl) => {
      const account = await createIdentityFixture(database, { now: initial });
      await withWithdrawalRole(
        { database, databaseUrl, role: "p06_api" },
        async (runtime) => {
          const harness = destinationHarness(database);
          const service = new WithdrawalDestinationService(
            runtime,
            new EmailService(
              {
                provider: "resend",
                send: async (mail) => {
                  await mail.assertCanDispatch?.();
                  const token =
                    /#withdrawal-confirmation=([A-Za-z0-9_-]{43})/u.exec(
                      mail.html,
                    )?.[1];
                  if (token === undefined)
                    throw new Error("Missing test credential");
                  harness.credentials.push(token);
                  return { providerMessageId: "test-ack" };
                },
              },
              "sender@company.test",
              "Company",
              "",
              "https://company.test",
              null,
              "https://company.test/employee/account",
            ),
            {
              network: "TRON_NILE",
              admission: financialFixtureAdmission(database),
              clock: () => initial,
            },
          );
          const owner = identity(account);
          await service.issue(owner, { address });
          expect(
            await service.consume(owner, { token: harness.credentials[0] }),
          ).toMatchObject({ state: "CONFIRMED", address });
          await expect(
            runtime.financialRuntimeControl.update({
              where: { id: 1 },
              data: { financialWritesFenced: false },
            }),
          ).rejects.toMatchObject({ code: "P2039" });
          await expect(
            runtime.financialRuntimeAdmission.update({
              where: { bootId: financialFixtureAdmission(database).bootId },
              data: { acknowledgedGeneration: 1n },
            }),
          ).rejects.toMatchObject({ code: "P2039" });
          await expect(
            runtime.withdrawalPolicy.update({
              where: { id: 1 },
              data: { freeFeeBps: 0 },
            }),
          ).rejects.toMatchObject({ code: "P2039" });
          await expect(
            runtime.user.update({
              where: { id: owner.userId },
              data: { role: "ADMIN" },
            }),
          ).rejects.toMatchObject({ code: "P2039" });
          await expect(
            runtime.$executeRaw`UPDATE financial_runtime_control SET id=id WHERE id=1`,
          ).rejects.toMatchObject({
            code: "P2010",
            meta: { driverAdapterError: { cause: { originalCode: "42501" } } },
          });
        },
      );
      expect(await database.withdrawalDestinationAudit.count()).toBe(2);
    }));

  it("uses persisted cooldown and expiry after changing the configured durations", async () =>
    withWithdrawalDatabase(async (database) => {
      const account = await createIdentityFixture(database, { now: initial });
      const expiredAccount = await createIdentityFixture(database, {
        now: initial,
      });
      const first = destinationHarness(database, {
        config: parseWithdrawalEnvironment({
          WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS: "60",
          WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS: "1",
        }),
      });
      await first.service.issue(identity(account), { address });
      await first.service.issue(identity(expiredAccount), { address });
      const changed = destinationHarness(database, {
        config: parseWithdrawalEnvironment({
          WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS: "3600",
          WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS: "3600",
        }),
      });
      changed.at(new Date(initial.getTime() + 1000));
      expect(
        await changed.service.resend(identity(account), { expectedVersion: 1 }),
      ).toMatchObject({
        version: 2,
        expiresAt: "2026-10-08T10:00:01.000Z",
        nextIssuanceAt: "2026-10-08T10:00:01.000Z",
      });
      changed.at(new Date(initial.getTime() + 60000));
      await expect(
        changed.service.consume(identity(expiredAccount), {
          token: first.credentials[1],
        }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_PROOF_INVALID" });
      expect(
        await changed.service.reads.destination(identity(expiredAccount)),
      ).toMatchObject({
        proofStatus: "EXPIRED",
        expiresAt: "2026-10-08T09:01:00.000Z",
      });
      expect(await database.withdrawalDestinationAudit.count()).toBe(3);
    }));

  it("does not commit issuance when the configured email confirmation target is unavailable", async () =>
    withWithdrawalDatabase(async (database) => {
      const account = await createIdentityFixture(database, { now: initial });
      const email = new EmailService(
        {
          provider: "resend",
          send: () => Promise.reject(new Error("must not dispatch")),
        },
        "sender@company.test",
        "Company",
        "",
        "https://company.test",
        null,
        null,
      );
      const service = new WithdrawalDestinationService(database, email, {
        network: "TRON_NILE",
        admission: financialFixtureAdmission(database),
        clock: () => initial,
      });
      const before = await proofState(database);
      await expect(
        service.issue(identity(account), { address }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_UNAVAILABLE" });
      expect(await proofState(database)).toEqual(before);
    }));
  it("stores a scope-bound hash, saves once, clears authority and exposes the saved result after a lost reply", async () =>
    withWithdrawalDatabase(async (database) => {
      const account = await createIdentityFixture(database, { now: initial });
      const harness = destinationHarness(database);
      const owner = identity(account);
      const pending = await harness.service.issue(owner, { address });
      expect(pending).toMatchObject({
        state: "PENDING",
        address,
        deliveryStatus: "ACKNOWLEDGED",
        version: 1,
      });
      const token = harness.credentials[0];
      if (token === undefined) throw new Error("Missing test credential");
      const stored = await database.withdrawalDestination.findUniqueOrThrow({
        where: { employeeId: owner.userId },
      });
      expect(stored.proofHash).toMatch(/^[0-9a-f]{64}$/u);
      expect(JSON.stringify(stored)).not.toContain(token);
      expect(JSON.stringify(pending)).not.toContain(token);
      expect(
        JSON.stringify(await database.withdrawalDestinationAudit.findMany()),
      ).not.toMatch(/proofHash|token|withdrawal-confirmation/u);
      await harness.service.consume(owner, { token });
      expect(await harness.service.reads.destination(owner)).toMatchObject({
        state: "CONFIRMED",
        address,
        addressVersion: 1,
      });
      const before = await proofState(database);
      expect(before.events.map((event) => event.kind).sort()).toEqual([
        "PROOF_CONSUMED",
        "PROOF_ISSUED",
      ]);
      expect(
        before.events.every(
          (event) =>
            event.proofId === stored.proofId &&
            event.proofGeneration === 1 &&
            event.actorUserId === owner.userId &&
            event.address === address,
        ),
      ).toBe(true);
      expect(before.destinations[0]).toMatchObject({
        proofId: null,
        proofHash: null,
        pendingAddress: null,
        issuedAt: null,
        expiresAt: null,
        nextIssuanceAt: null,
      });
      await expect(
        harness.service.consume(owner, { token }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_PROOF_INVALID" });
      await expect(
        harness.service.issue(owner, { address: otherAddress }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_DESTINATION_FIXED" });
      expect(await proofState(database)).toEqual(before);
      expect(before.reservations).toBe(0);
      expect(before.requests).toBe(0);
    }));

  it("rejects invalid, wrong-owner, expired and stale issuance without changing proof or audit authority", async () =>
    withWithdrawalDatabase(async (database) => {
      const account = await createIdentityFixture(database, { now: initial });
      const stranger = await createIdentityFixture(database, { now: initial });
      const harness = destinationHarness(database);
      const owner = identity(account);
      await harness.service.issue(owner, { address });
      const token = harness.credentials[0];
      if (token === undefined) throw new Error("Missing test credential");
      const before = await proofState(database);
      await expect(
        harness.service.issue(owner, { address: `T${"1".repeat(33)}` }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_ADDRESS_INVALID" });
      await expect(
        harness.service.issue(owner, { address: otherAddress }),
      ).rejects.toMatchObject({ statusCode: 429 });
      await expect(
        harness.service.resend(owner, { expectedVersion: 9 }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_DESTINATION_STALE" });
      await expect(
        harness.service.consume(identity(stranger), { token }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_PROOF_INVALID" });
      await expect(
        harness.service.consume(owner, {
          token: randomBytes(32).toString("base64url"),
        }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_PROOF_INVALID" });
      harness.at(new Date(initial.getTime() + 1800000));
      await expect(
        harness.service.consume(owner, { token }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_PROOF_INVALID" });
      expect(await proofState(database)).toEqual(before);
      expect(await harness.service.reads.destination(owner)).toMatchObject({
        proofStatus: "EXPIRED",
      });
    }));

  it.each(["UNKNOWN", "REJECTED"] as const)(
    "supersedes before %s email I/O and never revives the prior credential",
    async (disposition) =>
      withWithdrawalDatabase(async (database) => {
        const account = await createIdentityFixture(database, { now: initial });
        const owner = identity(account);
        let sends = 0;
        const harness = destinationHarness(database, {
          send: async () => {
            sends += 1;
            if (sends === 2) {
              const row =
                await database.withdrawalDestination.findUniqueOrThrow({
                  where: { employeeId: owner.userId },
                });
              expect(row.proofGeneration).toBe(2);
              expect(await database.withdrawalDestinationAudit.count()).toBe(2);
              await expect(
                harness.service.consume(owner, {
                  token: harness.credentials[0],
                }),
              ).rejects.toMatchObject({ code: "WITHDRAWAL_PROOF_INVALID" });
              throw new EmailDeliveryError("resend", 1, disposition, "TIMEOUT");
            }
          },
        });
        await harness.service.issue(owner, { address });
        harness.at(new Date(initial.getTime() + 60000));
        expect(
          await harness.service.resend(owner, { expectedVersion: 1 }),
        ).toMatchObject({
          state: "PENDING",
          deliveryStatus: disposition,
          version: 2,
        });
        expect(await database.withdrawalDestinationAudit.count()).toBe(2);
        expect(
          await harness.service.consume(owner, {
            token: harness.credentials[1],
          }),
        ).toMatchObject({ state: "CONFIRMED", address });
      }),
  );

  it("ignores a late old-generation acknowledgement and preserves configured expiry/cooldown instants", async () =>
    withWithdrawalDatabase(async (database) => {
      const account = await createIdentityFixture(database, { now: initial });
      let release: () => void = () => {};
      let arrived: () => void = () => {};
      const waiting = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        arrived = resolve;
      });
      const harness = destinationHarness(database, {
        config: parseWithdrawalEnvironment({
          WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS: "120",
          WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS: "2",
        }),
        send: async () => {
          if (harness.credentials.length === 1) {
            arrived();
            await waiting;
          } else throw new EmailDeliveryError("resend", 1, "REJECTED");
        },
      });
      const owner = identity(account);
      const first = harness.service.issue(owner, { address });
      await started;
      try {
        const other = destinationHarness(database);
        const saved = await other.service.reads.destination(owner);
        expect(saved).toMatchObject({
          expiresAt: "2026-10-08T09:02:00.000Z",
          nextIssuanceAt: "2026-10-08T09:00:02.000Z",
          deliveryStatus: "UNKNOWN",
        });
        harness.at(new Date(initial.getTime() + 2000));
        await harness.service.issue(owner, { address: otherAddress });
      } finally {
        release();
      }
      await first;
      expect(await harness.service.reads.destination(owner)).toMatchObject({
        address: otherAddress,
        version: 2,
        deliveryStatus: "REJECTED",
      });
      expect(await database.withdrawalDestinationAudit.count()).toBe(2);
    }));

  it.each(["issuance", "consumption", "issuance-consumption"] as const)(
    "serializes independent-client %s races with one committed winner",
    async (race) =>
      withWithdrawalDatabase(async (database, url) => {
        const account = await createIdentityFixture(database, { now: initial });
        const owner = identity(account);
        const original = destinationHarness(database);
        if (race !== "issuance")
          await original.service.issue(owner, { address });
        await withWithdrawalRaceClients(url, async (first, second) => {
          const a = destinationHarness(first);
          const b = destinationHarness(second);
          if (race === "issuance-consumption") {
            a.at(new Date(initial.getTime() + 60000));
            b.at(new Date(initial.getTime() + 60000));
          }
          const barrier = withdrawalRaceBarrier(2);
          const compete = async (
            service: WithdrawalDestinationService,
            which: number,
          ) => {
            await barrier();
            return race === "issuance" ||
              (race === "issuance-consumption" && which === 1)
              ? service.issue(owner, {
                  address: which === 1 ? address : otherAddress,
                })
              : service.consume(owner, { token: original.credentials[0] });
          };
          const outcomes = await Promise.allSettled([
            compete(a.service, 1),
            compete(b.service, 2),
          ]);
          expect(
            outcomes.filter((outcome) => outcome.status === "fulfilled"),
          ).toHaveLength(1);
        });
        expect(await database.withdrawalDestination.count()).toBe(1);
        expect(await database.withdrawalDestinationAudit.count()).toBe(
          race === "issuance" ? 1 : 2,
        );
        expect(await database.reservationAllocation.count()).toBe(0);
      }),
  );

  it.each(["PROOF_ISSUED", "PROOF_CONSUMED"] as const)(
    "rolls back the real authority transition when %s audit insertion fails",
    async (kind) =>
      withWithdrawalDatabase(async (database) => {
        const account = await createIdentityFixture(database, { now: initial });
        const harness = destinationHarness(database);
        const owner = identity(account);
        await harness.service.issue(owner, { address });
        const before = await proofState(database);
        await database.$executeRawUnsafe(
          `CREATE FUNCTION reject_test_proof_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind='${kind}' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`,
        );
        await database.$executeRawUnsafe(
          "CREATE TRIGGER reject_test_proof_event BEFORE INSERT ON withdrawal_destination_audits FOR EACH ROW EXECUTE FUNCTION reject_test_proof_event()",
        );
        harness.at(new Date(initial.getTime() + 60000));
        const command =
          kind === "PROOF_ISSUED"
            ? harness.service.issue(owner, { address: otherAddress })
            : harness.service.consume(owner, { token: harness.credentials[0] });
        await expect(command).rejects.toBeDefined();
        expect(await proofState(database)).toEqual(before);
        expect(harness.credentials).toHaveLength(1);
      }),
  );

  it("denies revoked session and withdrawal block at mutation while retaining authorized reads", async () =>
    withWithdrawalDatabase(async (database) => {
      const account = await createIdentityFixture(database, { now: initial });
      const harness = destinationHarness(database);
      const owner = identity(account);
      await harness.service.issue(owner, { address });
      await database.user.update({
        where: { id: owner.userId },
        data: { withdrawalsBlocked: true },
      });
      const before = await proofState(database);
      expect(await harness.service.reads.destination(owner)).toMatchObject({
        state: "PENDING",
      });
      await expect(
        harness.service.consume(owner, { token: harness.credentials[0] }),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_BLOCKED" });
      await database.authSession.update({
        where: { id: owner.sessionId },
        data: { revokedAt: initial },
      });
      await expect(
        harness.service.reads.destination(owner),
      ).rejects.toMatchObject({ statusCode: 401 });
      await expect(
        harness.service.issue(owner, { address: otherAddress }),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect(await proofState(database)).toEqual(before);
    }));
});
