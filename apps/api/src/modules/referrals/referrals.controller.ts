import type { Request, Response } from "express";
import { z } from "zod";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import type { ReferralsService } from "./referrals.service.js";

export const referralRootParamsSchema = z.object({ rootId: z.uuid() }).strict();
export class ReferralsController {
  constructor(private readonly service: ReferralsService) {}
  summary = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.summary(authenticatedSubscriptionIdentity(request)),
      "Team loaded.",
      request.path,
      request.requestId,
    );
  members = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.members(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Members loaded.",
      request.path,
      request.requestId,
    );
  commissions = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.commissions(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Commissions loaded.",
      request.path,
      request.requestId,
    );
  roots = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.roots(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Roots loaded.",
      request.path,
      request.requestId,
    );
  adminSummary = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.summary(
        authenticatedSubscriptionIdentity(request),
        referralRootParamsSchema.parse(request.validated?.params).rootId,
      ),
      "Team loaded.",
      request.path,
      request.requestId,
    );
  adminMembers = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.members(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
        referralRootParamsSchema.parse(request.validated?.params).rootId,
      ),
      "Members loaded.",
      request.path,
      request.requestId,
    );
  adminCommissions = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.commissions(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
        referralRootParamsSchema.parse(request.validated?.params).rootId,
      ),
      "Commissions loaded.",
      request.path,
      request.requestId,
    );
}
