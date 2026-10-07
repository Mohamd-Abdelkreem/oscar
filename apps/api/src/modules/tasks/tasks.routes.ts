import { Router, type RequestHandler } from "express";
import {
  taskCreateSchema,
  taskEditSchema,
  taskStatusSchema,
  taskListQuerySchema,
  taskCommandCancellationSchema,
  taskUnlockRequestSchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import {
  taskParamsSchema,
  taskCommandParamsSchema,
  taskCommandQuerySchema,
  type TasksController,
  type EmployeeTasksController,
  taskDayQuerySchema,
} from "./tasks.controller.js";

export function employeeTasksRoutes(
  controller: EmployeeTasksController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use(authentication, authorizeRoles("USER"), privateTaskResponse);
  router.get(
    "/today",
    validationMiddleware({ query: taskDayQuerySchema }),
    controller.today,
  );
  router.post(
    "/:taskId/unlock",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({
      params: taskParamsSchema,
      body: taskUnlockRequestSchema,
    }),
    controller.unlock,
  );
  return router;
}

export const taskActionLimiter = createKeyedAuthRateLimiter(
  { name: "task-action", windowMs: 60_000, max: 30 },
  (request) => sha256(authenticatedSubscriptionIdentity(request).userId),
);
export const privateTaskResponse: RequestHandler = (
  _request,
  response,
  next,
) => {
  response.setHeader("Cache-Control", "private, no-store");
  next();
};

export function tasksRoutes(
  controller: TasksController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use(authentication, authorizeRoles("ADMIN"), privateTaskResponse);
  router.get(
    "/",
    validationMiddleware({ query: taskListQuerySchema }),
    controller.list,
  );
  router.post(
    "/",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({ body: taskCreateSchema }),
    controller.create,
  );
  router.get(
    "/:taskId",
    validationMiddleware({ params: taskParamsSchema }),
    controller.detail,
  );
  router.patch(
    "/:taskId",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({ params: taskParamsSchema, body: taskEditSchema }),
    controller.edit,
  );
  router.patch(
    "/:taskId/status",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({ params: taskParamsSchema, body: taskStatusSchema }),
    controller.status,
  );
  return router;
}

export function taskCommandRoutes(
  controller: TasksController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use(
    authentication,
    authorizeRoles("USER", "ADMIN"),
    privateTaskResponse,
  );
  router.get(
    "/:commandId",
    validationMiddleware({
      params: taskCommandParamsSchema,
      query: taskCommandQuerySchema,
    }),
    controller.observe,
  );
  router.post(
    "/:commandId/cancel",
    csrfMiddleware,
    taskActionLimiter,
    validationMiddleware({
      params: taskCommandParamsSchema,
      body: taskCommandCancellationSchema,
    }),
    controller.cancel,
  );
  return router;
}
