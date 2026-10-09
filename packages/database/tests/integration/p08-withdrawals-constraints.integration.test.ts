import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, expect, it } from "vitest";
import { createDatabaseClient } from "../../src/index.js";
import { account, occurredAt } from "./support/p04-fixtures.js";

const url = process.env["DATABASE_URL"];
if (url === undefined)
  throw new Error("Disposable integration database required.");
const database = createDatabaseClient(url);
const pool = new Pool({ connectionString: url });
afterAll(async () => {
  await database.$disconnect();
  await pool.end();
});
const hash = "a".repeat(64);
const address = "T" + "1".repeat(33);
const schedulePolicy = {
  zone: "Asia/Baghdad",
  countedHours: "72",
  excludedWeekdays: [6, 7],
};
const due = new Date("2026-10-06T09:00:00Z");

async function destinationFixture() {
  const owner = await account(database);
  const proofId = randomUUID();
  const pending = await database.$transaction(async (tx) => {
    const destination = await tx.withdrawalDestination.create({
      data: {
        employeeId: owner.user.id,
        network: "TRON_NILE",
        proofId,
        proofHash: randomUUID().replaceAll("-", "").repeat(2),
        pendingAddress: address,
        proofGeneration: 1,
        issuedAt: occurredAt,
        expiresAt: new Date(occurredAt.getTime() + 1800000),
        nextIssuanceAt: new Date(occurredAt.getTime() + 60000),
      },
    });
    await tx.withdrawalDestinationAudit.create({
      data: {
        destinationId: destination.id,
        actorUserId: owner.user.id,
        kind: "PROOF_ISSUED",
        proofId,
        proofGeneration: 1,
        network: "TRON_NILE",
        address,
        occurredAt,
        committedDestinationVersion: 1,
      },
    });
    return destination;
  });
  return { ...owner, pending, proofId };
}
async function confirmedFixture() {
  const owner = await destinationFixture();
  const confirmedAt = new Date(occurredAt.getTime() + 1000);
  const destination = await database.$transaction(async (tx) => {
    const saved = await tx.withdrawalDestination.update({
      where: { id: owner.pending.id },
      data: {
        address,
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
        destinationId: saved.id,
        actorUserId: owner.user.id,
        kind: "PROOF_CONSUMED",
        proofId: owner.proofId,
        proofGeneration: 1,
        network: "TRON_NILE",
        address,
        occurredAt: confirmedAt,
        committedDestinationVersion: 2,
      },
    });
    return saved;
  });
  const quote = await database.withdrawalQuote.create({
    data: {
      employeeId: owner.user.id,
      walletId: owner.wallet.id,
      destinationId: destination.id,
      addressVersion: 1,
      network: "TRON_NILE",
      recipient: address,
      policyVersion: 1,
      createdAt: new Date(occurredAt.getTime() + 2000),
      expiresAt: new Date(occurredAt.getTime() + 602000),
      grossUnits: 80000000n,
      feeBps: 2100,
      feeUnits: 16800000n,
      netUnits: 63200000n,
      termsHash: hash,
      quotedTerms: { gross: "80" },
      eligibilitySnapshot: { effective: "PAID" },
      availableNonReferralUnits: 70000000n,
      availableReferralUnits: 30000000n,
      fundedNonReferralUnits: 70000000n,
      fundedReferralUnits: 10000000n,
      requiredTopUpUnits: 0n,
      canAccept: true,
      previewDueAt: due,
      previewDispatchAt: due,
    },
  });
  return { ...owner, destination, quote };
}
async function requestFixture() {
  const owner = await confirmedFixture();
  const request = await database.$transaction(async (tx) => {
    const operation = await tx.financialOperation.create({
      data: {
        walletId: owner.wallet.id,
        kind: "RESERVE",
        origin: "WITHDRAWAL_RESERVATION",
        businessNamespace: "p08.withdrawal.reserve",
        businessKey: owner.quote.id,
        intentHash: hash,
        magnitudeUnits: 80000000n,
        actorType: "USER",
        actorUserId: owner.user.id,
        acceptedTerms: {},
        outcome: {},
      },
    });
    await tx.ledgerPosting.createMany({
      data: [
        {
          operationId: operation.id,
          walletId: owner.wallet.id,
          source: "NON_REFERRAL",
          availableDeltaUnits: -70000000n,
          reservedDeltaUnits: 70000000n,
        },
        {
          operationId: operation.id,
          walletId: owner.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: -10000000n,
          reservedDeltaUnits: 10000000n,
        },
      ],
    });
    await tx.auditRecord.create({
      data: {
        operationId: operation.id,
        actorType: "USER",
        actorUserId: owner.user.id,
        action: "RESERVE",
      },
    });
    await tx.wallet.update({
      where: { id: owner.wallet.id },
      data: {
        reservedNonReferralUnits: 70000000n,
        reservedReferralUnits: 10000000n,
        availableReferralUnits: 20000000n,
      },
    });
    const allocation = await tx.reservationAllocation.create({
      data: {
        walletId: owner.wallet.id,
        openingOperationId: operation.id,
        grossUnits: 80000000n,
        nonReferralUnits: 70000000n,
        referralUnits: 10000000n,
      },
    });
    const saved = await tx.withdrawalRequest.create({
      data: {
        quoteId: owner.quote.id,
        employeeId: owner.user.id,
        walletId: owner.wallet.id,
        reservationId: allocation.id,
        destinationId: owner.destination.id,
        network: "TRON_NILE",
        recipient: address,
        addressVersion: 1,
        grossUnits: 80000000n,
        feeBps: 2100,
        feeUnits: 16800000n,
        netUnits: 63200000n,
        termsHash: hash,
        acceptedTerms: { gross: "80" },
        eligibilitySnapshot: { effective: "PAID" },
        nonReferralUnits: 70000000n,
        referralUnits: 10000000n,
        acceptedAt: new Date(occurredAt.getTime() + 3000),
        originalDueAt: due,
        dueAt: due,
        dispatchAt: due,
        schedulePolicy,
      },
    });
    await tx.withdrawalAction.create({
      data: {
        requestId: saved.id,
        actorUserId: owner.user.id,
        actorScope: `user:${owner.user.id}`,
        kind: "ACCEPT",
        intentHash: hash,
        expectedVersion: 0,
        committedVersion: 1,
        occurredAt: saved.acceptedAt,
        afterState: "SCHEDULED",
        afterDueAt: due,
        afterScheduleVersion: 1,
        confirmed: true,
        financialOperationId: operation.id,
      },
    });
    return saved;
  });
  return { ...owner, request };
}

