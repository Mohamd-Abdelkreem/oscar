import type { Request, Response } from "express";
import { z } from "zod";
import {
  taskCommandKindSchema,
  taskCommandCancellationSchema,
  type CommandObservation,
} from "@template/contracts";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import type { TasksService } from "./tasks.service.js";
import type { TaskPublicationService } from "./task-publication.service.js";
import type { TaskCommandService } from "./task-command.service.js";
import type { EmployeeTasksService } from "./employee-tasks.service.js";
import type { TaskUnlockService } from "../task-codes/task-unlock.service.js";

export const taskParamsSchema = z.strictObject({ taskId: z.uuid() });
export const taskCommandParamsSchema = z.strictObject({ commandId: z.uuid() });
export const taskCommandQuerySchema = z.strictObject({
  kind: taskCommandKindSchema,
});
export const taskDayQuerySchema = z.strictObject({});

export class EmployeeTasksController {
  constructor(
    private readonly days: EmployeeTasksService,
    private readonly unlocks: TaskUnlockService,
  ) {}
  today = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.days.today(authenticatedSubscriptionIdentity(request)),
      "Task day loaded.",
      request.path,
      request.requestId,
    );
  unlock = async (request: Request, response: Response) => {
    const { taskId } = taskParamsSchema.parse(request.validated?.params);
    return sendTaskCommand(
      response,
      request,
      await this.unlocks.unlock(
        authenticatedSubscriptionIdentity(request),
        taskId,
        request.validated?.body,
      ),
    );
  };
}

export function sendTaskCommand(
  response: Response,
  request: Request,
  receipt: { observation: CommandObservation; replayed: boolean },
  creationStatus = 200,
) {
  if (receipt.observation.state !== "OBSERVED")
    throw new TypeError("Command execution requires a committed outcome.");
  return ResponseHelper.success(
    response,
    receipt.observation.command.outcome,
    "Command saved.",
    receipt.replayed ? 200 : creationStatus,
    request.path,
    request.requestId,
  );
}

export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly publications: TaskPublicationService,
    private readonly commands: TaskCommandService,
  ) {}
  list = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.tasks.list(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Tasks loaded.",
      request.path,
      request.requestId,
    );
  detail = async (request: Request, response: Response) => {
    const { taskId } = taskParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.tasks.detail(
        authenticatedSubscriptionIdentity(request),
        taskId,
      ),
      "Task loaded.",
      request.path,
      request.requestId,
    );
  };
  create = async (request: Request, response: Response) =>
    sendTaskCommand(
      response,
      request,
      await this.publications.create(
        authenticatedSubscriptionIdentity(request),
        request.validated?.body,
      ),
      201,
    );
  edit = async (request: Request, response: Response) => {
    const { taskId } = taskParamsSchema.parse(request.validated?.params);
    return sendTaskCommand(
      response,
      request,
      await this.publications.edit(
        authenticatedSubscriptionIdentity(request),
        taskId,
        request.validated?.body,
      ),
    );
  };
  status = async (request: Request, response: Response) => {
    const { taskId } = taskParamsSchema.parse(request.validated?.params);
    return sendTaskCommand(
      response,
      request,
      await this.publications.status(
        authenticatedSubscriptionIdentity(request),
        taskId,
        request.validated?.body,
      ),
    );
  };
  observe = async (request: Request, response: Response) => {
    const { commandId } = taskCommandParamsSchema.parse(
      request.validated?.params,
    );
    const { kind } = taskCommandQuerySchema.parse(request.validated?.query);
    return ResponseHelper.ok(
      response,
      await this.commands.observe(
        { commandId, kind },
        authenticatedSubscriptionIdentity(request),
      ),
      "Command observed.",
      request.path,
      request.requestId,
    );
  };
  cancel = async (request: Request, response: Response) => {
    const { commandId } = taskCommandParamsSchema.parse(
      request.validated?.params,
    );
    const body = taskCommandCancellationSchema.parse(request.validated?.body);
    return ResponseHelper.ok(
      response,
      await this.commands.cancel(
        { ...body, commandId },
        authenticatedSubscriptionIdentity(request),
      ),
      "Command resolved.",
      request.path,
      request.requestId,
    );
  };
}
