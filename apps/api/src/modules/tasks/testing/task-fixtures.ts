import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import type { DatabaseClient } from "@template/database";
import { packageTermsSchema } from "@template/contracts";
import { createIdentityFixture } from "../../auth/testing/identity-fixtures.js";
import {
  activateSubscriptionFixture,
  fundSubscriptionFixture,
} from "../../subscriptions/testing/subscription-fixtures.js";
import { fixedFinancialClock } from "../../ledger/testing/financial-fixtures.js";

export { withIdentityDatabase as withTaskDatabase } from "../../auth/testing/identity-fixtures.js";
export { withIndependentFinancialClients as withIndependentTaskClients } from "../../ledger/testing/financial-fixtures.js";
export const P05_FIXTURE_NOW = new Date("2026-10-05T09:00:00.000Z");
export const taskIdentity = (
  account: Awaited<ReturnType<typeof createIdentityFixture>>,
) => ({ userId: account.user.id, sessionId: account.session.id });

export async function createTaskScenario(database: DatabaseClient) {
  const admin = await createIdentityFixture(database, {
    role: "ADMIN",
    now: P05_FIXTURE_NOW,
  });
  const employee = await createIdentityFixture(database, {
    now: P05_FIXTURE_NOW,
  });
  await fundSubscriptionFixture(database, employee, {
    nonReferral: "60",
    referral: "0",
  });
  const active = await activateSubscriptionFixture(database, employee);
  const task = await database.task.create({
    data: {
      publicationDate: new Date("2026-10-05T00:00:00Z"),
      publicationState: "PUBLISHED",
      title: "Task fixture",
      description: "Synthetic instructions",
      platform: "Test platform",
      targetUrl: "https://example.com/task",
      isCodeRequired: false,
      createdAt: P05_FIXTURE_NOW,
      updatedAt: P05_FIXTURE_NOW,
      createdByUserId: admin.user.id,
      updatedByUserId: admin.user.id,
    },
  });
  return {
    admin,
    employee,
    subscription: active.subscription,
    task,
    clock: fixedFinancialClock(P05_FIXTURE_NOW),
  };
}

export async function createReadyProofFixture(
  database: DatabaseClient,
  account: Awaited<ReturnType<typeof createIdentityFixture>>,
) {
  const staged = await database.imageAsset.create({
    data: {
      ownerUserId: account.user.id,
      purpose: "PROOF",
      uploadCommandId: randomUUID(),
      state: "STAGING",
      receivedAt: P05_FIXTURE_NOW,
      uploadedBySessionId: account.session.id,
      storageKey: randomUUID(),
      processingLeaseId: randomUUID(),
      processingLeaseExpiresAt: new Date(P05_FIXTURE_NOW.getTime() + 120_000),
    },
  });
  return database.imageAsset.update({
    where: { id: staged.id },
    data: {
      state: "READY",
      uploadedAt: P05_FIXTURE_NOW,
      uploadIntentHash: "a".repeat(64),
      readyAt: P05_FIXTURE_NOW,
      inputByteCount: 70,
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

export async function createPendingTaskFixture(
  database: DatabaseClient,
  scenario: Awaited<ReturnType<typeof createTaskScenario>>,
) {
  const { employee, subscription, task } = scenario;
  const asset = await createReadyProofFixture(database, employee);
  const submission = await database.$transaction(async (transaction) => {
    await transaction.task.update({
      where: { id: task.id },
      data: { firstParticipationAt: P05_FIXTURE_NOW },
    });
    const claim = await transaction.taskSubmission.create({
      data: {
        employeeId: employee.user.id,
        taskId: task.id,
        businessDate: task.publicationDate,
        capturedTaskRevision: task.revision,
        capturedTaskContent: {
          title: task.title,
          description: task.description,
          targetUrl: task.targetUrl,
          platform: task.platform,
        },
        subscriptionId: subscription.id,
        capturedSubscriptionTerms: packageTermsSchema.parse(
          subscription.acceptedTerms,
        ),
        rewardUnits: subscription.dailyRewardUnits,
        executionDeclared: true,
        submittedAt: P05_FIXTURE_NOW,
        deadlineAt: new Date("2026-10-05T15:00:00Z"),
        currentEvidenceVersion: 1,
      },
    });
    const evidence = await transaction.submissionEvidence.create({
      data: {
        submissionId: claim.id,
        employeeId: employee.user.id,
        version: 1,
        assetId: asset.id,
        assetPurpose: "PROOF",
        acceptedAt: P05_FIXTURE_NOW,
        acceptedByUserId: employee.user.id,
      },
    });
    return { ...claim, evidence };
  });
  return { submission, asset };
}

// This is actual synthetic storage, never an API upload/decoder acceptance claim.
export async function withTaskFileFixture<T>(
  work: (root: string, png: Buffer) => Promise<T>,
): Promise<T> {
  const root = await mkdtemp(join(tmpdir(), "oscar-p05-"));
  if (!resolve(root).startsWith(`${resolve(tmpdir())}${sep}`))
    throw new Error("Unsafe file-fixture cleanup.");
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
    "base64",
  );
  try {
    await writeFile(join(root, "fixture.png"), png);
    return await work(root, png);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
