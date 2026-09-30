import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class NotFoundException extends AppError {
  constructor(message = "The requested resource was not found.") {
    super(message, HTTP_STATUS.NOT_FOUND, "NOT_FOUND");
    this.name = "NotFoundException";
  }
}
