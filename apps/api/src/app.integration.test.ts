/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Supertest intentionally exposes response.body as any; boundary assertions validate every consumed field. */
import { randomUUID } from "node:crypto";
import {
  identityUserDataSchema,
  identitySessionDataSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { createIdentityFixture } from "./modules/auth/testing/identity-fixtures.js";
import {
  generateHash,
  generateTokenPair,
  sha256,
} from "./infrastructure/security/index.js";
import { authRateLimiters } from "./modules/auth/auth.rate-limiters.js";
import { authRouteLimits } from "./core/config/auth-rate-limit.config.js";
import { apiRateLimitMiddleware } from "./middlewares/rate-limit.middleware.js";
import { ipKeyGenerator } from "express-rate-limit";
import pino from "pino";
import request, { type Response as SupertestResponse } from "supertest";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { createDatabaseClient } from "@template/database";

import { createApp } from "./app.js";
import { createLogger } from "./infrastructure/logger/logger.js";
import { createFinancialAccount } from "./modules/ledger/testing/financial-fixtures.js";
import type {
  EmailDelivery,
  EmailSendRequest,
} from "./infrastructure/email/email-delivery.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("The Testcontainers DATABASE_URL was not provided.");
}

const database = createDatabaseClient(databaseUrl);
afterAll(() => {
  // Files share limiter instances in the integration harness; retain real budgets within each file.
  for (const source of ["127.0.0.1", "::ffff:127.0.0.1"]) {
    apiRateLimitMiddleware.resetKey(ipKeyGenerator(source));
    authRateLimiters.loginSource.resetKey(ipKeyGenerator(source));
  }
});
const delivered: EmailSendRequest[] = [];
let deliveryFailure: Error | undefined;
const delivery: EmailDelivery = {
  provider: "console",
  send: (message) => {
    if (deliveryFailure !== undefined) return Promise.reject(deliveryFailure);
    delivered.push(message);
    return Promise.resolve({
      providerMessageId: `test-${String(delivered.length)}`,
    });
  },
};
const app = createApp({
  database,
  logger: pino({ level: "silent" }),
  emailDelivery: delivery,
});

describe("P04 private projection route composition", () => {
  it("exposes canonical private image headers to an allowed browser origin", async () => {
    const response = await request(app)
      .get("/api/v1/health")
      .set("Origin", "http://localhost:3000");
    expect(response.headers["access-control-expose-headers"]).toBe(
      "Content-Disposition,X-Content-Type-Options",
    );
  });
  it("mounts every read with authentication before query parsing and no-store errors", async () => {
    for (const path of [
      "/wallet/me",
      "/wallet/me/ledger",
      `/wallet/me/ledger/${randomUUID()}`,
      "/referrals/me",
      "/referrals/me/members",
      "/referrals/me/commissions",
      `/admin/wallets/${randomUUID()}`,
      "/admin/finance",
      `/admin/finance/${randomUUID()}`,
      "/admin/referrals/roots",
      `/admin/referrals/${randomUUID()}`,
      `/admin/referrals/${randomUUID()}/members`,
      `/admin/referrals/${randomUUID()}/commissions`,
    ]) {
      const response = await request(app).get(`/api/v1${path}?limit=101`);
      expect(response.status).toBe(401);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(response.body.code).toBe("UNAUTHORIZED");
    }
  });
});