async function rejectScheduledFixture(
  owner: Awaited<ReturnType<typeof requestFixture>>,
  releasedNonReferral: bigint,
) {
  const admin = await database.user.create({
    data: {
      email: `p08-admin-${randomUUID()}@example.test`,
      fullName: "Withdrawal Admin Fixture",
      passwordHash: "test-only-hash",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: occurredAt,
    },
  });
  return database.$transaction(async (transaction) => {
    const finalizedAt = new Date();
    const release = await transaction.financialOperation.create({
      data: {
        walletId: owner.wallet.id,
        kind: "RELEASE",
        origin: "RESERVATION_RELEASE",
        businessNamespace: "p08.withdrawal.release",
        businessKey: owner.request.id,
        intentHash: hash,
        magnitudeUnits: 80000000n,
        actorType: "USER",
        actorUserId: admin.id,
        acceptedTerms: {},
        outcome: {},
      },
    });
    await transaction.ledgerPosting.createMany({
      data: [
        {
          operationId: release.id,
          walletId: owner.wallet.id,
          source: "NON_REFERRAL",
          availableDeltaUnits: releasedNonReferral,
          reservedDeltaUnits: -releasedNonReferral,
        },
        {
          operationId: release.id,
          walletId: owner.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: 10000000n,
          reservedDeltaUnits: -10000000n,
        },
      ],
    });
    await transaction.auditRecord.create({
      data: {
        operationId: release.id,
        action: "RELEASE",
        actorType: "USER",
        actorUserId: admin.id,
      },
    });
    await transaction.reservationAllocation.update({
      where: { id: owner.request.reservationId },
      data: {
        state: "RELEASED",
        releaseOperationId: release.id,
        releasedAt: finalizedAt,
      },
    });
    await transaction.wallet.update({
      where: { id: owner.wallet.id },
      data: {
        reservedNonReferralUnits: 0n,
        reservedReferralUnits: 0n,
        availableNonReferralUnits: releasedNonReferral,
        availableReferralUnits: 30000000n,
      },
    });
    const request = await transaction.withdrawalRequest.update({
      where: { id: owner.request.id },
      data: {
        state: "REJECTED",
        version: 2,
        releaseOperationId: release.id,
        finalizedAt,
      },
    });
    await transaction.withdrawalAction.create({
      data: {
        requestId: request.id,
        actorUserId: admin.id,
        actorScope: `user:${admin.id}`,
        kind: "REJECT",
        intentHash: hash,
        expectedVersion: 1,
        committedVersion: 2,
        occurredAt: finalizedAt,
        beforeState: "SCHEDULED",
        afterState: "REJECTED",
        beforeDueAt: request.dueAt,
        afterDueAt: request.dueAt,
        beforeScheduleVersion: 1,
        afterScheduleVersion: 1,
        confirmed: true,
        reason: "Fixture safe rejection",
        financialOperationId: release.id,
      },
    });
    return request;
  });
}

