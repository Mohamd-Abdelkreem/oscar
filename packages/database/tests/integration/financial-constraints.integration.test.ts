import { randomUUID } from "node:crypto";

import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const pool = new Pool({ connectionString: process.env["DATABASE_URL"] });
afterAll(async () => {
  await pool.end();
});
const HASH = "a".repeat(64);
const MAX = "9223372036854775807";

const fixture = async () => {
  const ownerId = randomUUID();
  const walletId = randomUUID();
  await pool.query(
    `INSERT INTO users (id,email,password_hash,full_name,updated_at) VALUES ($1,$2,'test-only-hash','Constraint Fixture',now())`,
    [ownerId, `constraint-${ownerId}@example.com`],
  );
  await pool.query(
    `INSERT INTO wallets (id,owner_user_id,updated_at) VALUES ($1,$2,now())`,
    [walletId, ownerId],
  );
  return { ownerId, walletId };
};
const operation = async (
  walletId: string,
  kind = "CREDIT",
  origin = "DEPOSIT",
  magnitude = "10",
) => {
  const id = randomUUID();
  await pool.query(
    `INSERT INTO financial_operations (id,wallet_id,kind,business_namespace,business_key,intent_hash,magnitude_units,origin,actor_type,actor_process_id,accepted_terms,outcome) VALUES ($1,$2,$3::financial_operation_kind,'constraint-test',$1::uuid::text,$4,$5,$6::financial_origin,'PROCESS','constraint-test','{}','{}')`,
    [id, walletId, kind, HASH, magnitude, origin],
  );
  return id;
};
const posting = (
  id: string,
  walletId: string,
  source = "NON_REFERRAL",
  available = "10",
  reserved = "0",
) =>
  pool.query(
    `INSERT INTO ledger_postings (id,operation_id,wallet_id,source,available_delta_units,reserved_delta_units) VALUES ($1,$2,$3,$4::fund_source,$5,$6)`,
    [randomUUID(), id, walletId, source, available, reserved],
  );
const alias = (id: string, key: string, kind = "CREDIT", hash = HASH) =>
  pool.query(
    `INSERT INTO financial_request_identities (id,operation_id,actor_scope,kind,request_key,intent_hash) VALUES ($1,$2,'PROCESS:constraint-test',$3::financial_operation_kind,$4,$5)`,
    [randomUUID(), id, kind, key, hash],
  );

