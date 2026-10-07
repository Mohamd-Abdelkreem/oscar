import { createInterface } from "node:readline";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProofsRuntime } from "../../src/modules/proofs/proofs.runtime.js";
import type { P05TaskScenario } from "./p05-tasks.js";
import type { P05DecoderBarrier } from "./p05-decoder-barrier.js";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { promisify } from "node:util";

import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { DatabaseClient } from "@template/database";
import type { P04FinanceScenario } from "./p04-finance.js";

import {
  controlRequestSchema,
  type ControlReply,
  type ControlRequest,
} from "./control.js";

// Configuration modules must load only after this scenario has discarded inherited state.
for (const key of Object.keys(process.env)) {
  if (
    key === "DATABASE_URL" ||
    key.startsWith("AUTH_LIMIT_") ||
    key === "API_RATE_LIMIT_MAX" ||
    key === "API_RATE_LIMIT_WINDOW_MS"
  )
    Reflect.deleteProperty(process.env, key);
}
Object.assign(process.env, {
  NODE_ENV: "test",
  RAILWAY_ENVIRONMENT: "p03-e2e",
  LOG_LEVEL: "silent",
  TRUST_PROXY: "false",
  API_HOST: "127.0.0.1",
  API_PORT: "4103",
  API_PREFIX: "/api/v1",
  CORS_ORIGINS: "http://127.0.0.1:3103",
  WEB_APP_URL: "http://127.0.0.1:3103",
  ADMIN_INVITATION_ACCEPT_URL:
    "http://127.0.0.1:3103/admin/auth/accept-invitation",
  EMAIL_PROVIDER: "resend",
  RESEND_API_KEY: "re_p03_isolated_no_network",
  MAIL_FROM_NAME: "OSCAR test",
  MAIL_FROM_ADDRESS: "test@example.test",
  MAIL_REPLY_TO: "support@example.test",
  AUTH_JWT_SECRET: randomUUID() + randomUUID(),
  // The finite financial clock journey stays inside a legitimately issued session lease.
  AUTH_REFRESH_FAMILY_TTL_SECONDS: String(14 * 24 * 60 * 60),
  AUTH_REFRESH_JWT_SECRET: randomUUID() + randomUUID(),
  AUTH_VERIFICATION_JWT_SECRET: randomUUID() + randomUUID(),
  AUTH_RESET_JWT_SECRET: randomUUID() + randomUUID(),
  // Nine-route proof/UI acceptance makes many bounded reads from one loopback IP.
  // Keep the real limiter finite; its production/default and P03 rate tests are unchanged.
  ...(process.env["P05_E2E_DATABASE_URL"]
    ? { API_RATE_LIMIT_MAX: "1000" }
    : {}),
});

let container: StartedPostgreSqlContainer | undefined;
let database: DatabaseClient | undefined;
let server: Server | undefined;
let financial: P04FinanceScenario | undefined;
let taskScenario: P05TaskScenario | undefined;
let proofs: ProofsRuntime | undefined;
let decoderBarrier: P05DecoderBarrier | undefined;
let privateRoot: string | undefined;
const nativeBridge = process.env["P05_E2E_DATABASE_URL"] !== undefined;
const lifecycle = { stopping: false };
const stopRequested = () => lifecycle.stopping;
let cleanupPromise: Promise<void> | undefined;
const mail = new Map<string, string>();
let deliveryOutcome: "acknowledged" | "rejected" | "unknown" = "acknowledged";
const send = (reply: ControlReply) => {
  if (nativeBridge) process.stdout.write(JSON.stringify(reply) + "\n");
  else if (process.connected) process.send?.(reply);
};
const cleanup = (): Promise<void> => {
  lifecycle.stopping = true;
  cleanupPromise ??= (async () => {
    server?.closeAllConnections();
    if (server !== undefined)
      await new Promise<void>((resolveClose) => {
        server?.close(() => {
          resolveClose();
        });
      });
    decoderBarrier?.dispose();
    await proofs?.stop();
    await database?.$disconnect();
    if (privateRoot) await rm(privateRoot, { recursive: true, force: true });
    await container?.stop();
    mail.clear();
  })();
  return cleanupPromise;
};

