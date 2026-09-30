/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Supertest intentionally exposes response.body as any; boundary assertions validate every consumed field. */
import pino from "pino";
import request, { type Response as SupertestResponse } from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@template/database";

import { createApp } from "./app.js";
import type {
  EmailDelivery,
  EmailSendRequest,
} from "./infrastructure/email/email-delivery.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("The Testcontainers DATABASE_URL was not provided.");
}

const database = createDatabaseClient(databaseUrl);
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

const registration = {
  fullName: "HTTP Integration User",
  email: "HTTP.User@Example.com",
  phone: null,
  password: "initial-secure-password",
};

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

describe("real HTTP authentication boundary", () => {
  beforeEach(async () => {
    delivered.length = 0;
    deliveryFailure = undefined;
    await database.refreshToken.deleteMany();
    await database.user.deleteMany();
  });

  afterAll(async () => {
    await database.$disconnect();
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
      .expect(400);

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
        where: { status: "ACTIVE", emailVerifiedAt: { not: null } },
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

  it("returns a safe 503 and rolls back registration when email delivery is unavailable", async () => {
    const providerDetail = "provider failure containing re_secret_fixture";
    deliveryFailure = new Error(providerDetail);

    const failed = await request(app)
      .post("/api/v1/auth/register")
      .send(registration);

    expect(failed.status).toBe(503);
    expect(failed.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
      message: "Registration is temporarily unavailable. Please try again.",
    });
    expect(JSON.stringify(failed.body)).not.toContain(providerDetail);
    await expect(database.user.count()).resolves.toBe(0);
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
    expect(await database.refreshToken.count()).toBe(2);

    const logout = await agentA
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${sessionA.accessToken}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({});
    expect(logout.status).toBe(200);
    expect(await database.refreshToken.count()).toBe(1);
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
    expect(await database.refreshToken.count()).toBe(2);

    const logoutAll = await agentA
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${sessionA.accessToken}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({});
    expect(logoutAll.status).toBe(200);
    expect(await database.refreshToken.count()).toBe(0);
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
    expect(await database.refreshToken.count()).toBe(0);
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
