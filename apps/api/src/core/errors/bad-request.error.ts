import { HTTP_STATUS } from "../constants/http-status.constants.js";
import type { FieldError } from "../responses/api-response.js";
import { AppError } from "./app.error.js";

export class BadRequestException extends AppError {
  constructor(message = "Bad request.", errors?: FieldError[]) {
    super(message, HTTP_STATUS.BAD_REQUEST, "BAD_REQUEST", true, errors);
    this.name = "BadRequestException";
  }
}
