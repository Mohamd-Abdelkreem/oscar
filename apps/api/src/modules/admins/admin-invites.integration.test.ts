import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";

import { createDatabaseClient, Prisma } from "@template/database";
import { describe, expect, it, vi } from "vitest";
import { setImmediate as nextTurn } from "node:timers/promises";
import pino from "pino";
import request from "supertest";
import {
  adminInvitationDataSchema,
  adminInvitationListDataSchema,
  identityUserDataSchema,
  identitySessionDataSchema,
  successEnvelopeSchema,
} from "@template/contracts";
import { ipKeyGenerator } from "express-rate-limit";
import { createApp } from "../../app.js";
import { apiRateLimitMiddleware } from "../../middlewares/rate-limit.middleware.js";
import { authRateLimiters } from "../auth/auth.rate-limiters.js";

import {
  EmailService,
  EmailDeliveryError,
} from "../../infrastructure/email/index.js";
import {
  compareHash,
  generateAdminInvitationToken,
  generateVerificationToken,
  generateHash,
} from "../../infrastructure/security/index.js";
import { AuthService } from "../auth/auth.service.js";
import {
  withIdentityDatabase,
  withIndependentIdentityClients,
  identityRaceBarrier,
} from "../auth/testing/identity-fixtures.js";
import { AdminBootstrapService } from "./admin-bootstrap.service.js";
import { AdminInvitationsService } from "./admin-invitations.service.js";
import { AdminLifecycleService } from "./admin-lifecycle.service.js";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";

const operator = { uid: 1000, username: "protected-operator" };
const password = "test-only-bootstrap-password";
const recipientPassword = "test-only-recipient-password";
const acceptBody = {
  newPassword: recipientPassword,
  passwordConfirmation: recipientPassword,
};
const issueBody = () => ({
  fullName: "Invited Administrator",
  email: `invite-${randomUUID()}@example.com`,
  confirmed: true as const,
  reason: "Reviewed administrator invitation",
});
const generationCommand = (expectedVersion: number) => ({
  expectedVersion,
  confirmed: true as const,
  reason: "Reviewed invitation generation",
});

async function invitationActor(
  database: Parameters<typeof createIdentityFixture>[0],
) {
  const fixture = await createIdentityFixture(database, {
    role: "ADMIN",
    passwordHash: await generateHash(password),
  });
  return {
    ...fixture,
    actor: { userId: fixture.user.id, sessionId: fixture.session.id },
  };
}
const input = () => ({
  fullName: "First Administrator",
  email: `bootstrap-${randomUUID()}@example.com`,
  password,
  reason: "Authorized initial setup",
});
function capturedEmail() {
  const messages: string[] = [];
  const email = new EmailService(
    {
      provider: "smtp",
      send: (request) => {
        messages.push(request.html);
        return Promise.resolve({ providerMessageId: "test-no-live-mail" });
      },
    },
    "sender@example.com",
    "Test Company",
    "",
    "https://approved.example.com",
    "https://approved.example.com/invitation",
  );
  return { email, messages };
}
function emailToken(html: string | undefined): string {
  if (html === undefined) throw new Error("No test email.");
  const href = /href="([^"]+token=[^"]+)"/u.exec(html)?.[1];
  if (href === undefined) throw new Error("No action URL in test email.");
  const token = new URL(href.replaceAll("&amp;", "&")).searchParams.get(
    "token",
  );
  if (token === null) throw new Error("No token in test email.");
  return token;
}

