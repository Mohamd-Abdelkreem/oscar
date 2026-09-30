import type { RequestHandler } from "express";

import { NotFoundException } from "../core/errors/not-found.error.js";

export const notFoundMiddleware: RequestHandler = (
  request,
  _response,
  next,
) => {
  next(
    new NotFoundException(`Route ${request.method} ${request.path} not found.`),
  );
};

export const notFound = notFoundMiddleware;
