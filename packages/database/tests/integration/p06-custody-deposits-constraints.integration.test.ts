import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient, type Prisma } from "../../src/index.js";
import { account, occurredAt } from "./support/p04-fixtures.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined)
  throw new Error("Disposable integration DATABASE_URL required.");
const database = createDatabaseClient(databaseUrl);
const pool = new Pool({ connectionString: databaseUrl });
afterAll(async () => {
  await database.$disconnect();
  await pool.end();
});
const digest = "a".repeat(64);
it("retains candidate discovery attribution and rejects a foreign-network binding", async () => {
  const owner = await readyAssignment();
  const now = new Date();
  const candidate = await database.depositCandidate.create({
    data: {
      network: "TRON_NILE",
      transactionId: randomUUID().replaceAll("-", "").repeat(2),
      firstObservedAt: now,
      lastObservedAt: now,
    },
  });
  const foreign = await database.depositCandidate.create({
    data: {
      network: "TRON_SHASTA",
      transactionId: randomUUID().replaceAll("-", "").repeat(2),
      firstObservedAt: now,
      lastObservedAt: now,
    },
  });
  await expect(
    database.depositCandidateDiscovery.create({
      data: { candidateId: foreign.id, assignmentId: owner.ready.id },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await database.depositCandidateDiscovery.createMany({
    data: { candidateId: candidate.id, assignmentId: owner.ready.id },
    skipDuplicates: true,
  });
  await database.depositCandidateDiscovery.createMany({
    data: { candidateId: candidate.id, assignmentId: owner.ready.id },
    skipDuplicates: true,
  });
  expect(
    await database.depositCandidateDiscovery.count({
      where: { candidateId: candidate.id },
    }),
  ).toBe(1);
  await expect(
    database.depositCandidateDiscovery.update({
      where: {
        candidateId_assignmentId: {
          candidateId: candidate.id,
          assignmentId: owner.ready.id,
        },
      },
      data: { discoveredAt: new Date(now.getTime() + 1000) },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
  await expect(
    database.depositCandidateDiscovery.deleteMany({
      where: { candidateId: candidate.id },
    }),
  ).rejects.toMatchObject({ code: "P2039" });
});
const address = () =>
  `T${randomUUID().replaceAll("-", "").replaceAll("0", "1")}1`;
async function assignment() {
  const owner = await account(database);
  const binding = await database.depositAddressAssignment.create({
    data: {
      employeeId: owner.user.id,
      walletId: owner.wallet.id,
      network: "TRON_NILE",
      keyRecordId: randomUUID(),
    },
  });
  return { ...owner, binding };
}
async function readyAssignment() {
  const fixture = await assignment();
  const acknowledgement = new Date();
  const publicAddress = address();
  const ready = await database.depositAddressAssignment.update({
    where: { id: fixture.binding.id },
    data: {
      state: "READY",
      address: publicAddress,
      keyEnvelopeDigest: digest,
      keyVersion: 1,
      recoveryAckId: randomUUID(),
      recoveryDigest: digest,
      recoveryAcknowledgedAt: acknowledgement,
      readyAt: acknowledgement,
      scanBoundaryBlockNumber: 123n,
      scanBoundaryBlockId: digest,
      scanBoundaryTimestamp: 123000n,
    },
  });
  return { ...fixture, ready: { ...ready, address: publicAddress } };
}
async function grant(
  transaction: Prisma.TransactionClient,
  options: {
    walletId: string;
    employeeId: string;
    actorUserId: string;
    omitDomain?: boolean;
    omitAudit?: boolean;
    wrongAmount?: boolean;
    foreignReferenceId?: string;
    wrongSource?: boolean;
  },
) {
  const actionId = randomUUID();
  const reference = "Reviewed test administrative action";
  const reason = "Test initial grant";
  const operation = await transaction.financialOperation.create({
    data: {
      walletId: options.walletId,
      kind: "CREDIT",
      origin: "ADMIN_ADJUSTMENT",
      businessNamespace: "p06.manual-credit",
      businessKey: actionId,
      magnitudeUnits: 1000001n,
      intentHash: digest,
      actorType: "USER",
      actorUserId: options.actorUserId,
      createdAt: occurredAt,
      acceptedTerms: {
        kind: "CREDIT",
        source: "NON_REFERRAL",
        grant: {
          actionId,
          confirmed: true,
          reason,
          reference:
            options.foreignReferenceId === undefined
              ? { kind: "EXTERNAL", value: reference }
              : {
                  kind: "LEDGER_OPERATION",
                  operationId: options.foreignReferenceId,
                },
        },
      },
      outcome: {},
    },
  });
  await transaction.ledgerPosting.create({
    data: {
      operationId: operation.id,
      walletId: options.walletId,
      source: "NON_REFERRAL",
      availableDeltaUnits: 1000001n,
      reservedDeltaUnits: 0n,
      createdAt: occurredAt,
    },
  });
  if (!options.omitAudit)
    await transaction.auditRecord.create({
      data: {
        operationId: operation.id,
        action: "CREDIT",
        actorType: "USER",
        actorUserId: options.actorUserId,
        reason,
        ...(options.foreignReferenceId === undefined
          ? {}
          : { referenceOperationId: options.foreignReferenceId }),
        createdAt: occurredAt,
      },
    });
  if (!options.omitDomain)
    await transaction.manualCredit.create({
      data: {
        id: actionId,
        walletId: options.walletId,
        employeeId: options.employeeId,
        actorUserId: options.actorUserId,
        amountUnits: options.wrongAmount ? 2n : 1000001n,
        source: options.wrongSource ? "REFERRAL" : "NON_REFERRAL",
        confirmed: true,
        reason,
        referenceKind:
          options.foreignReferenceId === undefined
            ? "EXTERNAL"
            : "LEDGER_OPERATION",
        externalReference:
          options.foreignReferenceId === undefined ? reference : null,
        referenceOperationId: options.foreignReferenceId ?? null,
        payloadHash: digest,
        financialOperationId: operation.id,
        recordedAt: occurredAt,
      },
    });
  return operation;
}

describe("P06 persisted custody and credit invariants", () => {
  it("credits each raw log identity once and rejects foreign assignment/operation evidence with immutable receipt links", async () => {
    const fixture = await readyAssignment();
    const transactionId = randomUUID().replaceAll("-", "").repeat(2);
    const createReceipt = (
      logIndex: number,
      overrides: Partial<Prisma.DepositReceiptUncheckedCreateInput> = {},
    ) =>
      database.$transaction(async (transaction) => {
        const operation = await transaction.financialOperation.create({
          data: {
            walletId: fixture.wallet.id,
            kind: "CREDIT",
            origin: "DEPOSIT",
            businessNamespace: "p06.deposit",
            businessKey: `TRON_NILE:${transactionId}:${String(logIndex)}`,
            magnitudeUnits: 1000001n,
            intentHash: digest,
            actorType: "PROCESS",
            actorProcessId: "deposit-indexer",
            createdAt: occurredAt,
            acceptedTerms: { kind: "CREDIT", source: "NON_REFERRAL" },
            outcome: {},
          },
        });
        await transaction.ledgerPosting.create({
          data: {
            operationId: operation.id,
            walletId: fixture.wallet.id,
            source: "NON_REFERRAL",
            availableDeltaUnits: 1000001n,
            reservedDeltaUnits: 0n,
            createdAt: occurredAt,
          },
        });
        await transaction.auditRecord.create({
          data: {
            operationId: operation.id,
            action: "CREDIT",
            actorType: "PROCESS",
            actorProcessId: "deposit-indexer",
            createdAt: occurredAt,
          },
        });
        return transaction.depositReceipt.create({
          data: {
            network: "TRON_NILE",
            transactionId,
            logIndex,
            assignmentId: fixture.ready.id,
            walletId: fixture.wallet.id,
            tokenContract: `T${"9".repeat(33)}`,
            sender: `T${"A".repeat(33)}`,
            recipient: fixture.ready.address,
            amountUnits: 1000001n,
            blockNumber: 123n,
            blockId: digest,
            blockTimestamp: 123000n,
            executionResult: "SUCCESS",
            finalityPolicy: "SOLIDIFIED_CANONICAL_SUCCESS",
            verifiedAt: occurredAt,
            evidenceDigest: digest,
            financialOperationId: operation.id,
            recordedAt: occurredAt,
            ...overrides,
          },
        });
      });
    const first = await createReceipt(0);
    await createReceipt(2);
    await expect(createReceipt(0)).rejects.toThrow();
    await expect(
      createReceipt(3, { recipient: `T${"B".repeat(33)}` }),
    ).rejects.toThrow();
    await expect(createReceipt(4, { amountUnits: 0n })).rejects.toThrow();
    await expect(
      database.depositReceipt.update({
        where: { id: first.id },
        data: { evidenceDigest: "b".repeat(64) },
      }),
    ).rejects.toThrow();
    await expect(
      database.depositReceipt.delete({ where: { id: first.id } }),
    ).rejects.toThrow();
    expect(
      await database.depositReceipt.count({ where: { transactionId } }),
    ).toBe(2);
    expect(
      await database.financialOperation.count({
        where: { walletId: fixture.wallet.id },
      }),
    ).toBe(2);
  });
  it("starts fenced/paused with empty new domains and preserves permanent employee ownership", async () => {
    expect(
      await database.financialRuntimeControl.findUnique({ where: { id: 1 } }),
    ).toMatchObject({
      financialWritesFenced: true,
      newDispatchPaused: true,
      generation: 1n,
    });
    const fixture = await assignment();
    const other = await account(database);
    await expect(
      database.depositAddressAssignment.update({
        where: { id: fixture.binding.id },
        data: {
          employeeId: other.user.id,
          walletId: other.wallet.id,
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.depositAddressAssignment.delete({
        where: { id: fixture.binding.id },
      }),
    ).rejects.toThrow();
    await expect(
      database.depositAddressAssignment.create({
        data: {
          employeeId: fixture.user.id,
          walletId: other.wallet.id,
          network: "TRON_SHASTA",
          keyRecordId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.depositAddressAssignment.create({
        data: {
          employeeId: fixture.user.id,
          walletId: fixture.wallet.id,
          network: "TRON_NILE",
          keyRecordId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects READY without exact acknowledged key/boundary agreement and retains published address", async () => {
    const fixture = await assignment();
    await expect(
      database.depositAddressAssignment.update({
        where: { id: fixture.binding.id },
        data: {
          state: "READY",
          address: address(),
          readyAt: new Date(),
          keyVersion: 1,
          keyEnvelopeDigest: digest,
        },
      }),
    ).rejects.toThrow();
    const ready = await readyAssignment();
    await expect(
      database.depositAddressAssignment.update({
        where: { id: ready.ready.id },
        data: {
          recoveryDigest: "b".repeat(64),
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.depositAddressAssignment.update({
        where: { id: ready.ready.id },
        data: {
          address: address(),
        },
      }),
    ).rejects.toThrow();
    await database.user.update({
      where: { id: ready.user.id },
      data: { status: "BANNED" },
    });
    expect(
      await database.depositAddressAssignment.findUnique({
        where: { id: ready.ready.id },
      }),
    ).toEqual(ready.ready);
  });

  it("commits an initial external grant with audit before domainWrite and rejects missing/mismatched dependent rows", async () => {
    const owner = await account(database);
    const admin = await database.user.create({
      data: {
        email: `${randomUUID()}@example.test`,
        fullName: "Grant admin",
        passwordHash: "test-only-hash",
        role: "ADMIN",
        status: "ACTIVE",
        emailVerifiedAt: occurredAt,
      },
    });
    const options = {
      walletId: owner.wallet.id,
      employeeId: owner.user.id,
      actorUserId: admin.id,
    };
    const operation = await database.$transaction((transaction) =>
      grant(transaction, options),
    );
    expect(
      await database.manualCredit.findUnique({
        where: { financialOperationId: operation.id },
      }),
    ).toMatchObject({ amountUnits: 1000001n, source: "NON_REFERRAL" });
    for (const failure of [
      { omitDomain: true },
      { omitAudit: true },
      { wrongAmount: true },
      { wrongSource: true },
    ]) {
      await expect(
        database.$transaction((transaction) =>
          grant(transaction, { ...options, ...failure }),
        ),
      ).rejects.toThrow();
    }
    expect(
      await database.financialOperation.count({
        where: { walletId: owner.wallet.id },
      }),
    ).toBe(1);
    expect(
      await database.ledgerPosting.count({
        where: { walletId: owner.wallet.id },
      }),
    ).toBe(1);
    const foreignOwner = await account(database);
    const foreignOperation = await database.$transaction((transaction) =>
      grant(transaction, {
        walletId: foreignOwner.wallet.id,
        employeeId: foreignOwner.user.id,
        actorUserId: admin.id,
      }),
    );
    await expect(
      database.$transaction((transaction) =>
        grant(transaction, {
          ...options,
          foreignReferenceId: foreignOperation.id,
        }),
      ),
    ).rejects.toThrow();
    await expect(
      database.manualCredit.update({
        where: { financialOperationId: operation.id },
        data: { reason: "Changed" },
      }),
    ).rejects.toThrow();
  });

  it.each([
    "REQUESTED",
    "WAITING_RESOURCES",
    "SIGNING",
    "SIGNED",
    "SUBMITTED",
    "UNKNOWN",
  ] as const)(
    "retains per-source exclusion in %s while allowing distinct sources",
    async (state) => {
      const first = await readyAssignment();
      const second = await readyAssignment();
      const intent = (binding: typeof first.ready) => ({
        id: randomUUID(),
        assignmentId: binding.id,
        network: binding.network,
        source: binding.address,
        treasury: `T${"2".repeat(33)}`,
        tokenContract: `T${"3".repeat(33)}`,
        amountUnits: 1n,
        policySnapshot: {},
        operatorIdentity: "test-operator",
        reason: "Test sweep",
        payloadHash: digest,
        state,
      });
      await database.treasurySweep.create({ data: intent(first.ready) });
      await expect(
        database.treasurySweep.create({ data: intent(first.ready) }),
      ).rejects.toThrow();
      await database.treasurySweep.create({ data: intent(second.ready) });
      await expect(
        database.treasurySweep.create({
          data: {
            ...intent(second.ready),
            tokenContract: `T${"4".repeat(33)}`,
            treasury: first.ready.address,
          },
        }),
      ).rejects.toThrow();
    },
  );

  it("retains one immutable attempt, intent, signature and recovery/broadcast metadata", async () => {
    const fixture = await readyAssignment();
    const sweep = await database.treasurySweep.create({
      data: {
        id: randomUUID(),
        assignmentId: fixture.ready.id,
        network: "TRON_NILE",
        source: fixture.ready.address,
        treasury: `T${"5".repeat(33)}`,
        tokenContract: `T${"6".repeat(33)}`,
        amountUnits: 1n,
        policySnapshot: {},
        operatorIdentity: "test-operator",
        reason: "Test immutable attempt",
        payloadHash: digest,
      },
    });
    const attempt = await database.transferAttempt.create({
      data: {
        id: randomUUID(),
        sweepId: sweep.id,
        intentHash: digest,
        network: sweep.network,
        tokenContract: sweep.tokenContract,
        source: sweep.source,
        treasury: sweep.treasury,
        amountUnits: sweep.amountUnits,
      },
    });
    await database.transferAttempt.update({
      where: { id: attempt.id },
      data: {
        transactionId: digest,
        expiration: 1000000n,
        signedAt: new Date(),
        envelopeId: randomUUID(),
        envelopeDigest: digest,
      },
    });
    for (const changed of [
      { transactionId: "b".repeat(64) },
      { amountUnits: 2n },
      { expiration: 1000001n },
    ]) {
      await expect(
        database.transferAttempt.update({
          where: { id: attempt.id },
          data: changed,
        }),
      ).rejects.toThrow();
    }
    await expect(
      database.transferAttempt.delete({ where: { id: attempt.id } }),
    ).rejects.toThrow();
    await expect(
      database.treasurySweep.update({
        where: { id: sweep.id },
        data: { treasury: `T${"7".repeat(33)}` },
      }),
    ).rejects.toThrow();
  });

  it("binds nonowner boot requests to process roles and denies self-acknowledgement/control/attempt authority", async () => {
    for (const role of [
      "p06_api",
      "p06_deposit_worker",
      "p06_signer",
      "p06_recovery_operator",
    ]) {
      await pool.query(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
      );
    }
    for (const [role, kind] of [
      ["p06_api", "API"],
      ["p06_deposit_worker", "DEPOSIT_WORKER"],
      ["p06_signer", "SIGNER"],
    ] as const) {
      const connection = await pool.connect();
      try {
        await connection.query(`GRANT USAGE ON SCHEMA public TO ${role}`);
        await connection.query(
          `GRANT SELECT,INSERT,UPDATE ON financial_runtime_admissions TO ${role}`,
        );
        await connection.query(
          `GRANT SELECT,UPDATE ON financial_runtime_control TO ${role}`,
        );
        await connection.query(`SET ROLE ${role}`);
        const bootId = randomUUID();
        await connection.query(
          "INSERT INTO financial_runtime_admissions (boot_id,process_kind) VALUES ($1,$2)",
          [bootId, kind],
        );
        await expect(
          connection.query(
            "INSERT INTO financial_runtime_admissions (boot_id,process_kind) VALUES ($1,$2)",
            [randomUUID(), kind === "API" ? "SIGNER" : "API"],
          ),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          connection.query(
            "UPDATE financial_runtime_admissions SET acknowledged_generation=1,acknowledged_at=now(),operator_identity='self',evidence_reference='fake' WHERE boot_id=$1",
            [bootId],
          ),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          connection.query(
            "UPDATE financial_runtime_control SET financial_writes_fenced=false,version=version+1,evidence_reference='fake',reconciliation_cutoff=now() WHERE id=1",
          ),
        ).rejects.toMatchObject({ code: "42501" });
        await expect(
          connection.query("UPDATE transfer_attempts SET treasury=$1", [
            `T${"8".repeat(33)}`,
          ]),
        ).rejects.toMatchObject({ code: "42501" });
        await connection.query("RESET ROLE");
        await connection.query(
          "GRANT USAGE ON SCHEMA public TO p06_recovery_operator",
        );
        await connection.query(
          "GRANT SELECT,UPDATE ON financial_runtime_admissions TO p06_recovery_operator",
        );
        await connection.query(
          "GRANT SELECT ON financial_runtime_control TO p06_recovery_operator",
        );
        await connection.query("SET ROLE p06_recovery_operator");
        await expect(
          connection.query(
            "UPDATE financial_runtime_admissions SET acknowledged_generation=2,acknowledged_at=now(),operator_identity='test-recovery',evidence_reference='clean-test-evidence' WHERE boot_id=$1",
            [bootId],
          ),
        ).rejects.toMatchObject({ constraint: "ck_p06_admission_binding" });
        // SQL authority accepts only the operator's current inventory stamp after P08.
        // Cryptographic/archive verification before issuing that stamp is covered by the recovery CLI tests.
        await connection.query("BEGIN");
        try {
          await connection.query(
            "SELECT set_config('p08.verified_inventory',p08_recovery_fingerprint(),true)",
          );
          await connection.query(
            "UPDATE financial_runtime_admissions SET acknowledged_generation=1,acknowledged_at=now(),operator_identity='test-recovery',evidence_reference='clean-test-evidence' WHERE boot_id=$1",
            [bootId],
          );
          await connection.query("COMMIT");
        } catch (error) {
          await connection.query("ROLLBACK");
          throw error;
        }
      } finally {
        await connection.query("RESET ROLE");
        connection.release();
      }
    }
  });
});
