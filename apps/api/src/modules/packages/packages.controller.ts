import type { Request, Response } from "express";
import { z } from "zod";
import { packageCodeSchema } from "@template/contracts";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { authenticatedSubscriptionIdentity } from "../subscriptions/subscriptions.controller.js";
import type { PackagesService } from "./packages.service.js";
import type { PackageConfigurationService } from "./package-configuration.service.js";

export const packageParamsSchema = z
  .object({ packageCode: packageCodeSchema })
  .strict();
export const configurationParamsSchema = z
  .object({ commandId: z.uuid() })
  .strict();

export class PackagesController {
  constructor(
    private readonly packages: PackagesService,
    private readonly configuration: PackageConfigurationService,
  ) {}
  catalog = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.packages.catalog(authenticatedSubscriptionIdentity(request)),
      "Packages loaded.",
      request.path,
      request.requestId,
    );
  adminCatalog = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.packages.adminCatalog(
        authenticatedSubscriptionIdentity(request),
      ),
      "Package counts loaded.",
      request.path,
      request.requestId,
    );
  referralSettings = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.packages.referralSettings(
        authenticatedSubscriptionIdentity(request),
      ),
      "Referral settings loaded.",
      request.path,
      request.requestId,
    );
  editPackage = async (request: Request, response: Response) => {
    const { packageCode } = packageParamsSchema.parse(
      request.validated?.params,
    );
    return ResponseHelper.ok(
      response,
      await this.configuration.editPackage(
        authenticatedSubscriptionIdentity(request),
        packageCode,
        request.validated?.body,
      ),
      "Future package terms saved.",
      request.path,
      request.requestId,
    );
  };
  editReferrals = async (request: Request, response: Response) =>
    ResponseHelper.ok(
      response,
      await this.configuration.editReferrals(
        authenticatedSubscriptionIdentity(request),
        request.validated?.body,
      ),
      "Future referral rates saved.",
      request.path,
      request.requestId,
    );
  configurationOutcome = async (request: Request, response: Response) => {
    const { commandId } = configurationParamsSchema.parse(
      request.validated?.params,
    );
    return ResponseHelper.ok(
      response,
      await this.configuration.outcome(
        authenticatedSubscriptionIdentity(request),
        commandId,
      ),
      "Configuration outcome observed.",
      request.path,
      request.requestId,
    );
  };
}
