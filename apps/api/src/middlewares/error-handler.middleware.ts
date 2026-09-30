import type { ErrorRequestHandler } from "express";

import type { ErrorEnvelope } from "@template/contracts";

import { appConfig } from "../core/config/app.config.js";
import { AppError } from "../core/errors/app.error.js";
import { InternalServerError } from "../core/errors/internal-server.error.js";
import { mapPrismaError } from "../infrastructure/database/prisma-error.mapper.js";

const createErrorResponse = (
  error: AppError,
  path: string,
  requestId: string,
): ErrorEnvelope => ({
  success: false,
  statusCode: error.statusCode,
  code: error.code,
  message: error.message,
  errors: error.errors?.length === 0 ? undefined : error.errors,
  ...(appConfig.isDevelopment ? { stack: error.stack } : {}),
  requestId,
  timestamp: error.timestamp,
  path,
});

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else {
    appError = mapPrismaError(error);
    if (appError instanceof InternalServerError) {
      const fallback = new InternalServerError();
      if (error instanceof Error && error.stack !== undefined) {
        fallback.stack = error.stack;
      }
      appError = fallback;
    }
  }

  const logContext = {
    code: appError.code,
    requestId: request.requestId,
    statusCode: appError.statusCode,
    ...(appError.isOperational ? {} : { err: error }),
  };

  if (appError.isOperational) {
    request.log.warn(logContext, appError.message);
  } else {
    request.log.error(logContext, appError.message);
  }

  return response
    .status(appError.statusCode)
    .json(createErrorResponse(appError, request.path, request.requestId));
};

export const errorHandler = errorHandlerMiddleware;
