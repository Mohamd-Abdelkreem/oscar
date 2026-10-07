import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  depositProvisionRequestSchema,
  depositHistoryQuerySchema,
  adminDepositHistoryQuerySchema,
  manualCreditBodySchema,
  manualCreditParamsSchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import {
  depositSession,
  type DepositsController,
} from "./deposits.controller.js";

const depositActionLimiter = createKeyedAuthRateLimiter(
  { name: "deposit-action", windowMs: 60000, max: 30 },
  (request) => sha256(depositSession(request).userId),
);
function protectedDepositRouter(
  authentication: RequestHandler,
  role: "USER" | "ADMIN",
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(authentication, authorizeRoles(role));
  return router;
}
const emptyQuery = z.object({}).strict();
export function depositsRoutes(
  controller: DepositsController,
  authentication: RequestHandler,
) {
  const router = protectedDepositRouter(authentication, "USER");
  router.get(
    "/me/address",
    validationMiddleware({ query: emptyQuery }),
    controller.address,
  );
  router.post(
    "/me/address",
    csrfMiddleware,
    depositActionLimiter,
    validationMiddleware({
      body: depositProvisionRequestSchema,
      query: emptyQuery,
    }),
    controller.provision,
  );
  router.get(
    "/me/history",
    validationMiddleware({ query: depositHistoryQuerySchema }),
    controller.history,
  );
  return router;
}
export function adminDepositsRoutes(
  controller: DepositsController,
  authentication: RequestHandler,
) {
  const router = protectedDepositRouter(authentication, "ADMIN");
  router.get(
    "/",
    validationMiddleware({ query: adminDepositHistoryQuerySchema }),
    controller.adminHistory,
  );
  router.post(
    "/manual-credits",
    csrfMiddleware,
    depositActionLimiter,
    validationMiddleware({ body: manualCreditBodySchema, query: emptyQuery }),
    controller.credit,
  );
  router.get(
    "/manual-credits/:actionId",
    validationMiddleware({
      params: manualCreditParamsSchema,
      query: emptyQuery,
    }),
    controller.outcome,
  );
  return router;
}
