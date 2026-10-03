import { createDatabaseClient, Prisma } from "@template/database";
import { once } from "node:events";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createServer, request as httpRequest } from "node:http";
import {
  identitySessionDataSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import pino from "pino";
import request from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { ipKeyGenerator } from "express-rate-limit";

import { createApp } from "../../app.js";
import {
  generateHash,
  generateResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  sha256,
  generateVerificationToken,
} from "../../infrastructure/security/index.js";
import { apiRateLimitMiddleware } from "../../middlewares/rate-limit.middleware.js";
import { authRateLimiters } from "./auth.rate-limiters.js";
import { authRouteLimits } from "../../core/config/auth-rate-limit.config.js";
import {
  createIdentityFixture,
  withIndependentIdentityClients,
  identityRaceBarrier,
} from "./testing/identity-fixtures.js";
import { AuthService } from "./auth.service.js";
import { EmailService } from "../../infrastructure/email/email.service.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined)
  throw new Error("The Testcontainers runtime is required.");
const connectionUrl = databaseUrl;
const database = createDatabaseClient(databaseUrl);
const password = "test-only-original-password";
const newPassword = "test-only-replacement-password";
let passwordHash: string;
const delivered: string[] = [];
const delivery = {
  provider: "smtp" as const,
  send: (message: { html: string }) => {
    delivered.push(message.html);
    return Promise.resolve({ providerMessageId: "test-no-live-mail" });
  },
};
const email = new EmailService(delivery);
const service = new AuthService(database, email);
const app = createApp({
  database,
  logger: pino({ level: "silent" }),
  emailDelivery: delivery,
});
beforeAll(async () => {
  passwordHash = await generateHash(password);
});
function resetSources() {
  for (const limiter of [
    apiRateLimitMiddleware,
    ...Object.values(authRateLimiters),
  ])
    for (const source of ["127.0.0.1", "::ffff:127.0.0.1"])
      limiter.resetKey(ipKeyGenerator(source));
  for (const source of ["127.0.0.1", "::ffff:127.0.0.1"]) {
    authRateLimiters.refreshSessionSource.resetKey(
      `auth:${authRouteLimits.refreshSessionSource.name}:${sha256(ipKeyGenerator(source))}`,
    );
    authRateLimiters.refreshFamilySource.resetKey(
      `auth:${authRouteLimits.refreshFamilySource.name}:${ipKeyGenerator(source)}`,
    );
  }
}
beforeEach(() => {
  resetSources();
  delivered.length = 0;
});
afterAll(async () => {
  resetSources();
  vi.useRealTimers();
  await database.$disconnect();
});
async function fixture(
  options: Parameters<typeof createIdentityFixture>[1] = {},
) {
  return createIdentityFixture(database, { ...options, passwordHash });
}
async function login(user: { email: string }, rememberMe = false) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email: user.email, password, rememberMe });
  expect(response.status).toBe(200);
  const projection = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(response.body).data,
  );
  const cookies: unknown = response.headers["set-cookie"];
  if (
    !Array.isArray(cookies) ||
    !cookies.every((cookie): cookie is string => typeof cookie === "string")
  )
    throw new Error("Expected session cookies");
  const pairs = cookies.map((cookie) => cookie.split(";")[0] ?? "");
  const csrf = pairs
    .find((cookie) => cookie.startsWith("csrfToken="))
    ?.slice(10);
  const refresh = pairs
    .find((cookie) => cookie.startsWith("refreshToken="))
    ?.slice(13);
  const claims = verifyAccessToken(projection.tokens.accessToken);
  if (csrf === undefined || refresh === undefined || !claims.valid)
    throw new Error("Expected session credentials");
  return {
    access: projection.tokens.accessToken,
    refresh: decodeURIComponent(refresh),
    csrf,
    cookies: pairs,
    sessionId: claims.payload.sessionId,
    userId: claims.payload.userId,
  };
}
type Device = Awaited<ReturnType<typeof login>>;

