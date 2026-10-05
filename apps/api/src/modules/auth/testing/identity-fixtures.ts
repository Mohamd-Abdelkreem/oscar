import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";

import {
  createDatabaseClient,
  type DatabaseClient,
  type UserRole,
  type UserStatus,
} from "@template/database";

export {
  financialRaceBarrier as identityRaceBarrier,
  withIndependentFinancialClients as withIndependentIdentityClients,
} from "../../ledger/testing/financial-fixtures.js";

const execFileAsync = promisify(execFile);

export async function createIdentityFixture(
  database: DatabaseClient,
  options: Readonly<{
    role?: UserRole;
    status?: UserStatus;
    passwordHash?: string;
    sponsorUserId?: string;
    now?: Date;
  }> = {},
) {
  const role = options.role ?? "USER";
  const status = options.status ?? "ACTIVE";
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime()))
    throw new RangeError("Invalid identity fixture clock.");
  const verifiedAt = status === "PENDING_VERIFICATION" ? null : now;
  return database.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        email: `identity-${randomUUID()}@example.com`,
        fullName: "Identity Fixture",
        passwordHash: options.passwordHash ?? "test-only-unused-password-hash",
        role,
        status,
        emailVerifiedAt: verifiedAt,
        ...(options.sponsorUserId === undefined
          ? {}
          : { sponsorUserId: options.sponsorUserId }),
      },
    });
    const wallet =
      role === "USER"
        ? await transaction.wallet.create({ data: { ownerUserId: user.id } })
        : null;
    const session = await transaction.authSession.create({
      data: {
        userId: user.id,
        rememberMe: false,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86_400_000),
      },
    });
    return { user, wallet, session };
  });
}

export async function withIdentityDatabase<T>(
  work: (database: DatabaseClient, databaseUrl: string) => Promise<T>,
  frontier: "P01" | "P02" = "P02",
): Promise<T> {
  const baseUrl = process.env["DATABASE_URL"];
  const pnpmScript = process.env["npm_execpath"];
  if (
    baseUrl === undefined ||
    pnpmScript === undefined ||
    new URL(baseUrl).pathname !== "/template_api_integration"
  )
    throw new Error("The isolated API Testcontainers runtime is required.");
  const databaseName = `p02_identity_${randomUUID().replaceAll("-", "")}`;
  const isolatedUrl = new URL(baseUrl);
  isolatedUrl.pathname = `/${databaseName}`;
  const root = createDatabaseClient(baseUrl);
  let isolated: DatabaseClient | undefined;
  let created = false;
  let temporary: string | undefined;
  const databasePackage = resolve(process.cwd(), "../../packages/database");
  const cacheRoot = resolve("node_modules/.cache");
  try {
    await root.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const argumentsList = [pnpmScript, "exec", "prisma", "migrate", "deploy"];
    if (frontier === "P01") {
      await mkdir(cacheRoot, { recursive: true });
      temporary = await mkdtemp(join(cacheRoot, "identity-frontier-"));
      const migrations = join(temporary, "migrations");
      for (const name of [
        "20260818000000_init_authentication",
        "20261002000000_financial_foundation",
      ]) {
        await mkdir(join(migrations, name), { recursive: true });
        await copyFile(
          join(databasePackage, "prisma/migrations", name, "migration.sql"),
          join(migrations, name, "migration.sql"),
        );
      }
      await copyFile(
        join(databasePackage, "prisma/migrations/migration_lock.toml"),
        join(migrations, "migration_lock.toml"),
      );
      const config = join(temporary, "prisma.config.ts");
      await writeFile(
        config,
        `import { defineConfig, env } from "prisma/config";\nexport default defineConfig({ schema: ${JSON.stringify(join(databasePackage, "prisma/schema.prisma"))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: env("DATABASE_URL") } });\n`,
      );
      argumentsList.push("--config", config);
    }
    await execFileAsync(process.execPath, argumentsList, {
      cwd: databasePackage,
      env: { ...process.env, DATABASE_URL: isolatedUrl.toString() },
      timeout: 180_000,
      windowsHide: true,
    });
    isolated = createDatabaseClient(isolatedUrl.toString());
    return await work(isolated, isolatedUrl.toString());
  } finally {
    try {
      await isolated?.$disconnect();
      if (created)
        await root.$executeRawUnsafe(`DROP DATABASE "${databaseName}"`);
    } finally {
      await root.$disconnect();
      if (temporary !== undefined) {
        if (resolve(temporary).startsWith(`${cacheRoot}${sep}`))
          await rm(temporary, { recursive: true, force: true });
      }
    }
  }
}
