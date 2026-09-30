import { randomUUID } from "node:crypto";

import type { RequestHandler } from "express";

const safeRequestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;

export const requestIdMiddleware: RequestHandler = (
  request,
  response,
  next,
) => {
  const incomingRequestId = request.get("x-request-id");
  request.requestId =
    incomingRequestId !== undefined &&
    safeRequestIdPattern.test(incomingRequestId)
      ? incomingRequestId
      : randomUUID();

  response.setHeader("x-request-id", request.requestId);
  next();
};

export const requestId = requestIdMiddleware;
