import { Router, type RequestHandler } from "express";
import {
  boundedPageQuerySchema,
  taskCodeCreateSchema,
  taskCodeStatusSchema,
  taskCodeListQuerySchema,
  taskCodeUsageQuerySchema,
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
  taskCodeParamsSchema,
  type TaskCodesController,
} from "./task-codes.controller.js";

export function taskCodesRoutes(
  controller: TaskCodesController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use(authentication, authorizeRoles("ADMIN"), privateTaskResponse);
  router.get(
    "/",
    validationMiddleware({ query: taskCodeListQuerySchema }),
    controller.list,
  );
  router.post(
    "/",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({ body: taskCodeCreateSchema }),
    controller.create,
  );
  router.get(
    "/:codeId",
    validationMiddleware({ params: taskCodeParamsSchema }),
    controller.detail,
  );
  router.patch(
    "/:codeId/status",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({
      params: taskCodeParamsSchema,
      body: taskCodeStatusSchema,
    }),
    controller.status,
  );
  router.get(
    "/:codeId/usages",
    validationMiddleware({
      params: taskCodeParamsSchema,
      query: taskCodeUsageQuerySchema,
    }),
    controller.usages,
  );
  router.get(
    "/:codeId/changes",
    validationMiddleware({
      params: taskCodeParamsSchema,
      query: boundedPageQuerySchema,
    }),
    controller.changes,
  );
  return router;
}
