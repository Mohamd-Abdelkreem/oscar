import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  ledgerFilterSchema,
  adminLedgerFilterSchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import { validationMiddleware } from "../../middlewares/index.js";
import {
  operationParamsSchema,
  walletEmployeeParamsSchema,
  type WalletsController,
} from "./wallets.controller.js";

export function walletsRoutes(
  controller: WalletsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/wallet/me",
    authentication,
    authorizeRoles("USER"),
    validationMiddleware({ query: z.object({}).strict() }),
    controller.wallet,
  );
  router.get(
    "/wallet/me/ledger",
    authentication,
    authorizeRoles("USER"),
    validationMiddleware({ query: ledgerFilterSchema }),
    controller.history,
  );
  router.get(
    "/wallet/me/ledger/:operationId",
    authentication,
    authorizeRoles("USER"),
    validationMiddleware({
      params: operationParamsSchema,
      query: z.object({}).strict(),
    }),
    controller.detail,
  );
  router.get(
    "/admin/wallets/:employeeId",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({
      params: walletEmployeeParamsSchema,
      query: z.object({}).strict(),
    }),
    controller.employeeWallet,
  );
  router.get(
    "/admin/finance",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({ query: adminLedgerFilterSchema }),
    controller.finance,
  );
  router.get(
    "/admin/finance/:operationId",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({
      params: operationParamsSchema,
      query: z.object({}).strict(),
    }),
    controller.adminDetail,
  );
  return router;
}
