import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/index.js";
import { buildSeedUpsert } from "../../src/seed-config.js";

const AUTH = "20260818000000_init_authentication";
const FINANCE = "20261002000000_financial_foundation";
const ENUM = "20261003000000_identity_status";
const IDENTITY = "20261003000100_identity_authority";
const migration = (name: string) =>
  readFile(`prisma/migrations/${name}/migration.sql`, "utf8");

async function withHistoricalDatabase(
  work: (pool: Pool, url: string) => Promise<void>,
) {
  const baseUrl = process.env["DATABASE_URL"];
  if (baseUrl === undefined)
    throw new Error("Disposable integration database is required.");
  const name = `p02_upgrade_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: baseUrl });
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  let pool: Pool | undefined;
  let created = false;
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    pool = new Pool({ connectionString: url.toString() });
    await pool.query<Record<string, unknown>>(await migration(AUTH));
    await pool.query<Record<string, unknown>>(await migration(FINANCE));
    await work(pool, url.toString());
  } finally {
    await pool?.end();
    if (created) await admin.query(`DROP DATABASE "${name}"`);
    await admin.end();
  }
}

async function insertHistoricalUser(
  pool: Pool,
  role = "USER",
  status = "ACTIVE",
) {
  const id = randomUUID();
  await pool.query<Record<string, unknown>>(
    `INSERT INTO users(id,email,password_hash,full_name,role,status,email_verified_at,verification_token_hash,verification_token_expires_at,reset_token_hash,reset_token_expires_at,updated_at)
    VALUES($1,$2,'historical-password','Historical',$3::user_role,$4::user_status,$5,$6,'2030-01-01',$7,'2030-01-01',now())`,
    [
      id,
      `${id}@example.com`,
      role,
      status,
      status === "PENDING_VERIFICATION" ? null : new Date("2026-01-01"),
      "a".repeat(64),
      "b".repeat(64),
    ],
  );
  return id;
}

async function upgrade(pool: Pool) {
  // Separate committed calls are required before the authority migration can use new enum values.
  await pool.query<Record<string, unknown>>(await migration(ENUM));
  await pool.query<Record<string, unknown>>(await migration(IDENTITY));
}

describe("P02 forward identity upgrade", () => {
  it.each(["ACTIVE", "PENDING_VERIFICATION"])(
    "preserves populated financial history with a viable historical %s administrator",
    async (status) => {
      await withHistoricalDatabase(async (pool, url) => {
        const adminId = await insertHistoricalUser(pool, "ADMIN", status);
        const employeeId = await insertHistoricalUser(pool);
        const walletId = randomUUID();
        await pool.query<Record<string, unknown>>(
          `INSERT INTO wallets(id,owner_user_id,available_non_referral_units,available_referral_units,updated_at) VALUES($1,$2,70000000,30000000,now())`,
          [walletId, employeeId],
        );
        const creditId = randomUUID();
        const referralId = randomUUID();
        const reserveId = randomUUID();
        for (const [operationId, kind, origin, amount] of [
          [creditId, "CREDIT", "DEPOSIT", "70000000"],
          [referralId, "CREDIT", "REFERRAL_COMMISSION", "30000000"],
          [reserveId, "RESERVE", "WITHDRAWAL_RESERVATION", "10000000"],
        ]) {
          await pool.query<Record<string, unknown>>(
            `INSERT INTO financial_operations(id,wallet_id,kind,business_namespace,business_key,intent_hash,magnitude_units,origin,actor_type,actor_process_id,accepted_terms,outcome) VALUES($1,$2,$3::financial_operation_kind,'identity-upgrade',$1::uuid::text,$4,$5,$6::financial_origin,'PROCESS','upgrade-fixture','{}','{}')`,
            [operationId, walletId, kind, "d".repeat(64), amount, origin],
          );
          await pool.query<Record<string, unknown>>(
            `INSERT INTO financial_audit_records(id,operation_id,actor_type,actor_process_id,action) VALUES($1,$2,'PROCESS','upgrade-fixture',$3::financial_operation_kind)`,
            [randomUUID(), operationId, kind],
          );
        }
        await pool.query<Record<string, unknown>>(
          `INSERT INTO ledger_postings(id,operation_id,wallet_id,source,available_delta_units,reserved_delta_units) VALUES($1,$2,$3,'NON_REFERRAL',70000000,0),($4,$7,$3,'REFERRAL',30000000,0),($5,$6,$3,'NON_REFERRAL',-10000000,10000000)`,
          [
            randomUUID(),
            creditId,
            walletId,
            randomUUID(),
            randomUUID(),
            reserveId,
            referralId,
          ],
        );
        await pool.query<Record<string, unknown>>(
          `INSERT INTO reservation_allocations(id,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units) VALUES($1,$2,$3,10000000,10000000,0)`,
          [randomUUID(), walletId, reserveId],
        );
        await pool.query<Record<string, unknown>>(
          `INSERT INTO financial_request_identities(id,operation_id,actor_scope,kind,request_key,intent_hash) VALUES($1,$2,'PROCESS:upgrade-fixture','CREDIT','historic-request',$3)`,
          [randomUUID(), creditId, "d".repeat(64)],
        );
        await pool.query<Record<string, unknown>>(
          `UPDATE wallets SET available_non_referral_units=60000000,reserved_non_referral_units=10000000 WHERE id=$1`,
          [walletId],
        );
        const missingId = await insertHistoricalUser(
          pool,
          "USER",
          "PENDING_VERIFICATION",
        );
        await pool.query<Record<string, unknown>>(
          `INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,'2030-01-01')`,
          [employeeId, "c".repeat(64)],
        );
        const walletBefore = (
          await pool.query<Record<string, unknown>>(
            `SELECT * FROM wallets WHERE id=$1`,
            [walletId],
          )
        ).rows;
        const financialTables = [
          "financial_operations",
          "financial_request_identities",
          "ledger_postings",
          "reservation_allocations",
          "financial_audit_records",
        ];
        const history = await Promise.all(
          financialTables.map(
            async (table) =>
              (
                await pool.query<Record<string, unknown>>(
                  `SELECT * FROM ${table}`,
                )
              ).rows,
          ),
        );
        await upgrade(pool);
        expect(
          (
            await pool.query<Record<string, unknown>>(
              `SELECT * FROM wallets WHERE id=$1`,
              [walletId],
            )
          ).rows,
        ).toEqual(walletBefore);
        expect(
          await Promise.all(
            financialTables.map(
              async (table) =>
                (
                  await pool.query<Record<string, unknown>>(
                    `SELECT * FROM ${table}`,
                  )
                ).rows,
            ),
          ),
        ).toEqual(history);
        const users = await pool.query<{
          id: string;
          referral_code: string;
          sponsor_user_id: string | null;
          verification_token_hash: string | null;
          reset_token_hash: string | null;
        }>(`SELECT * FROM users`);
        expect(users.rows).toHaveLength(3);
        for (const user of users.rows) {
          expect(user.referral_code).toMatch(/^[a-f0-9]{32}$/u);
          expect(user.sponsor_user_id).toBeNull();
          expect(user.verification_token_hash).toBeNull();
          expect(user.reset_token_hash).toBeNull();
        }
        expect(
          (
            await pool.query<Record<string, unknown>>(
              `SELECT count(*)::int AS count FROM refresh_tokens`,
            )
          ).rows[0],
        ).toEqual({ count: 0 });
        expect(
          (
            await pool.query<Record<string, unknown>>(
              `SELECT * FROM wallets WHERE owner_user_id=$1`,
              [missingId],
            )
          ).rows[0],
        ).toMatchObject({
          available_non_referral_units: "0",
          reserved_non_referral_units: "0",
          available_referral_units: "0",
          reserved_referral_units: "0",
        });
        expect(
          (
            await pool.query<Record<string, unknown>>(
              `SELECT count(*)::int AS count FROM wallets WHERE owner_user_id=$1`,
              [adminId],
            )
          ).rows[0],
        ).toEqual({ count: 0 });
        expect(
          (
            await pool.query<Record<string, unknown>>(
              `SELECT * FROM admin_setup_state`,
            )
          ).rows[0],
        ).toMatchObject({
          first_admin_user_id: adminId,
          completion_source: "LEGACY_PRESENT",
        });
        await expect(
          pool.query<Record<string, unknown>>(
            `UPDATE admin_setup_state SET completed_at=NULL`,
          ),
        ).rejects.toMatchObject({ code: "23514" });
        await expect(
          pool.query<Record<string, unknown>>(`TRUNCATE admin_setup_state`),
        ).rejects.toMatchObject({ code: "23514" });
        for (const sql of [
          "role='ADMIN'",
          "referral_code=repeat('d',32)",
          `sponsor_user_id='${missingId}'`,
        ]) {
          await expect(
            pool.query<Record<string, unknown>>(
              `UPDATE users SET ${sql} WHERE id=$1`,
              [employeeId],
            ),
          ).rejects.toMatchObject({ code: "23514" });
        }
        const client = createDatabaseClient(url);
        try {
          const before = await client.user.findUniqueOrThrow({
            where: { id: employeeId },
          });
          const decision = {
            kind: "enabled",
            group: "ADMIN",
            role: "ADMIN",
            email: before.email,
            fullName: "Replacement",
            passwordHash: "replacement-password",
          } as const;
          await client.user.upsert(buildSeedUpsert(decision, new Date()));
          await client.user.upsert(buildSeedUpsert(decision, new Date()));
          expect(
            await client.user.findUniqueOrThrow({ where: { id: employeeId } }),
          ).toEqual(before);
          expect(
            (
              await pool.query<Record<string, unknown>>(
                `SELECT * FROM wallets WHERE id=$1`,
                [walletId],
              )
            ).rows,
          ).toEqual(walletBefore);
        } finally {
          await client.$disconnect();
        }
      });
    },
  );

  it("rolls back the authority migration for only-ineligible historical admins without a bootstrap override", async () => {
    await withHistoricalDatabase(async (pool) => {
      await insertHistoricalUser(pool, "ADMIN", "SUSPENDED");
      await insertHistoricalUser(pool);
      const before = (
        await pool.query<Record<string, unknown>>(
          `SELECT * FROM users ORDER BY id`,
        )
      ).rows;
      await pool.query<Record<string, unknown>>(await migration(ENUM));
      const connection = await pool.connect();
      try {
        await expect(
          connection.query(await migration(IDENTITY)),
        ).rejects.toMatchObject({ code: "23514" });
        await connection.query("ROLLBACK");
      } finally {
        connection.release();
      }
      expect(
        (
          await pool.query<Record<string, unknown>>(
            `SELECT * FROM users ORDER BY id`,
          )
        ).rows,
      ).toEqual(before);
      expect(
        (
          await pool.query<Record<string, unknown>>(
            `SELECT to_regclass('admin_setup_state') AS setup`,
          )
        ).rows[0],
      ).toEqual({ setup: null });
      expect(
        (
          await pool.query<Record<string, unknown>>(
            `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='referral_code'`,
          )
        ).rows,
      ).toEqual([]);
    });
  });

  it("rolls back schema, credential invalidation and wallet backfill after a late migration failure", async () => {
    await withHistoricalDatabase(async (pool) => {
      const employee = await insertHistoricalUser(pool);
      await pool.query(
        `INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES($1,$2,'2030-01-01')`,
        [employee, "c".repeat(64)],
      );
      const before = (await pool.query(`SELECT * FROM users`)).rows;
      await pool.query(await migration(ENUM));
      const connection = await pool.connect();
      try {
        const faulted = (await migration(IDENTITY)).replace(
          "COMMIT;",
          "SELECT 1/0;\nCOMMIT;",
        );
        await expect(connection.query(faulted)).rejects.toMatchObject({
          code: "22012",
        });
        await connection.query("ROLLBACK");
      } finally {
        connection.release();
      }
      expect((await pool.query(`SELECT * FROM users`)).rows).toEqual(before);
      expect(
        (await pool.query(`SELECT count(*)::int AS count FROM wallets`)).rows,
      ).toEqual([{ count: 0 }]);
      expect(
        (await pool.query(`SELECT count(*)::int AS count FROM refresh_tokens`))
          .rows,
      ).toEqual([{ count: 1 }]);
      expect(
        (await pool.query(`SELECT to_regclass('auth_sessions') AS sessions`))
          .rows,
      ).toEqual([{ sessions: null }]);
    });
  });

  it("holds the User cutover fence until the authority transaction commits", async () => {
    await withHistoricalDatabase(async (pool) => {
      const employee = await insertHistoricalUser(pool);
      await pool.query<Record<string, unknown>>(await migration(ENUM));
      const migrator = await pool.connect();
      const legacy = await pool.connect();
      let pendingWrite: Promise<unknown> | undefined;
      try {
        await migrator.query<Record<string, unknown>>(
          (await migration(IDENTITY)).replace("COMMIT;", ""),
        );
        const pid = (
          await legacy.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")
        ).rows[0]?.pid;
        pendingWrite = legacy.query<Record<string, unknown>>(
          "UPDATE users SET full_name='Fenced writer' WHERE id=$1",
          [employee],
        );
        const deadline = Date.now() + 5000;
        let blocked = false;
        while (!blocked && Date.now() < deadline) {
          blocked =
            (
              await pool.query<{ blocked: boolean }>(
                "SELECT EXISTS(SELECT 1 FROM pg_locks WHERE pid=$1 AND NOT granted) AS blocked",
                [pid],
              )
            ).rows[0]?.blocked === true;
          if (!blocked)
            await new Promise<void>((resolve) => {
              setTimeout(resolve, 10);
            });
        }
        expect(blocked).toBe(true);
        await migrator.query<Record<string, unknown>>("COMMIT");
        await pendingWrite;
        expect(
          (
            await pool.query<{ token: string | null }>(
              "SELECT verification_token_hash AS token FROM users WHERE id=$1",
              [employee],
            )
          ).rows,
        ).toEqual([{ token: null }]);
      } finally {
        await migrator.query<Record<string, unknown>>("ROLLBACK");
        await pendingWrite;
        migrator.release();
        legacy.release();
      }
    });
  });

  it("binds sessions to owners and expiry, freezes revocation and protects append-only audit", async () => {
    await withHistoricalDatabase(async (pool) => {
      await upgrade(pool);
      const first = await insertHistoricalUser(pool);
      const second = await insertHistoricalUser(pool);
      await expect(
        pool.query(
          `UPDATE admin_setup_state SET first_admin_user_id=$1,completed_at=now(),completion_source=NULL`,
          [first],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      const session = randomUUID();
      await pool.query<Record<string, unknown>>(
        `INSERT INTO auth_sessions(id,user_id,remember_me,created_at,expires_at) VALUES($1,$2,false,'2026-01-01','2030-01-01')`,
        [session, first],
      );
      await expect(
        pool.query<Record<string, unknown>>(
          `INSERT INTO refresh_tokens(user_id,session_id,token_hash,expires_at) VALUES($1,$2,$3,'2030-01-01')`,
          [second, session, "f".repeat(64)],
        ),
      ).rejects.toMatchObject({ code: "23503" });
      await expect(
        pool.query<Record<string, unknown>>(
          `INSERT INTO auth_sessions(user_id,remember_me,created_at,expires_at) VALUES($1,false,'2026-01-01','2026-01-01')`,
          [first],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await pool.query<Record<string, unknown>>(
        `UPDATE auth_sessions SET revoked_at='2026-10-03' WHERE id=$1`,
        [session],
      );
      await expect(
        pool.query<Record<string, unknown>>(
          `UPDATE auth_sessions SET revoked_at=NULL WHERE id=$1`,
          [session],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        pool.query<Record<string, unknown>>(
          `INSERT INTO identity_audit_records(action,outcome,actor_kind,actor_user_id,target_user_id,reason,after_snapshot) VALUES('EMPLOYEE_CONTROL','COMMITTED','ADMIN',$1,$2,'Control',$3::jsonb)`,
          [first, second, JSON.stringify({ passwordHash: "private" })],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        pool.query(
          `INSERT INTO identity_audit_records(action,outcome,actor_kind,actor_user_id,target_user_id,reason,after_snapshot) VALUES('EMPLOYEE_CONTROL','COMMITTED','ADMIN',$1,$2,'Control',$3::jsonb)`,
          [first, second, JSON.stringify({ id: { token: "private" } })],
        ),
      ).rejects.toMatchObject({ code: "23514" });
      const admin = randomUUID();
      await pool.query<Record<string, unknown>>(
        `INSERT INTO users(id,email,password_hash,full_name,role,status,email_verified_at,updated_at) VALUES($1,$2,'unused','Admin','ADMIN','ACTIVE',now(),now())`,
        [admin, `${admin}@example.com`],
      );
      await pool.query<Record<string, unknown>>(
        `INSERT INTO identity_audit_records(action,outcome,actor_kind,actor_user_id,target_user_id,reason,after_snapshot) VALUES('EMPLOYEE_CONTROL','COMMITTED','ADMIN',$1,$2,'Control',$3::jsonb)`,
        [
          admin,
          second,
          JSON.stringify({
            id: second,
            role: "USER",
            status: "ACTIVE",
            accountVersion: 0,
          }),
        ],
      );
      for (const sql of [
        "UPDATE identity_audit_records SET reason='Overwrite'",
        "DELETE FROM identity_audit_records",
        "TRUNCATE identity_audit_records",
      ]) {
        await expect(
          pool.query<Record<string, unknown>>(sql),
        ).rejects.toMatchObject({ code: "23514" });
      }
    });
  });
});