describe("P02 US6 actual HTTP privacy", () => {
  it("keeps credentials/referrers/provider failures out of success, validation, error and request logs", async () => {
    const chunks: string[] = [];
    const sentinel = "sentinel-private-http-provider-signing-material";
    const privacyApp = createApp({
      database,
      logger: createLogger({
        level: "info",
        pretty: false,
        destination: {
          write: (chunk) => {
            chunks.push(chunk);
          },
        },
      }),
      emailDelivery: {
        provider: "resend",
        send: () =>
          Promise.reject(new Error(sentinel, { cause: { apiKey: sentinel } })),
      },
    });
    const { user, session } = await createIdentityFixture(database);
    const pair = generateTokenPair({
      userId: user.id,
      sessionId: session.id,
      tokenId: randomUUID(),
      email: user.email,
      role: user.role,
      rememberMe: false,
      absoluteExpiresAt: session.expiresAt,
    });
    const success = await request(privacyApp)
      .get(`/api/v1/users/me?private_key=${sentinel}`)
      .set("Authorization", `Bearer ${pair.accessToken}`)
      .set("Referer", `https://web.test/reset?token=${sentinel}`);
    expect(success.status).toBe(200);
    identityUserDataSchema.parse(
      successEnvelopeSchema.parse(success.body).data,
    );
    const invalid = await request(privacyApp)
      .get(
        `/api/v1/auth/validate-admin-invitation?token=${sentinel}&token=${sentinel}`,
      )
      .set("Referer", `https://web.test/invite?token=${sentinel}`);
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "query.token" }),
      ]),
    );
    // Inject a database transport failure; this case tests HTTP diagnostics, not persistence semantics.
    const lookup = vi
      .spyOn(database.authSession, "findUnique")
      .mockRejectedValueOnce(
        new Error(sentinel, { cause: { passwordHash: sentinel } }),
      );
    const unexpected = await (async () => {
      try {
        return await request(privacyApp)
          .get(`/api/v1/users/me?token=${sentinel}`)
          .set("Authorization", `Bearer ${pair.accessToken}`);
      } finally {
        lookup.mockRestore();
      }
    })();
    expect(unexpected.status).toBe(500);
    expect(unexpected.body.code).toBe("INTERNAL_SERVER_ERROR");
    const failed = await request(privacyApp)
      .post("/api/v1/auth/register")
      .send({
        fullName: "Privacy Employee",
        email: `privacy-${randomUUID()}@example.com`,
        password: sentinel,
      });
    expect(failed.status).toBe(503);
    for (const response of [success, invalid, unexpected, failed]) {
      expect(response.headers["cache-control"]).toBe("no-store");
      const serialized = JSON.stringify(response.body);
      expect(serialized).not.toContain(sentinel);
      expect(serialized).not.toContain(pair.accessToken);
      expect(serialized).not.toContain(user.passwordHash);
      expect(response.body).not.toHaveProperty("stack");
    }
    const emitted = chunks.join("");
    expect(emitted).toContain("request completed");
    expect(emitted).not.toContain(sentinel);
    expect(emitted).not.toContain(pair.accessToken);
    expect(emitted).not.toContain(user.passwordHash);
  });
});

describe("P02 US4 own profile", () => {
  it("updates only owned name/phone, preserves omission and permits explicit phone clearing", async () => {
    const { user, session } = await createIdentityFixture(database);
    const other = await createIdentityFixture(database);
    const pair = generateTokenPair({
      userId: user.id,
      sessionId: session.id,
      tokenId: randomUUID(),
      email: user.email,
      role: user.role,
      rememberMe: false,
      absoluteExpiresAt: session.expiresAt,
    });
    const update = (body: object) =>
      request(app)
        .patch("/api/v1/users/me")
        .set("Authorization", `Bearer ${pair.accessToken}`)
        .set("Cookie", "csrfToken=test-profile-csrf")
        .set("x-csrf-token", "test-profile-csrf")
        .send(body);
    for (const body of [
      {},
      { userId: other.user.id, fullName: "Forged" },
      { id: other.user.id, phone: "123" },
      { role: "ADMIN", fullName: "Forged" },
      { status: "BANNED", fullName: "Forged" },
      { sponsorUserId: other.user.id, fullName: "Forged" },
      { tasksBlocked: true },
      { withdrawalsBlocked: true },
      { email: other.user.email },
      { accountVersion: 1 },
      { balance: "20", fullName: "Forged" },
      { fullName: " " },
    ])
      expect((await update(body)).status).toBe(400);
    expect(
      await database.user.findUniqueOrThrow({ where: { id: user.id } }),
    ).toEqual(user);
    const named = await update({ fullName: "  Own Name  ", phone: "+964123" });
    expect(named.status).toBe(200);
    expect(
      identityUserDataSchema.parse(successEnvelopeSchema.parse(named.body).data)
        .user,
    ).toMatchObject({
      id: user.id,
      fullName: "Own Name",
      phone: "+964123",
      accountVersion: 0,
    });
    const unchanged = await update({ fullName: "Own Name" });
    expect(unchanged.status).toBe(200);
    expect(
      identityUserDataSchema.parse(
        successEnvelopeSchema.parse(unchanged.body).data,
      ).user.phone,
    ).toBe("+964123");
    const cleared = await update({ phone: null });
    expect(cleared.status).toBe(200);
    expect(cleared.headers["cache-control"]).toBe("no-store");
    expect(
      identityUserDataSchema.parse(
        successEnvelopeSchema.parse(cleared.body).data,
      ).user.phone,
    ).toBeNull();
    expect(
      await database.user.findUniqueOrThrow({ where: { id: other.user.id } }),
    ).toEqual(other.user);
    expect(
      (
        await request(app)
          .patch(`/api/v1/users/${other.user.id}`)
          .set("Authorization", `Bearer ${pair.accessToken}`)
          .send({ fullName: "Forged" })
      ).status,
    ).toBe(404);
  });
});

