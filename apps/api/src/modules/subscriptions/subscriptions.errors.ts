import { AppError } from "../../core/errors/app.error.js";

export class PurchaseError extends AppError {
  constructor(code: "PURCHASE_QUOTE_STALE" | "PURCHASE_TRANSITION_DENIED") {
    super(
      code === "PURCHASE_QUOTE_STALE"
        ? "The reviewed purchase has changed or expired."
        : "An active subscription requires a higher package tier.",
      409,
      code,
    );
  }
}