describe("P02 US6 production HTTP cookies", () => {
  it.each(["token", "source"] as const)(
    "shares the single-process invitation %s budget across preview/acceptance and ignores forged forwarding headers",
    async (bucket) => {
      const token = "sentinel-invalid-invitation-credential";
      const maximum =
        bucket === "token"
          ? authRouteLimits.invitationToken.max
          : authRouteLimits.invitationSource.max;
      const attempt = (index: number) => {
        const credential =
          bucket === "token" ? token : `${token}-${String(index)}`;
        const operation =
          index % 2 === 0
            ? request(app).get("/api/v1/auth/validate-admin-invitation")
            : request(app)
                .post("/api/v1/auth/admin-invitations/accept")
                .send({ newPassword, passwordConfirmation: newPassword });
        return operation
          .query({ token: credential })
          .set("X-Forwarded-For", `192.0.2.${String(index + 1)}`);
      };
      for (let index = 0; index < maximum; index += 1)
        expect((await attempt(index)).status).toBe(400);
      const denied = await attempt(maximum);
      expect(denied.status).toBe(429);
      expect(denied.headers["cache-control"]).toBe("no-store");
      expect(denied.headers["ratelimit-policy"]).toBeDefined();
      expect(JSON.stringify(denied.body)).not.toContain(token);
    },
  );
  it("sets Secure/HttpOnly/path/SameSite flags and still rejects refresh without matching CSRF", async () => {
    const { user } = await fixture({ role: "ADMIN" });
    const script = `
      import { createDatabaseClient } from "@template/database";
      import { createApp } from "./src/app.ts";
      import pino from "pino";
      import request from "supertest";
      const database = createDatabaseClient(process.env.DATABASE_URL);
      try {
        const app = createApp({ database, logger: pino({ level: "silent" }), emailDelivery: { provider: "resend", send: async () => ({ providerMessageId: "test-only" }) } });
        const login = await request(app).post("/api/v1/auth/admin/login").send({ email: process.env.US6_LOGIN_EMAIL, password: process.env.US6_LOGIN_PASSWORD, rememberMe: true });
        const cookies = login.headers["set-cookie"] ?? [];
        const refresh = cookies.find(cookie => cookie.startsWith("refreshToken=")) ?? "";
        const csrf = cookies.find(cookie => cookie.startsWith("csrfToken=")) ?? "";
        const denied = await request(app).post("/api/v1/auth/refresh").set("Cookie", refresh.split(";")[0]);
        const allowed = await request(app).post("/api/v1/auth/refresh").set("Cookie", cookies.map(cookie => cookie.split(";")[0])).set("x-csrf-token", csrf.split(";")[0].slice(10));
        console.log(JSON.stringify({ login: login.status, denied: denied.status, allowed: allowed.status, refreshSecure: refresh.includes("; Secure"), refreshHttpOnly: refresh.includes("; HttpOnly"), refreshPath: refresh.includes("; Path=/api/v1/auth;"), csrfSecure: csrf.includes("; Secure"), csrfReadable: !csrf.includes("; HttpOnly"), csrfPath: csrf.includes("; Path=/;"), sameSite: cookies.every(cookie => cookie.includes("; SameSite=Lax")), noStore: allowed.headers["cache-control"] }));
      } catch { console.log("safe-production-http-check-failed"); process.exitCode = 1; }
      finally { await database.$disconnect(); }
    `;
    const { stdout, stderr } = await promisify(execFile)(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "--eval", script],
      {
        timeout: 20_000,
        env: {
          ...process.env,
          NODE_ENV: "production",
          LOG_LEVEL: "silent",
          US6_LOGIN_EMAIL: user.email,
          US6_LOGIN_PASSWORD: password,
          AUTH_JWT_SECRET: "purpose-access-sentinel-000000000000000000000",
          AUTH_REFRESH_JWT_SECRET:
            "purpose-refresh-sentinel-00000000000000000000",
          AUTH_VERIFICATION_JWT_SECRET:
            "purpose-verification-sentinel-00000000000000",
          AUTH_RESET_JWT_SECRET:
            "purpose-reset-sentinel-0000000000000000000000",
          EMAIL_PROVIDER: "resend",
          RESEND_API_KEY: "re_sentinel_generated_credential",
          MAIL_FROM_NAME: "Configured Test Company",
          MAIL_FROM_ADDRESS: "sender@company.test",
          MAIL_REPLY_TO: "support@company.test",
          WEB_APP_URL: "https://company.test",
          ADMIN_INVITATION_ACCEPT_URL:
            "https://company.test/approved-test-invitation",
          AUTH_COOKIE_SAME_SITE: "lax",
        },
      },
    );
    expect(stderr).toBe("");
    expect(JSON.parse(stdout)).toEqual({
      login: 200,
      denied: 403,
      allowed: 200,
      refreshSecure: true,
      refreshHttpOnly: true,
      refreshPath: true,
      csrfSecure: true,
      csrfReadable: true,
      csrfPath: true,
      sameSite: true,
      noStore: "no-store",
    });
  });
});

describe("P02 US5 administrator lifecycle and shared credentials", () => {
  it("revokes all devices/action links on denial, and restoration revives none", async () => {
    const actor = await fixture({ role: "ADMIN" });
    const target = await fixture({ role: "ADMIN" });
    const administrator = await login(actor.user);
    const first = await login(target.user);
    const second = await login(target.user);
    const other = await fixture();
    const unaffected = await login(other.user);
    await service.forgotPassword({ email: target.user.email });
    const link = resetToken();
    const status = (state: "ACTIVE" | "DEACTIVATED", expectedVersion: number) =>
      request(app)
        .patch(`/api/v1/admin/admins/${target.user.id}/status`)
        .set("Authorization", `Bearer ${administrator.access}`)
        .set("Cookie", administrator.cookies)
        .set("x-csrf-token", administrator.csrf)
        .send({
          confirmed: true,
          reason: "Reviewed administrator lifecycle",
          expectedVersion,
          status: state,
        });
    expect((await status("DEACTIVATED", 0)).status).toBe(200);
    for (const device of [first, second]) {
      expect((await current(device)).status).toBe(401);
      expect(
        (
          await request(app)
            .post("/api/v1/auth/refresh")
            .set("Cookie", device.cookies)
            .set("x-csrf-token", device.csrf)
        ).status,
      ).toBe(401);
    }
    expect((await current(unaffected)).status).toBe(200);
    await expect(service.validateResetToken(link)).rejects.toThrow();
    expect((await status("ACTIVE", 1)).status).toBe(200);
    for (const device of [first, second])
      expect((await current(device)).status).toBe(401);
    await expect(service.validateResetToken(link)).rejects.toThrow();
    expect((await current(await login(target.user))).status).toBe(200);
    expect(
      await database.identityAuditRecord.count({
        where: {
          targetUserId: target.user.id,
          action: { in: ["ADMIN_DEACTIVATE", "ADMIN_ACTIVATE"] },
        },
      }),
    ).toBe(2);
  });
  it("uses shared administrator recovery/change/logout without elevating or restoring membership", async () => {
    const target = await fixture({ role: "ADMIN" });
    const first = await login(target.user);
    const second = await login(target.user);
    await service.forgotPassword({ email: target.user.email });
    const token = resetToken();
    await service.resetPassword(
      { newPassword, passwordConfirmation: newPassword },
      token,
    );
    for (const device of [first, second])
      expect((await current(device)).status).toBe(401);
    const signedIn = await request(app).post("/api/v1/auth/admin/login").send({
      email: target.user.email,
      password: newPassword,
      rememberMe: false,
    });
    expect(signedIn.status).toBe(200);
    expect(
      identitySessionDataSchema.parse(
        successEnvelopeSchema.parse(signedIn.body).data,
      ).user,
    ).toMatchObject({ role: "ADMIN", status: "ACTIVE" });
    expect(
      (
        await request(app)
          .post("/api/v1/auth/admin/login")
          .send({ email: target.user.email, password, rememberMe: false })
      ).status,
    ).toBe(401);
    const sessionData = identitySessionDataSchema.parse(
      successEnvelopeSchema.parse(signedIn.body).data,
    );
    const claims = verifyAccessToken(sessionData.tokens.accessToken);
    if (!claims.valid) throw new Error("Expected live administrator session");
    const identity = {
      userId: target.user.id,
      sessionId: claims.payload.sessionId,
    };
    await service.changePassword(identity, {
      currentPassword: newPassword,
      newPassword: password,
      passwordConfirmation: password,
    });
    expect(
      (
        await request(app)
          .get("/api/v1/users/me")
          .set("Authorization", `Bearer ${sessionData.tokens.accessToken}`)
      ).status,
    ).toBe(401);
    const fresh = await login(target.user);
    expect((await logout(fresh)).status).toBe(200);
    expect((await current(fresh)).status).toBe(401);
  });
});
const current = (device: Device) =>
  request(app)
    .get("/api/v1/users/me")
    .set("Authorization", `Bearer ${device.access}`);
