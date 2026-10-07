import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { Pool } from "pg";
import { expect, it } from "vitest";
import { createDatabaseClient } from "../../src/index.js";
import {
  occurredAt,
  purchaseFixture,
  subscription,
} from "./support/p04-fixtures.js";

const execFileAsync = promisify(execFile);
const p06Migration = "20261006000000_p06_tron_custody_deposits";
it("upgrades populated P05 history without loss, rolls back a late P06 failure and redeploys idempotently", async () => {
  const baseUrl = process.env["DATABASE_URL"];
  const pnpmScript = process.env["npm_execpath"];
  if (baseUrl === undefined || pnpmScript === undefined)
    throw new Error("Disposable integration runtime required.");
  const databaseName = `p06_upgrade_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: baseUrl });
  const upgradedUrl = new URL(baseUrl);
  upgradedUrl.pathname = `/${databaseName}`;
  const cacheRoot = resolve("node_modules/.cache");
  await mkdir(cacheRoot, { recursive: true });
  const temporary = await mkdtemp(join(cacheRoot, "p06-upgrade-"));
  if (
    !temporary.startsWith(`${cacheRoot}\\`) &&
    !temporary.startsWith(`${cacheRoot}/`)
  )
    throw new Error("Unsafe cleanup target.");
  const migrationsRoot = join(temporary, "migrations");
  const configuration = join(temporary, "prisma.config.ts");
  let created = false;
  let upgraded: Pool | undefined;
  let database: ReturnType<typeof createDatabaseClient> | undefined;
  const deploy = () =>
    execFileAsync(
      process.execPath,
      [
        pnpmScript,
        "exec",
        "prisma",
        "migrate",
        "deploy",
        "--config",
        configuration,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: upgradedUrl.toString() },
        windowsHide: true,
        timeout: 120000,
      },
    );
  try {
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    await mkdir(migrationsRoot);
    const history = (
      await readdir("prisma/migrations", { withFileTypes: true })
    ).filter((entry) => entry.isDirectory() && entry.name < p06Migration);
    for (const entry of history) {
      await mkdir(join(migrationsRoot, entry.name));
      await copyFile(
        join("prisma/migrations", entry.name, "migration.sql"),
        join(migrationsRoot, entry.name, "migration.sql"),
      );
    }
    await copyFile(
      "prisma/migrations/migration_lock.toml",
      join(migrationsRoot, "migration_lock.toml"),
    );
    await writeFile(
      configuration,
      `import { defineConfig, env } from "prisma/config";\nexport default defineConfig({ schema: ${JSON.stringify(resolve("prisma/schema.prisma"))}, migrations: { path: ${JSON.stringify(migrationsRoot)} }, datasource: { url: env("DATABASE_URL") } });\n`,
    );
    await deploy();
    upgraded = new Pool({ connectionString: upgradedUrl.toString() });
    database = createDatabaseClient(upgradedUrl.toString());
    const purchase = await purchaseFixture(database);
    const retainedPurchase = await database.purchase.create({
      data: purchase.purchaseData,
    });
    await subscription(database, retainedPurchase.id, purchase.owner.user.id);
    const operator = await database.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        fullName: "P06 upgrade admin",
        passwordHash: "test-only-hash",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: occurredAt,
      },
    });
    await database.authSession.create({
      data: {
        userId: operator.id,
        rememberMe: false,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      },
    });
    await database.task.create({
      data: {
        publicationDate: new Date("2026-10-06T00:00:00Z"),
        publicationState: "PUBLISHED",
        title: "Retained P05 task",
        description: "Retained immutable task context",
        targetUrl: "https://example.com/task",
        platform: "Custom",
        isCodeRequired: true,
        createdByUserId: operator.id,
        updatedByUserId: operator.id,
        createdAt: occurredAt,
        updatedAt: occurredAt,
      },
    });
    const snapshots = new Map<string, unknown[]>();
    for (const table of [
      "users",
      "auth_sessions",
      "wallets",
      "financial_operations",
      "ledger_postings",
      "purchases",
      "subscriptions",
      "tasks",
      "_prisma_migrations",
    ]) {
      snapshots.set(
        table,
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      );
    }
    const sql = await readFile(
      join("prisma/migrations", p06Migration, "migration.sql"),
      "utf8",
    );
    const connection = await upgraded.connect();
    try {
      await expect(
        connection.query(sql.replace(/COMMIT;\s*$/u, "SELECT 1/0;\nCOMMIT;")),
      ).rejects.toMatchObject({ code: "22012" });
      await connection.query("ROLLBACK");
      expect(
        (
          await connection.query(
            "SELECT to_regclass('deposit_receipts') AS receipt, to_regtype('tron_network') AS network",
          )
        ).rows,
      ).toEqual([{ receipt: null, network: null }]);
    } finally {
      connection.release();
    }
    for (const [table, snapshot] of snapshots)
      expect(
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      ).toEqual(snapshot);
    await mkdir(join(migrationsRoot, p06Migration));
    await copyFile(
      join("prisma/migrations", p06Migration, "migration.sql"),
      join(migrationsRoot, p06Migration, "migration.sql"),
    );
    await deploy();
    await deploy();
    for (const [table, snapshot] of snapshots) {
      if (table !== "_prisma_migrations")
        expect(
          (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
        ).toEqual(snapshot);
    }
    expect(
      await database.purchase.findUnique({
        where: { id: retainedPurchase.id },
      }),
    ).not.toBeNull();
    for (const table of [
      "deposit_address_assignments",
      "deposit_candidates",
      "deposit_scan_progress",
      "deposit_receipts",
      "manual_credits",
      "treasury_sweeps",
      "transfer_attempts",
      "financial_runtime_admissions",
    ]) {
      expect(
        (await upgraded.query(`SELECT count(*)::int AS count FROM ${table}`))
          .rows,
      ).toEqual([{ count: 0 }]);
    }
    expect(
      await database.financialRuntimeControl.findUnique({ where: { id: 1 } }),
    ).toMatchObject({
      generation: 1n,
      financialWritesFenced: true,
      newDispatchPaused: true,
    });
    for (const entry of (
      await readdir("prisma/migrations", { withFileTypes: true })
    ).filter((entry) => entry.isDirectory() && entry.name > p06Migration)) {
      await mkdir(join(migrationsRoot, entry.name));
      await copyFile(
        join("prisma/migrations", entry.name, "migration.sql"),
        join(migrationsRoot, entry.name, "migration.sql"),
      );
    }
    await deploy();
    await deploy();
    for (const [table, snapshot] of snapshots)
      if (table !== "_prisma_migrations")
        expect(
          (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
        ).toEqual(snapshot);
    expect(await database.depositCandidateDiscovery.count()).toBe(0);
    expect(
      (
        await upgraded.query(
          "SELECT column_name FROM information_schema.columns WHERE table_name='treasury_sweeps' AND column_name='next_attempt_at'",
        )
      ).rows,
    ).toEqual([{ column_name: "next_attempt_at" }]);
  } finally {
    await database?.$disconnect();
    await upgraded?.end();
    if (created)
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
    await rm(temporary, { recursive: true, force: true });
  }
}, 180000);
