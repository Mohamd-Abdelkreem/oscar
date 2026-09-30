import { pinoHttp } from "pino-http";
import type { Request } from "express";
import type { Logger } from "pino";

import { sanitizeRequestForLog } from "../infrastructure/logger/request-sanitizer.js";

export const createRequestLoggerMiddleware = (logger: Logger) =>
  pinoHttp({
    logger,
    serializers: {
      req: (request) =>
        sanitizeRequestForLog(request as Record<string, unknown>),
    },
    genReqId: (request) => (request as Request).requestId,
    customProps: (request) => {
      const expressRequest = request as Request;

      return {
        requestId: expressRequest.requestId,
        userId: expressRequest.user?.id,
      };
    },
  });
