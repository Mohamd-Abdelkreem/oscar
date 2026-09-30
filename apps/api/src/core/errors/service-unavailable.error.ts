import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class ServiceUnavailableException extends AppError {
  constructor(message = "The service is temporarily unavailable.") {
    super(message, HTTP_STATUS.SERVICE_UNAVAILABLE, "SERVICE_UNAVAILABLE");
    this.name = "ServiceUnavailableException";
  }
}
