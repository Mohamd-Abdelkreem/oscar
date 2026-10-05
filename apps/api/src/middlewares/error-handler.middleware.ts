import type { ErrorRequestHandler } from "express";

import type { ErrorEnvelope } from "@template/contracts";

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
      appError = new InternalServerError();
    }
  }

  const logContext = {
    code: appError.code,
    requestId: request.requestId,
    statusCode: appError.statusCode,
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