describe("P02 US5 protected bootstrap", () => {
  it("serializes setup and connects email proof, HTTP admin invitation, recovery and lifecycle without reopening bootstrap", async () => {
    await withIdentityDatabase(async (database, url) => {
      const { email, messages } = capturedEmail();
      const command = input();
      await withIndependentIdentityClients(url, async (first, second) => {
        const barrier = identityRaceBarrier(2);
        const attempts = await Promise.allSettled(
          [first, second].map(async (client) => {
            await barrier();
            return new AdminBootstrapService(client, email).provision(
              command,
              operator,
            );
          }),
        );
        expect(
          attempts.filter((attempt) => attempt.status === "fulfilled"),
        ).toHaveLength(1);
      });
      const user = await database.user.findUniqueOrThrow({
        where: { email: command.email },
      });
      expect(user).toMatchObject({
        role: "ADMIN",
        status: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
      });
      expect(await database.wallet.count()).toBe(0);
      expect(
        await database.adminSetupState.findUniqueOrThrow({ where: { id: 1 } }),
      ).toMatchObject({
        firstAdminUserId: user.id,
        completionSource: "BOOTSTRAP",
      });
      expect(
        await database.identityAuditRecord.count({
          where: { action: "BOOTSTRAP" },
        }),
      ).toBe(1);
      const auth = new AuthService(database, email);
      await expect(
        auth.adminLogin({ email: command.email, password, rememberMe: false }),
      ).rejects.toThrow();
      expect(messages).toHaveLength(1);
      const app = createApp({
        database,
        logger: pino({ level: "silent" }),
        emailDelivery: {
          provider: "smtp",
          send: (mail) => {
            messages.push(mail.html);
            return Promise.resolve({ providerMessageId: "test-no-live-mail" });
          },
        },
      });
      const proof = await request(app)
        .post("/api/v1/auth/verify-email")
        .query({ token: emailToken(messages[0]) });
      expect(proof.status).toBe(200);
      expect(proof.headers["set-cookie"]).toBeUndefined();
      expect(
        identityUserDataSchema.parse(
          successEnvelopeSchema.parse(proof.body).data,
        ).user,
      ).toMatchObject({ id: user.id, role: "ADMIN", accountVersion: 1 });
      expect(
        await database.identityAuditRecord.count({
          where: { action: "ADMIN_EMAIL_ACTIVATE" },
        }),
      ).toBe(1);

      const signIn = async (email: string, credential: string) => {
        const response = await request(app)
          .post("/api/v1/auth/admin/login")
          .send({ email, password: credential, rememberMe: false });
        expect(response.status).toBe(200);
        return identitySessionDataSchema.parse(
          successEnvelopeSchema.parse(response.body).data,
        );
      };
      const firstSession = await signIn(command.email, password);
      const authorized = (access: string) => ({
        Authorization: `Bearer ${access}`,
        Cookie: "csrfToken=cross-story-csrf",
        "x-csrf-token": "cross-story-csrf",
      });
      const invited = issueBody();
      const issued = await request(app)
        .post("/api/v1/admin/invitations")
        .set(authorized(firstSession.tokens.accessToken))
        .send(invited);
      expect(issued.status).toBe(201);
      const invitation = adminInvitationDataSchema.parse(
        successEnvelopeSchema.parse(issued.body).data,
      ).invitation;
      const accepted = await request(app)
        .post("/api/v1/auth/admin-invitations/accept")
        .query({ token: emailToken(messages.at(-1)) })
        .send(acceptBody);
      expect(accepted.status).toBe(201);
      expect(accepted.headers["set-cookie"]).toBeUndefined();
      const recipient = identityUserDataSchema.parse(
        successEnvelopeSchema.parse(accepted.body).data,
      ).user;
      const recipientSession = await signIn(invited.email, recipientPassword);
      expect(recipientSession.user.id).toBe(recipient.id);

      // The real first-admin account can recover through shared HTTP auth and retain administration.
      const forgot = await request(app)
        .post("/api/v1/auth/forgot-password")
        .send({ email: command.email });
      expect(forgot.status).toBe(200);
      const recoveredPassword = "test-only-recovered-bootstrap-password";
      const recovered = await request(app)
        .post("/api/v1/auth/reset-password")
        .query({ token: emailToken(messages.at(-1)) })
        .send({
          newPassword: recoveredPassword,
          passwordConfirmation: recoveredPassword,
        });
      expect(recovered.status).toBe(200);
      expect(
        (
          await request(app)
            .get("/api/v1/admin/admins")
            .set("Authorization", `Bearer ${firstSession.tokens.accessToken}`)
        ).status,
      ).toBe(401);
      const recoveredSession = await signIn(command.email, recoveredPassword);
      const lifecycle = (
        status: "ACTIVE" | "DEACTIVATED",
        expectedVersion: number,
      ) =>
        request(app)
          .patch(`/api/v1/admin/admins/${recipient.id}/status`)
          .set(authorized(recoveredSession.tokens.accessToken))
          .send({
            confirmed: true,
            reason: "Reviewed cross-story administrator lifecycle",
            expectedVersion,
            status,
          });
      expect((await lifecycle("DEACTIVATED", 0)).status).toBe(200);
      expect((await lifecycle("ACTIVE", 1)).status).toBe(200);
      expect(
        (
          await request(app)
            .get("/api/v1/admin/admins")
            .set(
              "Authorization",
              `Bearer ${recipientSession.tokens.accessToken}`,
            )
        ).status,
      ).toBe(401);
      expect((await signIn(invited.email, recipientPassword)).user.status).toBe(
        "ACTIVE",
      );
      expect(
        await database.adminInvitation.findUniqueOrThrow({
          where: { id: invitation.id },
        }),
      ).toMatchObject({ acceptedUserId: recipient.id, revokedAt: null });
      const audits = await database.identityAuditRecord.findMany({
        orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
      });
      expect(audits.map((audit) => audit.action)).toEqual([
        "BOOTSTRAP",
        "ADMIN_EMAIL_ACTIVATE",
        "INVITATION_ISSUE",
        "INVITATION_ACCEPT",
        "ADMIN_DEACTIVATE",
        "ADMIN_ACTIVATE",
      ]);
      expect(
        audits.find((audit) => audit.action === "INVITATION_ISSUE")
          ?.actorUserId,
      ).toBe(user.id);
      expect(
        audits.find((audit) => audit.action === "INVITATION_ACCEPT")
          ?.actorUserId,
      ).toBe(recipient.id);
      expect(await database.wallet.count()).toBe(0);
      expect(await database.ledgerPosting.count()).toBe(0);
      await expect(
        new AdminBootstrapService(database, email).provision(input(), operator),
      ).rejects.toThrow("permanently complete");
      expect(
        await compareHash(
          recoveredPassword,
          (await database.user.findUniqueOrThrow({ where: { id: user.id } }))
            .passwordHash,
        ),
      ).toBe(true);
    });
  });
  it.each(["UNKNOWN", "REJECTED"] as const)(
    "retains pending setup after %s delivery, recoverable by ordinary resend",
    async (disposition) => {
      await withIdentityDatabase(async (database) => {
        const command = input();
        const failed = new EmailService({
          provider: "smtp",
          send: () =>
            Promise.reject(new EmailDeliveryError("smtp", 1, disposition)),
        });
        await expect(
          new AdminBootstrapService(database, failed).provision(
            command,
            operator,
          ),
        ).rejects.toThrow("Setup is complete");
        const user = await database.user.findUniqueOrThrow({
          where: { email: command.email },
        });
        expect(user.status).toBe("PENDING_VERIFICATION");
        expect(
          (
            await database.adminSetupState.findUniqueOrThrow({
              where: { id: 1 },
            })
          ).completedAt,
        ).not.toBeNull();
        const { email, messages } = capturedEmail();
        await database.user.update({
          where: { id: user.id },
          data: {
            verificationTokenHash: null,
            verificationTokenExpiresAt: null,
          },
        });
        const auth = new AuthService(database, email);
        await auth.resendVerification({ email: command.email });
        await auth.verifyEmail(emailToken(messages[0]));
        await expect(
          new AdminBootstrapService(database, email).provision(
            command,
            operator,
          ),
        ).rejects.toThrow();
        expect(await database.user.count()).toBe(1);
      });
    },
  );
  it("rolls back setup/account when required audit fails", async () => {
    await withIdentityDatabase(async (database) => {
      await database.$executeRawUnsafe(
        "CREATE FUNCTION fail_bootstrap_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit fault'; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER test_bootstrap_audit BEFORE INSERT ON identity_audit_records FOR EACH ROW EXECUTE FUNCTION fail_bootstrap_audit()",
      );
      const { email, messages } = capturedEmail();
      await expect(
        new AdminBootstrapService(database, email).provision(input(), operator),
      ).rejects.toThrow();
      expect(await database.user.count()).toBe(0);
      expect(
        (await database.adminSetupState.findUniqueOrThrow({ where: { id: 1 } }))
          .completedAt,
      ).toBeNull();
      expect(messages).toHaveLength(0);
    });
  });
  it("historical pending presence closes setup without replacing credentials", async () => {
    await withIdentityDatabase(async (database, url) => {
      const id = randomUUID();
      await database.$executeRaw(
        Prisma.sql`INSERT INTO users (id, email, full_name, password_hash, role, status, updated_at) VALUES (${id}::uuid, 'historical-admin@example.com', 'Historical Administrator', 'historical-password-hash', 'ADMIN', 'PENDING_VERIFICATION', now())`,
      );
      const pnpmScript = process.env["npm_execpath"];
      if (pnpmScript === undefined) throw new Error("pnpm runtime required");
      const execute = promisify(execFile);
      await execute(
        process.execPath,
        [pnpmScript, "exec", "prisma", "migrate", "deploy"],
        {
          cwd: resolve("../../packages/database"),
          env: { ...process.env, DATABASE_URL: url },
          windowsHide: true,
        },
      );
      const current = createDatabaseClient(url);
      try {
        const { email } = capturedEmail();
        await expect(
          new AdminBootstrapService(current, email).provision(
            input(),
            operator,
          ),
        ).rejects.toThrow("permanently complete");
        expect(
          (await current.user.findUniqueOrThrow({ where: { id } }))
            .passwordHash,
        ).toBe("historical-password-hash");
        expect(
          (
            await current.adminSetupState.findUniqueOrThrow({
              where: { id: 1 },
            })
          ).completionSource,
        ).toBe("LEGACY_PRESENT");
      } finally {
        await current.$disconnect();
      }
    }, "P01");
  });
});

