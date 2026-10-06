import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { PrivateImageStorage } from "../../infrastructure/files/private-image-storage.js";
import { ProofUploadService } from "./proof-upload.service.js";
import {
  createTaskScenario,
  createReadyProofFixture,
  taskIdentity,
  withTaskDatabase,
  withIndependentTaskClients,
} from "../tasks/testing/task-fixtures.js";

it("durably fences both unused upload purposes and retains accepted READY proof metadata", async () => {
  await withTaskDatabase(async (database, databaseUrl) => {
    const scenario = await createTaskScenario(database);
    // Cancellation must fence unused work without filesystem admission or paid eligibility.
    const storage = new PrivateImageStorage({
      storageRoot: join(tmpdir(), `p05-unused-${randomUUID()}`),
      processingSlots: 2,
      uploadReservationBytes: 41_943_040,
      stagingMaxBytes: 268_435_456,
      inputDeadlineMs: 30_000,
    });
    const service = new ProofUploadService(
      database,
      storage,
      scenario.clock,
      30_000,
    );
    const employee = taskIdentity(scenario.employee);
    const admin = taskIdentity(scenario.admin);
    const accepted = await createReadyProofFixture(database, scenario.employee);
    await database.user.update({
      where: { id: employee.userId },
      data: { tasksBlocked: true },
    });
    for (const [identity, purpose] of [
      [employee, "PROOF"],
      [admin, "TASK_ILLUSTRATION"],
    ] as const) {
      const commandId = randomUUID();
      expect(await service.observe(identity, purpose, commandId)).toBeNull();
      const cancelled = await service.cancel(identity, purpose, commandId, {
        confirmed: true,
      });
      expect(cancelled).toMatchObject({
        state: "FAILED",
        failureCode: "UPLOAD_CANCELLED",
        ownerUserId: identity.userId,
        purpose,
        uploadCommandId: commandId,
        storageKey: null,
        receivedAt: null,
        uploadedAt: null,
        uploadedBySessionId: null,
        uploadIntentHash: null,
        inputByteCount: null,
      });
      expect(
        await service.cancel(identity, purpose, commandId, { confirmed: true }),
      ).toEqual(cancelled);
      expect(await service.observe(identity, purpose, commandId)).toEqual(
        cancelled,
      );
      await withIndependentTaskClients(databaseUrl, async (first, second) => {
        const concurrentKey = randomUUID();
        const competitors = [first, second].map(
          (client) =>
            new ProofUploadService(client, storage, scenario.clock, 30_000),
        );
        const [firstResult, secondResult] = await Promise.all(
          competitors.map((competitor) =>
            competitor.cancel(identity, purpose, concurrentKey, {
              confirmed: true,
            }),
          ),
        );
        expect(secondResult).toEqual(firstResult);
        expect(
          await database.imageAsset.count({
            where: {
              ownerUserId: identity.userId,
              purpose,
              uploadCommandId: concurrentKey,
            },
          }),
        ).toBe(1);
        // Ignore the original cancellation reply and recover its durable terminal observation.
        expect(await service.observe(identity, purpose, concurrentKey)).toEqual(
          firstResult,
        );
      });
    }
    const preserved = await service.cancel(
      employee,
      "PROOF",
      accepted.uploadCommandId,
      { confirmed: true },
    );
    expect(preserved).toEqual(accepted);
    expect(
      await database.imageAsset.findUnique({ where: { id: accepted.id } }),
    ).toEqual(accepted);
    expect(await database.taskSubmission.count()).toBe(0);
    await expect(
      service.cancel(employee, "TASK_ILLUSTRATION", randomUUID(), {
        confirmed: true,
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    await database.authSession.update({
      where: { id: employee.sessionId },
      data: { revokedAt: scenario.clock() },
    });
    await expect(
      service.cancel(employee, "PROOF", randomUUID(), { confirmed: true }),
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
