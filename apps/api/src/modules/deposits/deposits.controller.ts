import type { Request, Response } from "express";
import { manualCreditParamsSchema } from "@template/contracts";
import { InternalServerError } from "../../core/errors/index.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import type { DepositsService } from "./deposits.service.js";
import type { ManualCreditService } from "./manual-credit.service.js";

export function depositSession(request: Request) {
  if (request.authSession === undefined)
    throw new InternalServerError("Authenticated session context is required.");
  return request.authSession;
}
export class DepositsController {
  constructor(
    private readonly deposits: DepositsService,
    private readonly grants: ManualCreditService,
  ) {}
  address = async (request: Request, response: Response) => {
    const projection = await this.deposits.address(
      depositSession(request),
      false,
    );
    return ResponseHelper.ok(
      response,
      projection,
      "Deposit address loaded.",
      request.path,
      request.requestId,
    );
  };
  provision = async (request: Request, response: Response) => {
    const projection = await this.deposits.address(
      depositSession(request),
      true,
    );
    return ResponseHelper.success(
      response,
      projection,
      "Deposit address request recorded.",
      projection.state === "READY" ? 200 : 202,
      request.path,
      request.requestId,
    );
  };
  history = async (request: Request, response: Response) => {
    const history = await this.deposits.history(
      depositSession(request),
      request.validated?.query,
      false,
    );
    return ResponseHelper.ok(
      response,
      history,
      "Deposit history loaded.",
      request.path,
      request.requestId,
    );
  };
  adminHistory = async (request: Request, response: Response) => {
    const history = await this.deposits.history(
      depositSession(request),
      request.validated?.query,
      true,
    );
    return ResponseHelper.ok(
      response,
      history,
      "Deposit history loaded.",
      request.path,
      request.requestId,
    );
  };
  credit = async (request: Request, response: Response) => {
    const outcome = await this.grants.create(
      depositSession(request),
      request.validated?.body,
      request.get("Idempotency-Key"),
    );
    return ResponseHelper.success(
      response,
      outcome,
      "Manual credit recorded.",
      outcome.replayed ? 200 : 201,
      request.path,
      request.requestId,
    );
  };
  outcome = async (request: Request, response: Response) => {
    const { actionId } = manualCreditParamsSchema.parse(
      request.validated?.params,
    );
    const outcome = await this.grants.outcome(
      depositSession(request),
      actionId,
    );
    return ResponseHelper.ok(
      response,
      outcome,
      "Manual credit outcome loaded.",
      request.path,
      request.requestId,
    );
  };
}