describe("P02 US2 public and current-account HTTP boundaries", () => {
  afterAll(async () => {
    await database.$disconnect();
  });

  it("rejects public authority assignment and exposes no public admin provisioning", async () => {
    for (const authority of [
      { role: "ADMIN" },
      { status: "ACTIVE" },
      { emailVerifiedAt: new Date().toISOString() },
    ]) {
      const email = `us2-public-${randomUUID()}@example.com`;
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({
          fullName: "Public Employee",
          email,
          password: "test-only-secure-password",
          ...authority,
        });
      expect(response.status).toBe(400);
      expect(response.headers["cache-control"]).toBe("no-store");
      expect(await database.user.findUnique({ where: { email } })).toBeNull();
    }
    expect(
      (await request(app).post("/api/v1/auth/admin/register").send({})).status,
    ).toBe(404);
    expect(
      (await request(app).post("/api/v1/auth/admin/bootstrap").send({})).status,
    ).toBe(404);
    expect(
      (
        await request(app).post("/api/v1/auth/admin/login").send({
          email: "user@example.com",
          password: "password",
          role: "ADMIN",
        })
      ).status,
    ).toBe(400);
  });

  it("returns a safe current identity and keeps the cookie-backed CSRF boundary", async () => {
    const password = "test-only-current-account-password";
    const { user } = await createIdentityFixture(database, {
      passwordHash: await generateHash(password),
    });
    const login = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: user.email, password, rememberMe: false });
    expect(login.status).toBe(200);
    const session = identitySessionDataSchema.parse(
      successEnvelopeSchema.parse(login.body).data,
    );
    const current = await request(app)
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.tokens.accessToken}`);
    expect(current.status).toBe(200);
    expect(current.headers["cache-control"]).toBe("no-store");
    expect(
      identityUserDataSchema.parse(
        successEnvelopeSchema.parse(current.body).data,
      ).user,
    ).toEqual(session.user);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/logout")
          .set("Authorization", `Bearer ${session.tokens.accessToken}`)
          .send({})
      ).status,
    ).toBe(403);
    const anonymous = await request(app).get("/api/v1/users/me");
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers["cache-control"]).toBe("no-store");
  });
});

const registration = {
  fullName: "HTTP Integration User",
  email: "HTTP.User@Example.com",
  phone: null,
  password: "initial-secure-password",
};
const ownedUsers = { email: "http.user@example.com" };
const ownedRefreshTokens = { user: ownedUsers };
let retainedFinancialOwnerId: string;

const tokenFromLastEmail = (): string => {
  const html = delivered.at(-1)?.html;
  const match = html?.match(/token=([^"&<]+)/u);
  if (match?.[1] === undefined) {
    throw new Error("Expected a token in the captured email.");
  }
  return decodeURIComponent(match[1]);
};

const setCookies = (response: SupertestResponse): string[] => {
  const value: unknown = response.headers["set-cookie"];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
};

const cookiePair = (response: SupertestResponse, name: string): string => {
  const pair = setCookies(response)
    .map((cookie) => cookie.split(";")[0] ?? "")
    .find((cookie) => cookie.startsWith(`${name}=`));
  if (pair === undefined) throw new Error(`Missing ${name} cookie.`);
  return pair;
};

const cookieValue = (pair: string): string =>
  decodeURIComponent(pair.slice(pair.indexOf("=") + 1));

const registerAndVerify = async (): Promise<void> => {
  const registered = await request(app)
    .post("/api/v1/auth/register")
    .send(registration);
  expect(registered.status).toBe(201);
  const verified = await request(app)
    .post("/api/v1/auth/verify-email")
    .query({ token: tokenFromLastEmail() })
    .send({});
  expect(verified.status).toBe(200);
};

type TestAgent = ReturnType<typeof request.agent>;
type AuthenticatedSession = Readonly<{
  response: SupertestResponse;
  accessToken: string;
  csrfToken: string;
}>;

const loginSession = async (
  agent: TestAgent,
  password = registration.password,
  rememberMe = false,
): Promise<AuthenticatedSession> => {
  const response = await agent.post("/api/v1/auth/login").send({
    email: "http.user@example.com",
    password,
    rememberMe,
  });
  expect(response.status).toBe(200);
  return {
    response,
    accessToken: response.body.data.tokens.accessToken as string,
    csrfToken: cookieValue(cookiePair(response, "csrfToken")),
  };
};

describe("P02 US3 neutral public recovery HTTP", () => {
  it.each(["forgot-password", "resend-verification"] as const)(
    "%s has equal status, content and headers for equivalent limiter histories",
    async (path) => {
      const { user } = await createIdentityFixture(database, {
        status: path === "forgot-password" ? "ACTIVE" : "PENDING_VERIFICATION",
      });
      const accountLimiter =
        path === "forgot-password"
          ? authRateLimiters.forgotAccount
          : authRateLimiters.resendAccount;
      const sourceLimiter =
        path === "forgot-password"
          ? authRateLimiters.forgotSource
          : authRateLimiters.resendSource;
      const policy =
        path === "forgot-password"
          ? authRouteLimits.forgotAccount
          : authRouteLimits.resendAccount;
      const resetHistory = () => {
        accountLimiter.resetKey(`auth:${policy.name}:${sha256(user.email)}`);
        for (const source of ["127.0.0.1", "::ffff:127.0.0.1"]) {
          sourceLimiter.resetKey(ipKeyGenerator(source));
          apiRateLimitMiddleware.resetKey(ipKeyGenerator(source));
        }
      };
      const observed: {
        status: number;
        body: unknown;
        headers: Record<string, unknown>;
      }[] = [];
      const requestId = randomUUID();
      vi.useFakeTimers({ toFake: ["Date"] });
      try {
        for (const scenario of [
          "acknowledged",
          "provider failure",
          "ineligible",
          "missing",
        ]) {
          resetHistory();
          deliveryFailure =
            scenario === "provider failure"
              ? new Error("test-only-provider-failure")
              : undefined;
          if (scenario === "provider failure")
            await database.user.update({
              where: { id: user.id },
              data: {
                verificationTokenHash: null,
                verificationTokenExpiresAt: null,
              },
            });
          if (scenario === "ineligible")
            await database.user.update({
              where: { id: user.id },
              data: { status: "SUSPENDED" },
            });
          if (scenario === "missing") {
            await database.authSession.deleteMany({
              where: { userId: user.id },
            });
            await database.wallet.delete({ where: { ownerUserId: user.id } });
            await database.user.delete({ where: { id: user.id } });
          }
          const response = await request(app)
            .post(`/api/v1/auth/${path}`)
            .set("x-request-id", requestId)
            .send({ email: user.email });
          const headers = Object.fromEntries(
            [
              "cache-control",
              "content-type",
              "ratelimit",
              "ratelimit-policy",
              "x-request-id",
              "x-content-type-options",
            ].map((key) => [key, response.headers[key]]),
          );
          observed.push({
            status: response.status,
            body: response.body,
            headers,
          });
        }
        expect(observed[0]?.status).toBe(200);
        expect(observed[0]?.headers["cache-control"]).toBe("no-store");
        for (const response of observed.slice(1))
          expect(response).toEqual(observed[0]);
      } finally {
        deliveryFailure = undefined;
        resetHistory();
        vi.useRealTimers();
      }
    },
  );
});

describe("real HTTP authentication boundary", () => {
  beforeAll(async () => {
    const financialAccount = await createFinancialAccount(database);
    retainedFinancialOwnerId = financialAccount.ownerUserId;
  });
  beforeEach(async () => {
    delivered.length = 0;
    deliveryFailure = undefined;
    await database.refreshToken.deleteMany({ where: ownedRefreshTokens });
    await database.authSession.deleteMany({ where: { user: ownedUsers } });
    await database.wallet.deleteMany({
      where: {
        owner: ownedUsers,
        availableNonReferralUnits: 0n,
        reservedNonReferralUnits: 0n,
        availableReferralUnits: 0n,
        reservedReferralUnits: 0n,
        operations: { none: {} },
        allocations: { none: {} },
      },
    });
    await database.user.deleteMany({ where: ownedUsers });
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("retains another suite's financial owner and wallet during auth cleanup", async () => {
    await expect(
      database.wallet.findUnique({
        where: { ownerUserId: retainedFinancialOwnerId },
      }),
    ).resolves.toMatchObject({ ownerUserId: retainedFinancialOwnerId });
    await expect(
      database.user.findUnique({
        where: { id: retainedFinancialOwnerId },
      }),
    ).resolves.toMatchObject({ id: retainedFinancialOwnerId });
  });

  it("allows credentialed CORS preflight headers and rejects unknown origins", async () => {
    const preflight = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "authorization, content-type, x-csrf-token",
      );

    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");
    const allowedHeaders = (
      preflight.headers["access-control-allow-headers"] ?? ""
    )
      .toLowerCase()
      .split(",")
      .map((header) => header.trim());
    expect(allowedHeaders).toEqual(
      expect.arrayContaining(["authorization", "content-type", "x-csrf-token"]),
    );

    const rejectedOrigin = await request(app)
      .get("/api/v1/health/live")
      .set("Origin", "https://unapproved.example");
    expect(rejectedOrigin.status).toBe(403);
    expect(
      rejectedOrigin.headers["access-control-allow-origin"],
    ).toBeUndefined();
  });

  it("returns target-prefixed request validation errors", async () => {
    const invalid = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, email: "invalid" });

    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
      errors: [expect.objectContaining({ field: "body.email" })],
    });
    expect(invalid.body).not.toHaveProperty("data");
    expect(invalid.body.requestId).toBe(invalid.headers["x-request-id"]);
  });

  it("registers, captures verification delivery, and activates the account", async () => {
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send(registration);

    expect(registered.status).toBe(201);
    expect(registered.body.data.user).toMatchObject({
      email: "http.user@example.com",
      status: "PENDING_VERIFICATION",
    });
    expect(registered.body.data.user).not.toHaveProperty("passwordHash");
    expect(delivered).toHaveLength(1);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: registration.email,
        password: registration.password,
        rememberMe: false,
      })
      .expect(401);

    const verified = await request(app)
      .post("/api/v1/auth/verify-email")
      .query({ token: tokenFromLastEmail() })
      .send({});
    expect(verified.status).toBe(200);
    expect(verified.body.data.user).toMatchObject({ status: "ACTIVE" });
  });

  it("allows exactly one concurrent HTTP verification request to consume a token", async () => {
    await request(app)
      .post("/api/v1/auth/register")
      .send(registration)
      .expect(201);
    const token = tokenFromLastEmail();

    const results = await Promise.all([
      request(app).post("/api/v1/auth/verify-email").query({ token }).send({}),
      request(app).post("/api/v1/auth/verify-email").query({ token }).send({}),
    ]);

    expect(results.map(({ status }) => status).sort()).toEqual([200, 400]);
    await expect(
      database.user.count({
        where: {
          ...ownedUsers,
          status: "ACTIVE",
          emailVerifiedAt: { not: null },
        },
      }),
    ).resolves.toBe(1);
    await expect(
      database.user.findUniqueOrThrow({
        where: { email: "http.user@example.com" },
      }),
    ).resolves.toMatchObject({
      status: "ACTIVE",
      emailVerifiedAt: expect.any(Date),
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
    });
  });

  it("P02 US1 returns a safe 503 and retains registration when email delivery is unavailable", async () => {
    const providerDetail = "provider failure containing re_secret_fixture";
    deliveryFailure = new Error(providerDetail);

    const failed = await request(app)
      .post("/api/v1/auth/register")
      .send(registration);

    expect(failed.status).toBe(503);
    expect(failed.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
      message:
        "A pending account may exist. Request a new verification link to continue.",
    });
    expect(JSON.stringify(failed.body)).not.toContain(providerDetail);
    await expect(database.user.count({ where: ownedUsers })).resolves.toBe(1);
  });

  it("protects current-user reads and profile writes with bearer and CSRF", async () => {
    await registerAndVerify();
    const agent = request.agent(app);
    const session = await loginSession(agent, registration.password, true);

    expect(session.response.body.data.tokens).toEqual({
      accessToken: expect.any(String),
    });
    expect(JSON.stringify(session.response.body)).not.toContain("refreshToken");
    expect(
      setCookies(session.response).find((cookie) =>
        cookie.startsWith("refreshToken="),
      ),
    ).toContain("HttpOnly");
    expect(
      setCookies(session.response).find((cookie) =>
        cookie.startsWith("csrfToken="),
      ),
    ).not.toContain("HttpOnly");

    const me = await agent
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("http.user@example.com");

    await agent
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ fullName: "Updated User" })
      .expect(403);
    await agent
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("x-csrf-token", "mismatch")
      .send({ fullName: "Updated User" })
      .expect(403);
    const updated = await agent
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("x-csrf-token", session.csrfToken)
      .send({ fullName: "Updated User", phone: "+1 555 0100" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.fullName).toBe("Updated User");
  });

  it("rotates refresh tokens once and rejects replay or a missing cookie", async () => {
    await registerAndVerify();
    const agent = request.agent(app);
    const session = await loginSession(agent, registration.password, true);
    const oldRefreshCookie = cookiePair(session.response, "refreshToken");
    const oldCsrfCookie = cookiePair(session.response, "csrfToken");

    const refreshed = await agent
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", session.csrfToken)
      .send({});
    expect(refreshed.status).toBe(200);
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${oldRefreshCookie}; ${oldCsrfCookie}`)
      .set("x-csrf-token", cookieValue(oldCsrfCookie))
      .send({});
    expect(replay.status).toBe(401);

    const missing = await request(app).post("/api/v1/auth/refresh").send({});
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("BAD_REQUEST");
  });

  it("logs out only the current refresh session", async () => {
    await registerAndVerify();
    const agentA = request.agent(app);
    const agentB = request.agent(app);
    const sessionA = await loginSession(agentA);
    const sessionB = await loginSession(agentB);
    const refreshCookieA = cookiePair(sessionA.response, "refreshToken");
    const csrfCookieA = cookiePair(sessionA.response, "csrfToken");
    expect(
      await database.refreshToken.count({ where: ownedRefreshTokens }),
    ).toBe(2);

    const logout = await agentA
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${sessionA.accessToken}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({});
    expect(logout.status).toBe(200);
    expect(
      await database.refreshToken.count({ where: ownedRefreshTokens }),
    ).toBe(1);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${refreshCookieA}; ${csrfCookieA}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({})
      .expect(401);
    await agentB
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", sessionB.csrfToken)
      .send({})
      .expect(200);
  });

  it("logs out every refresh session", async () => {
    await registerAndVerify();
    const agentA = request.agent(app);
    const agentB = request.agent(app);
    const sessionA = await loginSession(agentA);
    const sessionB = await loginSession(agentB);
    expect(
      await database.refreshToken.count({ where: ownedRefreshTokens }),
    ).toBe(2);

    const logoutAll = await agentA
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${sessionA.accessToken}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({});
    expect(logoutAll.status).toBe(200);
    expect(
      await database.refreshToken.count({ where: ownedRefreshTokens }),
    ).toBe(0);
    await agentB
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", sessionB.csrfToken)
      .send({})
      .expect(401);
  });

  it("changes a password and revokes every refresh session", async () => {
    await registerAndVerify();
    const agent = request.agent(app);
    const session = await loginSession(agent);

    const changed = await agent
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("x-csrf-token", session.csrfToken)
      .send({
        currentPassword: registration.password,
        newPassword: "changed-secure-password",
        passwordConfirmation: "changed-secure-password",
      });
    expect(changed.status).toBe(200);
    expect(
      await database.refreshToken.count({ where: ownedRefreshTokens }),
    ).toBe(0);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "http.user@example.com",
        password: registration.password,
        rememberMe: false,
      })
      .expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "http.user@example.com",
        password: "changed-secure-password",
        rememberMe: false,
      })
      .expect(200);
  });

  it("keeps recovery neutral, consumes reset once, and revokes sessions", async () => {
    await registerAndVerify();
    const recoverySession = request.agent(app);
    const session = await loginSession(recoverySession);
    const beforeUnknownEmailCount = delivered.length;

    const unknownRecovery = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });
    const knownRecovery = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "http.user@example.com" });
    expect(unknownRecovery.body.data).toEqual(knownRecovery.body.data);
    expect(delivered).toHaveLength(beforeUnknownEmailCount + 1);

    const resetToken = tokenFromLastEmail();
    await request(app)
      .get("/api/v1/auth/validate-reset-token")
      .query({ token: resetToken })
      .expect(200);
    await request(app)
      .post("/api/v1/auth/reset-password")
      .query({ token: resetToken })
      .send({
        newPassword: "reset-secure-password",
        passwordConfirmation: "reset-secure-password",
      })
      .expect(200);
    await request(app)
      .get("/api/v1/auth/validate-reset-token")
      .query({ token: resetToken })
      .expect(401);
    await recoverySession
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", session.csrfToken)
      .send({})
      .expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "http.user@example.com",
        password: "reset-secure-password",
        rememberMe: false,
      })
      .expect(200);
  });
});

