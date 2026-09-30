import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const databaseUrl = (): string => {
  const value = process.env["DATABASE_URL"];
  if (value === undefined || value.length === 0) {
    throw new Error("The Testcontainers DATABASE_URL was not provided.");
  }
  return value;
};

describe("fresh authentication migration", () => {
  it("creates exactly the required application tables, columns, and indexes", async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const tables = await pool.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            AND table_name <> '_prisma_migrations'
          ORDER BY table_name`,
      );
      expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
        "refresh_tokens",
        "users",
      ]);

      const columns = await pool.query<{
        table_name: string;
        column_name: string;
      }>(
        `SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('users', 'refresh_tokens')
          ORDER BY table_name, ordinal_position`,
      );
      const userColumns = columns.rows
        .filter(({ table_name }) => table_name === "users")
        .map(({ column_name }) => column_name);
      const refreshTokenColumns = columns.rows
        .filter(({ table_name }) => table_name === "refresh_tokens")
        .map(({ column_name }) => column_name);
      expect(userColumns).toEqual([
        "id",
        "email",
        "password_hash",
        "full_name",
        "phone",
        "role",
        "status",
        "email_verified_at",
        "verification_token_hash",
        "verification_token_expires_at",
        "reset_token_hash",
        "reset_token_expires_at",
        "created_at",
        "updated_at",
      ]);
      expect(refreshTokenColumns).toEqual([
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "created_at",
      ]);

      const indexes = await pool.query<{ indexname: string }>(
        `SELECT indexname
           FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN (
              'users_status_role_idx',
              'refresh_tokens_user_idx',
              'refresh_tokens_expiry_idx'
            )
          ORDER BY indexname`,
      );
      expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
        "refresh_tokens_expiry_idx",
        "refresh_tokens_user_idx",
        "users_status_role_idx",
      ]);
    } finally {
      await pool.end();
    }
  });

  it("cascades refresh records and deploys idempotently", async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const deleteRule = await pool.query<{ delete_rule: string }>(
        `SELECT delete_rule
           FROM information_schema.referential_constraints
          WHERE constraint_schema = 'public'
            AND constraint_name = 'refresh_tokens_user_id_fkey'`,
      );
      expect(deleteRule.rows[0]?.delete_rule).toBe("CASCADE");
    } finally {
      await pool.end();
    }

    const pnpmScript = process.env["npm_execpath"];
    if (pnpmScript === undefined) throw new Error("npm_execpath is required.");
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [pnpmScript, "exec", "prisma", "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl() },
        timeout: 120_000,
        windowsHide: true,
      },
    );
    expect(`${stdout}${stderr}`).toMatch(
      /No pending migrations|already in sync/iu,
    );
  });

  it("installs exactly the approved user checks and enforces their data rules", async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const constraints = await pool.query<{ conname: string }>(
        `SELECT conname
           FROM pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND contype = 'c'
          ORDER BY conname`,
      );
      expect(constraints.rows.map(({ conname }) => conname)).toEqual([
        "ck_users_email_normalized",
        "ck_users_status_timestamps_consistent",
      ]);

      const insert = async (
        email: string,
        status: "ACTIVE" | "PENDING_VERIFICATION",
        verifiedAt: Date | null,
      ) =>
        pool.query(
          `INSERT INTO users
             (email, password_hash, full_name, status, email_verified_at, updated_at)
           VALUES ($1, $2, $3, $4::user_status, $5, CURRENT_TIMESTAMP)
           RETURNING id`,
          [email, "argon2-test-hash", "Migration User", status, verifiedAt],
        );

      await expect(
        insert(" Uppercase@example.com ", "PENDING_VERIFICATION", null),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        insert("active@example.com", "ACTIVE", null),
      ).rejects.toMatchObject({ code: "23514" });
      const pending = await insert(
        "pending@example.com",
        "PENDING_VERIFICATION",
        null,
      );
      const active = await insert("verified@example.com", "ACTIVE", new Date());
      expect(pending.rowCount).toBe(1);
      expect(active.rowCount).toBe(1);
      await pool.query(
        `DELETE FROM users
          WHERE email IN ('pending@example.com', 'verified@example.com')`,
      );
    } finally {
      await pool.end();
    }
  });
});
