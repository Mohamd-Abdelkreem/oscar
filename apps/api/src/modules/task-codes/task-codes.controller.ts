import type { Request, Response } from "express";
import { z } from "zod";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import { sendTaskCommand } from "../tasks/tasks.controller.js";
import type { TaskCodesService } from "./task-codes.service.js";
import type { TaskCodesQueries } from "./task-codes.queries.js";

export const taskCodeParamsSchema = z.strictObject({ codeId: z.uuid() });
export class TaskCodesController {
  constructor(
    private readonly codes: TaskCodesService,
    private readonly queries: TaskCodesQueries,
  ) {}
  create = async (request: Request, response: Response) =>
    sendTaskCommand(
      response,
      request,
      await this.codes.create(
        authenticatedSubscriptionIdentity(request),
        request.validated?.body,
      ),
      201,
    );
  status = async (request: Request, response: Response) => {
    const { codeId } = taskCodeParamsSchema.parse(request.validated?.params);
    return sendTaskCommand(
      response,
      request,
      await this.codes.status(
        authenticatedSubscriptionIdentity(request),
        codeId,
        request.validated?.body,
      ),
    );
  };
  list = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.queries.list(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Codes loaded.",
      request.path,
      request.requestId,
    );
  detail = async (request: Request, response: Response) => {
    const { codeId } = taskCodeParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.queries.detail(
        authenticatedSubscriptionIdentity(request),
        codeId,
      ),
      "Code loaded.",
      request.path,
      request.requestId,
    );
  };
  usages = async (request: Request, response: Response) => {
    const { codeId } = taskCodeParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.queries.usages(
        authenticatedSubscriptionIdentity(request),
        codeId,
        request.validated?.query,
      ),
      "Successful usages loaded.",
      request.path,
      request.requestId,
    );
  };
  changes = async (request: Request, response: Response) => {
    const { codeId } = taskCodeParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.queries.changes(
        authenticatedSubscriptionIdentity(request),
        codeId,
        request.validated?.query,
      ),
      "Code audit loaded.",
      request.path,
      request.requestId,
    );
  };
}