describe("P02 US5 invitation grants and consumption", () => {
  it("uses real issue/read/preview/accept endpoints with strict input, private responses and no session", async () => {
    await withIdentityDatabase(async (database) => {
      for (const limiter of [
        apiRateLimitMiddleware,
        ...Object.values(authRateLimiters),
      ])
        for (const source of ["127.0.0.1", "::ffff:127.0.0.1"])
          limiter.resetKey(ipKeyGenerator(source));
      const issuer = await invitationActor(database);
      const delivered: string[] = [];
      const delivery = {
        provider: "smtp" as const,
        send: (mail: { html: string }) => {
          delivered.push(mail.html);
          return Promise.resolve({ providerMessageId: "test-no-live-mail" });
        },
      };
      const app = createApp({
        database,
        logger: pino({ level: "silent" }),
        emailDelivery: delivery,
      });
      const login = await request(app)
        .post("/api/v1/auth/admin/login")
        .send({ email: issuer.user.email, password, rememberMe: false });
      expect(login.status).toBe(200);
      const { identitySessionDataSchema } = await import("@template/contracts");
      const access = identitySessionDataSchema.parse(
        successEnvelopeSchema.parse(login.body).data,
      ).tokens.accessToken;
      const issue = (body: object) =>
        request(app)
          .post("/api/v1/admin/invitations")
          .set("Authorization", `Bearer ${access}`)
          .set("Cookie", "csrfToken=test-invitation-csrf")
          .set("x-csrf-token", "test-invitation-csrf")
          .send(body);
      const body = issueBody();
      const issued = await issue(body);
      expect(issued.status).toBe(201);
      expect(issued.headers["cache-control"]).toBe("no-store");
      const invitation = adminInvitationDataSchema.parse(
        successEnvelopeSchema.parse(issued.body).data,
      ).invitation;
      const token = emailToken(delivered[0]);
      expect(JSON.stringify(issued.body)).not.toContain(token);
      const list = await request(app)
        .get("/api/v1/admin/invitations?limit=1")
        .set("Authorization", `Bearer ${access}`);
      expect(
        adminInvitationListDataSchema.parse(
          successEnvelopeSchema.parse(list.body).data,
        ).items[0]?.id,
      ).toBe(invitation.id);
      const read = await request(app)
        .get(`/api/v1/admin/invitations/${invitation.id}`)
        .set("Authorization", `Bearer ${access}`);
      expect(
        adminInvitationDataSchema.parse(
          successEnvelopeSchema.parse(read.body).data,
        ).invitation.status,
      ).toBe("PENDING");
      for (const method of ["get", "head"] as const) {
        const preview = await request(app)
          [method]("/api/v1/auth/validate-admin-invitation")
          .query({ token });
        expect(preview.status).toBe(200);
        expect(preview.headers["cache-control"]).toBe("no-store");
        if (method === "head") expect(preview.text).toBeUndefined();
      }
      expect(await database.user.count({ where: { email: body.email } })).toBe(
        0,
      );
      expect(
        (
          await request(app)
            .post("/api/v1/auth/admin-invitations/accept")
            .query({ token })
            .send({ ...acceptBody, email: "forged@example.com" })
        ).status,
      ).toBe(400);
      const accepted = await request(app)
        .post("/api/v1/auth/admin-invitations/accept")
        .query({ token })
        .send(acceptBody);
      expect(accepted.status).toBe(201);
      expect(accepted.headers["set-cookie"]).toBeUndefined();
      expect(
        identityUserDataSchema.parse(
          successEnvelopeSchema.parse(accepted.body).data,
        ).user,
      ).toMatchObject({ role: "ADMIN", email: body.email, status: "ACTIVE" });
      expect(
        (
          await request(app)
            .post("/api/v1/auth/admin-invitations/accept")
            .query({ token })
            .send(acceptBody)
        ).status,
      ).toBe(400);
      expect((await issue({ ...issueBody(), confirmed: false })).status).toBe(
        400,
      );
      expect(
        (
          await request(app)
            .post("/api/v1/admin/bootstrap")
            .set("Authorization", `Bearer ${access}`)
            .set("Cookie", "csrfToken=test-invitation-csrf")
            .set("x-csrf-token", "test-invitation-csrf")
            .send({})
        ).status,
      ).toBe(404);
    });
  });
  it("keeps one addressed generation, requires explicit reissue/cooldown and grants no session", async () => {
    await withIdentityDatabase(async (database) => {
      const { actor } = await invitationActor(database);
      const { email, messages } = capturedEmail();
      const service = new AdminInvitationsService(database, email);
      const body = issueBody();
      const invitation = await service.issue(actor, body);
      expect(invitation).toMatchObject({
        email: body.email,
        fullName: body.fullName,
        tokenVersion: 1,
        status: "PENDING",
        deliveryStatus: "ACKNOWLEDGED",
      });
      const firstToken = emailToken(messages[0]);
      await service.validate(firstToken);
      await service.validate(firstToken);
      expect(
        await database.user.findUnique({ where: { email: body.email } }),
      ).toBeNull();
      await expect(service.issue(actor, body)).rejects.toThrow(
        "explicit reissue",
      );
      await expect(
        service.reissue(actor, invitation.id, generationCommand(1)),
      ).rejects.toThrow("cooldown");
      await database.adminInvitation.update({
        where: { id: invitation.id },
        data: { issuedAt: new Date(Date.now() - 61000) },
      });
      const replacement = await service.reissue(
        actor,
        invitation.id,
        generationCommand(1),
      );
      expect(replacement.tokenVersion).toBe(2);
      await expect(service.validate(firstToken)).rejects.toThrow();
      await expect(
        service.revoke(actor, invitation.id, generationCommand(1)),
      ).rejects.toThrow("generation");
      const accepted = await service.accept(
        emailToken(messages[1]),
        acceptBody,
      );
      expect(accepted.user).toMatchObject({
        fullName: body.fullName,
        email: body.email,
        role: "ADMIN",
        status: "ACTIVE",
      });
      expect(
        await database.authSession.count({
          where: { userId: accepted.user.id },
        }),
      ).toBe(0);
      expect(
        await database.wallet.count({
          where: { ownerUserId: accepted.user.id },
        }),
      ).toBe(0);
      expect(
        await compareHash(
          recipientPassword,
          (
            await database.user.findUniqueOrThrow({
              where: { id: accepted.user.id },
            })
          ).passwordHash,
        ),
      ).toBe(true);
      await expect(
        service.accept(emailToken(messages[1]), acceptBody),
      ).rejects.toThrow();
      await expect(
        service.reissue(actor, invitation.id, generationCommand(2)),
      ).rejects.toThrow();
      const audits = await database.identityAuditRecord.findMany({
        where: { invitationId: invitation.id },
        orderBy: { occurredAt: "asc" },
      });
      expect(audits.map((audit) => audit.action)).toEqual([
        "INVITATION_ISSUE",
        "INVITATION_REISSUE",
        "INVITATION_ACCEPT",
      ]);
      expect(audits[2]).toMatchObject({
        actorKind: "INVITED_RECIPIENT",
        actorUserId: accepted.user.id,
        targetUserId: accepted.user.id,
        issuerUserId: actor.userId,
        tokenVersion: 2,
        reason: null,
      });
      expect(JSON.stringify(audits)).not.toContain(firstToken);
    });
  });
  it.each(["USER", "ADMIN"] as const)(
    "rejects a %s email collision without promotion or password overwrite",
    async (role) => {
      await withIdentityDatabase(async (database) => {
        const { actor } = await invitationActor(database);
        const existing = await createIdentityFixture(database, { role });
        const { email, messages } = capturedEmail();
        const service = new AdminInvitationsService(database, email);
        await expect(
          service.issue(actor, { ...issueBody(), email: existing.user.email }),
        ).rejects.toThrow("already in use");
        expect(
          await database.user.findUniqueOrThrow({
            where: { id: existing.user.id },
          }),
        ).toEqual(existing.user);
        expect(await database.adminInvitation.count()).toBe(0);
        expect(messages).toHaveLength(0);
      });
    },
  );
  it("revokes outstanding grants, accepts explicit new authority after cooldown and rejects forged purpose/email", async () => {
    await withIdentityDatabase(async (database) => {
      const { actor } = await invitationActor(database);
      const { email, messages } = capturedEmail();
      const service = new AdminInvitationsService(database, email);
      const invitation = await service.issue(actor, issueBody());
      const token = emailToken(messages[0]);
      const revoked = await service.revoke(
        actor,
        invitation.id,
        generationCommand(1),
      );
      expect(revoked.status).toBe("REVOKED");
      await expect(service.accept(token, acceptBody)).rejects.toThrow();
      await expect(
        service.revoke(actor, invitation.id, generationCommand(1)),
      ).rejects.toThrow();
      await database.adminInvitation.update({
        where: { id: invitation.id },
        data: {
          issuedAt: new Date(Date.now() - 61000),
          expiresAt: new Date(Date.now() - 1),
        },
      });
      expect(
        (
          await database.adminInvitation.findUniqueOrThrow({
            where: { id: invitation.id },
          })
        ).revokedAt,
      ).not.toBeNull();
      await service.reissue(actor, invitation.id, generationCommand(1));
      await expect(
        service.accept(
          generateVerificationToken(
            invitation.email,
            invitation.id,
            new Date(Date.now() + 60000),
          ),
          acceptBody,
        ),
      ).rejects.toThrow();
      await expect(
        service.accept(
          generateAdminInvitationToken({
            invitationId: invitation.id,
            tokenVersion: 2,
            email: "wrong@example.com",
            expiresAt: new Date(Date.now() + 60000),
          }),
          acceptBody,
        ),
      ).rejects.toThrow();
      expect(
        (await service.accept(emailToken(messages[1]), acceptBody)).user.role,
      ).toBe("ADMIN");
    });
  });
  it("serializes concurrent acceptance to one new administrator/audit", async () => {
    await withIdentityDatabase(async (database, url) => {
      const { actor } = await invitationActor(database);
      const { email, messages } = capturedEmail();
      const service = new AdminInvitationsService(database, email);
      const body = issueBody();
      const invitation = await service.issue(actor, body);
      await withIndependentIdentityClients(url, async (first, second) => {
        const barrier = identityRaceBarrier(2);
        const outcomes = await Promise.allSettled(
          [first, second].map(async (client) => {
            await barrier();
            return new AdminInvitationsService(client, email).accept(
              emailToken(messages[0]),
              acceptBody,
            );
          }),
        );
        expect(
          outcomes.filter((outcome) => outcome.status === "fulfilled"),
        ).toHaveLength(1);
      });
      expect(await database.user.count({ where: { email: body.email } })).toBe(
        1,
      );
      expect(
        await database.identityAuditRecord.count({
          where: { invitationId: invitation.id, action: "INVITATION_ACCEPT" },
        }),
      ).toBe(1);
    });
  });
  it.each(["issue", "accept"])(
    "rolls back %s and every dependent record when audit fails",
    async (operation) => {
      await withIdentityDatabase(async (database) => {
        const { actor } = await invitationActor(database);
        const { email, messages } = capturedEmail();
        const service = new AdminInvitationsService(database, email);
        const body = issueBody();
        const invitation =
          operation === "accept" ? await service.issue(actor, body) : null;
        await database.$executeRawUnsafe(
          "CREATE FUNCTION fail_invitation_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit fault'; END $$",
        );
        await database.$executeRawUnsafe(
          "CREATE TRIGGER test_invitation_audit BEFORE INSERT ON identity_audit_records FOR EACH ROW EXECUTE FUNCTION fail_invitation_audit()",
        );
        await expect(
          operation === "issue"
            ? service.issue(actor, body)
            : service.accept(emailToken(messages[0]), acceptBody),
        ).rejects.toThrow();
        expect(
          await database.user.findUnique({ where: { email: body.email } }),
        ).toBeNull();
        if (invitation === null)
          expect(await database.adminInvitation.count()).toBe(0);
        else
          expect(
            (
              await database.adminInvitation.findUniqueOrThrow({
                where: { id: invitation.id },
              })
            ).acceptedAt,
          ).toBeNull();
      });
    },
  );
  it.each(["UNKNOWN", "REJECTED"] as const)(
    "persists %s dispatch result without granting authority",
    async (disposition) => {
      await withIdentityDatabase(async (database) => {
        const { actor } = await invitationActor(database);
        const email = new EmailService(
          {
            provider: "smtp",
            send: () =>
              Promise.reject(new EmailDeliveryError("smtp", 1, disposition)),
          },
          "sender@example.com",
          "Test Company",
          "",
          "https://approved.example.com",
          "https://approved.example.com/invitation",
        );
        const body = issueBody();
        await expect(
          new AdminInvitationsService(database, email).issue(actor, body),
        ).rejects.toThrow("intent is retained");
        expect(
          await database.user.findUnique({ where: { email: body.email } }),
        ).toBeNull();
        const invitation = await database.adminInvitation.findUniqueOrThrow({
          where: { email: body.email },
        });
        expect(invitation).toMatchObject({
          deliveryStatus: disposition,
          acceptedAt: null,
        });
        expect(invitation.emailAttemptedAt).not.toBeNull();
        expect(
          await database.identityAuditRecord.count({
            where: { invitationId: invitation.id },
          }),
        ).toBe(1);
      });
    },
  );
});

