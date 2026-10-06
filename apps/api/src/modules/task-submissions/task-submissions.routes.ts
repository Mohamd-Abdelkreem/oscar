import { Router, type RequestHandler } from "express";
import {
  boundedPageQuerySchema,
  submissionListQuerySchema,
  submissionCreateSchema,
  evidenceReplaceSchema,
  adminSubmissionListQuerySchema,
  submissionReviewSchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import {
  taskActionLimiter,
  privateTaskResponse,
} from "../tasks/tasks.routes.js";
import {
  submissionParamsSchema,
  type TaskSubmissionsController,
} from "./task-submissions.controller.js";

export function adminTaskSubmissionsRoutes(
  controller: TaskSubmissionsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use(authentication, authorizeRoles("ADMIN"), privateTaskResponse);
  router.get(
    "/",
    validationMiddleware({ query: adminSubmissionListQuerySchema }),
    controller.adminList,
  );
  router.get(
    "/:submissionId",
    validationMiddleware({ params: submissionParamsSchema }),
    controller.adminDetail,
  );
  router.get(
    "/:submissionId/evidence",
    validationMiddleware({
      params: submissionParamsSchema,
      query: boundedPageQuerySchema,
    }),
    controller.adminEvidence,
  );
  router.post(
    "/:submissionId/review",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({
      params: submissionParamsSchema,
      body: submissionReviewSchema,
    }),
    controller.review,
  );
  return router;
}

export function taskSubmissionsRoutes(
  controller: TaskSubmissionsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use(authentication, authorizeRoles("USER"), privateTaskResponse);
  router.get(
    "/",
    validationMiddleware({ query: submissionListQuerySchema }),
    controller.list,
  );
  router.post(
    "/",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({ body: submissionCreateSchema }),
    controller.create,
  );
  router.get(
    "/:submissionId",
    validationMiddleware({ params: submissionParamsSchema }),
    controller.detail,
  );
  router.get(
    "/:submissionId/evidence",
    validationMiddleware({
      params: submissionParamsSchema,
      query: boundedPageQuerySchema,
    }),
    controller.evidence,
  );
  router.patch(
    "/:submissionId/evidence",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({
      params: submissionParamsSchema,
      body: evidenceReplaceSchema,
    }),
    controller.replace,
  );
  return router;
}