const logout = (device: Device, all = false) =>
  request(app)
    .post(`/api/v1/auth/${all ? "logout-all" : "logout"}`)
    .set("Authorization", `Bearer ${device.access}`)
    .set("Cookie", device.cookies)
    .set("x-csrf-token", device.csrf);
const rotate = (device: Device) =>
  request(app)
    .post("/api/v1/auth/refresh")
    .set("Cookie", device.cookies)
    .set("x-csrf-token", device.csrf);
function resetToken() {
  const match = delivered.at(-1)?.match(/token=([^"&<]+)/u);
  if (match?.[1] === undefined) throw new Error("Expected reset email");
  return decodeURIComponent(match[1]);
}
const reset = (token: string) =>
  request(app)
    .post("/api/v1/auth/reset-password")
    .query({ token })
    .send({ newPassword, passwordConfirmation: newPassword });

describe("P02 US4 full employee denial and restoration", () => {
  it.each(["SUSPENDED", "BANNED"] as const)(
    "%s revokes every device and restoration never revives access, refresh or reset",
    async (status) => {
      const admin = await fixture({ role: "ADMIN" });
      const actor = await login(admin.user);
      const employee = await fixture();
      const first = await login(employee.user);
      const second = await login(employee.user);
      const unrelated = await fixture();
      const other = await login(unrelated.user);
      await service.forgotPassword({ email: employee.user.email });
      const oldReset = resetToken();
      const update = (expectedVersion: number, controls: object) =>
        request(app)
          .patch(`/api/v1/admin/employees/${employee.user.id}/restrictions`)
          .set("Authorization", `Bearer ${actor.access}`)
          .set("Cookie", actor.cookies)
          .set("x-csrf-token", actor.csrf)
          .send({
            confirmed: true,
            reason: "Reviewed denial",
            expectedVersion,
            ...controls,
          });
      expect((await update(0, { tasksBlocked: true })).status).toBe(200);
      expect((await current(first)).status).toBe(200);
      expect(
        (
          await request(app)
            .get("/api/v1/auth/validate-reset-token")
            .query({ token: oldReset })
        ).status,
      ).toBe(200);
      const denied = await update(1, { status });
      expect(denied.status).toBe(200);
      const revoked = await database.authSession.findMany({
        where: { userId: employee.user.id },
        orderBy: { id: "asc" },
      });
      expect(revoked.every((session) => session.revokedAt !== null)).toBe(true);
      expect(
        await database.refreshToken.count({
          where: { userId: employee.user.id },
        }),
      ).toBe(0);
      const stored = await database.user.findUniqueOrThrow({
        where: { id: employee.user.id },
      });
      expect(stored).toMatchObject({
        status,
        tasksBlocked: true,
        withdrawalsBlocked: false,
        accountVersion: 2,
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      });
      for (const device of [first, second]) {
        expect((await current(device)).status).toBe(401);
        expect((await rotate(device)).status).toBe(401);
      }
      expect(
        (
          await request(app)
            .post("/api/v1/auth/login")
            .send({ email: employee.user.email, password, rememberMe: false })
        ).status,
      ).toBe(401);
      expect((await update(2, { status: "ACTIVE" })).status).toBe(200);
      for (const device of [first, second]) {
        expect((await current(device)).status).toBe(401);
        expect((await rotate(device)).status).toBe(401);
      }
      expect((await reset(oldReset)).status).toBe(401);
      expect((await current(other)).status).toBe(200);
      expect(
        await database.authSession.findMany({
          where: { userId: employee.user.id },
          orderBy: { id: "asc" },
        }),
      ).toEqual(revoked);
      const fresh = await login(employee.user);
      expect((await current(fresh)).status).toBe(200);
      expect(
        await database.user.findUniqueOrThrow({
          where: { id: employee.user.id },
        }),
      ).toMatchObject({
        status: "ACTIVE",
        tasksBlocked: true,
        withdrawalsBlocked: false,
        accountVersion: 3,
      });
    },
  );

  it("restores an unverified employee to pending and requires fresh verification proof", async () => {
    const admin = await fixture({ role: "ADMIN" });
    const actor = await login(admin.user);
    const { user } = await fixture({ status: "PENDING_VERIFICATION" });
    const expiresAt = new Date(Date.now() + 60_000);
    const oldToken = generateVerificationToken(user.email, user.id, expiresAt);
    await database.user.update({
      where: { id: user.id },
      data: {
        verificationTokenHash: sha256(oldToken),
        verificationTokenExpiresAt: expiresAt,
      },
    });
    const control = (expectedVersion: number, status: string) =>
      request(app)
        .patch(`/api/v1/admin/employees/${user.id}/restrictions`)
        .set("Authorization", `Bearer ${actor.access}`)
        .set("Cookie", actor.cookies)
        .set("x-csrf-token", actor.csrf)
        .send({
          confirmed: true,
          reason: "Reviewed pending account",
          expectedVersion,
          status,
        });
    expect((await control(0, "BANNED")).status).toBe(200);
    expect((await control(1, "ACTIVE")).status).toBe(200);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({
      status: "PENDING_VERIFICATION",
      emailVerifiedAt: null,
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
      accountVersion: 2,
    });
    expect(
      (
        await request(app)
          .post("/api/v1/auth/verify-email")
          .query({ token: oldToken })
      ).status,
    ).toBe(400);
    await service.resendVerification({ email: user.email });
    const freshToken = resetToken();
    expect(freshToken).not.toBe(oldToken);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/verify-email")
          .query({ token: freshToken })
      ).status,
    ).toBe(200);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toMatchObject({ status: "ACTIVE", accountVersion: 3 });
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: user.id },
      }),
    ).toBe(2);
  });
});

