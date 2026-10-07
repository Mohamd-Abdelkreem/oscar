import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  taskCreateSchema,
  taskEditSchema,
  taskListQuerySchema,
  employeeTaskDaySchema,
} from "./tasks.schema.ts";
import {
  taskPublicationDateSchema,
  taskTargetUrlSchema,
} from "./task-content.schema.ts";
import {
  commandObservationSchema,
  commandCancellationOutcomeSchema,
} from "./task-command.schema.ts";
import {
  TASK_COMMAND_ROLES,
  taskCommandCancellationSchema,
} from "./task-command-kind.schema.ts";

const create = {
  commandId: randomUUID(),
  confirmed: true,
  title: "Task",
  description: "Instructions",
  targetUrl: "https://example.com/task",
  platform: "An additional platform",
  publicationDate: "2026-10-05",
  publicationState: "PUBLISHED",
  isCodeRequired: false,
  illustrationAssetId: null,
};
describe("task publication and command contracts", () => {
  it("permits free-text platform and preserves PATCH omitted versus null", () => {
    expect(taskCreateSchema.safeParse(create).success).toBe(true);
    const identity = {
      commandId: create.commandId,
      confirmed: true,
      expectedTaskRevision: 1,
    };
    expect(
      taskEditSchema.parse({ ...identity, title: "Changed" }),
    ).not.toHaveProperty("illustrationAssetId");
    expect(
      taskEditSchema.parse({ ...identity, illustrationAssetId: null })
        .illustrationAssetId,
    ).toBeNull();
    expect(taskEditSchema.safeParse(identity).success).toBe(false);
    expect(taskCreateSchema.safeParse({ ...create, reward: "2" }).success).toBe(
      false,
    );
    expect(
      taskCreateSchema.safeParse({ ...create, confirmed: 1 }).success,
    ).toBe(false);
  });
  it.each(["2026-10-10", "2026-10-11", "2026-02-30", "0000-01-01"])(
    "rejects non-business publication date %s",
    (date) => {
      expect(taskPublicationDateSchema.safeParse(date).success).toBe(false);
    },
  );
  it.each([
    "javascript:alert(1)",
    "https://user:pass@example.com",
    "http://127.1",
    "http://0x7f000001",
    "http://10.0.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "https://localhost.",
    "https://example.com/\npath",
  ])("rejects unsafe link %s", (url) => {
    expect(taskTargetUrlSchema.safeParse(url).success).toBe(false);
  });
  it("bounds filters, offsets and ranges", () => {
    expect(taskListQuerySchema.parse({})).toEqual({ page: 1, limit: 25 });
    for (const query of [
      { limit: "101" },
      { page: "9007199254740991", limit: "100" },
      { page: ["1"] },
      { sort: "secret" },
      { dateFrom: "2026-10-06", dateTo: "2026-10-05" },
    ])
      expect(taskListQuerySchema.safeParse(query).success).toBe(false);
  });
  it("keeps own-key cancellation minimal and absence nonterminal", () => {
    expect(TASK_COMMAND_ROLES.FINAL_REVIEW).toBe("ADMIN");
    expect(TASK_COMMAND_ROLES.SUBMISSION_CREATE).toBe("USER");
    expect(
      taskCommandCancellationSchema.parse({
        kind: "TASK_UNLOCK",
        confirmed: true,
      }),
    ).toEqual({ kind: "TASK_UNLOCK", confirmed: true });
    expect(
      taskCommandCancellationSchema.safeParse({
        kind: "TASK_UNLOCK",
        confirmed: true,
        actorUserId: randomUUID(),
      }).success,
    ).toBe(false);
    const cancelled = {
      state: "CANCELLED",
      commandId: randomUUID(),
      kind: "TASK_UNLOCK",
      cancelledAt: "2026-10-05T09:00:00Z",
    };
    expect(commandObservationSchema.safeParse(cancelled).success).toBe(true);
    expect(
      commandObservationSchema.safeParse({ ...cancelled, targetId: null })
        .success,
    ).toBe(false);
    const absence = {
      state: "NOT_OBSERVED",
      commandId: cancelled.commandId,
      kind: cancelled.kind,
    };
    expect(commandObservationSchema.safeParse(absence).success).toBe(true);
    expect(commandCancellationOutcomeSchema.safeParse(absence).success).toBe(
      false,
    );
  });
  it("does not allow a fictitious usable task in an empty day", () => {
    const day = {
      serverNow: "2026-10-05T09:00:00Z",
      businessDate: "2026-10-05",
      window: {
        opensAt: "2026-10-05T09:00:00Z",
        closesAt: "2026-10-05T15:00:00Z",
        nextOpeningAt: "2026-10-06T09:00:00Z",
      },
      calendarState: "OPEN",
      workEligibility: "FREE",
      opportunityState: "NO_TASK",
      task: null,
      unlock: null,
      submission: null,
      currentEntitlement: {
        effective: false,
        packageCode: null,
        packageLabel: null,
        dailyReward: null,
      },
      canUnlock: false,
      canSubmit: false,
      canReplace: false,
      unavailableReason: "NO_TASK",
    };
    expect(employeeTaskDaySchema.safeParse(day).success).toBe(true);
    expect(
      employeeTaskDaySchema.safeParse({ ...day, canSubmit: true }).success,
    ).toBe(false);
    expect(
      employeeTaskDaySchema.safeParse({
        ...day,
        currentEntitlement: { ...day.currentEntitlement, dailyReward: "0" },
      }).success,
    ).toBe(false);
  });
  it("binds typed saved outcomes to their target and rejects private nested fields", () => {
    const id = randomUUID();
    const observation = {
      state: "OBSERVED",
      command: {
        kind: "CODE_CREATE",
        commandId: randomUUID(),
        targetId: id,
        committedAt: "2026-10-05T09:00:00Z",
        outcome: {
          id,
          normalizedText: "CODE",
          state: "ENABLED",
          version: 1,
          description: null,
          createdAt: "2026-10-05T09:00:00Z",
          updatedAt: "2026-10-05T09:00:00Z",
          creator: {
            id: randomUUID(),
            fullName: "Admin",
            email: "admin@example.test",
          },
          task: {
            id: randomUUID(),
            title: "Task",
            platform: "Platform",
            window: {
              opensAt: "2026-10-05T09:00:00Z",
              closesAt: "2026-10-05T15:00:00Z",
              nextOpeningAt: "2026-10-06T09:00:00Z",
            },
          },
          distinctSuccessfulEmployeeCount: 0,
          successfulUsageCount: 0,
        },
      },
    };
    expect(commandObservationSchema.safeParse(observation).success).toBe(true);
    for (const command of [
      { ...observation.command, targetId: randomUUID() },
      { ...observation.command, kind: "TASK_CREATE" },
      {
        ...observation.command,
        outcome: { ...observation.command.outcome, normalizedText: " code " },
      },
      {
        ...observation.command,
        outcome: {
          ...observation.command.outcome,
          creator: {
            ...observation.command.outcome.creator,
            passwordHash: "private",
          },
        },
      },
    ])
      expect(
        commandObservationSchema.safeParse({ ...observation, command }).success,
      ).toBe(false);
  });
});
