import { Router, type RequestHandler } from "express";
import {
  boundedPageQuerySchema,
  confirmedPurchaseBodySchema,
  financialRequestKeySchema,
  purchaseQuoteBodySchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { ValidationException } from "../../core/errors/index.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import {
  authenticatedSubscriptionIdentity,
  purchaseParamsSchema,
  quoteParamsSchema,
  employeeMembershipParamsSchema,
  type SubscriptionsController,
} from "./subscriptions.controller.js";

export const purchaseActionLimiter = createKeyedAuthRateLimiter(
  { name: "purchase-action", windowMs: 60000, max: 30 },
  (request) => sha256(authenticatedSubscriptionIdentity(request).userId),
);
const validateRequestKey: RequestHandler = (request, _response, next) => {
  const key = request.get("Idempotency-Key");
  if (key !== undefined && !financialRequestKeySchema.safeParse(key).success)
    throw new ValidationException([
      {
        field: "headers.idempotency-key",
        message: "Invalid financial request key.",
      },
    ]);
  next();
};

export function subscriptionsRoutes(
  controller: SubscriptionsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(authentication, authorizeRoles("USER"));
  router.get("/me", controller.membership);
  router.get(
    "/me/history",
    validationMiddleware({ query: boundedPageQuerySchema }),
    controller.subscriptionHistory,
  );
  router.post(
    "/purchase-quotes",
    csrfMiddleware,
    purchaseActionLimiter,
    validationMiddleware({ body: purchaseQuoteBodySchema }),
    controller.createQuote,
  );
  router.get(
    "/purchase-quotes/:quoteId/outcome",
    validationMiddleware({ params: quoteParamsSchema }),
    controller.outcome,
  );
  router.post(
    "/purchases",
    csrfMiddleware,
    purchaseActionLimiter,
    validateRequestKey,
    validationMiddleware({ body: confirmedPurchaseBodySchema }),
    controller.purchase,
  );
  router.get(
    "/purchases",
    validationMiddleware({ query: boundedPageQuerySchema }),
    controller.history,
  );
  router.get(
    "/purchases/:purchaseId",
    validationMiddleware({ params: purchaseParamsSchema }),
    controller.detail,
  );
  return router;
}

export function adminSubscriptionsRoutes(
  controller: SubscriptionsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(authentication, authorizeRoles("ADMIN"));
  router.get(
    "/:employeeId",
    validationMiddleware({ params: employeeMembershipParamsSchema }),
    controller.employeeMembership,
  );
  return router;
}
