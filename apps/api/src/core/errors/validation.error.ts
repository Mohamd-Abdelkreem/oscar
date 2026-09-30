import { HTTP_STATUS } from "../constants/http-status.constants.js";
import type { FieldError } from "../responses/api-response.js";
import { AppError } from "./app.error.js";

export class ValidationException extends AppError {
  constructor(errors: FieldError[], message = "Request validation failed.") {
    super(message, HTTP_STATUS.BAD_REQUEST, "VALIDATION_ERROR", true, errors);
    this.name = "ValidationException";
  }
}
