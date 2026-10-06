import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "@template/database";
import {
  createTaskScenario,
  createReadyProofFixture,
  taskIdentity,
} from "../../tasks/testing/task-fixtures.js";
import { TaskSubmissionsService } from "../task-submissions.service.js";
import { submissionFixtureReads } from "./submission-fixtures.js";

export async function acceptedReviewFixture(
  database: DatabaseClient,
  root: string,
) {
  const scenario = await createTaskScenario(database);
  const asset = await createReadyProofFixture(database, scenario.employee);
  const replacement = await createReadyProofFixture(
    database,
    scenario.employee,
  );
  const reads = await submissionFixtureReads(database, root, scenario.clock, [
    asset,
    replacement,
  ]);
  await new TaskSubmissionsService(database, scenario.clock, reads).create(
    taskIdentity(scenario.employee),
    {
      commandId: randomUUID(),
      taskId: scenario.task.id,
      expectedTaskRevision: 1,
      proofAssetId: asset.id,
      declaredExecuted: true,
    },
  );
  const submission = await database.taskSubmission.findFirstOrThrow();
  const intent = {
    commandId: randomUUID(),
    confirmed: true as const,
    expectedSubmissionVersion: 1,
    expectedEvidenceVersion: 1,
    decision: "APPROVE" as const,
    reason: "Inspected execution and current proof",
  };
  return { ...scenario, asset, replacement, reads, submission, intent };
}

export async function reviewState(database: DatabaseClient) {
  const orderBy = { id: "asc" as const };
  return {
    wallets: await database.wallet.findMany({ orderBy }),
    submissions: await database.taskSubmission.findMany({ orderBy }),
    evidence: await database.submissionEvidence.findMany({ orderBy }),
    finals: await database.finalReview.findMany({ orderBy }),
    commands: await database.taskCommandRecord.findMany({ orderBy }),
    operations: await database.financialOperation.findMany({ orderBy }),
    postings: await database.ledgerPosting.findMany({ orderBy }),
    audit: await database.auditRecord.findMany({ orderBy }),
    allocations: await database.reservationAllocation.findMany({ orderBy }),
  };
}
