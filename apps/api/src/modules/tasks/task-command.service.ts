import { createHash } from "node:crypto";
import {
  commandObservationSchema,
  committedTaskCommandSchema,
  TASK_COMMAND_ROLES,
  taskCommandKindSchema,
  taskCommandCancellationSchema,
  taskCreateSchema,
  taskEditSchema,
  taskStatusSchema,
  taskCodeCreateSchema,
  taskCodeStatusSchema,
  taskUnlockRequestSchema,
  submissionCreateSchema,
  evidenceReplaceSchema,
  submissionReviewSchema,
  type CommandObservation,
  proofAssetSchema,
} from "@template/contracts";
import {
  Prisma,
  type DatabaseClient,
  type TaskCommandRecord,
} from "@template/database";
import { z } from "zod";
import { AppError, NotFoundException } from "../../core/errors/index.js";
import { lockIdentityUsers } from "../auth/session-authority.js";
import type { ProofReadService } from "../proofs/proof-read.service.js";
import { TaskSubmissionsQueries } from "../task-submissions/task-submissions.queries.js";
import { EmployeeTasksService } from "./employee-tasks.service.js";
import {
  authorizeTaskActor,
  lockTaskSession,
  runTaskTransaction,
  type TaskActorIdentity,
  type TaskClock,
} from "./task-transaction.js";

const commandIntentSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("TASK_CREATE"),
    targetId: z.null(),
    payload: taskCreateSchema,
  }),
  z.strictObject({
    kind: z.literal("TASK_EDIT"),
    targetId: z.uuid(),
    payload: taskEditSchema,
  }),
  z.strictObject({
    kind: z.literal("TASK_STATUS"),
    targetId: z.uuid(),
    payload: taskStatusSchema,
  }),
  z.strictObject({
    kind: z.literal("CODE_CREATE"),
    targetId: z.null(),
    payload: taskCodeCreateSchema,
  }),
  z.strictObject({
    kind: z.literal("CODE_STATUS"),
    targetId: z.uuid(),
    payload: taskCodeStatusSchema,
  }),
  z.strictObject({
    kind: z.literal("TASK_UNLOCK"),
    targetId: z.uuid(),
    payload: taskUnlockRequestSchema,
  }),
  z.strictObject({
    kind: z.literal("SUBMISSION_CREATE"),
    targetId: z.null(),
    payload: submissionCreateSchema,
  }),
  z.strictObject({
    kind: z.literal("EVIDENCE_REPLACE"),
    targetId: z.uuid(),
    payload: evidenceReplaceSchema,
  }),
  z.strictObject({
    kind: z.literal("FINAL_REVIEW"),
    targetId: z.uuid(),
    payload: submissionReviewSchema,
  }),
]);
export type TaskCommandIntent = z.infer<typeof commandIntentSchema>;
type TaskCommandCommit = Readonly<{
  taskId: string;
  codeId?: string;
  submissionId?: string;
  outcome: unknown;
  beforeSnapshot?: Prisma.InputJsonObject;
  afterSnapshot?: Prisma.InputJsonObject;
}>;
export type TaskCommandWork = Readonly<{
  otherUserIds?: readonly string[];
  lock: (
    transaction: Prisma.TransactionClient,
    intent: TaskCommandIntent,
  ) => Promise<void>;
  commit: (
    transaction: Prisma.TransactionClient,
    accepted: { intent: TaskCommandIntent; now: Date },
  ) => Promise<TaskCommandCommit>;
}>;

const lookupSchema = z.strictObject({
  kind: taskCommandKindSchema,
  commandId: z.uuid(),
});
function canonicalJson(intent: unknown): string {
  if (Array.isArray(intent)) return `[${intent.map(canonicalJson).join(",")}]`;
  if (intent !== null && typeof intent === "object") {
    return `{${Object.entries(intent)
      .filter(([, field]) => field !== undefined)
      .sort(([first], [second]) => first.localeCompare(second, "en"))
      .map(([key, field]) => `${JSON.stringify(key)}:${canonicalJson(field)}`)
      .join(",")}}`;
  }
  return JSON.stringify(intent);
}
function intentHash(actorUserId: string, intent: TaskCommandIntent) {
  return createHash("sha256")
    .update(canonicalJson({ actorUserId, ...intent }))
    .digest("hex");
}
function commandTarget(
  receipt: Pick<
    TaskCommandRecord,
    "kind" | "taskId" | "codeId" | "submissionId"
  >,
) {
  if (["CODE_CREATE", "CODE_STATUS"].includes(receipt.kind))
    return receipt.codeId;
  if (
    ["SUBMISSION_CREATE", "EVIDENCE_REPLACE", "FINAL_REVIEW"].includes(
      receipt.kind,
    )
  )
    return receipt.submissionId;
  return receipt.taskId;
}

