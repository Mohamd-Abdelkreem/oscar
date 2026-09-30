import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class UnauthorizedException extends AppError {
  constructor(message = "Authentication is required.") {
    super(message, HTTP_STATUS.UNAUTHORIZED, "UNAUTHORIZED");
    this.name = "UnauthorizedException";
  }
}
