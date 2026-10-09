import { randomUUID } from "node:crypto";
import {
  identitySessionDataSchema,
  identityUserDataSchema,
  errorEnvelopeSchema,
  successEnvelopeSchema,
  employeeRestrictionsDataSchema,
  adminListDataSchema,
  adminDataSchema,
  adminInvitationListDataSchema,
  adminInvitationDataSchema,
} from "@template/contracts";
import { createDatabaseClient, Prisma } from "@template/database";
import pino from "pino";
import request from "supertest";
import { ipKeyGenerator } from "express-rate-limit";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createApp } from "../../app.js";
import {
  generateHash,
  generateTokenPair,
  verifyAccessToken,
  verifyRefreshToken,
  sha256,
  generateVerificationToken,
} from "../../infrastructure/security/index.js";
import { authConfig } from "../../core/config/auth.config.js";
import { authRouteLimits } from "../../core/config/auth-rate-limit.config.js";
import { authRateLimiters } from "../auth/auth.rate-limiters.js";
import { apiRateLimitMiddleware } from "../../middlewares/rate-limit.middleware.js";
import {
  createIdentityFixture,
  withIndependentIdentityClients,
  identityRaceBarrier,
  withIdentityDatabase,
} from "../auth/testing/identity-fixtures.js";
import { LedgerService } from "../ledger/ledger.service.js";
import type { LedgerContext } from "../ledger/ledger.types.js";
import {
  financialIdentity,
  financialFixtureAdmission,
  admitCleanDisposableFinancialBoot,
} from "../ledger/testing/financial-fixtures.js";
import { AdminLifecycleService } from "./admin-lifecycle.service.js";
import { AdminsService } from "./admins.service.js";
import { AdminInvitationsService } from "./admin-invitations.service.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { setImmediate as nextTurn } from "node:timers/promises";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined)
  throw new Error("The Testcontainers DATABASE_URL was not provided.");
const database = createDatabaseClient(databaseUrl);
await admitCleanDisposableFinancialBoot(database);
const app = createApp({
  database,
  financialAdmission: financialFixtureAdmission(database),
  logger: pino({ level: "silent" }),
  emailDelivery: {
    provider: "console",
    send: () => Promise.resolve({ providerMessageId: "test-no-live-mail" }),
  },
});

async function controlActor() {
  const { user, session } = await fixture({ role: "ADMIN" });
  const pair = generateTokenPair({
    userId: user.id,
    sessionId: session.id,
    tokenId: randomUUID(),
    email: user.email,
    role: user.role,
    rememberMe: false,
    absoluteExpiresAt: session.expiresAt,
  });
  return { user, session, access: pair.accessToken };
}
type ControlActor = Awaited<ReturnType<typeof controlActor>>;

describe("P02 US6 single-process invitation limits and trusted attribution", () => {
  const invite = (
    actor: ControlActor,
    email: string,
    requestId = randomUUID(),
  ) =>
    request(app)
      .post("/api/v1/admin/invitations")
      .set("Authorization", `Bearer ${actor.access}`)
      .set("Cookie", "csrfToken=test-invite-csrf")
      .set("x-csrf-token", "test-invite-csrf")
      .set("x-request-id", requestId)
      .send({
        fullName: "Invited Recipient",
        email,
        confirmed: true,
        reason: "Reviewed operational invitation",
      });
  it("shares the actor budget across recipients and reissue while correlation IDs cannot impersonate the audit actor", async () => {
    const actor = await controlActor();
    const correlationId = randomUUID();
    const issued = await invite(
      actor,
      `us6-actor-${randomUUID()}@example.com`,
      correlationId,
    );
    expect(issued.status).toBe(201);
    const invitation = adminInvitationDataSchema.parse(
      successEnvelopeSchema.parse(issued.body).data,
    ).invitation;
    expect(
      await database.identityAuditRecord.findFirstOrThrow({
        where: { invitationId: invitation.id, action: "INVITATION_ISSUE" },
      }),
    ).toMatchObject({
      actorUserId: actor.user.id,
      issuerUserId: actor.user.id,
    });
    expect(successEnvelopeSchema.parse(issued.body).requestId).toBe(
      correlationId,
    );
    const reissue = () =>
      request(app)
        .post(`/api/v1/admin/invitations/${invitation.id}/reissue`)
        .set("Authorization", `Bearer ${actor.access}`)
        .set("Cookie", "csrfToken=test-invite-csrf")
        .set("x-csrf-token", "test-invite-csrf")
        .send({
          confirmed: true,
          reason: "Reviewed replacement",
          expectedVersion: 1,
        });
    expect((await reissue()).status).toBe(409);
    for (
      let attempt = 2;
      attempt < authRouteLimits.invitationActor.max;
      attempt += 1
    )
      expect(
        (await invite(actor, `us6-next-${randomUUID()}@example.com`)).status,
      ).toBe(201);
    const rejected = await reissue();
    expect(rejected.status).toBe(429);
    expect(rejected.headers["cache-control"]).toBe("no-store");
    expect(rejected.headers["ratelimit"]).toBeDefined();
    expect(
      (
        await database.adminInvitation.findUniqueOrThrow({
          where: { id: invitation.id },
        })
      ).tokenVersion,
    ).toBe(1);
  });
  it("shares the recipient budget across distinct administrators and mixed issue/reissue attempts", async () => {
    const email = `us6-recipient-${randomUUID()}@example.com`;
    const first = await invite(await controlActor(), email);
    expect(first.status).toBe(201);
    const invitation = adminInvitationDataSchema.parse(
      successEnvelopeSchema.parse(first.body).data,
    ).invitation;
    for (
      let attempt = 1;
      attempt < authRouteLimits.invitationRecipient.max;
      attempt += 1
    ) {
      const actor = await controlActor();
      const response =
        attempt % 2 === 0
          ? await invite(actor, email)
          : await request(app)
              .post(`/api/v1/admin/invitations/${invitation.id}/reissue`)
              .set("Authorization", `Bearer ${actor.access}`)
              .set("Cookie", "csrfToken=test-invite-csrf")
              .set("x-csrf-token", "test-invite-csrf")
              .send({
                confirmed: true,
                reason: "Reviewed replacement",
                expectedVersion: 1,
              });
      expect(response.status).toBe(409);
    }
    expect((await invite(await controlActor(), email)).status).toBe(429);
    expect(
      (
        await database.adminInvitation.findUniqueOrThrow({
          where: { id: invitation.id },
        })
      ).tokenVersion,
    ).toBe(1);
  });
});

