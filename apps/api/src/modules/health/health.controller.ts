import type { Request, Response } from "express";

import { HTTP_STATUS } from "../../core/constants/http-status.constants.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  live = (request: Request, response: Response): Response => {
    const health = this.healthService.getLiveness();

    return ResponseHelper.ok(
      response,
      health,
      "Service is alive.",
      request.path,
      request.requestId,
    );
  };

  ready = async (request: Request, response: Response): Promise<Response> => {
    const health = await this.healthService.checkHealth();
    const statusCode =
      health.status === "ok" ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;

    return ResponseHelper.success(
      response,
      health,
      health.status === "ok"
        ? "Service is ready."
        : "Service dependencies are degraded.",
      statusCode,
      request.path,
      request.requestId,
    );
  };
}