describe("P02 US1 HTTP registration and email actions", () => {
  beforeEach(() => {
    deliveryFailure = undefined;
    delivered.length = 0;
  });
  it("keeps GET/HEAD/prefetch read-only and requires POST to activate without session cookies", async () => {
    const input = {
      ...registration,
      email: `us1-http-${randomUUID()}@example.com`,
    };
    const created = await request(app)
      .post("/api/v1/auth/register")
      .send(input);
    expect(created.status).toBe(201);
    expect(created.headers["cache-control"]).toBe("no-store");
    const pending = identityUserDataSchema.parse(created.body.data);
    expect(pending.user.status).toBe("PENDING_VERIFICATION");
    expect(setCookies(created)).toEqual([]);
    const token = tokenFromLastEmail();
    for (const method of ["get", "head"] as const) {
      const validated = await request(app)
        [method]("/api/v1/auth/validate-verification-token")
        .set("Purpose", "prefetch")
        .query({ token });
      expect(validated.status).toBe(200);
      expect(validated.headers["cache-control"]).toBe("no-store");
      if (method === "head") expect(validated.text).toBeUndefined();
      else expect(validated.body.data).toEqual({ valid: true });
      expect(
        await database.user.findUnique({ where: { id: pending.user.id } }),
      ).toMatchObject({ status: "PENDING_VERIFICATION", accountVersion: 0 });
    }
    expect(
      (await request(app).get("/api/v1/auth/verify-email").query({ token }))
        .status,
    ).toBe(404);
    const activated = await request(app)
      .post("/api/v1/auth/verify-email")
      .query({ token })
      .send({});
    expect(activated.status).toBe(200);
    expect(
      identityUserDataSchema.parse(activated.body.data).user,
    ).toMatchObject({
      id: pending.user.id,
      accountVersion: 1,
      status: "ACTIVE",
    });
    expect(setCookies(activated)).toEqual([]);
    expect(
      await database.authSession.count({ where: { userId: pending.user.id } }),
    ).toBe(0);
    expect(
      (
        await request(app)
          .post("/api/v1/auth/verify-email")
          .query({ token })
          .send({})
      ).status,
    ).toBe(400);
    expect(JSON.stringify(activated.body)).not.toContain(token);
    expect(
      await database.wallet.count({ where: { ownerUserId: pending.user.id } }),
    ).toBe(1);
  });

  it("rejects forged authority fields and malformed referral/query bodies without provisioning", async () => {
    const email = `us1-fields-${randomUUID()}@example.com`;
    for (const fields of [
      { role: "ADMIN" },
      { sponsorUserId: randomUUID() },
      { balance: "100" },
      { status: "ACTIVE" },
      { emailVerifiedAt: new Date().toISOString() },
      { referralCode: "malformed" },
      { passwordConfirmation: registration.password },
    ]) {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send({ ...registration, email, ...fields });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
    expect(await database.user.count({ where: { email } })).toBe(0);
    for (const query of [
      {},
      { token: "x".repeat(4097) },
      { token: ["one", "two"] },
      { token: "one", role: "ADMIN" },
    ]) {
      const response = await request(app)
        .get("/api/v1/auth/validate-verification-token")
        .query(query);
      expect(response.status).toBe(400);
      expect(response.body.code).toBe("VALIDATION_ERROR");
    }
  });

  it("shares finite token budgets between read-only validation and explicit activation", async () => {
    const token = `invalid-${randomUUID()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        (
          await request(app)
            .get("/api/v1/auth/validate-verification-token")
            .query({ token })
        ).status,
      ).toBe(400);
    }
    const limited = await request(app)
      .post("/api/v1/auth/verify-email")
      .query({ token })
      .send({});
    expect(limited.status).toBe(429);
    expect(limited.body.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(limited.headers["ratelimit"]).toBeDefined();
    expect(JSON.stringify(limited.body)).not.toContain(token);
  });

  it("keeps resend status/content/cache headers neutral when provider acknowledgement is lost", async () => {
    const input = {
      ...registration,
      email: `us1-neutral-${randomUUID()}@example.com`,
    };
    deliveryFailure = new Error("private-provider-sentinel");
    try {
      expect(
        (await request(app).post("/api/v1/auth/register").send(input)).status,
      ).toBe(503);
      await database.user.update({
        where: { email: input.email },
        data: { verificationTokenHash: null, verificationTokenExpiresAt: null },
      });
      const known = await request(app)
        .post("/api/v1/auth/resend-verification")
        .send({ email: input.email });
      const unknown = await request(app)
        .post("/api/v1/auth/resend-verification")
        .send({ email: `unknown-${randomUUID()}@example.com` });
      expect(known.status).toBe(200);
      expect(unknown.status).toBe(known.status);
      expect(known.body.data).toEqual(unknown.body.data);
      expect(known.body.message).toBe(unknown.body.message);
      expect(known.headers["cache-control"]).toBe("no-store");
      expect(known.headers["cache-control"]).toBe(
        unknown.headers["cache-control"],
      );
      expect(JSON.stringify(known.body)).not.toContain(
        "private-provider-sentinel",
      );
      expect(
        await database.wallet.count({
          where: { owner: { email: input.email } },
        }),
      ).toBe(1);
    } finally {
      deliveryFailure = undefined;
    }
  });
});
