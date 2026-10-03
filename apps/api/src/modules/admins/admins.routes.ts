import {
  employeeRestrictionsBodySchema,
  identityUserParamsSchema,
  identityListQuerySchema,
  adminStatusBodySchema,
  adminInvitationParamsSchema,
  adminInvitationIssueBodySchema,
  adminInvitationCommandBodySchema,
} from "@template/contracts";
import { Router, type RequestHandler, type Request } from "express";

import { authorizeRoles } from "../../middlewares/authorization.middleware.js";
import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { createKeyedAuthRateLimiter } from "../../middlewares/rate-limit.middleware.js";
import { authRouteLimits } from "../../core/config/auth-rate-limit.config.js";
import { InternalServerError } from "../../core/errors/internal-server.error.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import type { AdminsController } from "./admins.controller.js";

export const adminControlRateLimiter = createKeyedAuthRateLimiter(
  authRouteLimits.adminControlActor,
  (request) => {
    if (request.authSession === undefined)
      throw new InternalServerError(
        "Authenticated session context is required.",
      );
    return sha256(request.authSession.userId);
  },
);

const actorKey = (request: Parameters<typeof adminControlRateLimiter>[0]) => {
  if (request.authSession === undefined)
    throw new InternalServerError("Authenticated session context is required.");
  return sha256(request.authSession.userId);
};
export const adminInvitationActorLimiter = createKeyedAuthRateLimiter(
  authRouteLimits.invitationActor,
  actorKey,
);
const recipientKeys = new WeakMap<Request, string>();
export const adminInvitationRecipientLimiter = createKeyedAuthRateLimiter(
  authRouteLimits.invitationRecipient,
  (request) => {
    const recipientKey = recipientKeys.get(request);
    if (recipientKey !== undefined) return recipientKey;
    if (request.validated?.body === undefined) throw new InternalServerError();
    return sha256((request.validated.body as { email: string }).email);
  },
);

export function adminsRoutes(
  controller: AdminsController,
  authentication: RequestHandler,
): Router {
  const router = Router();
  const reissueRecipientLimit: RequestHandler = async (
    request,
    response,
    next,
  ) => {
    const recipient = await controller.invitationRecipient(request);
    recipientKeys.set(request, sha256(recipient));
    adminInvitationRecipientLimiter(request, response, next);
  };
  router.use((_request, response, next) => {
    response.setHeader("Cache-Control", "no-store");
    next();
  });
  router.use(authentication, authorizeRoles("ADMIN"));
  router.get(
    "/admins",
    validationMiddleware({ query: identityListQuerySchema }),
    controller.listAdmins,
  );
  router.get(
    "/admins/:userId",
    validationMiddleware({ params: identityUserParamsSchema }),
    controller.getAdmin,
  );
  router.patch(
    "/admins/:userId/status",
    csrfMiddleware,
    adminControlRateLimiter,
    validationMiddleware({
      params: identityUserParamsSchema,
      body: adminStatusBodySchema,
    }),
    controller.updateAdminStatus,
  );
  router.get(
    "/invitations",
    validationMiddleware({ query: identityListQuerySchema }),
    controller.listInvitations,
  );
  router.get(
    "/invitations/:invitationId",
    validationMiddleware({ params: adminInvitationParamsSchema }),
    controller.getInvitation,
  );
  router.post(
    "/invitations",
    csrfMiddleware,
    adminInvitationActorLimiter,
    validationMiddleware({ body: adminInvitationIssueBodySchema }),
    adminInvitationRecipientLimiter,
    controller.issueInvitation,
  );
  router.post(
    "/invitations/:invitationId/reissue",
    csrfMiddleware,
    adminInvitationActorLimiter,
    validationMiddleware({
      params: adminInvitationParamsSchema,
      body: adminInvitationCommandBodySchema,
    }),
    reissueRecipientLimit,
    controller.reissueInvitation,
  );
  router.post(
    "/invitations/:invitationId/revoke",
    csrfMiddleware,
    adminControlRateLimiter,
    validationMiddleware({
      params: adminInvitationParamsSchema,
      body: adminInvitationCommandBodySchema,
    }),
    controller.revokeInvitation,
  );
  router.get(
    "/employees/:userId/restrictions",
    validationMiddleware({ params: identityUserParamsSchema }),
    controller.getEmployeeRestrictions,
  );
  router.patch(
    "/employees/:userId/restrictions",
    csrfMiddleware,
    adminControlRateLimiter,
    validationMiddleware({
      params: identityUserParamsSchema,
      body: employeeRestrictionsBodySchema,
    }),
    controller.updateEmployeeRestrictions,
  );
  return router;
}
