import { z } from "zod";
import type { Request, Response } from "express";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { AppError } from "../../core/errors/app.error.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import { sendTaskCommand } from "../tasks/tasks.controller.js";
import type { TaskSubmissionsService } from "./task-submissions.service.js";
import type { TaskSubmissionsQueries } from "./task-submissions.queries.js";
import type { SubmissionEvidenceService } from "./submission-evidence.service.js";
import type { TaskReviewService } from "./task-review.service.js";

export const submissionParamsSchema = z.strictObject({
  submissionId: z.uuid(),
});
export class TaskSubmissionsController {
  constructor(
    private readonly submissions: TaskSubmissionsService,
    private readonly queries: TaskSubmissionsQueries,
    private readonly replacements?: SubmissionEvidenceService,
    private readonly reviews?: TaskReviewService,
  ) {}
  create = async (request: Request, response: Response) =>
    sendTaskCommand(
      response,
      request,
      await this.submissions.create(
        authenticatedSubscriptionIdentity(request),
        request.validated?.body,
      ),
      201,
    );
  adminList = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.queries.adminList(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Submissions loaded.",
      request.path,
      request.requestId,
    );
  adminDetail = async (request: Request, response: Response) => {
    const { submissionId } = submissionParamsSchema.parse(
      request.validated?.params,
    );
    return ResponseHelper.ok(
      response,
      await this.queries.adminDetail(
        authenticatedSubscriptionIdentity(request),
        submissionId,
      ),
      "Submission loaded.",
      request.path,
      request.requestId,
    );
  };
  adminEvidence = async (request: Request, response: Response) => {
    const { submissionId } = submissionParamsSchema.parse(
      request.validated?.params,
    );
    return ResponseHelper.ok(
      response,
      await this.queries.evidence(
        authenticatedSubscriptionIdentity(request),
        submissionId,
        request.validated?.query,
        "ADMIN",
      ),
      "Evidence loaded.",
      request.path,
      request.requestId,
    );
  };
  review = async (request: Request, response: Response) => {
    const { submissionId } = submissionParamsSchema.parse(
      request.validated?.params,
    );
    if (this.reviews === undefined)
      throw new AppError("Review is unavailable.", 503, "SERVICE_UNAVAILABLE");
    const observation = await this.reviews.review(
      authenticatedSubscriptionIdentity(request),
      submissionId,
      request.validated?.body,
    );
    return sendTaskCommand(response, request, { observation, replayed: false });
  };
  list = async (request: Request, response: Response) => {
    const page = await this.queries.list(
      authenticatedSubscriptionIdentity(request),
      request.validated?.query,
    );
    return ResponseHelper.ok(
      response,
      page,
      "Submissions loaded.",
      request.path,
      request.requestId,
    );
  };
  detail = async (request: Request, response: Response) => {
    const { submissionId } = submissionParamsSchema.parse(
      request.validated?.params,
    );
    return ResponseHelper.ok(
      response,
      await this.queries.detail(
        authenticatedSubscriptionIdentity(request),
        submissionId,
      ),
      "Submission loaded.",
      request.path,
      request.requestId,
    );
  };
  evidence = async (request: Request, response: Response) => {
    const { submissionId } = submissionParamsSchema.parse(
      request.validated?.params,
    );
    const page = await this.queries.evidence(
      authenticatedSubscriptionIdentity(request),
      submissionId,
      request.validated?.query,
    );
    return ResponseHelper.ok(
      response,
      page,
      "Evidence loaded.",
      request.path,
      request.requestId,
    );
  };
  replace = async (request: Request, response: Response) => {
    const { submissionId } = submissionParamsSchema.parse(
      request.validated?.params,
    );
    if (this.replacements === undefined)
      throw new AppError(
        "Private storage is unavailable.",
        503,
        "STORAGE_UNAVAILABLE",
      );
    const observation = await this.replacements.replace(
      authenticatedSubscriptionIdentity(request),
      submissionId,
      request.validated?.body,
    );
    return sendTaskCommand(response, request, { observation, replayed: false });
  };
}