const control = async (
  request: ControlRequest,
): Promise<ControlReply["data"]> => {
  if (request.command === "stop") {
    await cleanup();
    return null;
  }
  if (request.command === "delivery") {
    deliveryOutcome = request.outcome;
    return null;
  }
  if (request.command === "mail")
    return { url: mail.get(request.email) ?? null };
  if (database === undefined) throw new Error("HARNESS_NOT_READY");
  const finance = financial;
  if (finance === undefined) throw new Error("HARNESS_NOT_READY");
  if (request.command === "p05-fixtures") {
    const instant = request.futureWorkDate
      ? new Date()
      : new Date("2026-10-05T09:00:00.000Z");
    if (request.futureWorkDate) {
      // Reviewed catalog updates must follow the actual migration seed time.
      instant.setUTCDate(instant.getUTCDate() + 1);
      instant.setUTCHours(9, 0, 0, 0);
      while (instant.getUTCDay() === 0 || instant.getUTCDay() === 6)
        instant.setUTCDate(instant.getUTCDate() + 1);
    }
    finance.setClock(instant.toISOString());
    return taskScenario?.fixtures() ?? null;
  }
  if (request.command === "p05-state")
    return taskScenario?.state(request.email) ?? null;
  if (request.command === "p05-fund-upgrade") {
    if (!taskScenario) throw new Error("P05_FIXTURES_REQUIRED");
    return taskScenario.fundUpgrade();
  }
  if (request.command === "p05-scan") {
    await proofs?.lifecycle.scan();
    return null;
  }
  if (
    request.command === "p05-hold-decoder" ||
    request.command === "p05-decoder-state"
  ) {
    if (!decoderBarrier) throw new Error("P05_NATIVE_REQUIRED");
    if (request.command === "p05-hold-decoder") {
      decoderBarrier.arm();
      return null;
    }
    return decoderBarrier.state();
  }
  if (request.command === "p05-pages") {
    const admin = await database.user.findUniqueOrThrow({
      where: { email: "admin@p03.test" },
    });
    return taskScenario?.seedPages(admin.id) ?? null;
  }
  if (request.command === "p04-fixtures")
    return finance.fixtures(request.profile);
  if (request.command === "p04-state") return finance.state(request.email);
  if (request.command === "p04-referral-purchase") {
    await finance.referralPurchase(request.event);
    return null;
  }
  if (request.command === "p04-release") {
    await finance.release(request.email);
    return null;
  }
  if (request.command === "p04-clock") {
    finance.setClock(request.instant);
    return null;
  }
  if (request.command === "p04-fund") {
    await finance.fund(request.email, {
      referral: request.referral,
      nonReferral: request.nonReferral,
    });
    return null;
  }
  if (request.command === "display-fixtures") {
    await database.user.updateMany({
      where: { email: { in: ["employee@p03.test", "admin@p03.test"] } },
      data: {
        fullName:
          "مسؤول موظف للاختبار Mixed Direction Identity الاسم الطويل للتحقق من العرض الآمن على الهاتف",
      },
    });
    return null;
  }
  if (request.command === "management-fixtures") {
    const actor = await database.user.findUniqueOrThrow({
      where: { email: "admin@p03.test" },
      select: { id: true, passwordHash: true },
    });
    for (let index = 0; index < 26; index++) {
      await database.user.create({
        data: {
          fullName: `P03 paged administrator ${String(index)}`,
          email: `paged-admin-${String(index)}@p03.test`,
          role: "ADMIN",
          status: "DEACTIVATED",
          emailVerifiedAt: new Date(),
          passwordHash: actor.passwordHash,
        },
      });
      await database.adminInvitation.create({
        data: {
          email: `paged-invite-${String(index)}@p03.test`,
          fullName: `P03 paged invitation ${String(index)}`,
          issuerUserId: actor.id,
          tokenVersion: 1,
          tokenHash:
            randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", ""),
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          emailAttemptId: randomUUID(),
          deliveryStatus: "NOT_ATTEMPTED",
        },
      });
    }
    return null;
  }
  if (request.command === "invitation-cooldown") {
    await database.adminInvitation.update({
      where: { email: request.email },
      data: { issuedAt: new Date(Date.now() - 120000) },
    });
    return null;
  }
  if (request.command === "management-state") {
    const invitation = await database.adminInvitation.findUnique({
      where: { email: request.email },
      select: {
        id: true,
        tokenVersion: true,
        acceptedAt: true,
        revokedAt: true,
        deliveryStatus: true,
      },
    });
    const user = await database.user.findUnique({
      where: { email: request.email },
      select: { id: true },
    });
    const audits = await database.identityAuditRecord.findMany({
      where: {
        OR: [
          ...(invitation === null ? [] : [{ invitationId: invitation.id }]),
          ...(user === null ? [] : [{ targetUserId: user.id }]),
        ],
      },
      select: { action: true, actorUserId: true, reason: true },
      take: 100,
      orderBy: { occurredAt: "asc" },
    });
    return {
      invitation:
        invitation === null
          ? null
          : {
              id: invitation.id,
              tokenVersion: invitation.tokenVersion,
              accepted: invitation.acceptedAt !== null,
              revoked: invitation.revokedAt !== null,
              deliveryStatus: invitation.deliveryStatus,
            },
      audits,
    };
  }
  if (request.command === "expire") {
    const expiresAt = new Date(0);
    if (request.purpose === "invitation")
      await database.adminInvitation.update({
        where: { id: request.targetId },
        data: {
          issuedAt: new Date(Date.now() - 60_000),
          expiresAt: new Date(Date.now() - 1_000),
        },
      });
    else
      await database.user.update({
        where: { id: request.targetId },
        data:
          request.purpose === "reset"
            ? { resetTokenExpiresAt: expiresAt }
            : { verificationTokenExpiresAt: expiresAt },
      });
    return null;
  }
  const user = await database.user.findUnique({
    where: { email: request.email },
    select: {
      id: true,
      role: true,
      status: true,
      emailVerifiedAt: true,
      referralCode: true,
      sponsorUserId: true,
    },
  });
  return {
    user:
      user === null
        ? null
        : {
            id: user.id,
            role: user.role,
            status: user.status,
            verified: user.emailVerifiedAt !== null,
            referralCode: user.referralCode,
            sponsorUserId: user.sponsorUserId,
            sessions: await database.authSession.count({
              where: { userId: user.id, revokedAt: null },
            }),
          },
  };
};

