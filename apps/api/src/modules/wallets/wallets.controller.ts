import type { Request, Response } from "express";
import { z } from "zod";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import type { WalletsService } from "./wallets.service.js";

export const operationParamsSchema = z
  .object({ operationId: z.uuid() })
  .strict();
export const walletEmployeeParamsSchema = z
  .object({ employeeId: z.uuid() })
  .strict();
export class WalletsController {
  constructor(private readonly service: WalletsService) {}
  wallet = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.wallet(authenticatedSubscriptionIdentity(request)),
      "Wallet loaded.",
      request.path,
      request.requestId,
    );
  employeeWallet = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.employeeWallet(
        authenticatedSubscriptionIdentity(request),
        walletEmployeeParamsSchema.parse(request.validated?.params).employeeId,
      ),
      "Wallet loaded.",
      request.path,
      request.requestId,
    );
  history = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.history(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Ledger loaded.",
      request.path,
      request.requestId,
    );
  finance = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.finance(
        authenticatedSubscriptionIdentity(request),
        request.validated?.query,
      ),
      "Finance loaded.",
      request.path,
      request.requestId,
    );
  detail = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.detail(
        authenticatedSubscriptionIdentity(request),
        operationParamsSchema.parse(request.validated?.params).operationId,
      ),
      "Operation loaded.",
      request.path,
      request.requestId,
    );
  adminDetail = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.service.detail(
        authenticatedSubscriptionIdentity(request),
        operationParamsSchema.parse(request.validated?.params).operationId,
        true,
      ),
      "Operation loaded.",
      request.path,
      request.requestId,
    );
}
