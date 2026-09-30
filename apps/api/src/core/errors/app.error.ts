import { HTTP_STATUS } from "../constants/http-status.constants.js";
import type { FieldError } from "../responses/api-response.js";

export class AppError extends Error {
  public override readonly message: string;
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly errors: FieldError[] | undefined;
  public readonly timestamp: string;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    code = "INTERNAL_ERROR",
    isOperational = true,
    errors?: FieldError[],
  ) {
    super(message);
    this.message = message;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.errors = errors;
    this.timestamp = new Date().toISOString();
    this.name = "AppError";
    Error.captureStackTrace(this, this.constructor);
  }
}