describe("financial database guards", () => {
  it("rejects negative components and numeric total overflow without changing the wallet", async () => {
    const { walletId } = await fixture();
    await expect(
      pool.query(
        `UPDATE wallets SET available_referral_units = -1 WHERE id=$1`,
        [walletId],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "ck_wallets_components_nonnegative",
    });
    await expect(
      pool.query(
        `UPDATE wallets SET available_referral_units = $2, available_non_referral_units = 1 WHERE id=$1`,
        [walletId, MAX],
      ),
    ).rejects.toMatchObject({
      code: "23514",
      constraint: "ck_wallets_total_bounds",
    });
    expect(
      (
        await pool.query(
          `SELECT available_referral_units, available_non_referral_units FROM wallets WHERE id=$1`,
          [walletId],
        )
      ).rows,
    ).toEqual([
      { available_referral_units: "0", available_non_referral_units: "0" },
    ]);
  });

  it("enforces owner, actor, positive magnitude, origin and business identities", async () => {
    const { ownerId, walletId } = await fixture();
    await expect(
      pool.query(
        `INSERT INTO wallets (id,owner_user_id,updated_at) VALUES ($1,$2,now())`,
        [randomUUID(), ownerId],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "wallets_owner_user_id_key",
    });
    await expect(
      pool.query(
        `INSERT INTO wallets (id,owner_user_id,updated_at) VALUES ($1,$2,now())`,
        [randomUUID(), randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: "23503",
      constraint: "wallets_owner_user_id_fkey",
    });
    await expect(
      operation(walletId, "CREDIT", "DEPOSIT", "0"),
    ).rejects.toMatchObject({
      constraint: "ck_financial_operations_magnitude",
    });
    await expect(
      operation(walletId, "CREDIT", "ADMIN_ADJUSTMENT"),
    ).rejects.toMatchObject({ constraint: "ck_p06_manual_credit_link" });
    const id = await operation(walletId);
    await expect(
      pool.query(
        `INSERT INTO financial_operations SELECT $2::uuid, wallet_id,kind,business_namespace,business_key,intent_hash,magnitude_units,origin,actor_type,actor_user_id,actor_process_id,accepted_terms,outcome,created_at FROM financial_operations WHERE id=$1`,
        [id, randomUUID()],
      ),
    ).rejects.toMatchObject({
      code: "23505",
      constraint: "financial_operations_business_key",
    });
    await expect(
      pool.query(
        `INSERT INTO financial_operations SELECT $2::uuid,wallet_id,kind,business_namespace,$2::uuid::text,intent_hash,magnitude_units,origin,'USER',NULL,actor_process_id,accepted_terms,outcome,created_at FROM financial_operations WHERE id=$1`,
        [id, randomUUID()],
      ),
    ).rejects.toMatchObject({ constraint: "ck_financial_operations_actor" });
    await expect(
      pool.query(`DELETE FROM users WHERE id=$1`, [ownerId]),
    ).rejects.toMatchObject({
      code: "23001",
      constraint: "wallets_owner_user_id_fkey",
    });
  });

  it.each([
    ["CREDIT", "DEPOSIT", "NON_REFERRAL", "10", "0"],
    ["CREDIT", "TASK_REWARD", "NON_REFERRAL", "10", "0"],
    ["CREDIT", "REFERRAL_COMMISSION", "REFERRAL", "10", "0"],
    ["PURCHASE_DEBIT", "PACKAGE_PURCHASE", "REFERRAL", "-10", "0"],
    ["RESERVE", "WITHDRAWAL_RESERVATION", "NON_REFERRAL", "-10", "10"],
    ["RELEASE", "RESERVATION_RELEASE", "REFERRAL", "10", "-10"],
    ["CORRECTION", "ADMIN_ADJUSTMENT", "NON_REFERRAL", "-10", "0"],
  ])(
    "accepts %s/%s only with its valid posting shape and same wallet",
    async (kind, origin, source, available, reserved) => {
      const { walletId } = await fixture();
      const other = await fixture();
      const id = await operation(walletId, kind, origin);
      await expect(
        posting(id, other.walletId, source, available, reserved),
      ).rejects.toMatchObject({
        code: "23503",
        constraint: "ledger_postings_operation_id_wallet_id_fkey",
      });
      await expect(
        posting(id, walletId, source, available, "1"),
      ).rejects.toMatchObject({
        constraint: "ck_ledger_postings_operation_shape",
      });
      await posting(id, walletId, source, available, reserved);
      await expect(
        posting(id, walletId, source, available, reserved),
      ).rejects.toMatchObject({
        code: "23505",
        constraint: "ledger_postings_operation_source_key",
      });
    },
  );

  it.each([
    ["DEPOSIT", "REFERRAL"],
    ["TASK_REWARD", "REFERRAL"],
    ["REFERRAL_COMMISSION", "NON_REFERRAL"],
  ])("rejects the wrong source for %s", async (origin, source) => {
    const { walletId } = await fixture();
    await expect(
      posting(await operation(walletId, "CREDIT", origin), walletId, source),
    ).rejects.toMatchObject({
      constraint: "ck_ledger_postings_operation_shape",
    });
  });

  it("rejects zero and unsupported signed endpoint postings", async () => {
    const { walletId } = await fixture();
    const id = await operation(walletId, "CORRECTION", "ADMIN_ADJUSTMENT");
    await expect(
      posting(id, walletId, "NON_REFERRAL", "0"),
    ).rejects.toMatchObject({
      constraint: "ck_ledger_postings_operation_shape",
    });
    await expect(
      posting(id, walletId, "NON_REFERRAL", "-9223372036854775808"),
    ).rejects.toMatchObject({ constraint: "ck_ledger_postings_delta_bounds" });
  });

  it("binds aliases to kind/hash and audits to trusted actor/action/reference", async () => {
    const { walletId } = await fixture();
    const id = await operation(walletId);
    const key = randomUUID();
    await alias(id, key);
    await expect(alias(id, key)).rejects.toMatchObject({
      constraint: "financial_request_identities_scope_key",
    });
    await expect(alias(id, randomUUID(), "RESERVE")).rejects.toMatchObject({
      constraint: "ck_financial_request_operation_link",
    });
    await expect(
      alias(id, randomUUID(), "CREDIT", "b".repeat(64)),
    ).rejects.toMatchObject({
      constraint: "ck_financial_request_operation_link",
    });
    await expect(
      pool.query(
        `INSERT INTO financial_audit_records (id,operation_id,actor_type,actor_process_id,action) VALUES ($1,$2,'PROCESS','wrong-actor','CREDIT')`,
        [randomUUID(), id],
      ),
    ).rejects.toMatchObject({
      constraint: "ck_financial_audit_operation_link",
    });
    await pool.query(
      `INSERT INTO financial_audit_records (id,operation_id,actor_type,actor_process_id,action) VALUES ($1,$2,'PROCESS','constraint-test','CREDIT')`,
      [randomUUID(), id],
    );
    await expect(
      pool.query(
        `INSERT INTO financial_audit_records (id,operation_id,actor_type,actor_process_id,action) VALUES ($1,$2,'PROCESS','constraint-test','CREDIT')`,
        [randomUUID(), id],
      ),
    ).rejects.toMatchObject({
      constraint: "financial_audit_records_operation_id_key",
    });
    const correction = await operation(
      walletId,
      "CORRECTION",
      "ADMIN_ADJUSTMENT",
    );
    const other = await fixture();
    const otherId = await operation(other.walletId);
    await expect(
      pool.query(
        `INSERT INTO financial_audit_records (id,operation_id,actor_type,actor_process_id,action,reason,reference_operation_id) VALUES ($1,$2,'PROCESS','constraint-test','CORRECTION','reason',$3)`,
        [randomUUID(), correction, otherId],
      ),
    ).rejects.toMatchObject({
      constraint: "ck_financial_audit_operation_link",
    });
    await expect(
      pool.query(
        `INSERT INTO financial_audit_records (id,operation_id,actor_type,actor_process_id,action,reference_operation_id) VALUES ($1,$2,'PROCESS','constraint-test','CORRECTION',$3)`,
        [randomUUID(), correction, id],
      ),
    ).rejects.toMatchObject({ constraint: "ck_financial_audit_correction" });
  });

  it("retains original allocations, enforces conservation and permits exactly one release transition", async () => {
    const { walletId } = await fixture();
    const opening = await operation(
      walletId,
      "RESERVE",
      "WITHDRAWAL_RESERVATION",
    );
    const released = await operation(
      walletId,
      "RELEASE",
      "RESERVATION_RELEASE",
    );
    const id = randomUUID();
    const insert = (
      gross: string,
      nonReferral: string,
      referral: string,
      openingId = opening,
    ) =>
      pool.query(
        `INSERT INTO reservation_allocations (id,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units) VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, walletId, openingId, gross, nonReferral, referral],
      );
    await expect(insert("10", "8", "3")).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_amounts",
    });
    await expect(insert("10", "-1", "11")).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_amounts",
    });
    await expect(insert(MAX, MAX, "1")).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_amounts",
    });
    await expect(insert("10", "10", "0", released)).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_operation_link",
    });
    const other = await fixture();
    const foreignOpening = await operation(
      other.walletId,
      "RESERVE",
      "WITHDRAWAL_RESERVATION",
    );
    await expect(insert("10", "10", "0", foreignOpening)).rejects.toMatchObject(
      { constraint: "ck_reservation_allocation_operation_link" },
    );
    await expect(
      pool.query(
        `INSERT INTO reservation_allocations (id,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units,state,release_operation_id,released_at) VALUES ($1,$2,$3,10,10,0,'RELEASED',$4,now())`,
        [randomUUID(), walletId, opening, released],
      ),
    ).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_initial_state",
    });
    await insert("10", "7", "3");
    await expect(
      pool.query(
        `INSERT INTO reservation_allocations SELECT $2::uuid,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units,state,release_operation_id,released_at,created_at FROM reservation_allocations WHERE id=$1`,
        [id, randomUUID()],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    await expect(
      pool.query(
        `UPDATE reservation_allocations SET state='RELEASED',release_operation_id=$2,released_at=now(),non_referral_units=8,referral_units=2 WHERE id=$1`,
        [id, released],
      ),
    ).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_immutable",
    });
    await pool.query(
      `UPDATE reservation_allocations SET state='RELEASED',release_operation_id=$2,released_at=now() WHERE id=$1`,
      [id, released],
    );
    const secondOpening = await operation(
      walletId,
      "RESERVE",
      "WITHDRAWAL_RESERVATION",
    );
    const secondAllocation = randomUUID();
    await pool.query(
      `INSERT INTO reservation_allocations (id,wallet_id,opening_operation_id,gross_units,non_referral_units,referral_units) VALUES ($1,$2,$3,10,7,3)`,
      [secondAllocation, walletId, secondOpening],
    );
    await expect(
      pool.query(
        `UPDATE reservation_allocations SET state='RELEASED',release_operation_id=$2,released_at=now() WHERE id=$1`,
        [secondAllocation, released],
      ),
    ).rejects.toMatchObject({ code: "23505" });
    for (const update of [
      "state='ACTIVE',release_operation_id=NULL,released_at=NULL",
      "released_at=now()",
      "referral_units=2",
    ]) {
      await expect(
        pool.query(`UPDATE reservation_allocations SET ${update} WHERE id=$1`, [
          id,
        ]),
      ).rejects.toMatchObject({
        constraint: "ck_reservation_allocation_immutable",
      });
    }
    await expect(
      pool.query(`DELETE FROM reservation_allocations WHERE id=$1`, [id]),
    ).rejects.toMatchObject({
      constraint: "ck_reservation_allocation_immutable",
    });
  });

  it("blocks UPDATE/DELETE/TRUNCATE for retained history even when truncate has no rows", async () => {
    const { walletId } = await fixture();
    const id = await operation(walletId);
    await posting(id, walletId);
    await alias(id, randomUUID());
    await pool.query(
      `INSERT INTO financial_audit_records (id,operation_id,actor_type,actor_process_id,action) VALUES ($1,$2,'PROCESS','constraint-test','CREDIT')`,
      [randomUUID(), id],
    );
    for (const [table, predicate] of [
      ["financial_operations", "id"],
      ["ledger_postings", "operation_id"],
      ["financial_request_identities", "operation_id"],
      ["financial_audit_records", "operation_id"],
    ] as const) {
      await expect(
        pool.query(
          `UPDATE ${table} SET created_at=now() WHERE ${predicate}=$1`,
          [id],
        ),
      ).rejects.toMatchObject({ constraint: "ck_financial_history_immutable" });
      await expect(
        pool.query(`DELETE FROM ${table} WHERE ${predicate}=$1`, [id]),
      ).rejects.toMatchObject({ constraint: "ck_financial_history_immutable" });
    }
    for (const table of [
      "wallets",
      "financial_operations",
      "ledger_postings",
      "financial_request_identities",
      "financial_audit_records",
      "reservation_allocations",
    ]) {
      await expect(
        pool.query(`TRUNCATE ${table} CASCADE`),
      ).rejects.toMatchObject({ constraint: "ck_financial_history_immutable" });
    }
    expect(
      (
        await pool.query(
          `SELECT count(*)::int AS count FROM financial_operations WHERE id=$1`,
          [id],
        )
      ).rows,
    ).toEqual([{ count: 1 }]);
  });
});
