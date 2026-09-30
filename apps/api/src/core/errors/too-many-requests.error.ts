import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class TooManyRequestsException extends AppError {
  constructor(message = "Too many requests. Please try again later.") {
    super(message, HTTP_STATUS.TOO_MANY_REQUESTS, "RATE_LIMIT_EXCEEDED");
    this.name = "TooManyRequestsException";
  }
}
