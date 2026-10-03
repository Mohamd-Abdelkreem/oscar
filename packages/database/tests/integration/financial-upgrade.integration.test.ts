import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";

import { Pool } from "pg";
import { expect, it } from "vitest";

const execFileAsync = promisify(execFile);

it("upgrades populated legacy auth data and redeploys without inventing financial records", async () => {
  const baseUrl = process.env["DATABASE_URL"];
  const pnpmScript = process.env["npm_execpath"];
  if (baseUrl === undefined || pnpmScript === undefined)
    throw new Error("Isolated integration runtime is required.");
  // A second database in the disposable Testcontainers instance, never the developer database.
  const name = `p01_upgrade_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: baseUrl });
  const cacheRoot = resolve("node_modules/.cache");
  await mkdir(cacheRoot, { recursive: true });
  const temporary = await mkdtemp(join(cacheRoot, "p01-upgrade-"));
  // Verify the mkdtemp target before authorizing recursive cleanup below.
  if (
    !temporary.startsWith(`${cacheRoot}\\`) &&
    !temporary.startsWith(`${cacheRoot}/`)
  )
    throw new Error("Unsafe temporary cleanup target.");
  const upgradeUrl = new URL(baseUrl);
  upgradeUrl.pathname = `/${name}`;
  let upgraded: Pool | undefined;
  let created = false;
  const deploy = async (config?: string) => {
    await execFileAsync(
      process.execPath,
      [
        pnpmScript,
        "exec",
        "prisma",
        "migrate",
        "deploy",
        ...(config === undefined ? [] : ["--config", config]),
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: upgradeUrl.toString() },
        windowsHide: true,
        timeout: 120_000,
      },
    );
  };
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    const legacy = "20260818000000_init_authentication";
    const migrations = join(temporary, "migrations");
    await mkdir(join(migrations, legacy), { recursive: true });
    await copyFile(
      join("prisma/migrations", legacy, "migration.sql"),
      join(migrations, legacy, "migration.sql"),
    );
    await copyFile(
      "prisma/migrations/migration_lock.toml",
      join(migrations, "migration_lock.toml"),
    );
    const config = join(temporary, "prisma.config.ts");
    await writeFile(
      config,
      `import { defineConfig, env } from "prisma/config";\nexport default defineConfig({ schema: ${JSON.stringify(resolve("prisma/schema.prisma"))}, migrations: { path: ${JSON.stringify(migrations)} }, datasource: { url: env("DATABASE_URL") } });\n`,
    );
    await deploy(config);
    upgraded = new Pool({ connectionString: upgradeUrl.toString() });
    const tablesBefore = await upgraded.query<{ name: string }>(
      `SELECT tablename AS name FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY tablename`,
    );
    expect(tablesBefore.rows).toEqual([
      { name: "refresh_tokens" },
      { name: "users" },
    ]);
    const ownerId = randomUUID();
    const tokenId = randomUUID();
    await upgraded.query(
      `INSERT INTO users (id,email,password_hash,full_name,phone,role,status,email_verified_at,reset_token_hash,reset_token_expires_at,updated_at) VALUES ($1,'legacy@example.com','test-only-credential-hash','Legacy Admin','123','ADMIN','ACTIVE','2026-01-01T00:00:00Z',$2,'2027-01-01T00:00:00Z','2026-01-01T00:00:00Z')`,
      [ownerId, "a".repeat(64)],
    );
    await upgraded.query(
      `INSERT INTO refresh_tokens (id,user_id,token_hash,expires_at) VALUES ($1,$2,$3,'2027-01-01T00:00:00Z')`,
      [tokenId, ownerId, "b".repeat(64)],
    );
    await upgraded.query(
      `INSERT INTO users (email,password_hash,full_name,verification_token_hash,verification_token_expires_at,updated_at) VALUES ('pending-legacy@example.com','pending-test-hash','Pending Legacy',$1,'2027-01-01T00:00:00Z',now())`,
      ["c".repeat(64)],
    );
    const before = {
      users: (await upgraded.query(`SELECT * FROM users ORDER BY id`)).rows,
      refresh: (
        await upgraded.query(`SELECT * FROM refresh_tokens ORDER BY id`)
      ).rows,
      history: (
        await upgraded.query(
          `SELECT migration_name, checksum, finished_at FROM _prisma_migrations ORDER BY migration_name`,
        )
      ).rows,
    };
    await deploy();
    await deploy();
    expect(
      (await upgraded.query(`SELECT * FROM users ORDER BY id`)).rows,
    ).toEqual(before.users);
    expect(
      (await upgraded.query(`SELECT * FROM refresh_tokens ORDER BY id`)).rows,
    ).toEqual(before.refresh);
    expect(
      (
        await upgraded.query(
          `SELECT migration_name,checksum,finished_at FROM _prisma_migrations WHERE migration_name=$1`,
          [legacy],
        )
      ).rows,
    ).toEqual(before.history);
    for (const table of [
      "wallets",
      "financial_operations",
      "ledger_postings",
      "reservation_allocations",
      "financial_audit_records",
      "financial_request_identities",
    ]) {
      expect(
        (await upgraded.query(`SELECT count(*)::int AS count FROM ${table}`))
          .rows,
      ).toEqual([{ count: 0 }]);
    }
    await expect(
      upgraded.query(
        `UPDATE users SET email=' Unnormalized@Example.com ' WHERE id=$1`,
        [ownerId],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "ck_users_email_normalized",
    });
    await expect(
      upgraded.query(`UPDATE users SET email_verified_at=NULL WHERE id=$1`, [
        ownerId,
      ]),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "ck_users_status_timestamps_consistent",
    });
    await upgraded.query(`DELETE FROM users WHERE id=$1`, [ownerId]);
    expect(
      (
        await upgraded.query(
          `SELECT count(*)::int AS count FROM refresh_tokens WHERE id=$1`,
          [tokenId],
        )
      ).rows,
    ).toEqual([{ count: 0 }]);
  } finally {
    await upgraded?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
    await rm(temporary, { recursive: true, force: true });
  }
});
