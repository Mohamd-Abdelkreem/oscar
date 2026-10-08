import type {
  EmployeeRestrictionsBody,
  IdentityListQuery,
  ManualCreditTargetsQuery,
  AdminStatusBody,
  AdminInvitationIssueBody,
  AdminInvitationCommandBody,
} from "@template/contracts";
import type { Request, Response } from "express";

import { InternalServerError } from "../../core/errors/internal-server.error.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import type { EmployeeRestrictionsService } from "../users/employee-restrictions.service.js";
import type { AdminsService } from "./admins.service.js";
import type { AdminLifecycleService } from "./admin-lifecycle.service.js";
import type { AdminInvitationsService } from "./admin-invitations.service.js";

export class AdminsController {
  constructor(
    private readonly restrictions: EmployeeRestrictionsService,
    private readonly admins: AdminsService,
    private readonly lifecycle: AdminLifecycleService,
    private readonly invitations: AdminInvitationsService,
  ) {}

  private actor(request: Request) {
    if (request.authSession === undefined)
      throw new InternalServerError(
        "Authenticated session context is required.",
      );
    return request.authSession;
  }
  invitationRecipient = async (request: Request): Promise<string> => {
    const { invitationId } = request.validated?.params as {
      invitationId: string;
    };
    return (await this.admins.getInvitation(this.actor(request), invitationId))
      .email;
  };

  listAdmins = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const admins = await this.admins.listAdmins(
      this.actor(request),
      request.validated?.query as IdentityListQuery,
    );
    return ResponseHelper.ok(
      response,
      admins,
      "Administrators loaded.",
      request.path,
      request.requestId,
    );
  };
  listManualCreditTargets = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const targets = await this.admins.listManualCreditTargets(
      this.actor(request),
      request.validated?.query as ManualCreditTargetsQuery,
    );
    return ResponseHelper.ok(
      response,
      targets,
      "Manual credit targets loaded.",
      request.path,
      request.requestId,
    );
  };
  getAdmin = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { userId } = request.validated?.params as { userId: string };
    const admin = await this.admins.getAdmin(this.actor(request), userId);
    return ResponseHelper.ok(
      response,
      { admin },
      "Administrator loaded.",
      request.path,
      request.requestId,
    );
  };
  updateAdminStatus = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { userId } = request.validated?.params as { userId: string };
    const admin = await this.lifecycle.updateStatus(
      this.actor(request),
      userId,
      request.validated?.body as AdminStatusBody,
    );
    return ResponseHelper.ok(
      response,
      { admin },
      "Administrator status updated.",
      request.path,
      request.requestId,
    );
  };
  listInvitations = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const invitations = await this.admins.listInvitations(
      this.actor(request),
      request.validated?.query as IdentityListQuery,
    );
    return ResponseHelper.ok(
      response,
      invitations,
      "Invitations loaded.",
      request.path,
      request.requestId,
    );
  };
  getInvitation = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { invitationId } = request.validated?.params as {
      invitationId: string;
    };
    const invitation = await this.admins.getInvitation(
      this.actor(request),
      invitationId,
    );
    return ResponseHelper.ok(
      response,
      { invitation },
      "Invitation loaded.",
      request.path,
      request.requestId,
    );
  };
  issueInvitation = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const invitation = await this.invitations.issue(
      this.actor(request),
      request.validated?.body as AdminInvitationIssueBody,
    );
    return ResponseHelper.created(
      response,
      { invitation },
      "Invitation issued.",
      request.path,
      request.requestId,
    );
  };
  reissueInvitation = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { invitationId } = request.validated?.params as {
      invitationId: string;
    };
    const invitation = await this.invitations.reissue(
      this.actor(request),
      invitationId,
      request.validated?.body as AdminInvitationCommandBody,
    );
    return ResponseHelper.ok(
      response,
      { invitation },
      "Invitation reissued.",
      request.path,
      request.requestId,
    );
  };
  revokeInvitation = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const { invitationId } = request.validated?.params as {
      invitationId: string;
    };
    const invitation = await this.invitations.revoke(
      this.actor(request),
      invitationId,
      request.validated?.body as AdminInvitationCommandBody,
    );
    return ResponseHelper.ok(
      response,
      { invitation },
      "Invitation revoked.",
      request.path,
      request.requestId,
    );
  };

  getEmployeeRestrictions = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    if (request.authSession === undefined)
      throw new InternalServerError(
        "Authenticated session context is required.",
      );
    const { userId } = request.validated?.params as { userId: string };
    const employee = await this.restrictions.getRestrictions(
      request.authSession,
      userId,
    );
    return ResponseHelper.ok(
      response,
      { employee },
      "Employee controls loaded.",
      request.path,
      request.requestId,
    );
  };

  updateEmployeeRestrictions = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    if (request.authSession === undefined)
      throw new InternalServerError(
        "Authenticated session context is required.",
      );
    const { userId } = request.validated?.params as { userId: string };
    const command = request.validated?.body as EmployeeRestrictionsBody;
    const employee = await this.restrictions.updateRestrictions(
      request.authSession,
      userId,
      command,
    );
    return ResponseHelper.ok(
      response,
      { employee },
      "Employee controls updated.",
      request.path,
      request.requestId,
    );
  };
}