function adminStatusRequest(
  actor: ControlActor,
  userId: string,
  body: object,
  targetApp = app,
) {
  return request(targetApp)
    .patch(`/api/v1/admin/admins/${userId}/status`)
    .set("Authorization", `Bearer ${actor.access}`)
    .set("Cookie", "csrfToken=test-control-csrf")
    .set("x-csrf-token", "test-control-csrf")
    .send(body);
}

describe("P02 US5 administrator HTTP authority", () => {
  it.each(["lifecycle", "invitation", "read"])(
    "refuses a locked %s operation after actor logout with no partial state/audit",
    async (operation) => {
      resetApiSource();
      const actor = await controlActor();
      const target = await fixture({ role: "ADMIN" });
      await withIndependentIdentityClients(
        databaseUrl,
        async (holder, contender) => {
          let announce = () => {};
          let release = () => {};
          const held = new Promise<void>((resolve) => {
            announce = resolve;
          });
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          const holding = holder.$transaction(
            async (transaction) => {
              await transaction.$queryRaw(
                Prisma.sql`SELECT id FROM users WHERE id=${actor.user.id}::uuid FOR UPDATE`,
              );
              announce();
              await released;
              await transaction.authSession.update({
                where: { id: actor.session.id },
                data: { revokedAt: new Date() },
              });
            },
            { timeout: 10000 },
          );
          await held;
          const identity = {
            userId: actor.user.id,
            sessionId: actor.session.id,
          };
          const email = new EmailService({
            provider: "smtp",
            send: () =>
              Promise.resolve({ providerMessageId: "test-no-live-mail" }),
          });
          const address = `locked-invitation-${randomUUID()}@example.com`;
          const write =
            operation === "lifecycle"
              ? new AdminLifecycleService(contender).updateStatus(
                  identity,
                  target.user.id,
                  {
                    confirmed: true,
                    expectedVersion: 0,
                    reason: "Reviewed locked lifecycle",
                    status: "DEACTIVATED",
                  },
                )
              : operation === "read"
                ? new AdminsService(contender).listAdmins(identity, {
                    page: 1,
                    limit: 25,
                  })
                : new AdminInvitationsService(contender, email).issue(
                    identity,
                    {
                      confirmed: true,
                      fullName: "Locked Recipient",
                      email: address,
                      reason: "Reviewed locked invitation",
                    },
                  );
          const observed = write.then(
            (saved) => ({ saved }),
            (failure: unknown) => ({ failure }),
          );
          try {
            let blocked = false;
            for (let attempt = 0; attempt < 1000; attempt += 1) {
              const activity = await database.$queryRaw<
                { waiting: boolean }[]
              >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%users%') AS waiting`;
              if (activity[0]?.waiting === true) {
                blocked = true;
                break;
              }
              await nextTurn();
            }
            expect(blocked).toBe(true);
            release();
            await holding;
            expect(await observed).toMatchObject({
              failure: { statusCode: 401 },
            });
          } finally {
            release();
            await Promise.allSettled([holding, write]);
          }
          expect(
            (
              await database.user.findUniqueOrThrow({
                where: { id: target.user.id },
              })
            ).status,
          ).toBe("ACTIVE");
          expect(
            await database.adminInvitation.count({ where: { email: address } }),
          ).toBe(0);
          expect(
            await database.identityAuditRecord.count({
              where: { actorUserId: actor.user.id },
            }),
          ).toBe(0);
        },
      );
    },
  );
  it.each(["anonymous", "USER", "DEACTIVATED", "revoked"])(
    "denies %s callers at every administrator read/write boundary",
    async (kind) => {
      resetApiSource();
      const identity = await fixture({
        role: kind === "USER" ? "USER" : "ADMIN",
        status: kind === "DEACTIVATED" ? "DEACTIVATED" : "ACTIVE",
      });
      const pair = generateTokenPair({
        userId: identity.user.id,
        sessionId: identity.session.id,
        tokenId: randomUUID(),
        role: identity.user.role,
        email: identity.user.email,
        rememberMe: false,
        absoluteExpiresAt: identity.session.expiresAt,
      });
      if (kind === "revoked")
        await database.authSession.update({
          where: { id: identity.session.id },
          data: { revokedAt: new Date() },
        });
      for (const path of [
        "admins",
        `admins/${identity.user.id}`,
        "invitations",
        `invitations/${randomUUID()}`,
      ]) {
        const call = request(app).get(`/api/v1/admin/${path}`);
        if (kind !== "anonymous")
          call.set("Authorization", `Bearer ${pair.accessToken}`);
        const denied = await call;
        expect(denied.status).toBe(kind === "USER" ? 403 : 401);
        expect(denied.headers["cache-control"]).toBe("no-store");
      }
      const call = request(app)
        .post("/api/v1/admin/invitations")
        .set("Cookie", "csrfToken=test-control-csrf")
        .set("x-csrf-token", "test-control-csrf")
        .send({
          fullName: "Denied",
          email: `denied-${randomUUID()}@example.com`,
          confirmed: true,
          reason: "Test denial",
        });
      if (kind !== "anonymous")
        call.set("Authorization", `Bearer ${pair.accessToken}`);
      expect((await call).status).toBe(kind === "USER" ? 403 : 401);
    },
  );
  it("returns bounded role-filtered safe lists/details with deterministic page/count metadata", async () => {
    resetApiSource();
    const actor = await controlActor();
    const employee = await fixture();
    const list = await request(app)
      .get("/api/v1/admin/admins?page=1&limit=2")
      .set("Authorization", `Bearer ${actor.access}`);
    expect(list.status).toBe(200);
    const projection = adminListDataSchema.parse(
      successEnvelopeSchema.parse(list.body).data,
    );
    const expected = await database.user.findMany({
      where: { role: "ADMIN" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 2,
      select: { id: true },
    });
    expect(projection.items.map((admin) => admin.id)).toEqual(
      expected.map((admin) => admin.id),
    );
    expect(projection.pagination.total).toBe(
      await database.user.count({ where: { role: "ADMIN" } }),
    );
    expect(JSON.stringify(projection)).not.toMatch(
      /passwordHash|tokenHash|lastActiveAt|sessionId/u,
    );
    const detail = await request(app)
      .get(`/api/v1/admin/admins/${actor.user.id}`)
      .set("Authorization", `Bearer ${actor.access}`);
    expect(
      adminDataSchema.parse(successEnvelopeSchema.parse(detail.body).data).admin
        .id,
    ).toBe(actor.user.id);
    for (const id of [employee.user.id, randomUUID()])
      expect(
        (
          await request(app)
            .get(`/api/v1/admin/admins/${id}`)
            .set("Authorization", `Bearer ${actor.access}`)
        ).status,
      ).toBe(404);
    for (const query of [
      "limit=101",
      "page=0",
      "page=9007199254740991&limit=100",
      "sort=passwordHash",
    ])
      expect(
        (
          await request(app)
            .get(`/api/v1/admin/admins?${query}`)
            .set("Authorization", `Bearer ${actor.access}`)
        ).status,
      ).toBe(400);
    const invitations = await request(app)
      .get("/api/v1/admin/invitations?limit=1")
      .set("Authorization", `Bearer ${actor.access}`);
    expect(invitations.status).toBe(200);
    expect(
      adminInvitationListDataSchema.parse(
        successEnvelopeSchema.parse(invitations.body).data,
      ).items.length,
    ).toBeLessThanOrEqual(1);
  });
  it("rejects self/pending/employee/stale/unchanged and unsupported lifecycle intent", async () => {
    resetApiSource();
    const actor = await controlActor();
    const target = await fixture({ role: "ADMIN" });
    const pending = await fixture({
      role: "ADMIN",
      status: "PENDING_VERIFICATION",
    });
    const employee = await fixture();
    expect(
      (
        await adminStatusRequest(
          actor,
          actor.user.id,
          controlCommand(0, { status: "DEACTIVATED" }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await adminStatusRequest(
          actor,
          pending.user.id,
          controlCommand(0, { status: "DEACTIVATED" }),
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await adminStatusRequest(
          actor,
          employee.user.id,
          controlCommand(0, { status: "DEACTIVATED" }),
        )
      ).status,
    ).toBe(404);
    for (const body of [
      controlCommand(1, { status: "DEACTIVATED" }),
      controlCommand(0, { status: "ACTIVE" }),
    ])
      expect(
        (await adminStatusRequest(actor, target.user.id, body)).status,
      ).toBe(409);
    for (const body of [
      { ...controlCommand(0, { status: "DEACTIVATED" }), confirmed: false },
      { ...controlCommand(0, { status: "DEACTIVATED" }), reason: " " },
      controlCommand(0, { status: "SUSPENDED" }),
      controlCommand(0, { status: "DEACTIVATED", email: "forged@example.com" }),
    ])
      expect(
        (await adminStatusRequest(actor, target.user.id, body)).status,
      ).toBe(400);
    const missingCsrf = await request(app)
      .patch(`/api/v1/admin/admins/${target.user.id}/status`)
      .set("Authorization", `Bearer ${actor.access}`)
      .send(controlCommand(0, { status: "DEACTIVATED" }));
    expect(missingCsrf.status).toBe(403);
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: target.user.id },
      }),
    ).toBe(0);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: target.user.id } }))
        .status,
    ).toBe("ACTIVE");
  });
  it("serializes two remaining administrators denying each other with no losing audit", async () => {
    await withIdentityDatabase(async (isolated, url) => {
      const first = await createIdentityFixture(isolated, { role: "ADMIN" });
      const second = await createIdentityFixture(isolated, { role: "ADMIN" });
      const barrier = identityRaceBarrier(2);
      await withIndependentIdentityClients(url, async (left, right) => {
        const compete = async (
          client: typeof isolated,
          actor: typeof first,
          target: typeof first,
        ) => {
          await barrier();
          return new AdminLifecycleService(client).updateStatus(
            { userId: actor.user.id, sessionId: actor.session.id },
            target.user.id,
            {
              expectedVersion: 0,
              confirmed: true,
              reason: "Reviewed competing denial",
              status: "DEACTIVATED",
            },
          );
        };
        const attempts = await Promise.allSettled([
          compete(left, first, second),
          compete(right, second, first),
        ]);
        expect(
          attempts.filter((attempt) => attempt.status === "fulfilled"),
        ).toHaveLength(1);
      });
      expect(
        await isolated.user.count({
          where: { role: "ADMIN", status: "ACTIVE" },
        }),
      ).toBe(1);
      expect(
        await isolated.identityAuditRecord.count({
          where: { action: "ADMIN_DEACTIVATE" },
        }),
      ).toBe(1);
      const remaining = await isolated.user.findFirstOrThrow({
        where: { role: "ADMIN", status: "ACTIVE" },
      });
      const session = await isolated.authSession.findFirstOrThrow({
        where: { userId: remaining.id, revokedAt: null },
      });
      await expect(
        new AdminLifecycleService(isolated).updateStatus(
          { userId: remaining.id, sessionId: session.id },
          remaining.id,
          {
            expectedVersion: remaining.accountVersion,
            confirmed: true,
            reason: "Attempted last self-denial",
            status: "DEACTIVATED",
          },
        ),
      ).rejects.toThrow("Self-deactivation");
    });
  });
});
function controlRequest(
  actor: ControlActor,
  userId: string,
  body: object,
  targetApp = app,
) {
  return request(targetApp)
    .patch(`/api/v1/admin/employees/${userId}/restrictions`)
    .set("Authorization", `Bearer ${actor.access}`)
    .set("Cookie", "csrfToken=test-control-csrf")
    .set("x-csrf-token", "test-control-csrf")
    .send(body);
}
const controlCommand = (expectedVersion: number, controls: object) => ({
  confirmed: true,
  reason: "Reviewed employee restriction",
  expectedVersion,
  ...controls,
});
function employeeData(body: unknown) {
  return employeeRestrictionsDataSchema.parse(
    successEnvelopeSchema.parse(body).data,
  ).employee;
}

