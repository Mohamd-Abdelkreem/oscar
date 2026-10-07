import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { createDatabaseClient, type Prisma } from "../../src/index.js";
import { normalizeTaskCode } from "@template/contracts";
import {
  account,
  occurredAt,
  purchaseFixture,
  subscription,
} from "./support/p04-fixtures.js";

const url = process.env["DATABASE_URL"];
if (url === undefined || new URL(url).pathname !== "/template_integration")
  throw new Error("Isolated migrated database required.");
const pool = new Pool({ connectionString: url });
const database = createDatabaseClient(url);
afterAll(async () => {
  await database.$disconnect();
  await pool.end();
});
let nextDate = new Date("2026-10-05T00:00:00Z");
function allocateDate() {
  const selected = new Date(nextDate);
  do {
    nextDate = new Date(nextDate.getTime() + 86_400_000);
  } while ([0, 6].includes(nextDate.getUTCDay()));
  return selected;
}
async function taskFixture() {
  const admin = await database.user.create({
    data: {
      email: `p05-admin-${randomUUID()}@example.test`,
      fullName: "Task admin",
      passwordHash: "test-only-hash",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: occurredAt,
    },
  });
  const task = await database.task.create({
    data: {
      publicationDate: allocateDate(),
      publicationState: "PUBLISHED",
      title: "Accepted instructions",
      description: "Do the work",
      targetUrl: "https://example.com/task",
      platform: "Custom",
      isCodeRequired: true,
      createdAt: occurredAt,
      createdByUserId: admin.id,
      updatedAt: occurredAt,
      updatedByUserId: admin.id,
    },
  });
  return { admin, task };
}
async function readyAsset(
  ownerId: string,
  purpose: "PROOF" | "TASK_ILLUSTRATION" = "PROOF",
) {
  const session = await database.authSession.create({
    data: {
      userId: ownerId,
      rememberMe: false,
      createdAt: occurredAt,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    },
  });
  const asset = await database.imageAsset.create({
    data: {
      ownerUserId: ownerId,
      purpose,
      uploadCommandId: randomUUID(),
      state: "STAGING",
      receivedAt: occurredAt,
      uploadedBySessionId: session.id,
      storageKey: randomUUID(),
      processingLeaseId: randomUUID(),
      processingLeaseExpiresAt: new Date(occurredAt.getTime() + 120_000),
    },
  });
  return database.imageAsset.update({
    where: { id: asset.id },
    data: {
      state: "READY",
      uploadedAt: occurredAt,
      uploadIntentHash: "a".repeat(64),
      inputByteCount: 70,
      readyAt: occurredAt,
      storedByteCount: 70,
      format: "PNG",
      width: 1,
      height: 1,
      contentHash: "b".repeat(64),
      processingLeaseId: null,
      processingLeaseExpiresAt: null,
    },
  });
}
async function pendingFixture() {
  const { admin, task } = await taskFixture();
  const funding = await purchaseFixture(database);
  const purchase = await database.purchase.create({
    data: funding.purchaseData,
  });
  const saved = await subscription(
    database,
    purchase.id,
    funding.owner.user.id,
  );
  const asset = await readyAsset(funding.owner.user.id);
  const acceptedAt = new Date(task.publicationDate.getTime() + 9 * 3_600_000);
  const input = {
    employeeId: saved.ownerUserId,
    taskId: task.id,
    businessDate: task.publicationDate,
    capturedTaskRevision: task.revision,
    capturedTaskContent: {
      title: task.title,
      description: task.description,
      targetUrl: task.targetUrl,
      platform: task.platform,
    },
    subscriptionId: saved.id,
    capturedSubscriptionTerms: saved.acceptedTerms as Prisma.InputJsonValue,
    rewardUnits: saved.dailyRewardUnits,
    executionDeclared: true,
    submittedAt: acceptedAt,
    deadlineAt: new Date(task.publicationDate.getTime() + 15 * 3_600_000),
    currentEvidenceVersion: 1,
  };
  const claim = await database.$transaction(async (transaction) => {
    await transaction.task.update({
      where: { id: task.id },
      data: { firstParticipationAt: acceptedAt },
    });
    const created = await transaction.taskSubmission.create({ data: input });
    await transaction.submissionEvidence.create({
      data: {
        submissionId: created.id,
        employeeId: created.employeeId,
        version: 1,
        assetId: asset.id,
        assetPurpose: "PROOF",
        acceptedAt,
        acceptedByUserId: created.employeeId,
      },
    });
    return created;
  });
  return { admin, task, saved, asset, claim, input, funding };
}
type TaskTable =
  | "tasks"
  | "task_codes"
  | "task_unlocks"
  | "image_assets"
  | "task_submissions"
  | "submission_evidence"
  | "final_reviews"
  | "task_command_records";
