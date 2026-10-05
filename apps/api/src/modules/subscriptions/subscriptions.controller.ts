import type { Request, Response } from "express";
import { z } from "zod";
import { InternalServerError } from "../../core/errors/index.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import type { PurchaseQuoteService } from "./purchase-quote.service.js";
import type { SubscriptionPurchaseService } from "./subscription-purchase.service.js";
import type { SubscriptionsService } from "./subscriptions.service.js";

export const quoteParamsSchema = z.object({ quoteId: z.uuid() }).strict();
export const purchaseParamsSchema = z.object({ purchaseId: z.uuid() }).strict();
export const employeeMembershipParamsSchema = z
  .object({ employeeId: z.uuid() })
  .strict();
export const authenticatedSubscriptionIdentity = (request: Request) => {
  if (request.authSession === undefined)
    throw new InternalServerError("Authenticated session context is required.");
  return request.authSession;
};

export class SubscriptionsController {
  constructor(
    private readonly quotes: PurchaseQuoteService,
    private readonly purchases: SubscriptionPurchaseService,
    private readonly subscriptions: SubscriptionsService,
  ) {}

  createQuote = async (request: Request, response: Response) => {
    const quote = await this.quotes.create(
      authenticatedSubscriptionIdentity(request),
      request.validated?.body,
    );
    return ResponseHelper.created(
      response,
      quote,
      "Purchase quote created.",
      request.path,
      request.requestId,
    );
  };
  purchase = async (request: Request, response: Response) => {
    const command = await this.purchases.purchase(
      authenticatedSubscriptionIdentity(request),
      request.validated?.body,
      request.get("Idempotency-Key"),
    );
    return command.replayed
      ? ResponseHelper.ok(
          response,
          command,
          "Purchase recorded.",
          request.path,
          request.requestId,
        )
      : ResponseHelper.created(
          response,
          command,
          "Purchase recorded.",
          request.path,
          request.requestId,
        );
  };
  outcome = async (request: Request, response: Response) => {
    const { quoteId } = quoteParamsSchema.parse(request.validated?.params);
    const outcome = await this.quotes.outcome(
      authenticatedSubscriptionIdentity(request),
      quoteId,
    );
    return ResponseHelper.ok(
      response,
      outcome,
      "Purchase outcome observed.",
      request.path,
      request.requestId,
    );
  };
  membership = async (request: Request, response: Response) => {
    const membership = await this.subscriptions.membership(
      authenticatedSubscriptionIdentity(request),
    );
    return ResponseHelper.ok(
      response,
      membership,
      "Membership loaded.",
      request.path,
      request.requestId,
    );
  };
  history = async (request: Request, response: Response) => {
    const history = await this.subscriptions.purchaseHistory(
      authenticatedSubscriptionIdentity(request),
      request.validated?.query,
    );
    return ResponseHelper.ok(
      response,
      history,
      "Purchases loaded.",
      request.path,
      request.requestId,
    );
  };
  subscriptionHistory = async (request: Request, response: Response) => {
    const history = await this.subscriptions.subscriptionHistory(
      authenticatedSubscriptionIdentity(request),
      request.validated?.query,
    );
    return ResponseHelper.ok(
      response,
      history,
      "Subscriptions loaded.",
      request.path,
      request.requestId,
    );
  };
  employeeMembership = async (request: Request, response: Response) => {
    const { employeeId } = employeeMembershipParamsSchema.parse(
      request.validated?.params,
    );
    const membership = await this.subscriptions.employeeMembership(
      authenticatedSubscriptionIdentity(request),
      employeeId,
    );
    return ResponseHelper.ok(
      response,
      membership,
      "Membership loaded.",
      request.path,
      request.requestId,
    );
  };
  detail = async (request: Request, response: Response) => {
    const { purchaseId } = purchaseParamsSchema.parse(
      request.validated?.params,
    );
    const purchase = await this.subscriptions.purchaseDetail(
      authenticatedSubscriptionIdentity(request),
      purchaseId,
    );
    return ResponseHelper.ok(
      response,
      purchase,
      "Purchase loaded.",
      request.path,
      request.requestId,
    );
  };
}