it("restores the identical sources atomically and keeps quote identity after safe closure", async () => {
  const owner = await requestFixture();
  await expect(rejectScheduledFixture(owner, 69999999n)).rejects.toMatchObject({
    cause: { code: "23514" },
  });
  expect(
    await database.withdrawalRequest.findUnique({
      where: { id: owner.request.id },
    }),
  ).toMatchObject({ state: "SCHEDULED", version: 1 });
  expect(
    await database.wallet.findUnique({ where: { id: owner.wallet.id } }),
  ).toMatchObject({
    reservedNonReferralUnits: 70000000n,
    reservedReferralUnits: 10000000n,
  });
  const rejected = await rejectScheduledFixture(owner, 70000000n);
  expect(
    await database.wallet.findUnique({ where: { id: owner.wallet.id } }),
  ).toMatchObject({
    reservedNonReferralUnits: 0n,
    reservedReferralUnits: 0n,
    availableNonReferralUnits: 70000000n,
    availableReferralUnits: 30000000n,
  });
  await expect(
    database.withdrawalRequest.create({
      data: { ...owner.request, id: randomUUID() },
    }),
  ).rejects.toMatchObject({ code: "P2002" });
  await expect(
    database.withdrawalRequest.update({
      where: { id: rejected.id },
      data: {
        state: "SCHEDULED",
        version: 3,
        releaseOperationId: null,
        finalizedAt: null,
      },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  expect(
    await database.financialOperation.count({
      where: {
        businessNamespace: "p08.withdrawal.release",
        businessKey: owner.request.id,
      },
    }),
  ).toBe(1);
});

it("rolls back pending proof authority without its matching append-only employee event", async () => {
  const owner = await account(database);
  await expect(
    database.withdrawalDestination.create({
      data: {
        employeeId: owner.user.id,
        network: "TRON_NILE",
        proofId: randomUUID(),
        proofHash: hash,
        pendingAddress: address,
        proofGeneration: 1,
        issuedAt: occurredAt,
        expiresAt: new Date(occurredAt.getTime() + 1800000),
        nextIssuanceAt: new Date(occurredAt.getTime() + 60000),
      },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  expect(
    await database.withdrawalDestination.count({
      where: { employeeId: owner.user.id },
    }),
  ).toBe(0);
});
it("requires exact matching consumption and rolls back save/clear on missing audit", async () => {
  const owner = await destinationFixture();
  await expect(
    database.withdrawalDestination.update({
      where: { id: owner.pending.id },
      data: {
        address,
        addressVersion: 1,
        confirmedAt: new Date(occurredAt.getTime() + 1000),
        proofId: null,
        proofHash: null,
        pendingAddress: null,
        issuedAt: null,
        expiresAt: null,
        nextIssuanceAt: null,
        version: 2,
      },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  expect(
    await database.withdrawalDestination.findUnique({
      where: { id: owner.pending.id },
    }),
  ).toMatchObject({ proofId: owner.proofId, address: null, version: 1 });
  expect(
    await database.withdrawalDestinationAudit.count({
      where: { destinationId: owner.pending.id },
    }),
  ).toBe(1);
});
it("retains employee-bound immutable proof events and first saved address", async () => {
  const owner = await confirmedFixture();
  const foreign = await account(database);
  const issued = await database.withdrawalDestinationAudit.findFirstOrThrow({
    where: { destinationId: owner.destination.id, kind: "PROOF_ISSUED" },
  });
  await expect(
    database.withdrawalDestinationAudit.create({
      data: { ...issued, id: randomUUID(), actorUserId: foreign.user.id },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.withdrawalDestinationAudit.create({
      data: {
        ...issued,
        id: randomUUID(),
        kind: "PROOF_CONSUMED",
        proofId: randomUUID(),
        occurredAt: new Date(occurredAt.getTime() + 1000),
        committedDestinationVersion: 2,
      },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.withdrawalDestinationAudit.update({
      where: { id: issued.id },
      data: { address: "T" + "2".repeat(33) },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.withdrawalDestinationAudit.delete({ where: { id: issued.id } }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.withdrawalDestination.update({
      where: { id: owner.destination.id },
      data: { address: "T" + "2".repeat(33) },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  expect(
    await database.withdrawalDestinationAudit.count({
      where: { destinationId: owner.destination.id },
    }),
  ).toBe(2);
});
it("rejects ownership mismatch, negative/partial allocation, forged money and mutable quotes", async () => {
  const owner = await confirmedFixture();
  const foreign = await account(database);
  for (const patch of [
    { walletId: foreign.wallet.id },
    { employeeId: foreign.user.id },
    { feeUnits: 16800001n },
    { netUnits: 63200001n },
    { fundedNonReferralUnits: -1n },
    { fundedReferralUnits: 9999999n },
    { addressVersion: 2 },
  ])
    await expect(
      database.withdrawalQuote.create({
        data: { ...owner.quote, id: randomUUID(), ...patch },
      }),
    ).rejects.toBeDefined();
  await expect(
    database.withdrawalQuote.update({
      where: { id: owner.quote.id },
      data: { expiresAt: new Date("2027-01-01") },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.withdrawalQuote.delete({ where: { id: owner.quote.id } }),
  ).rejects.toMatchObject({ code: "P2039" });
});
it("makes quote and reservation identities permanent and snapshots immutable", async () => {
  const owner = await requestFixture();
  await expect(
    database.withdrawalRequest.create({
      data: { ...owner.request, id: randomUUID() },
    }),
  ).rejects.toMatchObject({ code: "P2002" });
  for (const patch of [
    { grossUnits: 1n },
    { recipient: "T" + "2".repeat(33) },
    { termsHash: "b".repeat(64) },
    { acceptedTerms: {} },
    { originalDueAt: new Date("2026-10-09") },
    { quoteId: randomUUID() },
  ])
    await expect(
      database.withdrawalRequest.update({
        where: { id: owner.request.id },
        data: patch,
      }),
    ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.withdrawalRequest.delete({ where: { id: owner.request.id } }),
  ).rejects.toMatchObject({ code: "P2039" });
});
it.each(["SCHEDULED", "SIGNING", "SIGNED", "SUBMITTED", "UNKNOWN"])(
  "keeps %s under the one-active employee guard",
  async (state) => {
    const owner = await requestFixture();
    // Only the disposable migrator injects future states to test the partial index; Group A cannot create a payout.
    const connection = await pool.connect();
    try {
      await connection.query("BEGIN");
      await connection.query(
        "ALTER TABLE withdrawal_requests DISABLE TRIGGER guard_p08_request",
      );
      await connection.query(
        "ALTER TABLE withdrawal_requests DISABLE TRIGGER validate_p08_request",
      );
      await connection.query(
        "UPDATE withdrawal_requests SET state=$2 WHERE id=$1",
        [owner.request.id, state],
      );
      await connection.query(
        "CREATE TEMP TABLE p08_collision (LIKE withdrawal_requests INCLUDING DEFAULTS) ON COMMIT DROP",
      );
      await connection.query(
        "INSERT INTO p08_collision SELECT * FROM withdrawal_requests WHERE id=$1",
        [owner.request.id],
      );
      await connection.query(
        "UPDATE p08_collision SET id=$1,quote_id=$2,reservation_id=$3",
        [randomUUID(), randomUUID(), randomUUID()],
      );
      await expect(
        connection.query(
          "INSERT INTO withdrawal_requests SELECT * FROM p08_collision",
        ),
      ).rejects.toMatchObject({
        code: "23505",
        constraint: "withdrawal_requests_active_employee_key",
      });
    } finally {
      await connection.query("ROLLBACK");
      connection.release();
    }
    expect(
      await database.withdrawalRequest.findUnique({
        where: { id: owner.request.id },
      }),
    ).toMatchObject({ state: "SCHEDULED", version: 1 });
  },
);
it("rolls back request transitions and dependent allocation releases from either write side", async () => {
  const owner = await requestFixture();
  await expect(
    database.withdrawalRequest.update({
      where: { id: owner.request.id },
      data: { state: "SIGNING", version: 2 },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.$transaction(async (tx) => {
      const release = await tx.financialOperation.create({
        data: {
          walletId: owner.wallet.id,
          kind: "RELEASE",
          origin: "RESERVATION_RELEASE",
          businessNamespace: "p08.withdrawal.release",
          businessKey: owner.request.id,
          intentHash: hash,
          magnitudeUnits: 80000000n,
          actorType: "PROCESS",
          actorProcessId: "fixture",
          acceptedTerms: {},
          outcome: {},
        },
      });
      await tx.reservationAllocation.update({
        where: { id: owner.request.reservationId },
        data: {
          state: "RELEASED",
          releaseOperationId: release.id,
          releasedAt: occurredAt,
        },
      });
    }),
  ).rejects.toMatchObject({ cause: { code: "23514" } });
  expect(
    await database.reservationAllocation.findUnique({
      where: { id: owner.request.reservationId },
    }),
  ).toMatchObject({ state: "ACTIVE", releaseOperationId: null });
  expect(
    await database.financialOperation.count({
      where: {
        businessNamespace: "p08.withdrawal.release",
        businessKey: owner.request.id,
      },
    }),
  ).toBe(0);
  expect(
    await database.wallet.findUnique({ where: { id: owner.wallet.id } }),
  ).toMatchObject({
    reservedNonReferralUnits: 70000000n,
    reservedReferralUnits: 10000000n,
  });
});
it("gives the worker only a null discovery hint and denies API claim, proof mutation and policy writes", async () => {
  const owner = await requestFixture();
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    await connection.query("SET LOCAL ROLE p06_deposit_worker");
    await connection.query(
      "UPDATE withdrawal_requests SET next_check_at=now() WHERE id=$1",
      [owner.request.id],
    );
    await connection.query("COMMIT");
    await connection.query("BEGIN");
    await connection.query("SET LOCAL ROLE p06_deposit_worker");
    await expect(
      connection.query(
        "UPDATE withdrawal_requests SET state='SIGNING',version=version+1 WHERE id=$1",
        [owner.request.id],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await connection.query("ROLLBACK");
    for (const statement of [
      "UPDATE withdrawal_policy SET free_fee_bps=0",
      "UPDATE withdrawal_requests SET state='SIGNING',version=version+1 WHERE id=$1",
    ]) {
      await connection.query("BEGIN");
      await connection.query("SET LOCAL ROLE p06_api");
      await expect(
        connection.query(
          statement,
          statement.includes("$1") ? [owner.request.id] : [],
        ),
      ).rejects.toMatchObject({ code: "42501" });
      await connection.query("ROLLBACK");
    }
    await connection.query("BEGIN");
    await connection.query("SET LOCAL ROLE p06_signer");
    await expect(
      connection.query(
        "UPDATE withdrawal_destinations SET proof_hash=$2 WHERE id=$1",
        [owner.destination.id, hash],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
  const hinted = await database.withdrawalRequest.findUniqueOrThrow({
    where: { id: owner.request.id },
  });
  expect(hinted.state).toBe("SCHEDULED");
  expect(hinted.nextCheckAt).toBeInstanceOf(Date);
});
it("denies private payout SQL writes and private reads to actual API/worker/operator roles", async () => {
  const connection = await pool.connect();
  try {
    for (const role of [
      "p06_api",
      "p06_deposit_worker",
      "p06_recovery_operator",
    ]) {
      const denied = [
        "INSERT INTO withdrawal_attempts DEFAULT VALUES",
        "UPDATE withdrawal_attempts SET transaction_id=NULL",
        "DELETE FROM withdrawal_attempts",
        "UPDATE reservation_allocations SET state='SETTLED',settlement_operation_id=gen_random_uuid(),settled_at=now()",
        "UPDATE treasury_payout_keys SET last_final_block_number=100",
      ];
      if (role !== "p06_recovery_operator")
        denied.push(
          "SELECT envelope_digest FROM treasury_payout_keys",
          "SELECT signed_digest FROM withdrawal_attempts",
          "INSERT INTO treasury_payout_keys DEFAULT VALUES",
        );
      for (const statement of denied) {
        await connection.query("BEGIN");
        await connection.query(`SET LOCAL ROLE ${role}`);
        await expect(connection.query(statement)).rejects.toMatchObject({
          code: "42501",
        });
        await connection.query("ROLLBACK");
      }
    }
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
});
it("requires current payout inventory before operator SQL can acknowledge a boot or remove the fence", async () => {
  const keyId = randomUUID();
  await database.treasuryPayoutKey.create({
    data: {
      id: keyId,
      network: "TRON_NILE",
      tokenContract: address,
      source: `T${"2".repeat(33)}`,
      envelopeId: randomUUID(),
      envelopeDigest: hash,
      recoveryDigest: hash,
      recoveryAckId: randomUUID(),
      recoveryAcknowledgedAt: occurredAt,
      createdAt: occurredAt,
      operatorIdentity: "disposable-test",
      reason: "Guard authority only; no key bytes",
    },
  });
  const connection = await pool.connect();
  try {
    for (const approval of ["BOOT", "UNFENCE"] as const) {
      await connection.query("BEGIN");
      await connection.query(
        "UPDATE financial_runtime_control SET financial_writes_fenced=true,generation=generation+1,version=version+1 WHERE id=1",
      );
      const bootId = randomUUID();
      await connection.query(
        "INSERT INTO financial_runtime_admissions(boot_id,process_kind,requested_at) VALUES($1,'SIGNER',now())",
        [bootId],
      );
      await connection.query("SET LOCAL ROLE p06_recovery_operator");
      await expect(
        connection.query(
          approval === "BOOT"
            ? "UPDATE financial_runtime_admissions SET acknowledged_generation=(SELECT generation FROM financial_runtime_control WHERE id=1),acknowledged_at=now(),operator_identity='disposable-test',evidence_reference='unverified' WHERE boot_id=$1"
            : "UPDATE financial_runtime_control SET financial_writes_fenced=false,version=version+1 WHERE id=1",
          approval === "BOOT" ? [bootId] : [],
        ),
      ).rejects.toMatchObject({
        code: "23514",
        constraint: "ck_p08_recovery_inventory",
      });
      await connection.query("ROLLBACK");
      expect(
        await database.financialRuntimeAdmission.findUnique({
          where: { bootId },
        }),
      ).toBeNull();
    }
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
});

it("rejects a naked settlement from either the financial operation or allocation side", async () => {
  const owner = await requestFixture();
  await expect(
    database.financialOperation.create({
      data: {
        walletId: owner.wallet.id,
        kind: "SETTLE",
        origin: "WITHDRAWAL_SETTLEMENT",
        businessNamespace: "p08.withdrawal.settle",
        businessKey: owner.request.id,
        intentHash: hash,
        magnitudeUnits: owner.request.grossUnits,
        actorType: "PROCESS",
        actorProcessId: "p08-payout",
        acceptedTerms: {},
        outcome: {},
      },
    }),
  ).rejects.toThrow();
  await expect(
    database.reservationAllocation.update({
      where: { id: owner.request.reservationId },
      data: {
        state: "SETTLED",
        settlementOperationId: owner.request.reservationId,
        settledAt: new Date(),
      },
    }),
  ).rejects.toThrow();
  expect(
    await database.withdrawalRequest.findUniqueOrThrow({
      where: { id: owner.request.id },
    }),
  ).toMatchObject({ state: "SCHEDULED", settlementOperationId: null });
  expect(
    await database.reservationAllocation.findUniqueOrThrow({
      where: { id: owner.request.reservationId },
    }),
  ).toMatchObject({
    state: "ACTIVE",
    settlementOperationId: null,
    releaseOperationId: null,
  });
  expect(
    await database.financialOperation.count({
      where: { kind: "SETTLE", walletId: owner.wallet.id },
    }),
  ).toBe(0);
});