export class TaskCommandService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: TaskClock,
    private readonly reads?: ProofReadService,
  ) {}

  async execute(
    rawIntent: unknown,
    identity: TaskActorIdentity,
    work: TaskCommandWork,
  ): Promise<CommandObservation> {
    return (await this.executeResult(rawIntent, identity, work)).observation;
  }

  async executeResult(
    rawIntent: unknown,
    identity: TaskActorIdentity,
    work: TaskCommandWork,
  ) {
    const intent = commandIntentSchema.parse(rawIntent);
    const receipt = await runTaskTransaction(
      this.database,
      {
        identity,
        ...(work.otherUserIds === undefined
          ? {}
          : { otherUserIds: work.otherUserIds }),
      },
      (transaction) =>
        this.executeAccepted(transaction, intent, identity, work),
    );
    return {
      ...receipt,
      observation: await this.refreshOutcome(receipt.observation, identity),
    };
  }

  // Final approval passes the existing ledger transaction; it must never open a nested transaction.
  async executeInTransaction(
    transaction: Prisma.TransactionClient,
    request: { intent: TaskCommandIntent; identity: TaskActorIdentity },
    work: TaskCommandWork,
  ): Promise<CommandObservation> {
    const intent = commandIntentSchema.parse(request.intent);
    return (
      await this.executeAccepted(transaction, intent, request.identity, work)
    ).observation;
  }

  private async executeAccepted(
    transaction: Prisma.TransactionClient,
    intent: TaskCommandIntent,
    identity: TaskActorIdentity,
    work: TaskCommandWork,
  ): Promise<{ observation: CommandObservation; replayed: boolean }> {
    await lockIdentityUsers(transaction, {
      userIds: [identity.userId, ...(work.otherUserIds ?? [])],
      adminPopulation: false,
    });
    await lockTaskSession(transaction, identity);
    await authorizeTaskActor(transaction, identity, {
      role: TASK_COMMAND_ROLES[intent.kind],
      clock: this.clock,
    });
    const receipt = await this.receipt(transaction, identity.userId, intent);
    const fingerprint = intentHash(identity.userId, intent);
    if (receipt !== null) {
      if (receipt.terminalState === "CANCELLED")
        throw new AppError(
          "The command key was cancelled.",
          409,
          "COMMAND_CANCELLED",
        );
      if (receipt.intentHash !== fingerprint)
        throw new AppError(
          "Command identity conflicts.",
          409,
          "IDEMPOTENCY_CONFLICT",
        );
      return {
        observation: await this.observed(transaction, identity, receipt),
        replayed: true,
      };
    }
    await work.lock(transaction, intent);
    const { now } = await authorizeTaskActor(transaction, identity, {
      role: TASK_COMMAND_ROLES[intent.kind],
      clock: this.clock,
    });
    const committed = await work.commit(transaction, { intent, now });
    const targetId = commandTarget({
      kind: intent.kind,
      taskId: committed.taskId,
      codeId: committed.codeId ?? null,
      submissionId: committed.submissionId ?? null,
    });
    const command = committedTaskCommandSchema.parse({
      kind: intent.kind,
      commandId: intent.payload.commandId,
      targetId,
      committedAt: now.toISOString(),
      outcome: committed.outcome,
    });
    if (intent.targetId !== null && intent.targetId !== command.targetId)
      throw new TypeError("Command target changed during execution.");
    const saved = await transaction.taskCommandRecord.create({
      data: {
        actorUserId: identity.userId,
        kind: intent.kind,
        commandId: intent.payload.commandId,
        terminalState: "COMMITTED",
        intentHash: fingerprint,
        taskId: committed.taskId,
        codeId: committed.codeId ?? null,
        submissionId: committed.submissionId ?? null,
        occurredAt: now,
        reason: intent.kind === "FINAL_REVIEW" ? intent.payload.reason : null,
        beforeSnapshot: committed.beforeSnapshot ?? Prisma.DbNull,
        afterSnapshot: committed.afterSnapshot ?? Prisma.DbNull,
        safeOutcome: command.outcome,
      },
    });
    return {
      observation: await this.observed(transaction, identity, saved),
      replayed: false,
    };
  }

  async observe(
    rawLookup: unknown,
    identity: TaskActorIdentity,
  ): Promise<CommandObservation> {
    const lookup = lookupSchema.parse(rawLookup);
    const observation = await runTaskTransaction<CommandObservation>(
      this.database,
      { identity },
      async (transaction) => {
        await authorizeTaskActor(transaction, identity, {
          role: TASK_COMMAND_ROLES[lookup.kind],
          clock: this.clock,
        });
        const receipt = await this.receipt(transaction, identity.userId, {
          kind: lookup.kind,
          payload: { commandId: lookup.commandId },
        });
        return receipt === null
          ? { state: "NOT_OBSERVED", ...lookup }
          : this.observed(transaction, identity, receipt);
      },
    );
    return this.refreshOutcome(observation, identity);
  }

  async cancel(
    rawCancellation: unknown,
    identity: TaskActorIdentity,
  ): Promise<CommandObservation> {
    const cancellation = taskCommandCancellationSchema
      .extend({ commandId: z.uuid() })
      .parse(rawCancellation);
    const observation = await runTaskTransaction(
      this.database,
      { identity },
      async (transaction) => {
        const { now } = await authorizeTaskActor(transaction, identity, {
          role: TASK_COMMAND_ROLES[cancellation.kind],
          clock: this.clock,
        });
        const saved = await this.receipt(transaction, identity.userId, {
          kind: cancellation.kind,
          payload: { commandId: cancellation.commandId },
        });
        if (saved !== null) return this.observed(transaction, identity, saved);
        const marker = await transaction.taskCommandRecord.create({
          data: {
            actorUserId: identity.userId,
            kind: cancellation.kind,
            commandId: cancellation.commandId,
            terminalState: "CANCELLED",
            occurredAt: now,
          },
        });
        return this.observed(transaction, identity, marker);
      },
    );
    return this.refreshOutcome(observation, identity);
  }

  // Check live bytes after the database transaction; never rewrite captured content or receipt identity.
  private async refreshOutcome(
    observation: CommandObservation,
    identity: TaskActorIdentity,
  ) {
    if (this.reads === undefined || observation.state !== "OBSERVED")
      return observation;
    const command = observation.command;
    if (command.kind === "FINAL_REVIEW") {
      const asset = proofAssetSchema.parse(
        await this.reads.metadata(
          identity,
          "PROOF",
          command.outcome.submission.evidence.assetId,
        ),
      );
      return commandObservationSchema.parse({
        ...observation,
        command: {
          ...command,
          outcome: {
            ...command.outcome,
            submission: {
              ...command.outcome.submission,
              evidence: { ...command.outcome.submission.evidence, asset },
            },
          },
        },
      });
    }
    if (
      command.kind === "SUBMISSION_CREATE" ||
      command.kind === "EVIDENCE_REPLACE"
    ) {
      const current = await new TaskSubmissionsQueries(
        this.database,
        this.clock,
      ).detail(identity, command.outcome.id);
      const asset = proofAssetSchema.parse(
        await this.reads.metadata(
          identity,
          "PROOF",
          command.outcome.evidence.assetId,
        ),
      );
      return commandObservationSchema.parse({
        ...observation,
        command: {
          ...command,
          outcome: {
            ...command.outcome,
            evidence: { ...command.outcome.evidence, asset },
            canReplace:
              current.canReplace && current.version === command.outcome.version,
          },
        },
      });
    }
    if (command.kind === "TASK_UNLOCK") {
      const day = await new EmployeeTasksService(
        this.database,
        this.clock,
        this.reads,
      ).refresh(command.outcome.day, identity);
      return commandObservationSchema.parse({
        ...observation,
        command: { ...command, outcome: { day } },
      });
    }
    if (
      command.kind !== "TASK_CREATE" &&
      command.kind !== "TASK_EDIT" &&
      command.kind !== "TASK_STATUS"
    )
      return observation;
    if (command.outcome.illustration === null) return observation;
    const illustration = await this.reads.metadata(
      identity,
      "TASK_ILLUSTRATION",
      command.outcome.illustration.id,
    );
    return commandObservationSchema.parse({
      state: "OBSERVED",
      command: { ...command, outcome: { ...command.outcome, illustration } },
    });
  }

  private receipt(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    command: {
      kind: TaskCommandIntent["kind"];
      payload: { commandId: string };
    },
  ) {
    return transaction.taskCommandRecord.findUnique({
      where: {
        actorUserId_kind_commandId: {
          actorUserId,
          kind: command.kind,
          commandId: command.payload.commandId,
        },
      },
    });
  }

  private async observed(
    transaction: Prisma.TransactionClient,
    identity: TaskActorIdentity,
    receipt: TaskCommandRecord,
  ): Promise<CommandObservation> {
    await authorizeTaskActor(transaction, identity, {
      role: TASK_COMMAND_ROLES[receipt.kind],
      clock: this.clock,
    });
    if (receipt.terminalState === "CANCELLED")
      return {
        state: "CANCELLED",
        commandId: receipt.commandId,
        kind: receipt.kind,
        cancelledAt: receipt.occurredAt.toISOString(),
      };
    if (TASK_COMMAND_ROLES[receipt.kind] === "USER")
      await this.assertOwnResource(transaction, identity.userId, receipt);
    return commandObservationSchema.parse({
      state: "OBSERVED",
      command: {
        kind: receipt.kind,
        commandId: receipt.commandId,
        targetId: commandTarget(receipt),
        committedAt: receipt.occurredAt.toISOString(),
        outcome: receipt.safeOutcome,
      },
    });
  }

  private async assertOwnResource(
    transaction: Prisma.TransactionClient,
    actorUserId: string,
    receipt: TaskCommandRecord,
  ) {
    const resourceId =
      receipt.kind === "TASK_UNLOCK" ? receipt.taskId : receipt.submissionId;
    if (resourceId === null)
      throw new TypeError("Missing committed command target.");
    const ownResource =
      receipt.kind === "TASK_UNLOCK"
        ? await transaction.taskUnlock.findFirst({
            where: { taskId: resourceId, employeeId: actorUserId },
            select: { id: true },
          })
        : await transaction.taskSubmission.findFirst({
            where: { id: resourceId, employeeId: actorUserId },
            select: { id: true },
          });
    if (ownResource === null) throw new NotFoundException();
  }
}
