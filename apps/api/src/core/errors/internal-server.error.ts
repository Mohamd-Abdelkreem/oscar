import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class InternalServerError extends AppError {
  constructor(message = "An unexpected error occurred.") {
    super(
      message,
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      "INTERNAL_SERVER_ERROR",
      false,
    );
    this.name = "InternalServerError";
  }
}