describe("P02 US5 lifecycle and delayed dispatch", () => {
  it("revokes and audits more than one bounded batch of outstanding issuer invitations atomically", async () => {
    await withIdentityDatabase(async (database) => {
      const issuer = await invitationActor(database);
      const actor = await invitationActor(database);
      const { sha256 } = await import("../../infrastructure/security/index.js");
      const now = new Date();
      await database.adminInvitation.createMany({
        data: Array.from({ length: 101 }, () => {
          const id = randomUUID();
          return {
            id,
            email: `batched-${id}@example.com`,
            fullName: "Batch Recipient",
            issuerUserId: issuer.user.id,
            tokenVersion: 1,
            tokenHash: sha256(id),
            issuedAt: now,
            expiresAt: new Date(now.getTime() + 60000),
            emailAttemptId: randomUUID(),
          };
        }),
      });
      await new AdminLifecycleService(database).updateStatus(
        actor.actor,
        issuer.user.id,
        {
          confirmed: true,
          reason: "Reviewed bounded issuer denial",
          expectedVersion: 0,
          status: "DEACTIVATED",
        },
      );
      expect(
        await database.adminInvitation.count({
          where: { issuerUserId: issuer.user.id, revokedAt: null },
        }),
      ).toBe(0);
      expect(
        await database.identityAuditRecord.count({
          where: {
            action: "INVITATION_REVOKE",
            issuerUserId: issuer.user.id,
            actorUserId: actor.user.id,
          },
        }),
      ).toBe(101);
      expect(
        await database.identityAuditRecord.count({
          where: { action: "ADMIN_DEACTIVATE", targetUserId: issuer.user.id },
        }),
      ).toBe(1);
    });
  });
  it("serializes acceptance against issuer denial and never revives the losing credential", async () => {
    await withIdentityDatabase(async (database, url) => {
      const issuer = await invitationActor(database);
      const colleague = await invitationActor(database);
      const { email, messages } = capturedEmail();
      const service = new AdminInvitationsService(database, email);
      const invitation = await service.issue(issuer.actor, issueBody());
      const token = emailToken(messages[0]);
      await withIndependentIdentityClients(
        url,
        async (recipientConnection, adminConnection) => {
          const barrier = identityRaceBarrier(2);
          const accept = async () => {
            await barrier();
            return new AdminInvitationsService(
              recipientConnection,
              email,
            ).accept(token, acceptBody);
          };
          const deny = async () => {
            await barrier();
            return new AdminLifecycleService(adminConnection).updateStatus(
              colleague.actor,
              issuer.user.id,
              {
                confirmed: true,
                reason: "Reviewed concurrent issuer denial",
                expectedVersion: 0,
                status: "DEACTIVATED",
              },
            );
          };
          const outcomes = await Promise.allSettled([accept(), deny()]);
          expect(outcomes[1].status).toBe("fulfilled");
          const persisted = await database.adminInvitation.findUniqueOrThrow({
            where: { id: invitation.id },
          });
          const accepted = outcomes[0].status === "fulfilled";
          expect(
            await database.user.count({
              where: {
                email: invitation.email,
                role: "ADMIN",
                status: "ACTIVE",
              },
            }),
          ).toBe(accepted ? 1 : 0);
          expect(persisted.acceptedAt !== null).toBe(accepted);
          expect(persisted.revokedAt !== null).toBe(!accepted);
          expect(
            await database.identityAuditRecord.count({
              where: {
                invitationId: invitation.id,
                action: "INVITATION_ACCEPT",
              },
            }),
          ).toBe(accepted ? 1 : 0);
        },
      );
      await new AdminLifecycleService(database).updateStatus(
        colleague.actor,
        issuer.user.id,
        {
          confirmed: true,
          reason: "Reviewed issuer restoration",
          expectedVersion: 1,
          status: "ACTIVE",
        },
      );
      await expect(service.accept(token, acceptBody)).rejects.toThrow();
    });
  });
  it("rolls back lifecycle, sessions, action pairs and every invitation/audit when lifecycle audit fails", async () => {
    await withIdentityDatabase(async (database) => {
      const issuer = await invitationActor(database);
      const actor = await invitationActor(database);
      const { email } = capturedEmail();
      const invitation = await new AdminInvitationsService(
        database,
        email,
      ).issue(issuer.actor, issueBody());
      const auth = new AuthService(database, email);
      await auth.forgotPassword({ email: issuer.user.email });
      const before = await database.user.findUniqueOrThrow({
        where: { id: issuer.user.id },
      });
      await database.$executeRawUnsafe(
        "CREATE FUNCTION fail_lifecycle_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action = 'ADMIN_DEACTIVATE' THEN RAISE EXCEPTION 'test lifecycle audit fault'; END IF; RETURN NEW; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER test_lifecycle_audit BEFORE INSERT ON identity_audit_records FOR EACH ROW EXECUTE FUNCTION fail_lifecycle_audit()",
      );
      await expect(
        new AdminLifecycleService(database).updateStatus(
          actor.actor,
          issuer.user.id,
          {
            expectedVersion: 0,
            confirmed: true,
            reason: "Reviewed atomic lifecycle",
            status: "DEACTIVATED",
          },
        ),
      ).rejects.toThrow();
      expect(
        await database.user.findUniqueOrThrow({
          where: { id: issuer.user.id },
        }),
      ).toEqual(before);
      expect(
        (
          await database.authSession.findUniqueOrThrow({
            where: { id: issuer.session.id },
          })
        ).revokedAt,
      ).toBeNull();
      expect(
        (
          await database.adminInvitation.findUniqueOrThrow({
            where: { id: invitation.id },
          })
        ).revokedAt,
      ).toBeNull();
      expect(
        await database.identityAuditRecord.count({
          where: { actorUserId: actor.user.id },
        }),
      ).toBe(0);
    });
  });
  it.each(["accept", "revoke", "expire", "issuer-denial"])(
    "returns fresh %s disposition independently of delayed acknowledgement",
    async (closure) => {
      await withIdentityDatabase(async (database) => {
        const issuer = await invitationActor(database);
        const colleague = await invitationActor(database);
        let announce = () => {};
        let acknowledge = () => {};
        let captured: string | undefined;
        const sending = new Promise<void>((resolve) => {
          announce = resolve;
        });
        const reply = new Promise<void>((resolve) => {
          acknowledge = resolve;
        });
        const delayed = new EmailService(
          {
            provider: "smtp",
            send: async (message) => {
              captured = message.html;
              announce();
              await reply;
              return { providerMessageId: "test-no-live-mail" };
            },
          },
          "sender@example.com",
          "Test Company",
          "",
          "https://approved.example.com",
          "https://approved.example.com/invitation",
        );
        const service = new AdminInvitationsService(database, delayed);
        const body = issueBody();
        const issuing = service.issue(issuer.actor, body);
        try {
          await sending;
          const invitation = await database.adminInvitation.findUniqueOrThrow({
            where: { email: body.email },
          });
          expect(invitation.deliveryStatus).toBe("UNKNOWN");
          const token = emailToken(captured);
          if (closure === "accept") await service.accept(token, acceptBody);
          if (closure === "revoke")
            await service.revoke(
              colleague.actor,
              invitation.id,
              generationCommand(1),
            );
          if (closure === "expire")
            await database.adminInvitation.update({
              where: { id: invitation.id },
              data: {
                issuedAt: new Date(Date.now() - 61000),
                expiresAt: new Date(Date.now() - 1),
              },
            });
          if (closure === "issuer-denial")
            await new AdminLifecycleService(database).updateStatus(
              colleague.actor,
              issuer.user.id,
              {
                expectedVersion: 0,
                confirmed: true,
                reason: "Reviewed issuer denial",
                status: "DEACTIVATED",
              },
            );
          acknowledge();
          const outcome = await issuing;
          expect(outcome).toMatchObject({
            status:
              closure === "accept"
                ? "ACCEPTED"
                : closure === "expire"
                  ? "EXPIRED"
                  : "REVOKED",
            deliveryStatus: "ACKNOWLEDGED",
          });
          await expect(service.validate(token)).rejects.toThrow();
          if (closure === "issuer-denial") {
            await new AdminLifecycleService(database).updateStatus(
              colleague.actor,
              issuer.user.id,
              {
                expectedVersion: 1,
                confirmed: true,
                reason: "Reviewed restoration",
                status: "ACTIVE",
              },
            );
            await expect(service.accept(token, acceptBody)).rejects.toThrow();
            expect(
              await database.identityAuditRecord.count({
                where: {
                  invitationId: invitation.id,
                  action: "INVITATION_REVOKE",
                },
              }),
            ).toBe(1);
            expect(
              (
                await database.authSession.findUniqueOrThrow({
                  where: { id: issuer.session.id },
                })
              ).revokedAt,
            ).not.toBeNull();
          }
        } finally {
          acknowledge();
          await Promise.allSettled([issuing]);
        }
      });
    },
  );
  it("rejects stale generation replies and preserves original and replacement attribution", async () => {
    await withIdentityDatabase(async (database) => {
      const first = await invitationActor(database);
      const second = await invitationActor(database);
      let announce = () => {};
      let acknowledge = () => {};
      let captured: string | undefined;
      const sending = new Promise<void>((resolve) => {
        announce = resolve;
      });
      const reply = new Promise<void>((resolve) => {
        acknowledge = resolve;
      });
      const delayed = new EmailService(
        {
          provider: "smtp",
          send: async (message) => {
            captured = message.html;
            announce();
            await reply;
            return { providerMessageId: "test-no-live-mail" };
          },
        },
        "sender@example.com",
        "Test Company",
        "",
        "https://approved.example.com",
        "https://approved.example.com/invitation",
      );
      const body = issueBody();
      const issuing = new AdminInvitationsService(database, delayed).issue(
        first.actor,
        body,
      );
      const observed = issuing.then(
        (outcome) => ({ outcome }),
        (failure: unknown) => ({ failure }),
      );
      try {
        await sending;
        const invitation = await database.adminInvitation.findUniqueOrThrow({
          where: { email: body.email },
        });
        await database.adminInvitation.update({
          where: { id: invitation.id },
          data: { issuedAt: new Date(Date.now() - 61000) },
        });
        const { email, messages } = capturedEmail();
        const current = new AdminInvitationsService(database, email);
        const replacement = await current.reissue(
          second.actor,
          invitation.id,
          generationCommand(1),
        );
        acknowledge();
        expect(await observed).toMatchObject({ failure: { statusCode: 409 } });
        expect(
          await database.adminInvitation.findUniqueOrThrow({
            where: { id: invitation.id },
          }),
        ).toMatchObject({
          tokenVersion: 2,
          issuerUserId: second.user.id,
          deliveryStatus: "ACKNOWLEDGED",
        });
        await expect(current.validate(emailToken(captured))).rejects.toThrow();
        const accepted = await current.accept(
          emailToken(messages[0]),
          acceptBody,
        );
        expect(accepted.user.id).toBeDefined();
        const audits = await database.identityAuditRecord.findMany({
          where: { invitationId: replacement.id },
          orderBy: { occurredAt: "asc" },
        });
        expect(audits[0]).toMatchObject({
          actorUserId: first.user.id,
          issuerUserId: first.user.id,
          tokenVersion: 1,
        });
        expect(audits[1]).toMatchObject({
          actorUserId: second.user.id,
          issuerUserId: second.user.id,
          tokenVersion: 2,
        });
      } finally {
        acknowledge();
        await observed;
      }
    });
  });
  it("retains unknown intent after acknowledgement persistence fails and recovers without password overwrite", async () => {
    await withIdentityDatabase(async (database) => {
      const { actor } = await invitationActor(database);
      const { email, messages } = capturedEmail();
      const service = new AdminInvitationsService(database, email);
      await database.$executeRawUnsafe(
        "CREATE FUNCTION fail_delivery_persistence() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.delivery_status = 'ACKNOWLEDGED' THEN RAISE EXCEPTION 'test delivery persistence fault'; END IF; RETURN NEW; END $$",
      );
      await database.$executeRawUnsafe(
        "CREATE TRIGGER test_delivery_persistence BEFORE UPDATE ON admin_invitations FOR EACH ROW EXECUTE FUNCTION fail_delivery_persistence()",
      );
      const body = issueBody();
      await expect(service.issue(actor, body)).rejects.toThrow();
      const invitation = await database.adminInvitation.findUniqueOrThrow({
        where: { email: body.email },
      });
      expect(invitation.deliveryStatus).toBe("UNKNOWN");
      expect(
        await database.identityAuditRecord.count({
          where: { invitationId: invitation.id },
        }),
      ).toBe(1);
      const accepted = await service.accept(
        emailToken(messages[0]),
        acceptBody,
      );
      await expect(
        service.accept(emailToken(messages[0]), acceptBody),
      ).rejects.toThrow();
      expect(await database.user.count({ where: { email: body.email } })).toBe(
        1,
      );
      expect(
        await compareHash(
          recipientPassword,
          (
            await database.user.findUniqueOrThrow({
              where: { id: accepted.user.id },
            })
          ).passwordHash,
        ),
      ).toBe(true);
    });
  });
  it("rechecks exclusive expiry after waiting for the admin guard", async () => {
    await withIdentityDatabase(async (database, url) => {
      const { actor } = await invitationActor(database);
      const { email, messages } = capturedEmail();
      const service = new AdminInvitationsService(database, email);
      const invitation = await service.issue(actor, issueBody());
      const expiresAt = new Date(Date.now() + 60000);
      const token = generateAdminInvitationToken({
        invitationId: invitation.id,
        tokenVersion: 1,
        email: invitation.email,
        expiresAt,
      });
      const { sha256 } = await import("../../infrastructure/security/index.js");
      await database.adminInvitation.update({
        where: { id: invitation.id },
        data: { tokenHash: sha256(token), expiresAt },
      });
      expect(messages).toHaveLength(1);
      await withIndependentIdentityClients(url, async (holder, contender) => {
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
            await transaction.$queryRaw`SELECT id FROM admin_setup_state WHERE id=1 FOR UPDATE`;
            announce();
            await released;
          },
          { timeout: 10000 },
        );
        await held;
        const accepting = new AdminInvitationsService(contender, email).accept(
          token,
          acceptBody,
        );
        const observed = accepting.then(
          (user) => ({ user }),
          (failure: unknown) => ({ failure }),
        );
        try {
          let blocked = false;
          for (let attempt = 0; attempt < 1000; attempt += 1) {
            const activity = await database.$queryRaw<
              { waiting: boolean }[]
            >`SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%admin_setup_state%') AS waiting`;
            if (activity[0]?.waiting === true) {
              blocked = true;
              break;
            }
            await nextTurn();
          }
          expect(blocked).toBe(true);
          vi.useFakeTimers({ toFake: ["Date"] });
          vi.setSystemTime(expiresAt);
          release();
          await holding;
          expect(await observed).toHaveProperty("failure");
        } finally {
          release();
          await Promise.allSettled([holding, accepting]);
          vi.useRealTimers();
        }
      });
      expect(
        (
          await database.adminInvitation.findUniqueOrThrow({
            where: { id: invitation.id },
          })
        ).acceptedAt,
      ).toBeNull();
      expect(
        await database.user.count({ where: { email: invitation.email } }),
      ).toBe(0);
    });
  });
});
