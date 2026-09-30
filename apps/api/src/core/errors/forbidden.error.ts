import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class ForbiddenException extends AppError {
  constructor(message = "You are not allowed to perform this action.") {
    super(message, HTTP_STATUS.FORBIDDEN, "FORBIDDEN");
    this.name = "ForbiddenException";
  }
}