function directUpdate(
  table: TaskTable,
  id: string,
  patch: Record<string, unknown>,
) {
  return pool.query(
    `UPDATE ${table} SET ${Object.keys(patch)
      .map((column, index) => `"${column}"=$${String(index + 2)}`)
      .join(",")} WHERE id=$1`,
    [id, ...Object.values(patch)],
  );
}
function clone(table: TaskTable, id: string, patch: Record<string, unknown>) {
  return pool.query(
    `INSERT INTO ${table} SELECT (jsonb_populate_record(NULL::${table},to_jsonb(saved)||$2::jsonb)).* FROM ${table} saved WHERE id=$1 RETURNING id`,
    [id, JSON.stringify({ id: randomUUID(), ...patch })],
  );
}
async function finalize(
  transaction: Prisma.TransactionClient,
  fixture: Awaited<ReturnType<typeof pendingFixture>>,
  decision: "APPROVED" | "REJECTED",
  reward: bigint = fixture.claim.rewardUnits,
) {
  const { claim, admin, funding } = fixture;
  let operationId: string | null = null;
  if (decision === "APPROVED") {
    const operation = await transaction.financialOperation.create({
      data: {
        walletId: funding.owner.wallet.id,
        kind: "CREDIT",
        origin: "TASK_REWARD",
        businessNamespace: "p05.task-reward",
        businessKey: claim.id,
        intentHash: "c".repeat(64),
        magnitudeUnits: reward,
        actorType: "USER",
        actorUserId: admin.id,
        acceptedTerms: {},
        outcome: {},
      },
    });
    operationId = operation.id;
    await transaction.ledgerPosting.create({
      data: {
        operationId,
        walletId: operation.walletId,
        source: "NON_REFERRAL",
        availableDeltaUnits: reward,
        reservedDeltaUnits: 0n,
      },
    });
    await transaction.auditRecord.create({
      data: {
        operationId,
        actorType: "USER",
        actorUserId: admin.id,
        action: "CREDIT",
      },
    });
    await transaction.wallet.update({
      where: { id: operation.walletId },
      data: { availableNonReferralUnits: { increment: reward } },
    });
  }
  await transaction.taskSubmission.update({
    where: { id: claim.id },
    data: { status: decision, version: 2 },
  });
  return transaction.finalReview.create({
    data: {
      submissionId: claim.id,
      employeeId: claim.employeeId,
      decision,
      submissionVersion: 1,
      evidenceVersion: 1,
      actorUserId: admin.id,
      decidedAt: claim.submittedAt,
      reason: "Inspected evidence",
      walletId: decision === "APPROVED" ? funding.owner.wallet.id : null,
      approvalOperationId: operationId,
    },
  });
}