async function lockedWrite<T>(
  userId: string,
  mutation: (transaction: Prisma.TransactionClient) => Promise<void>,
  action: (contender: AuthService) => Promise<T>,
): Promise<T> {
  return withIndependentIdentityClients(
    connectionUrl,
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
            Prisma.sql`SELECT id FROM users WHERE id=${userId}::uuid FOR UPDATE`,
          );
          acquire();
          await released;
          await mutation(transaction);
        },
        { timeout: 10_000 },
      );
      await acquired;
      const outcome = action(new AuthService(contender, email)).then(
        (response) => ({ response }),
        (failure: unknown) => ({ failure }),
      );
      try {
        let waiting = false;
        const deadline = performance.now() + 5000;
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
        await outcome;
      }
      const completed = await outcome;
      if ("failure" in completed) throw completed.failure;
      return completed.response;
    },
  );
}

describe("P02 US3 session revocation and recovery", () => {
  it("a lost logout acknowledgement leaves committed revocation and an irreversible tombstone", async () => {
    const device = await login((await fixture()).user);
    const upstream = createServer(app);
    upstream.listen(0, "127.0.0.1");
    await once(upstream, "listening");
    const address = upstream.address();
    if (address === null || typeof address === "string")
      throw new Error("Expected isolated HTTP listener");
    let committedStatus: number | undefined;
    const proxy = createServer((incoming, outgoing) => {
      const forwarded = httpRequest(
        {
          hostname: "127.0.0.1",
          port: address.port,
          path: incoming.url,
          method: incoming.method,
          headers: incoming.headers,
        },
        (acknowledgement) => {
          committedStatus = acknowledgement.statusCode;
          acknowledgement.on("end", () => outgoing.destroy());
          acknowledgement.resume();
        },
      );
      forwarded.on("error", () => outgoing.destroy());
      incoming.pipe(forwarded);
    });
    try {
      await expect(
        request(proxy)
          .post("/api/v1/auth/logout")
          .set("Authorization", `Bearer ${device.access}`)
          .set("Cookie", device.cookies)
          .set("x-csrf-token", device.csrf)
          .then((response) => response),
      ).rejects.toThrow();
      expect(committedStatus).toBe(200);
      expect((await current(device)).status).toBe(401);
      expect((await rotate(device)).status).toBe(401);
      expect(
        await database.refreshToken.count({
          where: { sessionId: device.sessionId },
        }),
      ).toBe(0);
      const tombstone = await database.authSession.findUniqueOrThrow({
        where: { id: device.sessionId },
      });
      expect(tombstone.revokedAt).not.toBeNull();
      expect((await logout(device)).status).toBe(401);
      expect(
        (
          await database.authSession.findUniqueOrThrow({
            where: { id: device.sessionId },
          })
        ).revokedAt,
      ).toEqual(tombstone.revokedAt);
    } finally {
      for (const server of [proxy, upstream])
        if (server.listening)
          await new Promise<void>((resolve, reject) =>
            server.close((failure) => {
              if (failure === undefined) resolve();
              else reject(failure);
            }),
          );
    }
  });
  it.each([false, true])(
    "rotation preserves access, original expiry and rememberMe=%s; stale/absent-cookie logout revokes only its session",
    async (rememberMe) => {
      const { user } = await fixture();
      const first = await login(user, rememberMe);
      const second = await login(user);
      const unrelated = await login((await fixture()).user);
      const original = await database.authSession.findUniqueOrThrow({
        where: { id: first.sessionId },
      });
      const rotation = await rotate(first);
      expect(rotation.status).toBe(200);
      expect((await current(first)).status).toBe(200);
      expect((await rotate(first)).status).toBe(401);
      const stored = await database.refreshToken.findUniqueOrThrow({
        where: { sessionId: first.sessionId },
      });
      expect(stored.expiresAt).toEqual(original.expiresAt);
      expect(
        (
          await database.authSession.findUniqueOrThrow({
            where: { id: first.sessionId },
          })
        ).rememberMe,
      ).toBe(rememberMe);
      expect(
        (
          await logout(
            rememberMe
              ? {
                  ...first,
                  cookies: first.cookies.filter((cookie) =>
                    cookie.startsWith("csrfToken="),
                  ),
                }
              : first,
          )
        ).status,
      ).toBe(200);
      expect((await current(first)).status).toBe(401);
      expect((await current(second)).status).toBe(200);
      expect((await current(unrelated)).status).toBe(200);
      expect(
        await database.refreshToken.count({
          where: { sessionId: first.sessionId },
        }),
      ).toBe(0);
      expect(
        (
          await database.authSession.findUniqueOrThrow({
            where: { id: first.sessionId },
          })
        ).revokedAt,
      ).not.toBeNull();
    },
  );

  it.each(["logout-all", "reset", "change"])(
    "%s revokes every account session including the caller, without affecting another account",
    async (action) => {
      const { user } = await fixture();
      const first = await login(user);
      const second = await login(user);
      const unrelated = await login((await fixture()).user);
      let response;
      if (action === "logout-all") response = await logout(first, true);
      else if (action === "reset") {
        await service.forgotPassword({ email: user.email });
        response = await reset(resetToken());
      } else
        response = await request(app)
          .patch("/api/v1/auth/change-password")
          .set("Authorization", `Bearer ${first.access}`)
          .set("Cookie", first.cookies)
          .set("x-csrf-token", first.csrf)
          .send({
            currentPassword: password,
            newPassword,
            passwordConfirmation: newPassword,
          });
      expect(response.status).toBe(200);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.headers["set-cookie"]).toEqual(
        expect.arrayContaining([
          expect.stringContaining("refreshToken=;"),
          expect.stringContaining("csrfToken=;"),
        ]),
      );
      for (const device of [first, second]) {
        expect((await current(device)).status).toBe(401);
        expect((await rotate(device)).status).toBe(401);
      }
      expect((await current(unrelated)).status).toBe(200);
      expect(
        await database.authSession.count({
          where: { userId: user.id, revokedAt: null },
        }),
      ).toBe(0);
      expect(
        await database.refreshToken.count({ where: { userId: user.id } }),
      ).toBe(0);
      if (action !== "logout-all") {
        await expect(
          service.login({ email: user.email, password, rememberMe: false }),
        ).rejects.toMatchObject({ statusCode: 401 });
        await expect(
          service.login({
            email: user.email,
            password: newPassword,
            rememberMe: false,
          }),
        ).resolves.toMatchObject({ user: { id: user.id } });
      }
    },
  );

  it("GET/HEAD reset validation is read-only; replacement, wrong purpose and replay cannot reset again", async () => {
    const { user } = await fixture();
    await service.forgotPassword({ email: user.email });
    const old = resetToken();
    await service.forgotPassword({ email: user.email });
    const token = resetToken();
    expect((await reset(old)).status).toBe(401);
    const device = await login(user);
    expect((await reset(device.refresh)).status).toBe(401);
    const before = await database.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    for (const method of ["get", "head"] as const) {
      const response = await request(app)
        [method]("/api/v1/auth/validate-reset-token")
        .query({ token });
      expect(response.status).toBe(200);
      if (method === "head") expect(response.text).toBeUndefined();
    }
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
        .resetTokenHash,
    ).toBe(before.resetTokenHash);
    expect((await reset(token)).status).toBe(200);
    expect((await reset(token)).status).toBe(401);
    expect(await service.forgotPassword({ email: user.email })).toHaveProperty(
      "message",
    );
  });

  it.each(["refresh", "reset"])(
    "concurrent %s consumption has one winner on independent connections",
    async (operation) => {
      const { user } = await fixture();
      const device = await login(user);
      await service.forgotPassword({ email: user.email });
      const token = resetToken();
      await withIndependentIdentityClients(
        connectionUrl,
        async (first, second) => {
          const barrier = identityRaceBarrier(2);
          const outcomes = await Promise.allSettled(
            [first, second].map(async (client) => {
              await barrier();
              const contender = new AuthService(client, email);
              return operation === "refresh"
                ? contender.refresh(device.refresh)
                : contender.resetPassword(
                    { newPassword, passwordConfirmation: newPassword },
                    token,
                  );
            }),
          );
          expect(outcomes.map(({ status }) => status).sort()).toEqual([
            "fulfilled",
            "rejected",
          ]);
        },
      );
      expect(
        await database.refreshToken.count({
          where: { sessionId: device.sessionId },
        }),
      ).toBe(operation === "refresh" ? 1 : 0);
      expect((await current(device)).status).toBe(
        operation === "refresh" ? 200 : 401,
      );
      if (operation === "reset")
        expect(
          (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
            .resetTokenHash,
        ).toBeNull();
    },
  );

  it.each(["logout", "logout-all", "reset"])(
    "refresh racing %s leaves no authority after the winning revoke",
    async (operation) => {
      const { user } = await fixture();
      const device = await login(user);
      await service.forgotPassword({ email: user.email });
      const token = resetToken();
      await withIndependentIdentityClients(
        connectionUrl,
        async (first, second) => {
          const barrier = identityRaceBarrier(2);
          const outcomes = await Promise.allSettled([
            (async () => {
              await barrier();
              return new AuthService(first, email).refresh(device.refresh);
            })(),
            (async () => {
              await barrier();
              const contender = new AuthService(second, email);
              if (operation === "logout") return contender.logout(device);
              if (operation === "logout-all")
                return contender.logoutAll(device);
              return contender.resetPassword(
                { newPassword, passwordConfirmation: newPassword },
                token,
              );
            })(),
          ]);
          expect(outcomes[1].status).toBe("fulfilled");
          const refreshOutcome = outcomes[0];
          if (refreshOutcome.status === "fulfilled") {
            await expect(
              service.refresh(refreshOutcome.value.tokens.refreshToken),
            ).rejects.toMatchObject({ statusCode: 401 });
            expect(
              (
                await request(app)
                  .get("/api/v1/users/me")
                  .set(
                    "Authorization",
                    `Bearer ${refreshOutcome.value.tokens.accessToken}`,
                  )
              ).status,
            ).toBe(401);
          }
        },
      );
      expect((await current(device)).status).toBe(401);
      expect(
        await database.refreshToken.count({ where: { userId: user.id } }),
      ).toBe(0);
      const tombstone = await database.authSession.findUniqueOrThrow({
        where: { id: device.sessionId },
      });
      expect(tombstone.revokedAt).not.toBeNull();
      await expect(service.logout(device)).rejects.toMatchObject({
        statusCode: 401,
      });
      expect(
        (
          await database.authSession.findUniqueOrThrow({
            where: { id: device.sessionId },
          })
        ).revokedAt,
      ).toEqual(tombstone.revokedAt);
    },
  );

  it.each(["refresh", "reset", "change"])(
    "%s rechecks authority after a User lock wait",
    async (operation) => {
      const { user } = await fixture();
      const device = await login(user);
      await service.forgotPassword({ email: user.email });
      const token = resetToken();
      const replacedHash = await generateHash("test-only-competing-password");
      await expect(
        lockedWrite(
          user.id,
          async (transaction) => {
            await transaction.user.update({
              where: { id: user.id },
              data:
                operation === "change"
                  ? { passwordHash: replacedHash }
                  : { status: "SUSPENDED" },
            });
          },
          async (contender) => {
            if (operation === "refresh")
              return contender.refresh(device.refresh);
            if (operation === "reset")
              return contender.resetPassword(
                { newPassword, passwordConfirmation: newPassword },
                token,
              );
            return contender.changePassword(device, {
              currentPassword: password,
              newPassword,
              passwordConfirmation: newPassword,
            });
          },
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
      const stored = await database.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.passwordHash).toBe(
        operation === "change" ? replacedHash : passwordHash,
      );
      expect(stored.resetTokenHash).toBe(sha256(token));
      expect(
        await database.refreshToken.count({
          where: { sessionId: device.sessionId },
        }),
      ).toBe(1);
    },
  );

  it.each(["refresh", "reset"])(
    "%s rejects expiry crossed while waiting for the User lock",
    async (operation) => {
      const { user } = await fixture();
      const device = await login(user);
      await service.forgotPassword({ email: user.email });
      const token = resetToken();
      const stored = await database.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      const session = await database.authSession.findUniqueOrThrow({
        where: { id: device.sessionId },
      });
      const expiry =
        operation === "reset" ? stored.resetTokenExpiresAt : session.expiresAt;
      if (expiry === null) throw new Error("Expected expiry");
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        await expect(
          lockedWrite(
            user.id,
            () => {
              vi.setSystemTime(expiry);
              return Promise.resolve();
            },
            (contender) =>
              operation === "refresh"
                ? contender.refresh(device.refresh)
                : contender.resetPassword(
                    { newPassword, passwordConfirmation: newPassword },
                    token,
                  ),
          ),
        ).rejects.toMatchObject({ statusCode: 401 });
        expect(
          await database.refreshToken.count({
            where: { sessionId: device.sessionId },
          }),
        ).toBe(1);
        expect(
          (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
            .passwordHash,
        ).toBe(passwordHash);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["USER", "ADMIN"] as const)(
    "%s recovery preserves role and verification; password change invalidates prior links and allows fresh issuance",
    async (role) => {
      const { user } = await fixture({ role });
      const device = await login(user);
      if (role === "USER")
        await database.user.update({
          where: { id: user.id },
          data: { tasksBlocked: true, withdrawalsBlocked: true },
        });
      await service.forgotPassword({ email: user.email });
      const old = resetToken();
      await service.changePassword(device, {
        currentPassword: password,
        newPassword,
        passwordConfirmation: newPassword,
      });
      await expect(service.validateResetToken(old)).rejects.toMatchObject({
        statusCode: 401,
      });
      await service.forgotPassword({ email: user.email });
      const fresh = resetToken();
      await expect(service.validateResetToken(fresh)).resolves.toEqual({
        valid: true,
      });
      await service.resetPassword(
        { newPassword: password, passwordConfirmation: password },
        fresh,
      );
      const stored = await database.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored).toMatchObject({
        role,
        status: "ACTIVE",
        emailVerifiedAt: user.emailVerifiedAt,
        accountVersion: user.accountVersion,
        tasksBlocked: role === "USER",
        withdrawalsBlocked: role === "USER",
      });
    },
  );

  it.each([
    "PENDING_VERIFICATION",
    "SUSPENDED",
    "BANNED",
    "DEACTIVATED",
  ] as const)("%s cannot receive or consume recovery", async (status) => {
    const { user } = await fixture({
      role: status === "DEACTIVATED" ? "ADMIN" : "USER",
    });
    await service.forgotPassword({ email: user.email });
    const token = resetToken();
    await database.user.update({ where: { id: user.id }, data: { status } });
    delivered.length = 0;
    expect(await service.forgotPassword({ email: user.email })).toEqual(
      await service.forgotPassword({ email: "missing-recovery@example.com" }),
    );
    expect(delivered).toHaveLength(0);
    await expect(service.validateResetToken(token)).rejects.toMatchObject({
      statusCode: 401,
    });
    await expect(
      service.resetPassword(
        { newPassword, passwordConfirmation: newPassword },
        token,
      ),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
        .passwordHash,
    ).toBe(passwordHash);
  });

  it("server session expiry denies cookies and old access even when the browser retains them", async () => {
    const device = await login((await fixture()).user, true);
    const claims = verifyRefreshToken(device.refresh);
    if (!claims.valid) throw new Error("Expected refresh claims");
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(claims.payload.expiresAt * 1000 - 1000);
      const rotated = await service.refresh(device.refresh);
      vi.setSystemTime(claims.payload.expiresAt * 1000);
      expect(verifyAccessToken(rotated.tokens.accessToken).valid).toBe(true);
      expect(
        (
          await request(app)
            .get("/api/v1/users/me")
            .set("Authorization", `Bearer ${rotated.tokens.accessToken}`)
        ).status,
      ).toBe(401);
      await expect(
        service.refresh(rotated.tokens.refreshToken),
      ).rejects.toMatchObject({ statusCode: 401 });
      expect((await current(device)).status).toBe(401);
      expect((await rotate(device)).status).toBe(401);
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovery issuance racing password change either gets invalidated or creates a fresh link after the committed change", async () => {
    const { user } = await fixture();
    const device = await login(user);
    await withIndependentIdentityClients(
      connectionUrl,
      async (first, second) => {
        const barrier = identityRaceBarrier(2);
        const outcomes = await Promise.allSettled([
          (async () => {
            await barrier();
            return new AuthService(first, email).forgotPassword({
              email: user.email,
            });
          })(),
          (async () => {
            await barrier();
            return new AuthService(second, email).changePassword(device, {
              currentPassword: password,
              newPassword,
              passwordConfirmation: newPassword,
            });
          })(),
        ]);
        expect(outcomes.map(({ status }) => status)).toEqual([
          "fulfilled",
          "fulfilled",
        ]);
      },
    );
    const token = resetToken();
    const stored = await database.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    if (stored.resetTokenHash === null)
      await expect(service.validateResetToken(token)).rejects.toMatchObject({
        statusCode: 401,
      });
    else {
      expect(stored.resetTokenHash).toBe(sha256(token));
      await expect(service.validateResetToken(token)).resolves.toEqual({
        valid: true,
      });
    }
    expect((await current(device)).status).toBe(401);
    await expect(
      service.login({
        email: user.email,
        password: newPassword,
        rememberMe: false,
      }),
    ).resolves.toMatchObject({ user: { id: user.id } });
  });

  it("competing reset and password change cannot commit stale comparisons", async () => {
    const { user } = await fixture();
    const device = await login(user);
    await service.forgotPassword({ email: user.email });
    const token = resetToken();
    await withIndependentIdentityClients(
      connectionUrl,
      async (first, second) => {
        const barrier = identityRaceBarrier(2);
        const outcomes = await Promise.allSettled([
          (async () => {
            await barrier();
            return new AuthService(first, email).resetPassword(
              { newPassword, passwordConfirmation: newPassword },
              token,
            );
          })(),
          (async () => {
            await barrier();
            return new AuthService(second, email).changePassword(device, {
              currentPassword: password,
              newPassword: "test-only-competing-password",
              passwordConfirmation: "test-only-competing-password",
            });
          })(),
        ]);
        expect(outcomes.map(({ status }) => status).sort()).toEqual([
          "fulfilled",
          "rejected",
        ]);
        const winningPassword =
          outcomes[0].status === "fulfilled"
            ? newPassword
            : "test-only-competing-password";
        await expect(
          service.login({
            email: user.email,
            password: winningPassword,
            rememberMe: false,
          }),
        ).resolves.toMatchObject({ user: { id: user.id } });
      },
    );
    await expect(service.validateResetToken(token)).rejects.toMatchObject({
      statusCode: 401,
    });
    expect((await current(device)).status).toBe(401);
  });

  it("recovery issuance rechecks eligibility after waiting for the User lock", async () => {
    const { user } = await fixture();
    await expect(
      lockedWrite(
        user.id,
        async (transaction) => {
          await transaction.user.update({
            where: { id: user.id },
            data: { status: "BANNED" },
          });
        },
        (contender) => contender.forgotPassword({ email: user.email }),
      ),
    ).resolves.toHaveProperty("message");
    expect(delivered).toHaveLength(0);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
        .resetTokenHash,
    ).toBeNull();
  });

  it("rotating credentials cannot reset the verified stable-session refresh budget", async () => {
    let device = await login((await fixture()).user);
    for (
      let attempt = 0;
      attempt < authRouteLimits.refreshSessionSource.max;
      attempt += 1
    ) {
      for (const source of ["127.0.0.1", "::ffff:127.0.0.1"]) {
        authRateLimiters.refreshSource.resetKey(ipKeyGenerator(source));
        apiRateLimitMiddleware.resetKey(ipKeyGenerator(source));
      }
      const response = await rotate(device);
      expect(response.status).toBe(200);
      const projection = identitySessionDataSchema.parse(
        successEnvelopeSchema.parse(response.body).data,
      );
      const cookies: unknown = response.headers["set-cookie"];
      if (
        !Array.isArray(cookies) ||
        !cookies.every((cookie): cookie is string => typeof cookie === "string")
      )
        throw new Error("Expected rotated cookies");
      const pairs = cookies.map((cookie) => cookie.split(";")[0] ?? "");
      const refresh = pairs
        .find((cookie) => cookie.startsWith("refreshToken="))
        ?.slice(13);
      const csrf = pairs
        .find((cookie) => cookie.startsWith("csrfToken="))
        ?.slice(10);
      if (refresh === undefined || csrf === undefined)
        throw new Error("Expected rotated credentials");
      device = {
        ...device,
        access: projection.tokens.accessToken,
        refresh: decodeURIComponent(refresh),
        csrf,
        cookies: pairs,
      };
    }
    for (const source of ["127.0.0.1", "::ffff:127.0.0.1"])
      authRateLimiters.refreshSource.resetKey(ipKeyGenerator(source));
    const denied = await rotate(device);
    expect(denied.status).toBe(429);
    expect(
      (
        await database.refreshToken.findUniqueOrThrow({
          where: { sessionId: device.sessionId },
        })
      ).tokenHash,
    ).toBe(sha256(device.refresh));
    expect((await current(device)).status).toBe(200);
  });

  it("current logout uses its authenticated session budget despite changing or absent refresh cookies", async () => {
    const device = await login((await fixture()).user);
    for (
      let attempt = 0;
      attempt < authRouteLimits.logoutSession.max;
      attempt += 1
    ) {
      for (const source of ["127.0.0.1", "::ffff:127.0.0.1"])
        apiRateLimitMiddleware.resetKey(ipKeyGenerator(source));
      const response = await request(app)
        .post("/api/v1/auth/logout")
        .set("Authorization", `Bearer ${device.access}`)
        .set("Cookie", `refreshToken=forged-${String(attempt)}`);
      expect(response.status).toBe(403);
    }
    expect((await logout(device)).status).toBe(429);
    expect((await current(device)).status).toBe(200);
    expect(
      (
        await database.authSession.findUniqueOrThrow({
          where: { id: device.sessionId },
        })
      ).revokedAt,
    ).toBeNull();
  });

  it("password and session writes roll back together when refresh deletion fails", async () => {
    const { user } = await fixture();
    const device = await login(user);
    await service.forgotPassword({ email: user.email });
    const token = resetToken();
    await database.$executeRaw`CREATE FUNCTION us3_reject_refresh_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test-only dependent delete'; END $$`;
    await database.$executeRaw`CREATE TRIGGER us3_reject_refresh_delete BEFORE DELETE ON refresh_tokens FOR EACH ROW EXECUTE FUNCTION us3_reject_refresh_delete()`;
    try {
      expect((await reset(token)).status).toBe(500);
      const stored = await database.user.findUniqueOrThrow({
        where: { id: user.id },
      });
      expect(stored.passwordHash).toBe(passwordHash);
      expect(stored.resetTokenHash).toBe(sha256(token));
      expect(
        (
          await database.authSession.findUniqueOrThrow({
            where: { id: device.sessionId },
          })
        ).revokedAt,
      ).toBeNull();
      expect((await current(device)).status).toBe(200);
      expect(
        await database.refreshToken.count({
          where: { sessionId: device.sessionId },
        }),
      ).toBe(1);
    } finally {
      await database.$executeRaw`DROP TRIGGER us3_reject_refresh_delete ON refresh_tokens`;
      await database.$executeRaw`DROP FUNCTION us3_reject_refresh_delete()`;
    }
    expect((await reset(token)).status).toBe(200);
    expect((await current(device)).status).toBe(401);
  });

  it("source refresh budget bounds distinct invalid credentials before any session work", async () => {
    const before = await database.authSession.count();
    for (
      let attempt = 0;
      attempt < authRouteLimits.refreshSource.max;
      attempt += 1
    ) {
      for (const source of ["127.0.0.1", "::ffff:127.0.0.1"])
        apiRateLimitMiddleware.resetKey(ipKeyGenerator(source));
      const denied = await request(app)
        .post("/api/v1/auth/refresh")
        .set("Cookie", [
          `refreshToken=invalid-${String(attempt)}`,
          "csrfToken=test-csrf",
        ])
        .set("x-csrf-token", "test-csrf");
      expect(denied.status).toBe(401);
    }
    const limited = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", ["refreshToken=one-more-invalid", "csrfToken=test-csrf"])
      .set("x-csrf-token", "test-csrf");
    expect(limited.status).toBe(429);
    expect(limited.headers["cache-control"]).toBe("no-store");
    expect(await database.authSession.count()).toBe(before);
  });

  it.each(["email", "userId"])(
    "a reset with the wrong %s cannot consume another account's persisted credential",
    async (binding) => {
      const { user } = await fixture();
      const other = await fixture();
      const expiry = new Date(Date.now() + 60_000);
      const token = generateResetToken(
        binding === "email" ? other.user.email : user.email,
        binding === "userId" ? other.user.id : user.id,
        expiry,
      );
      await database.user.update({
        where: { id: user.id },
        data: { resetTokenHash: sha256(token), resetTokenExpiresAt: expiry },
      });
      await expect(service.validateResetToken(token)).rejects.toMatchObject({
        statusCode: 401,
      });
      await expect(
        service.resetPassword(
          { newPassword, passwordConfirmation: newPassword },
          token,
        ),
      ).rejects.toMatchObject({ statusCode: 401 });
      for (const id of [user.id, other.user.id])
        expect(
          (await database.user.findUniqueOrThrow({ where: { id } }))
            .passwordHash,
        ).toBe(passwordHash);
    },
  );
});
