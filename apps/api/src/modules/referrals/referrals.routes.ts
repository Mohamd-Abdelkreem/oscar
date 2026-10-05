import { Router, type RequestHandler } from "express";
import { z } from "zod";
import {
  employeeMemberFilterSchema,
  adminMemberFilterSchema,
  commissionFilterSchema,
  adminCommissionFilterSchema,
  rootSearchFilterSchema,
} from "@template/contracts";
import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import { validationMiddleware } from "../../middlewares/index.js";
import {
  referralRootParamsSchema,
  type ReferralsController,
} from "./referrals.controller.js";

export function referralsRoutes(
  controller: ReferralsController,
  authentication: RequestHandler,
) {
  const router = Router();
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.get(
    "/referrals/me",
    authentication,
    authorizeRoles("USER"),
    validationMiddleware({ query: z.object({}).strict() }),
    controller.summary,
  );
  router.get(
    "/referrals/me/members",
    authentication,
    authorizeRoles("USER"),
    validationMiddleware({ query: employeeMemberFilterSchema }),
    controller.members,
  );
  router.get(
    "/referrals/me/commissions",
    authentication,
    authorizeRoles("USER"),
    validationMiddleware({ query: commissionFilterSchema }),
    controller.commissions,
  );
  router.get(
    "/admin/referrals/roots",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({ query: rootSearchFilterSchema }),
    controller.roots,
  );
  router.get(
    "/admin/referrals/:rootId",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({
      params: referralRootParamsSchema,
      query: z.object({}).strict(),
    }),
    controller.adminSummary,
  );
  router.get(
    "/admin/referrals/:rootId/members",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({
      params: referralRootParamsSchema,
      query: adminMemberFilterSchema,
    }),
    controller.adminMembers,
  );
  router.get(
    "/admin/referrals/:rootId/commissions",
    authentication,
    authorizeRoles("ADMIN"),
    validationMiddleware({
      params: referralRootParamsSchema,
      query: adminCommissionFilterSchema,
    }),
    controller.adminCommissions,
  );
  return router;
}