describe("P02 US4 employee controls", () => {
  it.each(["profile", "control"])(
    "rejects a locked %s write after actor logout commits",
    async (operation) => {
      resetApiSource();
      const actor = await controlActor();
      const { user } = await fixture();
      await withIndependentIdentityClients(
        databaseUrl,
        async (holder, contender) => {
          let acquire = () => {};
          let release = () => {};
          const acquired = new Promise<void>((resolve) => {
            acquire = resolve;
          });
          const released = new Promise<void>((resolve) => {
            release = resolve;
          });
          const holding = holder.$transaction(
            async (transaction) => {
              await transaction.$queryRaw(
                Prisma.sql`SELECT id FROM users WHERE id=${actor.user.id}::uuid FOR UPDATE`,
              );
              acquire();
              await released;
              await transaction.authSession.update({
                where: { id: actor.session.id },
                data: { revokedAt: new Date() },
              });
            },
            { timeout: 10_000 },
          );
          await acquired;
          const contenderApp = createApp({
            database: contender,
            financialAdmission: financialFixtureAdmission(database),
            logger: pino({ level: "silent" }),
            emailDelivery: {
              provider: "console",
              send: () => Promise.resolve({ providerMessageId: "test" }),
            },
          });
          const pending = (
            operation === "control"
              ? controlRequest(
                  actor,
                  user.id,
                  controlCommand(0, { tasksBlocked: true }),
                  contenderApp,
                )
              : request(contenderApp)
                  .patch("/api/v1/users/me")
                  .set("Authorization", `Bearer ${actor.access}`)
                  .set("Cookie", "csrfToken=test-control-csrf")
                  .set("x-csrf-token", "test-control-csrf")
                  .send({ fullName: "Forbidden stale name" })
          ).then((response) => response);
          try {
            const deadline = performance.now() + 5000;
            let waiting = false;
            while (!waiting && performance.now() < deadline) {
              const rows = await database.$queryRaw<
                { waiting: boolean }[]
              >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%users%') AS waiting`;
              waiting = rows[0]?.waiting === true;
            }
            expect(waiting).toBe(true);
          } finally {
            release();
            await Promise.allSettled([holding, pending]);
          }
          await holding;
          expect((await pending).status).toBe(401);
        },
      );
      expect(
        await database.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).toEqual(user);
      expect(
        (
          await database.user.findUniqueOrThrow({
            where: { id: actor.user.id },
          })
        ).fullName,
      ).toBe(actor.user.fullName);
      expect(
        await database.identityAuditRecord.count({
          where: { targetUserId: user.id },
        }),
      ).toBe(0);
    },
  );

  it("email activation advances the version and makes earlier confirmed control intent stale", async () => {
    resetApiSource();
    const actor = await controlActor();
    const { user } = await fixture({ status: "PENDING_VERIFICATION" });
    const expiresAt = new Date(Date.now() + 60_000);
    const token = generateVerificationToken(user.email, user.id, expiresAt);
    await database.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: sha256(token),
        verificationTokenExpiresAt: expiresAt,
      },
    });
    const results = await withIndependentIdentityClients(
      databaseUrl,
      async (first, second) => {
        const start = identityRaceBarrier(2);
        const activationApp = createApp({
          database: first,
          logger: pino({ level: "silent" }),
          emailDelivery: {
            provider: "console",
            send: () => Promise.resolve({ providerMessageId: "test" }),
          },
        });
        const controlApp = createApp({
          database: second,
          financialAdmission: financialFixtureAdmission(database),
          logger: pino({ level: "silent" }),
          emailDelivery: {
            provider: "console",
            send: () => Promise.resolve({ providerMessageId: "test" }),
          },
        });
        return Promise.all([
          (async () => {
            await start();
            return request(activationApp)
              .post("/api/v1/auth/verify-email")
              .query({ token });
          })(),
          (async () => {
            await start();
            return controlRequest(
              actor,
              user.id,
              controlCommand(0, { tasksBlocked: true }),
              controlApp,
            );
          })(),
        ]);
      },
    );
    // A partial control preserves pending email authority; activation can follow it. Activation first makes version zero stale.
    expect(results[0].status).toBe(200);
    expect([200, 409]).toContain(results[1].status);
    const current = await database.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    const controlWon = results[1].status === 200;
    expect(current).toMatchObject({
      status: "ACTIVE",
      tasksBlocked: controlWon,
      accountVersion: controlWon ? 2 : 1,
    });
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(controlWon ? 1 : 0);
    const unchanged = current;
    expect(
      (
        await controlRequest(
          actor,
          user.id,
          controlCommand(0, { withdrawalsBlocked: true }),
        )
      ).status,
    ).toBe(409);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toEqual(unchanged);
  });
  it("preserves independent controls, action links and exact funded financial history", async () => {
    resetApiSource();
    const actor = await controlActor();
    const sponsor = await fixture();
    const { user, wallet } = await fixture({ sponsorUserId: sponsor.user.id });
    if (wallet === null) throw new Error("Employee wallet required");
    const ledger = new LedgerService(
      database,
      {
        businessNamespaces: ["financial-test"],
        processIds: [],
      },
      financialFixtureAdmission(database),
    );
    const context: LedgerContext = {
      actor: { type: "USER", userId: user.id },
      walletIds: [wallet.id],
      clock: () => new Date(),
      observe: async () => {},
      mutate: async () => {},
      eligibleSources: () => Promise.resolve(["NON_REFERRAL", "REFERRAL"]),
      releaseSafety: async () => {},
    };
    for (const source of ["NON_REFERRAL", "REFERRAL"] as const)
      await ledger.execute(
        {
          ...financialIdentity(),
          kind: "CREDIT",
          walletId: wallet.id,
          amount: source === "REFERRAL" ? "40" : "20",
          source,
          origin: source === "REFERRAL" ? "REFERRAL_COMMISSION" : "DEPOSIT",
        },
        context,
      );
    await ledger.execute(
      {
        ...financialIdentity(),
        kind: "RESERVE",
        walletId: wallet.id,
        amount: "25",
        reservationId: randomUUID(),
      },
      context,
    );
    await ledger.execute(
      {
        ...financialIdentity(),
        kind: "CREDIT",
        walletId: wallet.id,
        amount: "10",
        source: "NON_REFERRAL",
        origin: "DEPOSIT",
      },
      context,
    );
    const history = async () => ({
      wallet: await database.wallet.findUniqueOrThrow({
        where: { id: wallet.id },
      }),
      operations: await database.financialOperation.findMany({
        where: { walletId: wallet.id },
        orderBy: { id: "asc" },
      }),
      postings: await database.ledgerPosting.findMany({
        where: { walletId: wallet.id },
        orderBy: { id: "asc" },
      }),
      reservations: await database.reservationAllocation.findMany({
        where: { walletId: wallet.id },
        orderBy: { id: "asc" },
      }),
      audits: await database.auditRecord.findMany({
        where: { operation: { walletId: wallet.id } },
        orderBy: { id: "asc" },
      }),
      identities: await database.requestIdentity.findMany({
        where: { operation: { walletId: wallet.id } },
        orderBy: { id: "asc" },
      }),
    });
    const before = await history();
    expect(before.wallet).toMatchObject({
      availableNonReferralUnits: 10_000_000n,
      reservedNonReferralUnits: 20_000_000n,
      availableReferralUnits: 35_000_000n,
      reservedReferralUnits: 5_000_000n,
    });
    await database.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: sha256("test-reset"),
        resetTokenExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    const first = await controlRequest(
      actor,
      user.id,
      controlCommand(0, { tasksBlocked: true }),
    );
    expect(first.status).toBe(200);
    expect(employeeData(first.body)).toEqual({
      id: user.id,
      status: "ACTIVE",
      tasksBlocked: true,
      withdrawalsBlocked: false,
      accountVersion: 1,
    });
    const second = await controlRequest(
      actor,
      user.id,
      controlCommand(1, { withdrawalsBlocked: true }),
    );
    expect(second.status).toBe(200);
    expect(employeeData(second.body)).toMatchObject({
      tasksBlocked: true,
      withdrawalsBlocked: true,
      accountVersion: 2,
    });
    const stored = await database.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stored.resetTokenHash).toBe(sha256("test-reset"));
    expect(stored.sponsorUserId).toBe(sponsor.user.id);
    expect(stored.referralCode).toBe(user.referralCode);
    expect(await history()).toEqual(before);
    const audits = await database.identityAuditRecord.findMany({
      where: { targetUserId: user.id },
      orderBy: { occurredAt: "asc" },
    });
    expect(audits).toHaveLength(2);
    expect(audits[0]).toMatchObject({
      action: "EMPLOYEE_CONTROL",
      actorKind: "ADMIN",
      actorUserId: actor.user.id,
      reason: "Reviewed employee restriction",
      outcome: "COMMITTED",
      beforeSnapshot: { accountVersion: 0 },
      afterSnapshot: { accountVersion: 1, tasksBlocked: true },
    });
    for (const body of [
      controlCommand(0, { tasksBlocked: false }),
      controlCommand(2, { tasksBlocked: true }),
    ])
      expect((await controlRequest(actor, user.id, body)).status).toBe(409);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toEqual(stored);
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(2);
    const read = await request(app)
      .get(`/api/v1/admin/employees/${user.id}/restrictions`)
      .set("Authorization", `Bearer ${actor.access}`);
    expect(read.status).toBe(200);
    expect(employeeData(read.body)).toEqual(employeeData(second.body));
    const unblockedTask = await controlRequest(
      actor,
      user.id,
      controlCommand(2, { tasksBlocked: false }),
    );
    expect(unblockedTask.status).toBe(200);
    expect(employeeData(unblockedTask.body)).toMatchObject({
      tasksBlocked: false,
      withdrawalsBlocked: true,
      accountVersion: 3,
    });
    const unblockedWithdrawal = await controlRequest(
      actor,
      user.id,
      controlCommand(3, { withdrawalsBlocked: false }),
    );
    expect(unblockedWithdrawal.status).toBe(200);
    expect(employeeData(unblockedWithdrawal.body)).toMatchObject({
      tasksBlocked: false,
      withdrawalsBlocked: false,
      accountVersion: 4,
    });
    expect(await history()).toEqual(before);
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(4);
    for (const [expectedVersion, status] of [
      [4, "BANNED"],
      [5, "ACTIVE"],
    ] as const) {
      expect(
        (
          await controlRequest(
            actor,
            user.id,
            controlCommand(expectedVersion, { status }),
          )
        ).status,
      ).toBe(200);
      expect(await history()).toEqual(before);
      expect(
        await database.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).toMatchObject({
        sponsorUserId: sponsor.user.id,
        referralCode: user.referralCode,
        accountVersion: expectedVersion + 1,
      });
    }
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(6);
  });

  it("rejects unconfirmed, blank, forged and malformed control input without effects", async () => {
    resetApiSource();
    const actor = await controlActor();
    const { user } = await fixture();
    for (const overrides of [
      { confirmed: false },
      { reason: "  " },
      { actorUserId: actor.user.id },
      { expectedVersion: -1 },
      { status: "DEACTIVATED" },
      { role: "ADMIN" },
      { expectedVersion: "0" },
    ]) {
      expect(
        (
          await controlRequest(actor, user.id, {
            ...controlCommand(0, { tasksBlocked: true }),
            ...overrides,
          })
        ).status,
      ).toBe(400);
    }
    expect(
      (await controlRequest(actor, user.id, controlCommand(0, {}))).status,
    ).toBe(400);
    expect(
      (
        await controlRequest(
          actor,
          "invalid-id",
          controlCommand(0, { tasksBlocked: true }),
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await controlRequest(
          actor,
          randomUUID(),
          controlCommand(0, { tasksBlocked: true }),
        )
      ).status,
    ).toBe(404);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toEqual(user);
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(0);
  });

  it("denies anonymous, employee, stale-admin and ADMIN targets with CSRF enforced", async () => {
    resetApiSource();
    const actor = await controlActor();
    const employee = await fixture();
    const path = `/api/v1/admin/employees/${employee.user.id}/restrictions`;
    expect((await request(app).get(path)).status).toBe(401);
    const employeePair = generateTokenPair({
      userId: employee.user.id,
      sessionId: employee.session.id,
      tokenId: randomUUID(),
      email: employee.user.email,
      role: "ADMIN",
      rememberMe: false,
      absoluteExpiresAt: employee.session.expiresAt,
    });
    expect(
      (
        await request(app)
          .get(path)
          .set("Authorization", `Bearer ${employeePair.accessToken}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .patch(path)
          .set("Authorization", `Bearer ${actor.access}`)
          .send(controlCommand(0, { tasksBlocked: true }))
      ).status,
    ).toBe(403);
    expect(
      (
        await controlRequest(
          actor,
          actor.user.id,
          controlCommand(0, { status: "BANNED" }),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .get(`/api/v1/admin/employees/${actor.user.id}/restrictions`)
          .set("Authorization", `Bearer ${actor.access}`)
      ).status,
    ).toBe(404);
    await database.authSession.update({
      where: { id: actor.session.id },
      data: { revokedAt: new Date() },
    });
    expect(
      (
        await controlRequest(
          actor,
          employee.user.id,
          controlCommand(0, { tasksBlocked: true }),
        )
      ).status,
    ).toBe(401);
    expect(
      await database.user.findUniqueOrThrow({
        where: { id: employee.user.id },
      }),
    ).toEqual(employee.user);
  });

  it("rolls back status, credentials and session revocation when audit fails", async () => {
    resetApiSource();
    const actor = await controlActor();
    const { user, session } = await fixture();
    const tokenId = randomUUID();
    const pair = generateTokenPair({
      userId: user.id,
      sessionId: session.id,
      tokenId,
      email: user.email,
      role: user.role,
      rememberMe: false,
      absoluteExpiresAt: session.expiresAt,
    });
    const refresh = await database.refreshToken.create({
      data: {
        id: tokenId,
        userId: user.id,
        sessionId: session.id,
        tokenHash: sha256(pair.refreshToken),
        expiresAt: session.expiresAt,
      },
    });
    const before = await database.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: sha256("rollback-reset"),
        resetTokenExpiresAt: new Date(Date.now() + 60_000),
        verificationTokenHash: sha256("rollback-verify"),
        verificationTokenExpiresAt: new Date(Date.now() + 60_000),
      },
    });
    await database.$executeRaw`CREATE FUNCTION us4_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$`;
    await database.$executeRaw`CREATE TRIGGER us4_reject_audit BEFORE INSERT ON identity_audit_records FOR EACH ROW EXECUTE FUNCTION us4_reject_audit()`;
    try {
      expect(
        (
          await controlRequest(
            actor,
            user.id,
            controlCommand(0, { status: "BANNED" }),
          )
        ).status,
      ).toBe(500);
      expect(
        await database.user.findUniqueOrThrow({ where: { id: user.id } }),
      ).toEqual(before);
      expect(
        await database.authSession.findUniqueOrThrow({
          where: { id: session.id },
        }),
      ).toEqual(session);
      expect(
        await database.refreshToken.findUniqueOrThrow({
          where: { id: refresh.id },
        }),
      ).toEqual(refresh);
      expect(
        await database.identityAuditRecord.count({
          where: { targetUserId: user.id },
        }),
      ).toBe(0);
    } finally {
      await database.$executeRaw`DROP TRIGGER us4_reject_audit ON identity_audit_records`;
      await database.$executeRaw`DROP FUNCTION us4_reject_audit()`;
    }
  });

  it("enforces the authenticated actor budget without resetting it across targets", async () => {
    resetApiSource();
    const actor = await controlActor();
    const first = await fixture();
    const second = await fixture();
    for (
      let attempt = 0;
      attempt < authRouteLimits.adminControlActor.max;
      attempt += 1
    )
      expect(
        (
          await controlRequest(
            actor,
            attempt % 2 === 0 ? first.user.id : second.user.id,
            controlCommand(0, { tasksBlocked: false }),
          )
        ).status,
      ).toBe(409);
    const rejected = await controlRequest(
      actor,
      first.user.id,
      controlCommand(0, { tasksBlocked: true }),
    );
    expect(rejected.status).toBe(429);
    expect(rejected.headers["ratelimit"]).toBeDefined();
    expect(rejected.headers["ratelimit-policy"]).toBeDefined();
    expect(
      await database.user.findUniqueOrThrow({ where: { id: first.user.id } }),
    ).toEqual(first.user);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: second.user.id } }),
    ).toEqual(second.user);
    expect(
      await database.identityAuditRecord.count({
        where: { actorUserId: actor.user.id },
      }),
    ).toBe(0);
  });

  it("serializes competing independent controls without overwriting the losing intent", async () => {
    resetApiSource();
    const actor = await controlActor();
    const { user } = await fixture();
    const responses = await withIndependentIdentityClients(
      databaseUrl,
      async (first, second) => {
        const start = identityRaceBarrier(2);
        return Promise.all(
          [first, second].map(async (client, index) => {
            const contenderApp = createApp({
              database: client,
              financialAdmission: financialFixtureAdmission(database),
              logger: pino({ level: "silent" }),
              emailDelivery: {
                provider: "console",
                send: () => Promise.resolve({ providerMessageId: "test" }),
              },
            });
            await start();
            return controlRequest(
              actor,
              user.id,
              controlCommand(
                0,
                index === 0
                  ? { tasksBlocked: true }
                  : { withdrawalsBlocked: true },
              ),
              contenderApp,
            );
          }),
        );
      },
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409,
    ]);
    const winner = responses.find((response) => response.status === 200);
    if (winner === undefined) throw new Error("Expected one winner");
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject(employeeData(winner.body));
    expect(employeeData(winner.body).accountVersion).toBe(1);
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(1);
  });
});
const password = "test-only-identity-password";
let passwordHash: string;
beforeAll(async () => {
  passwordHash = await generateHash(password);
});
function resetLoginSource() {
  // Supertest connects over loopback. Isolate the source and account store tests.
  for (const source of ["127.0.0.1", "::ffff:127.0.0.1"]) {
    authRateLimiters.loginSource.resetKey(ipKeyGenerator(source));
  }
  resetApiSource();
}
function resetApiSource() {
  for (const source of ["127.0.0.1", "::ffff:127.0.0.1"])
    apiRateLimitMiddleware.resetKey(ipKeyGenerator(source));
}
afterAll(async () => {
  resetLoginSource();
  await database.$disconnect();
});

async function fixture(
  options: Parameters<typeof createIdentityFixture>[1] = {},
) {
  return createIdentityFixture(database, { ...options, passwordHash });
}
function sessionData(body: unknown) {
  return identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(body).data,
  );
}

describe("P02 US2 sign-in and current authority", () => {
  it.each([false, true])(
    "issues independent owned admin device sessions with rememberMe=%s",
    async (rememberMe) => {
      const { user } = await fixture({ role: "ADMIN" });
      const responses = await Promise.all(
        ["/auth/admin/login", "/auth/login"].map((path) =>
          request(app)
            .post(`/api/v1${path}`)
            .send({ email: user.email, password, rememberMe }),
        ),
      );
      const sessionIds = new Set<string>();
      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const projection = sessionData(response.body);
        expect(projection.user).toMatchObject({
          id: user.id,
          role: "ADMIN",
          referralCode: null,
        });
        const access = verifyAccessToken(projection.tokens.accessToken);
        if (!access.valid) throw new Error("Expected valid access credential");
        sessionIds.add(access.payload.sessionId);
        const session = await database.authSession.findUniqueOrThrow({
          where: { id: access.payload.sessionId },
        });
        const refresh = await database.refreshToken.findUniqueOrThrow({
          where: { sessionId: session.id },
        });
        expect(session).toMatchObject({
          userId: user.id,
          rememberMe,
          revokedAt: null,
        });
        expect(refresh.userId).toBe(user.id);
        expect(refresh.expiresAt).toEqual(session.expiresAt);
        const expectedTtl = rememberMe
          ? authConfig.refreshRememberedTtlSeconds
          : authConfig.refreshFamilyTtlSeconds;
        expect(session.expiresAt.getTime()).toBe(
          (Math.floor(session.createdAt.getTime() / 1000) + expectedTtl) * 1000,
        );
        const cookies: unknown = response.headers["set-cookie"];
        if (!Array.isArray(cookies)) throw new Error("Missing session cookies");
        const refreshCookie = cookies.find(
          (cookie: unknown): cookie is string =>
            typeof cookie === "string" && cookie.startsWith("refreshToken="),
        );
        expect(refreshCookie).toContain("HttpOnly");
        expect(refreshCookie).toContain("Path=/api/v1/auth");
        expect(refreshCookie).toContain("SameSite=Lax");
        expect(refreshCookie?.includes("Max-Age=")).toBe(rememberMe);
        if (typeof refreshCookie !== "string")
          throw new Error("Missing refresh cookie");
        const rawRefresh = decodeURIComponent(
          refreshCookie.slice("refreshToken=".length).split(";")[0] ?? "",
        );
        const claims = verifyRefreshToken(rawRefresh);
        expect(claims.valid && claims.payload.sessionId).toBe(session.id);
        expect(refresh.tokenHash).toBe(sha256(rawRefresh));
        const current = await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${projection.tokens.accessToken}`);
        expect(current.status).toBe(200);
        expect(current.headers["cache-control"]).toBe("no-store");
        expect(
          identityUserDataSchema.parse(
            successEnvelopeSchema.parse(current.body).data,
          ).user,
        ).toEqual(projection.user);
      }
      expect(sessionIds.size).toBe(2);
    },
  );

  it.each([
    "missing",
    "wrong-password",
    "USER",
    "PENDING_VERIFICATION",
    "DEACTIVATED",
  ])(
    "returns the same admin denial without authority for %s",
    async (scenario) => {
      const identity =
        scenario === "missing"
          ? null
          : await fixture({
              role: scenario === "USER" ? "USER" : "ADMIN",
              status:
                scenario === "PENDING_VERIFICATION"
                  ? "PENDING_VERIFICATION"
                  : scenario === "DEACTIVATED"
                    ? "DEACTIVATED"
                    : "ACTIVE",
            });
      const before = await database.authSession.count();
      const refreshBefore = await database.refreshToken.count();
      const response = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({
          email: identity?.user.email ?? `missing-${randomUUID()}@example.com`,
          password: scenario === "wrong-password" ? "wrong-password" : password,
          rememberMe: false,
        });
      expect(response.status).toBe(401);
      expect(errorEnvelopeSchema.parse(response.body)).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Invalid credentials.",
      });
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(await database.authSession.count()).toBe(before);
      expect(await database.refreshToken.count()).toBe(refreshBefore);
    },
  );

  it("permits partial employee controls while denying full employee restrictions", async () => {
    const { user } = await fixture();
    await database.user.update({
      where: { id: user.id },
      data: { tasksBlocked: true, withdrawalsBlocked: true },
    });
    const signedIn = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password, rememberMe: false });
    expect(signedIn.status).toBe(200);
    const projection = sessionData(signedIn.body);
    expect(projection.user).toMatchObject({
      tasksBlocked: true,
      withdrawalsBlocked: true,
      referralCode: user.referralCode,
    });
    for (const status of ["SUSPENDED", "BANNED"] as const) {
      await database.user.update({ where: { id: user.id }, data: { status } });
      expect(
        (
          await request(app)
            .get("/api/v1/users/me")
            .set("Authorization", `Bearer ${projection.tokens.accessToken}`)
        ).status,
      ).toBe(401);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email: user.email, password, rememberMe: false })
        ).status,
      ).toBe(401);
    }
  });

  it.each(["missing", "unowned", "revoked", "expired", "exact-expiry"])(
    "denies %s session on the first protected request",
    async (scenario) => {
      const { user, session } = await fixture();
      let sessionId = session.id;
      if (scenario === "missing") sessionId = randomUUID();
      if (scenario === "unowned") sessionId = (await fixture()).session.id;
      if (scenario === "revoked")
        await database.authSession.update({
          where: { id: session.id },
          data: { revokedAt: new Date() },
        });
      if (scenario === "expired" || scenario === "exact-expiry")
        await database.authSession.update({
          where: { id: session.id },
          data: { expiresAt: new Date(Date.now() + 1000) },
        });
      const pair = generateTokenPair({
        userId: user.id,
        tokenId: randomUUID(),
        sessionId,
        email: user.email,
        role: "ADMIN",
        rememberMe: false,
        absoluteExpiresAt: new Date(Date.now() + 3600_000),
      });
      if (scenario === "expired" || scenario === "exact-expiry") {
        const stored = await database.authSession.findUniqueOrThrow({
          where: { id: session.id },
        });
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(
          stored.expiresAt.getTime() + (scenario === "expired" ? 1 : 0),
        );
      }
      try {
        expect(
          (
            await request(app)
              .get("/api/v1/users/me")
              .set("Authorization", `Bearer ${pair.accessToken}`)
          ).status,
        ).toBe(401);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it("projects the live employee role despite a signed ADMIN claim", async () => {
    const { user, session } = await fixture();
    const pair = generateTokenPair({
      userId: user.id,
      tokenId: randomUUID(),
      sessionId: session.id,
      email: user.email,
      role: "ADMIN",
      rememberMe: false,
      absoluteExpiresAt: session.expiresAt,
    });
    const current = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${pair.accessToken}`);
    expect(current.status).toBe(200);
    expect(
      identityUserDataSchema.parse(
        successEnvelopeSchema.parse(current.body).data,
      ).user.role,
    ).toBe("USER");
  });

  it.each(["password", "status"])(
    "rechecks %s after login waits for the User lock",
    async (change) => {
      const { user } = await fixture({ role: "ADMIN" });
      const replacementHash = await generateHash(
        "test-only-replacement-password",
      );
      const sessionsBefore = await database.authSession.count({
        where: { userId: user.id },
      });
      await withIndependentIdentityClients(
        databaseUrl,
        async (holder, contender) => {
          let release = () => {};
          const unlocked = new Promise<void>((resolve) => {
            release = resolve;
          });
          let acquired = () => {};
          const locked = new Promise<void>((resolve) => {
            acquired = resolve;
          });
          const holding = holder.$transaction(
            async (transaction) => {
              await transaction.$queryRaw(
                Prisma.sql`SELECT id FROM users WHERE id=${user.id}::uuid FOR UPDATE`,
              );
              acquired();
              await unlocked;
              await transaction.user.update({
                where: { id: user.id },
                data:
                  change === "password"
                    ? { passwordHash: replacementHash }
                    : { status: "DEACTIVATED" },
              });
            },
            { timeout: 10_000 },
          );
          await locked;
          const contenderApp = createApp({
            database: contender,
            logger: pino({ level: "silent" }),
            emailDelivery: {
              provider: "console",
              send: () =>
                Promise.resolve({ providerMessageId: "test-no-live-mail" }),
            },
          });
          const signIn = request(contenderApp)
            .post("/api/v1/auth/admin/login")
            .send({ email: user.email, password, rememberMe: false })
            .then((response) => response);
          try {
            const deadline = performance.now() + 5000;
            let waiting = false;
            while (!waiting && performance.now() < deadline) {
              const rows = await database.$queryRaw<
                { waiting: boolean }[]
              >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%users%') AS waiting`;
              waiting = rows[0]?.waiting === true;
            }
            expect(waiting).toBe(true);
          } finally {
            release();
            await holding;
            await signIn;
          }
          const response = await signIn;
          expect(response.status).toBe(401);
          expect(errorEnvelopeSchema.parse(response.body).message).toBe(
            "Invalid credentials.",
          );
          expect(response.headers["set-cookie"]).toBeUndefined();
        },
      );
      expect(
        await database.authSession.count({ where: { userId: user.id } }),
      ).toBe(sessionsBefore);
      expect(
        await database.refreshToken.count({ where: { userId: user.id } }),
      ).toBe(0);
    },
  );

  it("rolls back stable-session creation when the dependent refresh insert fails", async () => {
    const { user } = await fixture();
    await database.$executeRaw`CREATE FUNCTION us2_reject_refresh() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test dependent write'; END $$`;
    await database.$executeRaw`CREATE TRIGGER us2_reject_refresh BEFORE INSERT ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION us2_reject_refresh()`;
    const before = await database.authSession.count({
      where: { userId: user.id },
    });
    try {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: user.email, password, rememberMe: false });
      expect(response.status).toBe(500);
      expect(response.headers["set-cookie"]).toBeUndefined();
      expect(
        await database.authSession.count({ where: { userId: user.id } }),
      ).toBe(before);
      expect(
        await database.refreshToken.count({ where: { userId: user.id } }),
      ).toBe(0);
    } finally {
      await database.$executeRaw`DROP TRIGGER us2_reject_refresh ON refresh_tokens`;
      await database.$executeRaw`DROP FUNCTION us2_reject_refresh()`;
    }
  });

  it("shares account and source budgets across both login entrypoints", async () => {
    resetLoginSource();
    const email = `limited-${randomUUID()}@example.com`;
    for (
      let attempt = 0;
      attempt < authRouteLimits.loginAccountSource.max;
      attempt += 1
    ) {
      expect(
        (
          await request(app)
            .post(
              attempt % 2 === 0
                ? "/api/v1/auth/login"
                : "/api/v1/auth/admin/login",
            )
            .send({ email, password, rememberMe: false })
        ).status,
      ).toBe(401);
    }
    resetLoginSource();
    for (const path of ["/api/v1/auth/login", "/api/v1/auth/admin/login"]) {
      const denied = await request(app)
        .post(path)
        .send({ email, password, rememberMe: false });
      expect(denied.status).toBe(429);
      expect(denied.headers["ratelimit"]).toBeDefined();
      expect(denied.headers["ratelimit-policy"]).toBeDefined();
    }
    resetLoginSource();
    // Distinct accounts isolate the shared source bucket from the account bucket.
    for (
      let attempt = 0;
      attempt < authRouteLimits.loginSource.max;
      attempt += 1
    ) {
      const response = await request(app)
        .post(
          attempt % 2 === 0 ? "/api/v1/auth/login" : "/api/v1/auth/admin/login",
        )
        .send({
          email: `source-${randomUUID()}@example.com`,
          password,
          rememberMe: false,
        });
      expect(response.status).toBe(401);
    }
    resetApiSource();
    for (const path of ["/api/v1/auth/login", "/api/v1/auth/admin/login"])
      expect(
        (
          await request(app)
            .post(path)
            .send({
              email: `final-${randomUUID()}@example.com`,
              password,
              rememberMe: false,
            })
        ).status,
      ).toBe(429);
  });
});