describe("P05 direct write boundaries", () => {
  it("retains dates and Unicode-normalized code identities", async () => {
    const { admin, task } = await taskFixture();
    for (const raw of [
      "straße",
      "éλληνικά",
      "مهمة",
      "Ａｂ１２",
      "\u00a0mixed\ufeff",
    ]) {
      const normalizedText = normalizeTaskCode(raw);
      const code = await database.taskCode.create({
        data: {
          taskId: task.id,
          normalizedText,
          state: "ENABLED",
          createdAt: occurredAt,
          updatedAt: occurredAt,
          createdByUserId: admin.id,
          updatedByUserId: admin.id,
        },
      });
      await expect(
        database.taskCode.create({
          data: {
            taskId: task.id,
            normalizedText,
            state: "PAUSED",
            createdAt: occurredAt,
            updatedAt: occurredAt,
            createdByUserId: admin.id,
            updatedByUserId: admin.id,
          },
        }),
      ).rejects.toThrow();
      await expect(
        directUpdate("task_codes", code.id, {
          normalized_text: `${normalizedText}X`,
          version: 2,
        }),
      ).rejects.toMatchObject({ constraint: "ck_task_codes_immutable" });
    }
    const code = await database.taskCode.findFirstOrThrow({
      where: { taskId: task.id },
    });
    for (const normalized_text of [
      "lower",
      "ß",
      " PAD ",
      "A\u0085B",
      "😀".repeat(33),
    ])
      await expect(
        clone("task_codes", code.id, { normalized_text }),
      ).rejects.toThrow();
    await expect(
      clone("tasks", task.id, { publication_date: "2026-10-10" }),
    ).rejects.toMatchObject({ constraint: "ck_tasks_publication_weekday" });
    await expect(clone("tasks", task.id, {})).rejects.toMatchObject({
      constraint: "tasks_publication_date_key",
    });
    await expect(
      directUpdate("tasks", task.id, { revision: 0 }),
    ).rejects.toThrow();
  });
  it("requires participation from unlock inserts and prevents moving or erasing accepted usage", async () => {
    const { admin, task } = await taskFixture();
    const employee = await account(database);
    const code = await database.taskCode.create({
      data: {
        taskId: task.id,
        normalizedText: randomUUID().toUpperCase(),
        state: "ENABLED",
        createdAt: occurredAt,
        updatedAt: occurredAt,
        createdByUserId: admin.id,
        updatedByUserId: admin.id,
      },
    });
    const input = {
      employeeId: employee.user.id,
      taskId: task.id,
      codeId: code.id,
      businessDate: task.publicationDate,
      unlockedAt: occurredAt,
    };
    await expect(database.taskUnlock.create({ data: input })).rejects.toThrow();
    const unlock = await database.$transaction(async (transaction) => {
      await transaction.task.update({
        where: { id: task.id },
        data: { firstParticipationAt: occurredAt },
      });
      return transaction.taskUnlock.create({ data: input });
    });
    await expect(
      directUpdate("tasks", task.id, {
        publication_date: "2027-01-04",
        revision: 2,
      }),
    ).rejects.toMatchObject({ constraint: "ck_tasks_date_immutable" });
    await expect(
      directUpdate("tasks", task.id, { first_participation_at: null }),
    ).rejects.toMatchObject({ constraint: "ck_tasks_date_immutable" });
    await expect(
      directUpdate("task_unlocks", unlock.id, { code_id: randomUUID() }),
    ).rejects.toMatchObject({ constraint: "ck_p05_history_immutable" });
    await expect(clone("task_unlocks", unlock.id, {})).rejects.toMatchObject({
      constraint: "task_unlocks_employee_task_date_key",
    });
    await expect(
      clone("task_unlocks", unlock.id, { employee_id: randomUUID() }),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      clone("task_unlocks", unlock.id, { business_date: "2027-01-04" }),
    ).rejects.toMatchObject({ code: "23503" });
    const otherTask = await taskFixture();
    await expect(
      clone("task_unlocks", unlock.id, {
        task_id: otherTask.task.id,
        business_date: otherTask.task.publicationDate,
      }),
    ).rejects.toMatchObject({ code: "23503" });
    await expect(
      directUpdate("task_codes", code.id, {
        task_id: otherTask.task.id,
        version: 2,
      }),
    ).rejects.toMatchObject({ constraint: "ck_task_codes_immutable" });
  });
  it("fences absent cancelled uploads with no fake file facts", async () => {
    const owner = await account(database);
    const cancelled = await database.imageAsset.create({
      data: {
        ownerUserId: owner.user.id,
        purpose: "PROOF",
        uploadCommandId: randomUUID(),
        state: "FAILED",
        failureCode: "UPLOAD_CANCELLED",
        failedAt: occurredAt,
      },
    });
    expect(cancelled.uploadedAt).toBeNull();
    expect(cancelled.uploadIntentHash).toBeNull();
    await expect(clone("image_assets", cancelled.id, {})).rejects.toMatchObject(
      { constraint: "image_assets_owner_purpose_upload_key" },
    );
    for (const patch of [
      { state: "STAGING" },
      { failure_code: "INVALID_IMAGE" },
      { upload_command_id: randomUUID() },
      { uploaded_at: occurredAt },
    ])
      await expect(
        directUpdate("image_assets", cancelled.id, patch),
      ).rejects.toMatchObject({ constraint: "ck_image_assets_transition" });
    await expect(
      clone("image_assets", cancelled.id, {
        upload_command_id: randomUUID(),
        failure_code: "INVALID_IMAGE",
      }),
    ).rejects.toMatchObject({ constraint: "ck_image_assets_state_metadata" });
    await expect(
      clone("image_assets", cancelled.id, {
        upload_command_id: randomUUID(),
        uploaded_at: occurredAt,
      }),
    ).rejects.toMatchObject({ constraint: "ck_image_assets_state_metadata" });
  });
  it("protects accepted asset ownership, age, hashes, readiness and retention", async () => {
    const owner = await account(database);
    const asset = await readyAsset(owner.user.id);
    for (const patch of [
      { owner_user_id: randomUUID() },
      { purpose: "TASK_ILLUSTRATION" },
      { uploaded_at: new Date("2026-10-06T09:00:00Z") },
      { upload_intent_hash: "d".repeat(64) },
      { content_hash: "d".repeat(64) },
      { state: "FAILED" },
    ])
      await expect(
        directUpdate("image_assets", asset.id, patch),
      ).rejects.toThrow();
    await expect(
      clone("image_assets", asset.id, {
        upload_command_id: randomUUID(),
        storage_key: randomUUID(),
      }),
    ).rejects.toMatchObject({ constraint: "ck_image_assets_transition" });
    await expect(
      directUpdate("image_assets", asset.id, {
        state: "DELETING",
        deletion_lease_id: randomUUID(),
        deletion_lease_expires_at: occurredAt,
      }),
    ).rejects.toMatchObject({ constraint: "ck_image_assets_retained" });
    const { task } = await taskFixture();
    await expect(
      directUpdate("tasks", task.id, {
        illustration_asset_id: asset.id,
        illustration_purpose: "TASK_ILLUSTRATION",
        revision: 2,
      }),
    ).rejects.toMatchObject({ constraint: "ck_tasks_ready_illustration" });
    const illustration = await readyAsset(
      task.createdByUserId,
      "TASK_ILLUSTRATION",
    );
    await directUpdate("tasks", task.id, {
      illustration_asset_id: illustration.id,
      illustration_purpose: "TASK_ILLUSTRATION",
      revision: 2,
    });
    await expect(
      directUpdate("image_assets", illustration.id, {
        state: "DELETING",
        deletion_lease_id: randomUUID(),
        deletion_lease_expires_at: new Date("2027-01-01"),
      }),
    ).rejects.toMatchObject({ constraint: "ck_image_assets_retained" });
  });
  it("requires complete immutable snapshots, ownership and the current evidence pair", async () => {
    const fixture = await pendingFixture();
    const { claim, asset } = fixture;
    for (const patch of [
      { reward_units: "1" },
      { execution_declared: false },
      { captured_task_revision: 2 },
      { captured_task_content: {} },
      { deadline_at: occurredAt },
      { business_date: "2027-01-04" },
    ])
      await expect(
        directUpdate("task_submissions", claim.id, patch),
      ).rejects.toMatchObject({ constraint: "ck_task_submissions_immutable" });
    await expect(clone("task_submissions", claim.id, {})).rejects.toMatchObject(
      { constraint: "task_submissions_employee_date_key" },
    );
    const evidence = await database.submissionEvidence.findFirstOrThrow({
      where: { submissionId: claim.id },
    });
    await expect(
      directUpdate("submission_evidence", evidence.id, {
        asset_id: randomUUID(),
      }),
    ).rejects.toMatchObject({ constraint: "ck_p05_history_immutable" });
    await expect(
      directUpdate("task_submissions", claim.id, {
        version: 2,
        current_evidence_version: 2,
      }),
    ).rejects.toThrow();
    const foreign = await readyAsset(fixture.admin.id);
    const wrongPurpose = await readyAsset(
      claim.employeeId,
      "TASK_ILLUSTRATION",
    );
    const unready = await database.imageAsset.create({
      data: {
        ownerUserId: claim.employeeId,
        purpose: "PROOF",
        uploadCommandId: randomUUID(),
        state: "STAGING",
        receivedAt: occurredAt,
        uploadedBySessionId: asset.uploadedBySessionId,
        storageKey: randomUUID(),
        processingLeaseId: randomUUID(),
        processingLeaseExpiresAt: new Date(occurredAt.getTime() + 120_000),
      },
    });
    for (const asset_id of [
      foreign.id,
      wrongPurpose.id,
      unready.id,
      randomUUID(),
    ])
      await expect(
        clone("submission_evidence", evidence.id, { version: 2, asset_id }),
      ).rejects.toMatchObject({ constraint: "ck_submission_evidence_ready" });
    await expect(
      clone("submission_evidence", evidence.id, { version: 2 }),
    ).rejects.toMatchObject({ constraint: "ck_p05_current_evidence" });
    await expect(
      directUpdate("image_assets", asset.id, {
        state: "DELETING",
        deletion_lease_id: randomUUID(),
        deletion_lease_expires_at: new Date("2027-01-01"),
      }),
    ).rejects.toMatchObject({ constraint: "ck_image_assets_retained" });
    expect(
      await database.financialOperation.count({
        where: { businessNamespace: "p05.task-reward", businessKey: claim.id },
      }),
    ).toBe(0);
  });
  it.each(["APPROVED", "REJECTED"] as const)(
    "commits one %s final and freezes all later evidence/status/review changes",
    async (decision) => {
      const fixture = await pendingFixture();
      const review = await database.$transaction((transaction) =>
        finalize(transaction, fixture, decision),
      );
      await expect(
        directUpdate("task_submissions", fixture.claim.id, {
          status: "PENDING",
          version: 3,
        }),
      ).rejects.toMatchObject({ constraint: "ck_task_submissions_immutable" });
      await expect(
        directUpdate("final_reviews", review.id, { reason: "Rewritten" }),
      ).rejects.toMatchObject({ constraint: "ck_p05_history_immutable" });
      const evidence = await database.submissionEvidence.findFirstOrThrow({
        where: { submissionId: fixture.claim.id },
      });
      await expect(
        clone("submission_evidence", evidence.id, { version: 2 }),
      ).rejects.toMatchObject({ constraint: "ck_submission_evidence_ready" });
      expect(
        await database.finalReview.count({
          where: { submissionId: fixture.claim.id },
        }),
      ).toBe(1);
      expect(
        await database.financialOperation.count({
          where: {
            businessNamespace: "p05.task-reward",
            businessKey: fixture.claim.id,
          },
        }),
      ).toBe(decision === "APPROVED" ? 1 : 0);
    },
  );
  it("rejects final status alone, unattached reward and reward/version disagreement atomically", async () => {
    const fixture = await pendingFixture();
    const { claim, admin, funding } = fixture;
    await expect(
      directUpdate("task_submissions", claim.id, {
        status: "REJECTED",
        version: 2,
      }),
    ).rejects.toMatchObject({ constraint: "ck_p05_final_consistency" });
    await expect(
      database.$transaction((transaction) =>
        finalize(transaction, fixture, "APPROVED", 1n),
      ),
    ).rejects.toThrow();
    await expect(
      database.financialOperation.create({
        data: {
          walletId: funding.owner.wallet.id,
          kind: "CREDIT",
          origin: "TASK_REWARD",
          businessNamespace: "p05.task-reward",
          businessKey: claim.id,
          intentHash: "c".repeat(64),
          magnitudeUnits: claim.rewardUnits,
          actorType: "USER",
          actorUserId: admin.id,
          acceptedTerms: {},
          outcome: {},
        },
      }),
    ).rejects.toThrow();
    expect(
      (
        await database.taskSubmission.findUniqueOrThrow({
          where: { id: claim.id },
        })
      ).status,
    ).toBe("PENDING");
    expect(
      await database.finalReview.count({ where: { submissionId: claim.id } }),
    ).toBe(0);
    expect(
      await database.financialOperation.count({
        where: { businessNamespace: "p05.task-reward", businessKey: claim.id },
      }),
    ).toBe(0);
  });
  it("validates final consistency from review, posting, audit and operation insert sides", async () => {
    const fixture = await pendingFixture();
    await expect(
      database.finalReview.create({
        data: {
          submissionId: fixture.claim.id,
          employeeId: fixture.claim.employeeId,
          decision: "REJECTED",
          submissionVersion: 1,
          evidenceVersion: 1,
          actorUserId: fixture.admin.id,
          decidedAt: fixture.claim.submittedAt,
          reason: "No matching final status",
        },
      }),
    ).rejects.toThrow();
    const review = await database.$transaction((transaction) =>
      finalize(transaction, fixture, "APPROVED"),
    );
    if (review.approvalOperationId === null)
      throw new Error("Approved control needs an operation.");
    const operationId = review.approvalOperationId;
    await expect(
      database.ledgerPosting.create({
        data: {
          operationId,
          walletId: fixture.funding.owner.wallet.id,
          source: "REFERRAL",
          availableDeltaUnits: 1n,
          reservedDeltaUnits: 0n,
        },
      }),
    ).rejects.toThrow();
    await expect(
      database.auditRecord.create({
        data: {
          operationId,
          actorType: "USER",
          actorUserId: fixture.admin.id,
          action: "CREDIT",
        },
      }),
    ).rejects.toThrow();
    const operation = await database.financialOperation.findUniqueOrThrow({
      where: { id: operationId },
    });
    await expect(
      database.financialOperation.create({
        data: {
          walletId: operation.walletId,
          kind: operation.kind,
          origin: operation.origin,
          businessNamespace: operation.businessNamespace,
          businessKey: operation.businessKey.toUpperCase(),
          intentHash: operation.intentHash,
          magnitudeUnits: operation.magnitudeUnits,
          actorType: "USER",
          actorUserId: fixture.admin.id,
          acceptedTerms: {},
          outcome: {},
        },
      }),
    ).rejects.toThrow();
    const triggers = await pool.query<{ table_name: string }>(
      `SELECT c.relname AS table_name FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE t.tgname='p05_final_links' AND t.tgdeferrable AND t.tginitdeferred ORDER BY c.relname`,
    );
    expect(triggers.rows.map((row) => row.table_name)).toEqual([
      "final_reviews",
      "financial_audit_records",
      "financial_operations",
      "ledger_postings",
      "submission_evidence",
      "task_submissions",
    ]);
    expect(await database.ledgerPosting.count({ where: { operationId } })).toBe(
      1,
    );
    expect(await database.auditRecord.count({ where: { operationId } })).toBe(
      1,
    );
  });
  it("keeps cancelled domain keys minimal, unique, immutable and absent from business audit", async () => {
    const { admin, task } = await taskFixture();
    const committed = await database.taskCommandRecord.create({
      data: {
        actorUserId: admin.id,
        kind: "TASK_CREATE",
        commandId: randomUUID(),
        terminalState: "COMMITTED",
        occurredAt,
        intentHash: "a".repeat(64),
        taskId: task.id,
        safeOutcome: { id: task.id },
        afterSnapshot: { revision: 1 },
      },
    });
    await expect(
      directUpdate("task_command_records", committed.id, {
        safe_outcome: { id: randomUUID() },
      }),
    ).rejects.toMatchObject({ constraint: "ck_p05_history_immutable" });
    await expect(
      clone("task_command_records", committed.id, {
        command_id: randomUUID(),
        after_snapshot: { description: "x".repeat(65_536) },
      }),
    ).rejects.toMatchObject({ constraint: "ck_task_commands_snapshot_bounds" });
    const marker = await database.taskCommandRecord.create({
      data: {
        actorUserId: admin.id,
        kind: "TASK_CREATE",
        commandId: randomUUID(),
        terminalState: "CANCELLED",
        occurredAt,
      },
    });
    await expect(
      clone("task_command_records", marker.id, {}),
    ).rejects.toMatchObject({
      constraint: "task_commands_actor_kind_command_key",
    });
    await expect(
      clone("task_command_records", marker.id, {
        command_id: randomUUID(),
        intent_hash: "a".repeat(64),
      }),
    ).rejects.toMatchObject({ constraint: "ck_task_commands_terminal_shape" });
    await expect(
      clone("task_command_records", marker.id, {
        command_id: randomUUID(),
        terminal_state: "COMMITTED",
      }),
    ).rejects.toMatchObject({ constraint: "ck_task_commands_terminal_shape" });
    await expect(
      directUpdate("task_command_records", marker.id, {
        terminal_state: "COMMITTED",
      }),
    ).rejects.toMatchObject({ constraint: "ck_p05_history_immutable" });
    expect(
      await database.taskCommandRecord.count({
        where: { id: marker.id, terminalState: "COMMITTED" },
      }),
    ).toBe(0);
    for (const table of [
      "tasks",
      "task_codes",
      "image_assets",
      "task_submissions",
      "task_unlocks",
      "submission_evidence",
      "final_reviews",
      "task_command_records",
    ] as const)
      await expect(pool.query(`TRUNCATE ${table} CASCADE`)).rejects.toThrow();
  });
});
