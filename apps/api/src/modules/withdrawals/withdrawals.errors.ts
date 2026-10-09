import { AppError } from "../../core/errors/app.error.js";

const errors = {
  WITHDRAWAL_VERSION_CONFLICT: [409, "Withdrawal version has changed."],
  WITHDRAWAL_STATE_CONFLICT: [
    409,
    "Only safely scheduled withdrawals can change.",
  ],
  WITHDRAWAL_AMOUNT_INVALID: [
    400,
    "Withdrawal gross amount or fee terms are unsupported.",
  ],
  WITHDRAWAL_QUOTE_STALE: [
    409,
    "Reviewed withdrawal facts changed or expired.",
  ],
  WITHDRAWAL_ACTIVE: [409, "An active withdrawal already exists."],
  WITHDRAWAL_DESTINATION_REQUIRED: [
    409,
    "A confirmed withdrawal destination is required.",
  ],
  WITHDRAWAL_ADDRESS_INVALID: [400, "Withdrawal address is invalid."],
  WITHDRAWAL_PROOF_INVALID: [
    409,
    "Withdrawal proof is invalid or no longer current.",
  ],
  WITHDRAWAL_DESTINATION_FIXED: [
    409,
    "The first withdrawal destination is already confirmed.",
  ],
  WITHDRAWAL_DESTINATION_STALE: [409, "Withdrawal destination state changed."],
  WITHDRAWAL_BLOCKED: [403, "Withdrawals are restricted for this account."],
  WITHDRAWAL_UNAVAILABLE: [503, "Withdrawal configuration is unavailable."],
  WITHDRAWAL_UNRESOLVED: [409, "Withdrawal operation could not be resolved."],
  WITHDRAWAL_INTERNAL: [500, "Withdrawal operation failed."],
} as const;
export class WithdrawalError extends AppError {
  constructor(code: keyof typeof errors) {
    const [status, message] = errors[code];
    super(message, status, code);
  }
}
