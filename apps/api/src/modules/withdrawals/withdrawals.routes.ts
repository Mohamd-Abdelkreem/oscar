import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  withdrawalDestinationBodySchema,
  withdrawalResendBodySchema,
  withdrawalConsumeBodySchema,
  withdrawalQuoteBodySchema,
  withdrawalAcceptBodySchema,
  withdrawalFilterSchema,
  adminWithdrawalFilterSchema,
  withdrawalParamsSchema,
  withdrawalQuoteParamsSchema,
  financialRequestKeySchema,
  withdrawalExtensionBodySchema,
  withdrawalRejectionBodySchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { ValidationException } from "../../core/errors/index.js";
import {
  withdrawalSession,
  type WithdrawalsController,
} from "./withdrawals.controller.js";

const emptyQuery = z.object({}).strict();
const withdrawalLimiter = createKeyedAuthRateLimiter(
  { name: "withdrawal-acceptance", windowMs: 60000, max: 30 },
  (request) => sha256(withdrawalSession(request).userId),
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
const destinationLimiter = createKeyedAuthRateLimiter(
  { name: "withdrawal-destination", windowMs: 60000, max: 30 },
  (request) => sha256(withdrawalSession(request).userId),
);

export function withdrawalsRoutes(
  controller: WithdrawalsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(authentication, authorizeRoles("USER"));
  router.get(
    "/me",
    validationMiddleware({ query: emptyQuery, body: emptyQuery.optional() }),
    controller.status,
  );
  router.post(
    "/quotes",
    csrfMiddleware,
    withdrawalLimiter,
    validationMiddleware({
      body: withdrawalQuoteBodySchema,
      query: emptyQuery,
    }),
    controller.createQuote,
  );
  router.get(
    "/quotes/:quoteId/outcome",
    validationMiddleware({
      params: withdrawalQuoteParamsSchema,
      query: emptyQuery,
      body: emptyQuery.optional(),
    }),
    controller.outcome,
  );
  router.post(
    "/",
    csrfMiddleware,
    withdrawalLimiter,
    validateRequestKey,
    validationMiddleware({
      body: withdrawalAcceptBodySchema,
      query: emptyQuery,
    }),
    controller.accept,
  );
  router.get(
    "/",
    validationMiddleware({
      query: withdrawalFilterSchema,
      body: emptyQuery.optional(),
    }),
    controller.history,
  );
  router.get(
    "/me/destination",
    validationMiddleware({ query: emptyQuery, body: emptyQuery.optional() }),
    controller.destination,
  );
  router.post(
    "/me/destination/confirmations",
    csrfMiddleware,
    destinationLimiter,
    validationMiddleware({
      body: withdrawalDestinationBodySchema,
      query: emptyQuery,
    }),
    controller.issueDestination,
  );
  router.post(
    "/me/destination/resend",
    csrfMiddleware,
    destinationLimiter,
    validationMiddleware({
      body: withdrawalResendBodySchema,
      query: emptyQuery,
    }),
    controller.resendDestination,
  );
  router.post(
    "/me/destination/consume",
    csrfMiddleware,
    destinationLimiter,
    validationMiddleware({
      body: withdrawalConsumeBodySchema,
      query: emptyQuery,
    }),
    controller.consumeDestination,
  );
  router.get(
    "/:withdrawalId",
    validationMiddleware({
      params: withdrawalParamsSchema,
      query: emptyQuery,
      body: emptyQuery.optional(),
    }),
    controller.detail,
  );
  return router;
}

export function adminWithdrawalsRoutes(
  controller: WithdrawalsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(authentication, authorizeRoles("ADMIN"));
  router.post(
    "/:withdrawalId/extensions",
    csrfMiddleware,
    withdrawalLimiter,
    validateRequestKey,
    validationMiddleware({
      params: withdrawalParamsSchema,
      query: emptyQuery,
      body: withdrawalExtensionBodySchema,
    }),
    controller.extend,
  );
  router.post(
    "/:withdrawalId/rejections",
    csrfMiddleware,
    withdrawalLimiter,
    validateRequestKey,
    validationMiddleware({
      params: withdrawalParamsSchema,
      query: emptyQuery,
      body: withdrawalRejectionBodySchema,
    }),
    controller.reject,
  );
  router.get(
    "/",
    validationMiddleware({
      query: adminWithdrawalFilterSchema,
      body: emptyQuery.optional(),
    }),
    controller.adminHistory,
  );
  router.get(
    "/:withdrawalId",
    validationMiddleware({
      params: withdrawalParamsSchema,
      query: emptyQuery,
      body: emptyQuery.optional(),
    }),
    controller.adminDetail,
  );
  return router;
}
