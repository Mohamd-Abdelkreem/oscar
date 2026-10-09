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
import { join, resolve, sep } from "node:path";
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
const migration = "20261008000000_p08_withdrawal_reservations";

it("preserves populated predecessor history, atomically rejects late migration failure and redeploys without resetting policy", async () => {
  const baseUrl = process.env["DATABASE_URL"],
    pnpmScript = process.env["npm_execpath"];
  if (baseUrl === undefined || pnpmScript === undefined)
    throw new Error("Disposable integration runtime required.");
  const name = `p08_upgrade_${randomUUID().replaceAll("-", "")}`;
  const admin = new Pool({ connectionString: baseUrl });
  const targetUrl = new URL(baseUrl);
  targetUrl.pathname = `/${name}`;
  const cacheRoot = resolve("node_modules/.cache");
  await mkdir(cacheRoot, { recursive: true });
  const temporary = await mkdtemp(join(cacheRoot, "p08-upgrade-"));
  if (!temporary.startsWith(cacheRoot + sep))
    throw new Error("Unsafe cleanup target.");
  const migrations = join(temporary, "migrations"),
    config = join(temporary, "prisma.config.ts");
  let created = false;
  let upgraded: Pool | undefined;
  let database: ReturnType<typeof createDatabaseClient> | undefined;
  const deploy = () =>
    execFileAsync(
      process.execPath,
      [pnpmScript, "exec", "prisma", "migrate", "deploy", "--config", config],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: targetUrl.toString() },
        windowsHide: true,
        timeout: 120000,
      },
    );
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
    created = true;
    await mkdir(migrations);
    for (const entry of await readdir("prisma/migrations", {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory() || entry.name >= migration) continue;
      await mkdir(join(migrations, entry.name));
      await copyFile(
        join("prisma/migrations", entry.name, "migration.sql"),
        join(migrations, entry.name, "migration.sql"),
      );
    }
    await copyFile(
      "prisma/migrations/migration_lock.toml",
      join(migrations, "migration_lock.toml"),
    );
    await writeFile(
      config,
      `import { defineConfig, env } from "prisma/config";\nexport default defineConfig({schema:${JSON.stringify(resolve("prisma/schema.prisma"))},migrations:{path:${JSON.stringify(migrations)}},datasource:{url:env("DATABASE_URL")}});\n`,
    );
    await deploy();
    upgraded = new Pool({ connectionString: targetUrl.toString() });
    database = createDatabaseClient(targetUrl.toString());
    const purchase = await purchaseFixture(database);
    const retained = await database.purchase.create({
      data: purchase.purchaseData,
    });
    await subscription(database, retained.id, purchase.owner.user.id);
    await database.authSession.create({
      data: {
        userId: purchase.owner.user.id,
        rememberMe: false,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      },
    });
    await database.depositAddressAssignment.create({
      data: {
        employeeId: purchase.owner.user.id,
        walletId: purchase.owner.wallet.id,
        network: "TRON_NILE",
        keyRecordId: randomUUID(),
      },
    });
    const reserveId = randomUUID(),
      allocationId = randomUUID();
    await upgraded.query(
      "INSERT INTO financial_operations(id,wallet_id,kind,business_namespace,business_key,intent_hash,magnitude_units,origin,actor_type,actor_process_id,accepted_terms,outcome) VALUES($1::uuid,$2,'RESERVE','upgrade-history',$1::uuid::text,$3,1000000,'WITHDRAWAL_RESERVATION','PROCESS','upgrade-fixture','{}','{}')",
      [reserveId, purchase.owner.wallet.id, "a".repeat(64)],
    );
    await upgraded.query(
      "INSERT INTO reservation_allocations(id,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units) VALUES($1,$2,$3,1000000,1000000,0)",
      [allocationId, purchase.owner.wallet.id, reserveId],
    );
    const tables = [
      "users",
      "auth_sessions",
      "wallets",
      "financial_operations",
      "ledger_postings",
      "financial_audit_records",
      "reservation_allocations",
      "purchases",
      "subscriptions",
      "deposit_address_assignments",
    ];
    const before = new Map<string, unknown[]>();
    for (const table of tables)
      before.set(
        table,
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      );
    const sql = await readFile(
      join("prisma/migrations", migration, "migration.sql"),
      "utf8",
    );
    const broken = sql.replace(
      /COMMIT;\s*$/u,
      "SELECT p08_intentional_late_failure();\nCOMMIT;",
    );
    const deployment = await upgraded.connect();
    try {
      await expect(deployment.query(broken)).rejects.toMatchObject({
        code: "42883",
      });
    } finally {
      await deployment.query("ROLLBACK");
      deployment.release();
    }
    expect(
      (
        await upgraded.query(
          "SELECT to_regclass('withdrawal_requests') AS name",
        )
      ).rows,
    ).toEqual([{ name: null }]);
    for (const table of tables)
      expect(
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      ).toEqual(before.get(table));
    await mkdir(join(migrations, migration));
    await copyFile(
      join("prisma/migrations", migration, "migration.sql"),
      join(migrations, migration, "migration.sql"),
    );
    await deploy();
    for (const table of tables)
      expect(
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      ).toEqual(before.get(table));
    expect(
      await database.withdrawalPolicy.findUnique({ where: { id: 1 } }),
    ).toMatchObject({
      minimumGrossUnits: 16000000n,
      maximumGrossUnits: 500000000n,
      freeFeeBps: 2100,
      version: 1,
    });
    await database.withdrawalPolicy.update({
      where: { id: 1 },
      data: { freeFeeBps: 2000, version: 2, updatedAt: occurredAt },
    });
    const authorityMigration =
      "20261008010000_p08_destination_authority_access";
    await mkdir(join(migrations, authorityMigration));
    await copyFile(
      join("prisma/migrations", authorityMigration, "migration.sql"),
      join(migrations, authorityMigration, "migration.sql"),
    );
    await deploy();
    for (const table of tables)
      expect(
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      ).toEqual(before.get(table));
    expect(
      (
        await upgraded.query(
          "SELECT has_column_privilege('p06_api','financial_runtime_control','id','UPDATE') AS lock, has_column_privilege('p06_api','financial_runtime_control','financial_writes_fenced','UPDATE') AS unfence",
        )
      ).rows,
    ).toEqual([{ lock: true, unfence: false }]);
    const reservationAuthorityMigration =
      "20261008020000_p08_reservation_authority_access";
    await mkdir(join(migrations, reservationAuthorityMigration));
    await copyFile(
      join("prisma/migrations", reservationAuthorityMigration, "migration.sql"),
      join(migrations, reservationAuthorityMigration, "migration.sql"),
    );
    await deploy();
    for (const table of tables)
      expect(
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      ).toEqual(before.get(table));
    expect(
      (
        await upgraded.query(
          "SELECT has_table_privilege('p06_api','wallets','SELECT') AS read, has_column_privilege('p06_api','wallets','reserved_non_referral_units','UPDATE') AS reserve, has_column_privilege('p06_api','withdrawal_policy','free_fee_bps','UPDATE') AS policy, has_column_privilege('p06_api','users','role','UPDATE') AS role",
        )
      ).rows,
    ).toEqual([{ read: true, reserve: true, policy: false, role: false }]);
    const scheduledAuthorityMigration =
      "20261008030000_p08_scheduled_authority_access";
    await mkdir(join(migrations, scheduledAuthorityMigration));
    await copyFile(
      join("prisma/migrations", scheduledAuthorityMigration, "migration.sql"),
      join(migrations, scheduledAuthorityMigration, "migration.sql"),
    );
    await deploy();
    for (const table of tables)
      expect(
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      ).toEqual(before.get(table));
    expect(
      (
        await upgraded.query(
          "SELECT has_column_privilege('p06_api','reservation_allocations','state','UPDATE') AS release, has_column_privilege('p06_deposit_worker','withdrawal_requests','next_check_at','UPDATE') AS hint, has_column_privilege('p06_deposit_worker','withdrawal_requests','state','UPDATE') AS claim, has_column_privilege('p06_deposit_worker','users','password_hash','SELECT') AS password, has_table_privilege('p06_deposit_worker','withdrawal_destinations','SELECT') AS recipient, has_column_privilege('p06_signer','financial_runtime_control','financial_writes_fenced','UPDATE') AS unfence",
        )
      ).rows,
    ).toEqual([
      {
        release: true,
        hint: true,
        claim: false,
        password: false,
        recipient: false,
        unfence: false,
      },
    ]);
    await deploy();
    expect(
      await database.withdrawalPolicy.findUnique({ where: { id: 1 } }),
    ).toMatchObject({ freeFeeBps: 2000, version: 2 });
    expect(await database.withdrawalRequest.count()).toBe(0);
    expect(await database.withdrawalDestinationAudit.count()).toBe(0);
    // A populated accepted Group A request must survive Group B without invented payout history.
    const destinationId = randomUUID(),
      quoteId = randomUUID(),
      requestId = randomUUID(),
      openingId = randomUUID(),
      reservationId = randomUUID();
    const recipient = `T${"1".repeat(33)}`;
    const acceptedAt = new Date("2026-10-05T09:00:00Z"),
      dueAt = new Date("2026-10-08T09:00:00Z");
    const proofId = randomUUID();
    await database.$transaction(async (tx) => {
      const issuedAt = new Date(acceptedAt.getTime() - 2000);
      await tx.withdrawalDestination.create({
        data: {
          id: destinationId,
          employeeId: purchase.owner.user.id,
          network: "TRON_NILE",
          proofId,
          proofHash: "b".repeat(64),
          pendingAddress: recipient,
          proofGeneration: 1,
          issuedAt,
          expiresAt: new Date(acceptedAt.getTime() + 1800000),
          nextIssuanceAt: new Date(acceptedAt.getTime() + 60000),
        },
      });
      await tx.withdrawalDestinationAudit.create({
        data: {
          destinationId,
          actorUserId: purchase.owner.user.id,
          kind: "PROOF_ISSUED",
          proofId,
          proofGeneration: 1,
          network: "TRON_NILE",
          address: recipient,
          occurredAt: issuedAt,
          committedDestinationVersion: 1,
        },
      });
    });
    await database.$transaction(async (tx) => {
      const confirmedAt = new Date(acceptedAt.getTime() - 1000);
      await tx.withdrawalDestination.update({
        where: { id: destinationId },
        data: {
          address: recipient,
          addressVersion: 1,
          confirmedAt,
          proofId: null,
          proofHash: null,
          pendingAddress: null,
          issuedAt: null,
          expiresAt: null,
          nextIssuanceAt: null,
          version: 2,
        },
      });
      await tx.withdrawalDestinationAudit.create({
        data: {
          destinationId,
          actorUserId: purchase.owner.user.id,
          kind: "PROOF_CONSUMED",
          proofId,
          proofGeneration: 1,
          network: "TRON_NILE",
          address: recipient,
          occurredAt: confirmedAt,
          committedDestinationVersion: 2,
        },
      });
    });
    const groupA = await upgraded.connect();
    try {
      await groupA.query("BEGIN");
      await groupA.query(
        "INSERT INTO withdrawal_quotes(id,employee_id,wallet_id,destination_id,address_version,network,recipient,policy_version,created_at,expires_at,gross_units,fee_bps,fee_units,net_units,terms_hash,quoted_terms,eligibility_snapshot,available_non_referral_units,available_referral_units,funded_non_referral_units,funded_referral_units,required_top_up_units,can_accept,preview_due_at,preview_dispatch_at) VALUES($1,$2,$3,$4,1,'TRON_NILE',$5,2,$6,$6::timestamptz+interval '10 minutes',16000000,2000,3200000,12800000,$7,'{}','{}',16000000,0,16000000,0,0,true,$8,$8)",
        [
          quoteId,
          purchase.owner.user.id,
          purchase.owner.wallet.id,
          destinationId,
          recipient,
          acceptedAt,
          "a".repeat(64),
          dueAt,
        ],
      );
      await groupA.query(
        "INSERT INTO financial_operations(id,wallet_id,kind,business_namespace,business_key,intent_hash,magnitude_units,origin,actor_type,actor_user_id,accepted_terms,outcome,created_at) VALUES($1,$2,'RESERVE','p08.withdrawal.reserve',$3,$4,16000000,'WITHDRAWAL_RESERVATION','USER',$5,'{}','{}',$6)",
        [
          openingId,
          purchase.owner.wallet.id,
          quoteId,
          "a".repeat(64),
          purchase.owner.user.id,
          acceptedAt,
        ],
      );
      await groupA.query(
        "INSERT INTO ledger_postings(id,operation_id,wallet_id,source,available_delta_units,reserved_delta_units) VALUES(gen_random_uuid(),$1,$2,'NON_REFERRAL',-16000000,16000000)",
        [openingId, purchase.owner.wallet.id],
      );
      await groupA.query(
        "INSERT INTO financial_audit_records(id,operation_id,actor_type,actor_user_id,action,created_at) VALUES(gen_random_uuid(),$1,'USER',$2,'RESERVE',$3)",
        [openingId, purchase.owner.user.id, acceptedAt],
      );
      await groupA.query(
        "INSERT INTO reservation_allocations(id,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units,created_at) VALUES($1,$2,$3,16000000,16000000,0,$4)",
        [reservationId, purchase.owner.wallet.id, openingId, acceptedAt],
      );
      await groupA.query(
        "INSERT INTO withdrawal_requests(id,quote_id,employee_id,wallet_id,reservation_id,destination_id,network,recipient,address_version,gross_units,fee_bps,fee_units,net_units,terms_hash,accepted_terms,eligibility_snapshot,non_referral_units,referral_units,accepted_at,original_due_at,due_at,dispatch_at,schedule_policy) VALUES($1,$2,$3,$4,$5,$6,'TRON_NILE',$7,1,16000000,2000,3200000,12800000,$8,'{}','{}',16000000,0,$9,$10,$10,$10,$11::jsonb)",
        [
          requestId,
          quoteId,
          purchase.owner.user.id,
          purchase.owner.wallet.id,
          reservationId,
          destinationId,
          recipient,
          "a".repeat(64),
          acceptedAt,
          dueAt,
          JSON.stringify({
            zone: "Asia/Baghdad",
            countedHours: "72",
            excludedWeekdays: [6, 7],
          }),
        ],
      );
      await groupA.query(
        "INSERT INTO withdrawal_actions(id,request_id,actor_user_id,actor_scope,kind,intent_hash,expected_version,committed_version,occurred_at,after_state,after_due_at,after_schedule_version,confirmed,financial_operation_id) VALUES(gen_random_uuid(),$1,$2,$3,'ACCEPT',$4,0,1,$5,'SCHEDULED',$6,1,true,$7)",
        [
          requestId,
          purchase.owner.user.id,
          `user:${purchase.owner.user.id}`,
          "a".repeat(64),
          acceptedAt,
          dueAt,
          openingId,
        ],
      );
      await groupA.query("COMMIT");
    } finally {
      await groupA.query("ROLLBACK");
      groupA.release();
    }
    const preservedTables = [
      "withdrawal_destinations",
      "withdrawal_destination_audits",
      "withdrawal_quotes",
      "withdrawal_requests",
      "withdrawal_actions",
      "reservation_allocations",
      "financial_operations",
      "ledger_postings",
      "financial_audit_records",
    ];
    const populated = new Map<string, unknown[]>();
    for (const table of preservedTables)
      populated.set(
        table,
        (await upgraded.query(`SELECT * FROM ${table} ORDER BY 1`)).rows,
      );
    for (const payoutMigration of [
      "20261008000100_p08_settlement_enums",
      "20261008000200_p08_payout_settlement",
      "20261008000300_p08_payout_recovery_authority",
      "20261008000400_p08_runtime_custody_access",
    ]) {
      await mkdir(join(migrations, payoutMigration));
      await copyFile(
        join("prisma/migrations", payoutMigration, "migration.sql"),
        join(migrations, payoutMigration, "migration.sql"),
      );
    }
    await deploy();
    await deploy();
    for (const table of preservedTables) {
      const rows = (
        await upgraded.query<Record<string, unknown>>(
          `SELECT * FROM ${table} ORDER BY 1`,
        )
      ).rows;
      // Group B only adds nullable settlement fields to Group A request/allocation rows.
      for (const row of rows) {
        delete row["settlement_operation_id"];
        delete row["settled_at"];
      }
      expect(rows).toEqual(populated.get(table));
    }
    expect(await database.withdrawalAttempt.count()).toBe(0);
    expect(await database.treasuryPayoutKey.count()).toBe(0);
    expect(
      await database.withdrawalRequest.findUnique({
        where: { id: requestId },
        select: { state: true, settlementOperationId: true },
      }),
    ).toEqual({ state: "SCHEDULED", settlementOperationId: null });
    expect(
      (
        await upgraded.query(
          "SELECT migration_name FROM _prisma_migrations WHERE migration_name=$1 AND finished_at IS NOT NULL",
          [migration],
        )
      ).rowCount,
    ).toBe(1);
  } finally {
    await database?.$disconnect();
    await upgraded?.end();
    if (created) await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);
    await admin.end();
    await rm(temporary, { recursive: true, force: true });
  }
});
