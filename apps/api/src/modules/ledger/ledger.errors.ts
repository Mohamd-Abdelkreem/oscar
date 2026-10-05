import { HTTP_STATUS } from "../../core/constants/http-status.constants.js";
import { AppError } from "../../core/errors/app.error.js";

const LEDGER_ERRORS = {
  LEDGER_INVALID_INTENT: [HTTP_STATUS.BAD_REQUEST, "Invalid financial intent."],
  LEDGER_FORBIDDEN: [
    HTTP_STATUS.FORBIDDEN,
    "Financial action is not authorized.",
  ],
  LEDGER_INSUFFICIENT_FUNDS: [
    HTTP_STATUS.CONFLICT,
    "Insufficient eligible available funds.",
  ],
  LEDGER_AMOUNT_BOUNDS: [
    HTTP_STATUS.CONFLICT,
    "Financial amount exceeds supported bounds.",
  ],
  LEDGER_IDENTITY_CONFLICT: [
    HTTP_STATUS.CONFLICT,
    "Financial identity conflicts with the accepted intent.",
  ],
  LEDGER_RESERVATION_CLOSED: [
    HTTP_STATUS.CONFLICT,
    "Reservation is already closed.",
  ],
  LEDGER_UNRESOLVED: [
    HTTP_STATUS.CONFLICT,
    "Financial operation could not be resolved.",
  ],
  LEDGER_INVALID_TRANSACTION: [
    HTTP_STATUS.CONFLICT,
    "Invalid financial transaction scope.",
  ],
  LEDGER_INTERNAL: [
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    "Financial operation failed.",
  ],
} as const;

export type LedgerErrorCode = keyof typeof LEDGER_ERRORS;
export class LedgerError extends AppError {
  constructor(code: LedgerErrorCode, options?: ErrorOptions) {
    const [status, message] = LEDGER_ERRORS[code];
    super(message, status, code);
    if (options !== undefined && "cause" in options) {
      // Retain diagnostic evidence without adding it to serializable fields.
      Object.defineProperty(this, "cause", { value: options.cause });
    }
  }
}
