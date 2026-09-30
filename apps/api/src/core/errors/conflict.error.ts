import { HTTP_STATUS } from "../constants/http-status.constants.js";
import { AppError } from "./app.error.js";

export class ConflictException extends AppError {
  constructor(message = "The request conflicts with the current state.") {
    super(message, HTTP_STATUS.CONFLICT, "CONFLICT");
    this.name = "ConflictException";
  }
}
