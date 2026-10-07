import { Router, type RequestHandler } from "express";
import { uploadCancellationSchema } from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import {
  imageParamsSchema,
  uploadParamsSchema,
  type ProofsController,
} from "./proofs.controller.js";

const actionLimiter = createKeyedAuthRateLimiter(
  { name: "image-action", windowMs: 60_000, max: 30 },
  (request) => sha256(authenticatedSubscriptionIdentity(request).userId),
);

export function proofsRoutes(
  controller: ProofsController,
  authentication: RequestHandler,
  role: "USER" | "ADMIN",
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "private, no-store");
    next();
  });
  router.use(authentication);
  router.post(
    "/",
    authorizeRoles(role),
    csrfMiddleware,
    actionLimiter,
    controller.upload,
  );
  router.get(
    "/uploads/:commandId",
    authorizeRoles(role),
    validationMiddleware({ params: uploadParamsSchema }),
    controller.observe,
  );
  router.post(
    "/uploads/:commandId/cancel",
    authorizeRoles(role),
    csrfMiddleware,
    actionLimiter,
    validationMiddleware({
      params: uploadParamsSchema,
      body: uploadCancellationSchema,
    }),
    controller.cancel,
  );
  // Illustration reads use their separate authenticated task namespace.
  if (role === "USER") {
    router.get(
      "/:assetId",
      validationMiddleware({ params: imageParamsSchema }),
      controller.metadata,
    );
    router.get(
      "/:assetId/content",
      validationMiddleware({ params: imageParamsSchema }),
      controller.content,
    );
  }
  return router;
}