const start = async () => {
  if (process.send === undefined && !nativeBridge)
    throw new Error("PRIVATE_IPC_REQUIRED");
  let databaseUrl = process.env["P05_E2E_DATABASE_URL"] ?? "";
  if (!nativeBridge) {
    const probe = createServer();
    await new Promise<void>((ready, reject) => {
      probe.once("error", reject);
      probe.listen(4103, "127.0.0.1", ready);
    });
    await new Promise<void>((closed) =>
      probe.close(() => {
        closed();
      }),
    );
    container = await new PostgreSqlContainer("postgres:18.4")
      .withDatabase("p03_e2e")
      .withUsername("p03_test")
      .withPassword("isolated-test-only")
      .withStartupTimeout(120_000)
      .start();
    if (stopRequested()) {
      await container.stop();
      throw new Error("HARNESS_STOPPED");
    }
    databaseUrl = container.getConnectionUri();
    process.env["DATABASE_URL"] = databaseUrl;
    const pnpmScript = process.env["npm_execpath"];
    if (pnpmScript === undefined) throw new Error("PNPM_REQUIRED");
    await promisify(execFile)(
      process.execPath,
      [pnpmScript, "exec", "prisma", "migrate", "deploy"],
      {
        cwd: resolve(import.meta.dirname, "../../../../packages/database"),
        env: { ...process.env, DATABASE_URL: databaseUrl },
        windowsHide: true,
        timeout: 180_000,
      },
    );
  } else process.env["DATABASE_URL"] = databaseUrl;
  const [
    { createDatabaseClient },
    { createApp },
    { createLogger },
    { generateHash },
    { ResendEmailDelivery },
  ] = await Promise.all([
    import("@template/database"),
    import("../../src/app.js"),
    import("../../src/infrastructure/logger/logger.js"),
    import("../../src/infrastructure/security/password-hasher.js"),
    import("../../src/infrastructure/email/email-delivery.js"),
  ]);
  database = createDatabaseClient(databaseUrl);
  const { P04FinanceScenario } = await import("./p04-finance.js");
  financial = new P04FinanceScenario(database);
  const { P05TaskScenario } = await import("./p05-tasks.js");
  taskScenario = new P05TaskScenario(database, financial.clock);
  if (nativeBridge) {
    const { P05DecoderBarrier } = await import("./p05-decoder-barrier.js");
    decoderBarrier = new P05DecoderBarrier();
    privateRoot = await mkdtemp(join(tmpdir(), "oscar-p05-private-"));
    const { ProofsRuntime } =
      await import("../../src/modules/proofs/proofs.runtime.js");
    const { parseProofsEnvironment } =
      await import("../../src/core/config/proofs.config.js");
    proofs = new ProofsRuntime(
      database,
      parseProofsEnvironment({ PROOF_STORAGE_ROOT: privateRoot }, "/work"),
      financial.clock,
      () => {},
      (observation) => {
        decoderBarrier?.observe(observation);
      },
    );
    await proofs.start();
  }
  const passwordHash = await generateHash("P03 test password only!");
  for (const [email, role, status, verified] of [
    ["employee@p03.test", "USER", "ACTIVE", true],
    ["admin@p03.test", "ADMIN", "ACTIVE", true],
    ["admin2@p03.test", "ADMIN", "ACTIVE", true],
    ["inactive-admin@p03.test", "ADMIN", "DEACTIVATED", true],
    ["pending-admin@p03.test", "ADMIN", "PENDING_VERIFICATION", false],
    ["other@p03.test", "USER", "ACTIVE", true],
    ["pending@p03.test", "USER", "PENDING_VERIFICATION", false],
    ["suspended@p03.test", "USER", "SUSPENDED", true],
    ["banned@p03.test", "USER", "BANNED", true],
  ] as const) {
    await database.user.create({
      data: {
        email,
        fullName:
          email === "admin2@p03.test"
            ? "مديرة الاختبار الثانية ذات اسم عربي طويل للتأكد من ثبات مساحة الهوية"
            : role === "ADMIN"
              ? "مدير الاختبار"
              : "موظف الاختبار",
        role,
        status,
        emailVerifiedAt: verified ? new Date() : null,
        passwordHash,
        ...(role === "USER" ? { wallet: { create: {} } } : {}),
      },
    });
  }
  const emailDelivery = new ResendEmailDelivery({
    apiKey: "re_p03_no_network",
    wait: () => Promise.resolve(),
    fetch: (_url, init) => {
      if (typeof init?.body !== "string")
        return Promise.reject(new Error("INVALID_MAIL_BODY"));
      const body: unknown = JSON.parse(init.body);
      if (
        body !== null &&
        typeof body === "object" &&
        "to" in body &&
        typeof body.to === "string" &&
        "html" in body &&
        typeof body.html === "string"
      ) {
        const link = body.html.match(
          /https?:\/\/127\.0\.0\.1:3103\/[^"<>\s]+/u,
        )?.[0];
        if (link !== undefined)
          mail.set(body.to, link.replaceAll("&amp;", "&"));
      }
      if (deliveryOutcome === "unknown")
        return Promise.reject(new TypeError("CONTROLLED_TRANSPORT_FAILURE"));
      return Promise.resolve(
        deliveryOutcome === "rejected"
          ? new Response("{}", { status: 422 })
          : Response.json({ id: randomUUID() }),
      );
    },
  });
  const app = createApp({
    database,
    logger: createLogger({ level: "silent", pretty: false }),
    emailDelivery,
    financialClock: financial.clock,
    ...(proofs ? { proofs } : {}),
  });
  await new Promise<void>((ready, reject) => {
    server = app.listen(
      4103,
      nativeBridge ? "0.0.0.0" : "127.0.0.1",
      (error) => {
        if (error !== undefined) reject(error);
        else ready();
      },
    );
    server.once("error", reject);
  });
  if (stopRequested()) {
    await cleanup();
    throw new Error("HARNESS_STOPPED");
  }
  send({ id: 0, status: "ready", data: null });
  const receive = (input: unknown) => {
    const parsed = controlRequestSchema.safeParse(input);
    if (!parsed.success) {
      send({ id: 0, status: "failed", data: null });
      return;
    }
    void control(parsed.data)
      .then((data) => {
        send({
          id: parsed.data.id,
          status: parsed.data.command === "stop" ? "stopped" : "ok",
          data,
        });
        if (parsed.data.command === "stop") {
          if (nativeBridge) process.stdin.destroy();
          else process.disconnect();
        }
      })
      .catch(() => {
        send({ id: parsed.data.id, status: "failed", data: null });
      });
  };
  if (nativeBridge) {
    const lines = createInterface({ input: process.stdin });
    lines.on("line", (line) => {
      try {
        receive(JSON.parse(line));
      } catch {
        send({ id: 0, status: "failed", data: null });
      }
    });
    lines.on("close", () => {
      void cleanup().finally(() => process.exit());
    });
  } else process.on("message", receive);
};
process.once("disconnect", () => {
  void cleanup().finally(() => {
    process.exit();
  });
});
process.once("SIGTERM", () => {
  void cleanup().finally(() => {
    process.exit();
  });
});
process.once("SIGINT", () => {
  void cleanup().finally(() => {
    process.exit();
  });
});
void start().catch(async () => {
  send({ id: 0, status: "failed", data: null });
  await cleanup();
  process.exitCode = 1;
  if (process.connected) process.disconnect();
});
