import { randomUUID } from "node:crypto";

import { createDatabaseClient, Prisma } from "@template/database";
import {
  identityUserDataSchema,
  registerBodySchema,
} from "@template/contracts";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ConflictException } from "../../core/errors/conflict.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import type { EmailDelivery } from "../../infrastructure/email/email-delivery.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import {
  compareHash,
  generateResetToken,
  sha256,
} from "../../infrastructure/security/index.js";
import { AuthService } from "./auth.service.js";
import {
  createIdentityFixture,
  identityRaceBarrier,
  withIndependentIdentityClients,
} from "./testing/identity-fixtures.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined)
  throw new Error("Testcontainers DATABASE_URL is required.");
const database = createDatabaseClient(databaseUrl);
const pendingInput = () => ({
  fullName: "Same Person",
  email: `us1-${randomUUID()}@example.com`,
  phone: null,
  password: "  password-preserved  ",
});
const mailHarness = () => {
  const tokens: string[] = [];
  let failure: Error | undefined;
  const delivery: EmailDelivery = {
    provider: "console",
    send: (message) => {
      const encoded = message.html.match(/token=([^"&<]+)/u)?.[1];
      if (encoded === undefined) throw new Error("Missing test email action.");
      tokens.push(decodeURIComponent(encoded));
      if (failure !== undefined) return Promise.reject(failure);
      return Promise.resolve({ providerMessageId: "test-us1" });
    },
  };
  const email = new EmailService(delivery);
  return {
    tokens,
    email,
    service: new AuthService(database, email),
    fail: (error?: Error) => {
      failure = error;
    },
  };
};
const lastToken = (tokens: string[]) => {
  const token = tokens.at(-1);
  if (token === undefined) throw new Error("No captured token.");
  return token;
};
const zeroSources = {
  availableNonReferralUnits: 0n,
  reservedNonReferralUnits: 0n,
  availableReferralUnits: 0n,
  reservedReferralUnits: 0n,
};

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
afterAll(async () => {
  await database.$disconnect();
});

describe("P02 US1 atomic employee registration", () => {
  it.each([false, true])(
    "retries only generated code collisions and bounds exhaustion=%s",
    async (exhausted) => {
      const sponsor = await createIdentityFixture(database);
      const input = pendingInput();
      const { email } = mailHarness();
      let generated = 0;
      const service = new AuthService(database, email, () => {
        generated += 1;
        return exhausted || generated === 1
          ? sponsor.user.referralCode
          : randomUUID().replaceAll("-", "");
      });
      if (exhausted) {
        await expect(service.register(input)).rejects.toBeInstanceOf(
          ServiceUnavailableException,
        );
        expect(
          await database.user.count({ where: { email: input.email } }),
        ).toBe(0);
        expect(
          await database.wallet.count({
            where: { owner: { email: input.email } },
          }),
        ).toBe(0);
        expect(generated).toBe(3);
      } else {
        const registered = await service.register(input);
        expect(registered.user.referralCode).not.toBe(
          sponsor.user.referralCode,
        );
        expect(generated).toBe(2);
        expect(
          await database.wallet.count({
            where: { ownerUserId: registered.user.id },
          }),
        ).toBe(1);
      }
    },
  );
  it("creates distinct same-person accounts with fixed assigned/absent sponsors and zero wallets", async () => {
    const { service, tokens } = mailHarness();
    const sponsor = await createIdentityFixture(database);
    const firstInput = pendingInput();
    const first = await service.register(
      registerBodySchema.parse({
        ...firstInput,
        email: ` ${firstInput.email.toUpperCase()} `,
        referralCode: ` ${sponsor.user.referralCode.toUpperCase()} `,
      }),
    );
    const second = await service.register(pendingInput());
    expect(identityUserDataSchema.parse(first).user).toMatchObject({
      status: "PENDING_VERIFICATION",
      accountVersion: 0,
      tasksBlocked: false,
      withdrawalsBlocked: false,
    });
    expect(first.user.referralCode).toMatch(/^[0-9a-f]{32}$/u);
    expect(first.user.referralCode).not.toBe(second.user.referralCode);
    for (const [registered, sponsorId] of [
      [first, sponsor.user.id],
      [second, null],
    ] as const) {
      const stored = await database.user.findUniqueOrThrow({
        where: { id: registered.user.id },
      });
      expect(stored.sponsorUserId).toBe(sponsorId);
      expect(await compareHash(firstInput.password, stored.passwordHash)).toBe(
        true,
      );
      expect(
        await database.wallet.findUnique({ where: { ownerUserId: stored.id } }),
      ).toMatchObject(zeroSources);
      await expect(
        database.user.update({
          where: { id: stored.id },
          data: { sponsorUserId: sponsorId === null ? sponsor.user.id : null },
        }),
      ).rejects.toThrow();
    }
    const code = second.user.referralCode;
    const activated = await service.verifyEmail(lastToken(tokens));
    expect(activated.user).toMatchObject({
      referralCode: code,
      accountVersion: 1,
      status: "ACTIVE",
    });
    expect(
      await database.authSession.count({
        where: { userId: activated.user.id },
      }),
    ).toBe(0);
    expect(
      await database.financialOperation.count({
        where: { wallet: { ownerUserId: activated.user.id } },
      }),
    ).toBe(0);
  });

  it("rejects unknown/nonemployee codes without partial provisioning", async () => {
    const { service } = mailHarness();
    const admin = await createIdentityFixture(database, { role: "ADMIN" });
    for (const referralCode of [
      randomUUID().replaceAll("-", ""),
      admin.user.referralCode,
    ]) {
      const input = { ...pendingInput(), referralCode };
      await expect(service.register(input)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(await database.user.count({ where: { email: input.email } })).toBe(
        0,
      );
    }
  });

  it("rejects direct self/cycle/code changes while retaining the sponsor tree", async () => {
    const parent = await createIdentityFixture(database);
    const child = await createIdentityFixture(database, {
      sponsorUserId: parent.user.id,
    });
    const selfId = randomUUID();
    await expect(
      database.user.create({
        data: {
          id: selfId,
          email: pendingInput().email,
          fullName: "Self",
          passwordHash: "fixture-hash",
          sponsorUserId: selfId,
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.user.update({
        where: { id: parent.user.id },
        data: { sponsorUserId: child.user.id },
      }),
    ).rejects.toThrow();
    await expect(
      database.user.update({
        where: { id: child.user.id },
        data: { referralCode: randomUUID().replaceAll("-", "") },
      }),
    ).rejects.toThrow();
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: child.user.id } }))
        .sponsorUserId,
    ).toBe(parent.user.id);
  });

  it("allows one normalized email registration across independent competing clients", async () => {
    const { email } = mailHarness();
    const input = pendingInput();
    await withIndependentIdentityClients(databaseUrl, async (first, second) => {
      const start = identityRaceBarrier(2);
      const outcomes = await Promise.allSettled(
        [first, second].map(async (client, index) => {
          await start();
          return new AuthService(client, email).register({
            ...input,
            email: index === 0 ? input.email : ` ${input.email.toUpperCase()} `,
          });
        }),
      );
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      const losing = outcomes.find((outcome) => outcome.status === "rejected");
      if (losing?.status !== "rejected")
        throw new Error("Missing competing denial.");
      expect(losing.reason).toBeInstanceOf(ConflictException);
    });
    expect(await database.user.count({ where: { email: input.email } })).toBe(
      1,
    );
    expect(
      await database.wallet.count({ where: { owner: { email: input.email } } }),
    ).toBe(1);
  });

  it("rolls back the account when the dependent wallet write fails after user creation", async () => {
    const { service, tokens } = mailHarness();
    const input = pendingInput();
    await database.$executeRawUnsafe(
      `CREATE FUNCTION us1_wallet_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF EXISTS(SELECT 1 FROM users WHERE id=NEW.owner_user_id AND email='${input.email}') THEN RAISE EXCEPTION 'controlled wallet failure'; END IF; RETURN NEW; END $$`,
    );
    await database.$executeRawUnsafe(
      "CREATE TRIGGER us1_wallet_failure BEFORE INSERT ON wallets FOR EACH ROW EXECUTE FUNCTION us1_wallet_failure()",
    );
    try {
      await expect(service.register(input)).rejects.toThrow();
      expect(await database.user.count({ where: { email: input.email } })).toBe(
        0,
      );
      expect(
        await database.wallet.count({
          where: { owner: { email: input.email } },
        }),
      ).toBe(0);
      expect(tokens).toHaveLength(0);
    } finally {
      await database.$executeRawUnsafe(
        "DROP TRIGGER us1_wallet_failure ON wallets",
      );
      await database.$executeRawUnsafe("DROP FUNCTION us1_wallet_failure()");
    }
  });

  it.each(["rejected", "timeout", "lost provider acknowledgement"])(
    "retains complete pending state after %s and recovers through bounded resend",
    async (outcome) => {
      const harness = mailHarness();
      const input = pendingInput();
      const sponsor = await createIdentityFixture(database);
      harness.fail(new Error(outcome));
      await expect(
        harness.service.register({
          ...input,
          referralCode: sponsor.user.referralCode,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      const saved = await database.user.findUniqueOrThrow({
        where: { email: input.email },
      });
      expect(saved).toMatchObject({
        status: "PENDING_VERIFICATION",
        sponsorUserId: sponsor.user.id,
      });
      expect(
        await database.wallet.findUnique({ where: { ownerUserId: saved.id } }),
      ).toMatchObject(zeroSources);
      await expect(harness.service.register(input)).rejects.toBeInstanceOf(
        ConflictException,
      );
      const oldToken = lastToken(harness.tokens);
      await database.user.update({
        where: { id: saved.id },
        data: { verificationTokenExpiresAt: new Date(Date.now() - 1) },
      });
      const neutralFailure = await harness.service.resendVerification({
        email: saved.email,
      });
      const neutralUnknown = await harness.service.resendVerification({
        email: pendingInput().email,
      });
      expect(neutralFailure).toEqual(neutralUnknown);
      harness.fail();
      await database.user.update({
        where: { id: saved.id },
        data: { verificationTokenHash: null, verificationTokenExpiresAt: null },
      });
      await harness.service.resendVerification({ email: saved.email });
      await expect(
        harness.service.verifyEmail(oldToken),
      ).rejects.toBeInstanceOf(BadRequestException);
      await harness.service.verifyEmail(lastToken(harness.tokens));
      expect(
        await database.wallet.count({ where: { ownerUserId: saved.id } }),
      ).toBe(1);
      expect(
        (await database.user.findUniqueOrThrow({ where: { id: saved.id } }))
          .sponsorUserId,
      ).toBe(sponsor.user.id);
    },
  );
});

describe("P02 US1 single-use activation", () => {
  it("validates without consuming, replaces only after cooldown and consumes once across clients", async () => {
    const { service, email, tokens } = mailHarness();
    const registered = await service.register(pendingInput());
    const original = lastToken(tokens);
    await expect(service.validateVerificationToken(original)).resolves.toEqual({
      valid: true,
    });
    await service.resendVerification({ email: registered.user.email });
    expect(tokens).toHaveLength(1);
    await database.user.update({
      where: { id: registered.user.id },
      data: { verificationTokenExpiresAt: new Date(Date.now() - 1) },
    });
    await service.resendVerification({ email: registered.user.email });
    const replacement = lastToken(tokens);
    await expect(service.verifyEmail(original)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await withIndependentIdentityClients(databaseUrl, async (first, second) => {
      const start = identityRaceBarrier(2);
      const outcomes = await Promise.allSettled(
        [first, second].map(async (client) => {
          await start();
          return new AuthService(client, email).verifyEmail(replacement);
        }),
      );
      expect(
        outcomes.filter((outcome) => outcome.status === "fulfilled"),
      ).toHaveLength(1);
      const denied = outcomes.find((outcome) => outcome.status === "rejected");
      if (denied?.status !== "rejected")
        throw new Error("Missing activation denial.");
      expect(denied.reason).toBeInstanceOf(BadRequestException);
    });
    const saved = await database.user.findUniqueOrThrow({
      where: { id: registered.user.id },
    });
    expect(saved).toMatchObject({
      status: "ACTIVE",
      accountVersion: 1,
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
    });
    await expect(service.verifyEmail(replacement)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(
      await database.identityAuditRecord.count({
        where: { targetUserId: saved.id },
      }),
    ).toBe(0);
  });

  it.each([-1, 0, 1])(
    "uses an exclusive persisted expiry boundary with offset %i milliseconds",
    async (offset) => {
      const { service, tokens } = mailHarness();
      const registered = await service.register(pendingInput());
      // Keep JWT live so this isolates the persisted boundary, independently of its expiry.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date());
      const issued = Date.now();
      await database.user.update({
        where: { id: registered.user.id },
        data: { verificationTokenExpiresAt: new Date(issued + 60_000) },
      });
      vi.setSystemTime(issued + 60_000 + offset);
      if (offset < 0)
        await expect(
          service.verifyEmail(lastToken(tokens)),
        ).resolves.toMatchObject({ user: { status: "ACTIVE" } });
      else
        await expect(
          service.verifyEmail(lastToken(tokens)),
        ).rejects.toBeInstanceOf(BadRequestException);
      expect(
        (
          await database.user.findUniqueOrThrow({
            where: { id: registered.user.id },
          })
        ).accountVersion,
      ).toBe(offset < 0 ? 1 : 0);
    },
  );

  it("rechecks expiry after waiting for a real User lock", async () => {
    const { service, tokens } = mailHarness();
    const registered = await service.register(pendingInput());
    const issued = Date.now();
    await database.user.update({
      where: { id: registered.user.id },
      data: { verificationTokenExpiresAt: new Date(issued + 60_000) },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(issued);
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
              Prisma.sql`SELECT id FROM users WHERE id=${registered.user.id}::uuid FOR UPDATE`,
            );
            acquired();
            await unlocked;
          },
          { timeout: 10_000 },
        );
        await locked;
        const activation = new AuthService(
          contender,
          mailHarness().email,
        ).verifyEmail(lastToken(tokens));
        const observed = activation.catch((failure: unknown) => failure);
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
          vi.setSystemTime(issued + 60_000);
        } finally {
          release();
          await holding;
        }
        expect(await observed).toBeInstanceOf(BadRequestException);
      },
    );
    expect(
      (
        await database.user.findUniqueOrThrow({
          where: { id: registered.user.id },
        })
      ).status,
    ).toBe("PENDING_VERIFICATION");
  });

  it.each(["SUSPENDED", "BANNED"] as const)(
    "never restores %s with an old credential or resend",
    async (status) => {
      const { service, tokens } = mailHarness();
      const registered = await service.register(pendingInput());
      const token = lastToken(tokens);
      await database.user.update({
        where: { id: registered.user.id },
        data: { status },
      });
      await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await service.resendVerification({ email: registered.user.email });
      expect(tokens).toHaveLength(1);
      expect(
        (
          await database.user.findUniqueOrThrow({
            where: { id: registered.user.id },
          })
        ).status,
      ).toBe(status);
    },
  );

  it("rejects wrong purpose and cross-user hash binding", async () => {
    const { service, tokens } = mailHarness();
    const first = await service.register(pendingInput());
    const token = lastToken(tokens);
    const second = await service.register(pendingInput());
    await database.user.update({
      where: { id: first.user.id },
      data: { verificationTokenHash: null, verificationTokenExpiresAt: null },
    });
    await database.user.update({
      where: { id: second.user.id },
      data: { verificationTokenHash: sha256(token) },
    });
    await expect(service.verifyEmail(token)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.verifyEmail(
        generateResetToken(
          first.user.email,
          first.user.id,
          new Date(Date.now() + 60_000),
        ),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      (await database.user.findUniqueOrThrow({ where: { id: second.user.id } }))
        .status,
    ).toBe("PENDING_VERIFICATION");
  });

  it("recovers a migrated pending ADMIN on weekends and records recipient audit without a wallet/session", async () => {
    const { service, tokens } = mailHarness();
    const admin = await database.user.create({
      data: {
        email: pendingInput().email,
        fullName: "Pending Admin",
        passwordHash: "fixture-hash",
        role: "ADMIN",
      },
    });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2030-10-05T23:00:00Z"));
    vi.stubEnv("TZ", "Pacific/Honolulu");
    await service.resendVerification({ email: admin.email });
    const token = lastToken(tokens);
    await expect(service.validateVerificationToken(token)).resolves.toEqual({
      valid: true,
    });
    const activated = await service.verifyEmail(token);
    expect(activated.user).toMatchObject({
      role: "ADMIN",
      referralCode: null,
      accountVersion: 1,
      status: "ACTIVE",
    });
    const audit = await database.identityAuditRecord.findMany({
      where: { targetUserId: admin.id },
    });
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: "ADMIN_EMAIL_ACTIVATE",
      actorKind: "VERIFIED_EMAIL_RECIPIENT",
      actorUserId: admin.id,
      targetUserId: admin.id,
      reason: null,
      outcome: "COMMITTED",
    });
    expect(JSON.stringify(audit)).not.toContain(token);
    expect(
      await database.wallet.count({ where: { ownerUserId: admin.id } }),
    ).toBe(0);
    expect(
      await database.authSession.count({ where: { userId: admin.id } }),
    ).toBe(0);
  });

  it("rolls back pending ADMIN activation and credential consumption when required audit fails", async () => {
    const { service, tokens } = mailHarness();
    const admin = await database.user.create({
      data: {
        email: pendingInput().email,
        fullName: "Audit rollback",
        passwordHash: "fixture-hash",
        role: "ADMIN",
      },
    });
    await service.resendVerification({ email: admin.email });
    const token = lastToken(tokens);
    await database.$executeRawUnsafe(
      `CREATE FUNCTION us1_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.target_user_id='${admin.id}'::uuid THEN RAISE EXCEPTION 'controlled audit failure'; END IF; RETURN NEW; END $$`,
    );
    await database.$executeRawUnsafe(
      "CREATE TRIGGER us1_audit_failure BEFORE INSERT ON identity_audit_records FOR EACH ROW EXECUTE FUNCTION us1_audit_failure()",
    );
    try {
      await expect(service.verifyEmail(token)).rejects.toThrow();
      expect(
        await database.user.findUnique({ where: { id: admin.id } }),
      ).toMatchObject({
        status: "PENDING_VERIFICATION",
        accountVersion: 0,
        emailVerifiedAt: null,
        verificationTokenHash: sha256(token),
      });
      expect(
        await database.identityAuditRecord.count({
          where: { targetUserId: admin.id },
        }),
      ).toBe(0);
    } finally {
      await database.$executeRawUnsafe(
        "DROP TRIGGER us1_audit_failure ON identity_audit_records",
      );
      await database.$executeRawUnsafe("DROP FUNCTION us1_audit_failure()");
    }
    await expect(service.verifyEmail(token)).resolves.toMatchObject({
      user: { status: "ACTIVE", accountVersion: 1 },
    });
  });
});
