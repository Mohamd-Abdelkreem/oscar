import type { Response } from "express";

import {
  paginationMetaSchema,
  type PaginationMeta,
  type SuccessEnvelope,
} from "@template/contracts";

import { HTTP_STATUS } from "../constants/http-status.constants.js";

export type { FieldError, PaginationMeta } from "@template/contracts";

/* eslint-disable @typescript-eslint/no-extraneous-class, @typescript-eslint/no-unnecessary-type-parameters -- Static generic response helpers are the API response convention. */

const readPaginationMeta = (data: unknown): PaginationMeta | undefined => {
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("pagination" in data)
  ) {
    return undefined;
  }
  const pagination = (data as { pagination?: unknown }).pagination;
  return pagination === undefined
    ? undefined
    : paginationMetaSchema.parse(pagination);
};

export class ResponseHelper {
  static success<T>(
    response: Response,
    data: T,
    message: string,
    statusCode: number,
    path: string,
    requestId: string,
  ): Response {
    const paginationMeta = readPaginationMeta(data);
    const payload: SuccessEnvelope<T> = {
      success: true,
      message,
      statusCode,
      data,
      ...(paginationMeta === undefined ? {} : { paginationMeta }),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    };
    return response.status(statusCode).json(payload);
  }

  static created<T>(
    response: Response,
    data: T,
    message: string,
    path: string,
    requestId: string,
  ): Response {
    return this.success(
      response,
      data,
      message,
      HTTP_STATUS.CREATED,
      path,
      requestId,
    );
  }

  static ok<T>(
    response: Response,
    data: T,
    message: string,
    path: string,
    requestId: string,
  ): Response {
    return this.success(
      response,
      data,
      message,
      HTTP_STATUS.OK,
      path,
      requestId,
    );
  }
}

export default ResponseHelper;
