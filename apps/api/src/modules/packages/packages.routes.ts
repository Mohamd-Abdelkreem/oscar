import { Router, type RequestHandler } from "express";
import { packageEditSchema, referralEditSchema } from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import {
  packageParamsSchema,
  configurationParamsSchema,
  type PackagesController,
} from "./packages.controller.js";

export const configurationActionLimiter = createKeyedAuthRateLimiter(
  { name: "configuration-action", windowMs: 60000, max: 30 },
  (request) => sha256(authenticatedSubscriptionIdentity(request).userId),
);

export function packagesRoutes(
  controller: PackagesController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/packages",
    authentication,
    authorizeRoles("USER", "ADMIN"),
    controller.catalog,
  );
  router.get(
    "/admin/packages",
    authentication,
    authorizeRoles("ADMIN"),
    controller.adminCatalog,
  );
  router.patch(
    "/admin/packages/:packageCode",
    authentication,
    authorizeRoles("ADMIN"),
    csrfMiddleware,
    configurationActionLimiter,
    validationMiddleware({
      params: packageParamsSchema,
      body: packageEditSchema,
    }),
    controller.editPackage,
  );
  router.get(
    "/admin/referral-settings",
    authentication,
    authorizeRoles("ADMIN"),
    controller.referralSettings,
  );
  router.patch(
    "/admin/referral-settings",
    authentication,
    authorizeRoles("ADMIN"),
    csrfMiddleware,
    configurationActionLimiter,
    validationMiddleware({ body: referralEditSchema }),
    controller.editReferrals,
  );
  router.get(
    "/admin/configuration-changes/:commandId",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({ params: configurationParamsSchema }),
    controller.configurationOutcome,
  );
  return router;
}
