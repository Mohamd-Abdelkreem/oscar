import type { Request, Response } from "express";
import { InternalServerError } from "../../core/errors/index.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import type { WithdrawalsService } from "./withdrawals.service.js";
import type { WithdrawalDestinationService } from "./withdrawal-destination.service.js";
import type { WithdrawalQuoteService } from "./withdrawal-quote.service.js";
import type { WithdrawalReservationService } from "./withdrawal-reservation.service.js";
import {
  withdrawalParamsSchema,
  withdrawalQuoteParamsSchema,
} from "@template/contracts";

export function withdrawalSession(request: Request) {
  if (request.authSession === undefined)
    throw new InternalServerError("Authenticated session context is required.");
  return request.authSession;
}

export class WithdrawalsController {
  constructor(
    private readonly withdrawals: WithdrawalsService,
    private readonly destinations: WithdrawalDestinationService,
    private readonly quotes: WithdrawalQuoteService,
    private readonly reservations: WithdrawalReservationService,
  ) {}

  extend = async (request: Request, response: Response) => {
    const params = withdrawalParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.withdrawals.extend(
        withdrawalSession(request),
        params.withdrawalId,
        request.validated?.body,
        request.get("Idempotency-Key"),
      ),
      "Withdrawal deadline extended.",
      request.path,
      request.requestId,
    );
  };
  reject = async (request: Request, response: Response) => {
    const params = withdrawalParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.withdrawals.reject(
        withdrawalSession(request),
        params.withdrawalId,
        request.validated?.body,
        request.get("Idempotency-Key"),
      ),
      "Withdrawal safely rejected.",
      request.path,
      request.requestId,
    );
  };

  createQuote = async (request: Request, response: Response) =>
    ResponseHelper.success(
      response,
      await this.quotes.create(
        withdrawalSession(request),
        request.validated?.body,
      ),
      "Withdrawal quote created.",
      201,
      request.path,
      request.requestId,
    );
  accept = async (request: Request, response: Response) => {
    const result = await this.reservations.accept(
      withdrawalSession(request),
      request.validated?.body,
      request.get("Idempotency-Key"),
    );
    return ResponseHelper.success(
      response,
      result,
      "Withdrawal reservation recorded.",
      result.replayed ? 200 : 201,
      request.path,
      request.requestId,
    );
  };
  status = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.withdrawals.status(withdrawalSession(request)),
      "Withdrawal status loaded.",
      request.path,
      request.requestId,
    );
  outcome = async (request: Request, response: Response) => {
    const params = withdrawalQuoteParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.withdrawals.outcome(
        withdrawalSession(request),
        params.quoteId,
      ),
      "Withdrawal outcome loaded.",
      request.path,
      request.requestId,
    );
  };
  detail = async (request: Request, response: Response) =>
    this.loadDetail(request, response, false);
  adminDetail = async (request: Request, response: Response) =>
    this.loadDetail(request, response, true);
  history = async (request: Request, response: Response) =>
    this.loadHistory(request, response, false);
  adminHistory = async (request: Request, response: Response) =>
    this.loadHistory(request, response, true);
  private async loadDetail(
    request: Request,
    response: Response,
    admin: boolean,
  ) {
    const params = withdrawalParamsSchema.parse(request.validated?.params);
    return ResponseHelper.ok(
      response,
      await this.withdrawals.detail(
        withdrawalSession(request),
        params.withdrawalId,
        admin,
      ),
      "Withdrawal loaded.",
      request.path,
      request.requestId,
    );
  }
  private async loadHistory(
    request: Request,
    response: Response,
    admin: boolean,
  ) {
    const result = await this.withdrawals.history(
      withdrawalSession(request),
      request.validated?.query,
      admin,
    );
    return ResponseHelper.ok(
      response,
      result,
      "Withdrawals loaded.",
      request.path,
      request.requestId,
    );
  }

  destination = async (request: Request, response: Response) => {
    const projection = await this.withdrawals.destination(
      withdrawalSession(request),
    );
    return ResponseHelper.ok(
      response,
      projection,
      "Withdrawal destination loaded.",
      request.path,
      request.requestId,
    );
  };
  issueDestination = async (request: Request, response: Response) => {
    const projection = await this.destinations.issue(
      withdrawalSession(request),
      request.validated?.body,
    );
    return ResponseHelper.success(
      response,
      projection,
      "Withdrawal confirmation recorded.",
      201,
      request.path,
      request.requestId,
    );
  };
  resendDestination = async (request: Request, response: Response) => {
    const projection = await this.destinations.resend(
      withdrawalSession(request),
      request.validated?.body,
    );
    return ResponseHelper.ok(
      response,
      projection,
      "Withdrawal confirmation recorded.",
      request.path,
      request.requestId,
    );
  };
  consumeDestination = async (request: Request, response: Response) => {
    const projection = await this.destinations.consume(
      withdrawalSession(request),
      request.validated?.body,
    );
    return ResponseHelper.ok(
      response,
      projection,
      "Withdrawal destination confirmed.",
      request.path,
      request.requestId,
    );
  };
}
