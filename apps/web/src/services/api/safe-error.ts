import axios from "axios";
import { errorEnvelopeSchema } from "@template/contracts";

export type ApiErrorCategory =
  | "contract"
  | "denied"
  | "transient"
  | "cancelled"
  | "coordination"
  | "obsolete"
  | "uncertain"
  | "request";
const messages: Readonly<Record<ApiErrorCategory, string>> = {
  contract: "تعذر التحقق من استجابة الخدمة. حاول لاحقاً.",
  denied: "تعذر السماح بهذا الطلب. تحقق من تسجيل الدخول والصلاحيات.",
  transient: "الخدمة غير متاحة مؤقتاً. تحقق من الاتصال وحاول لاحقاً.",
  cancelled: "تم إلغاء الطلب.",
  coordination:
    "تعذر تأكيد انتهاء الطلب السابق. استخدم ملف متصفح منفصلاً أو جلسة خاصة مستقلة، ثم سجل الدخول. علامة تبويب جديدة في الجلسة نفسها لا تكفي.",
  obsolete: "انتهى سياق هذا الطلب.",
  uncertain: "تعذر تأكيد نتيجة الطلب. لا تكرره حتى تتضح النتيجة.",
  request: "تعذر إتمام الطلب. راجع المدخلات وحاول مجدداً.",
};

class ApiFailure extends Error {
  readonly requestId = "";
  constructor(
    readonly category: ApiErrorCategory,
    readonly code: string,
    readonly statusCode: number,
    readonly fieldErrors: Readonly<
      Record<string, readonly string[]>
    > = Object.freeze({}),
  ) {
    super(messages[category]);
    // Error satisfies the project's throwing contract without retaining stack/cause diagnostics.
    delete this.stack;
    Object.freeze(this);
  }
}
export type ApiError = ApiFailure;
export const safeApiError = (
  category: ApiErrorCategory,
  code: string,
  statusCode = 0,
  fields: Readonly<Record<string, readonly string[]>> = Object.freeze({}),
): ApiError => new ApiFailure(category, code, statusCode, fields);
const record = (input: unknown): input is Record<string, unknown> =>
  input !== null && typeof input === "object" && !Array.isArray(input);
const knownCodes = new Set([
  "VALIDATION_ERROR",
  "BAD_REQUEST",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMIT_EXCEEDED",
  "SERVICE_UNAVAILABLE",
  "INTERNAL_SERVER_ERROR",
  "NOT_IMPLEMENTED",
  "BAD_GATEWAY",
  "GATEWAY_TIMEOUT",
]);
const knownFields = new Set([
  "email",
  "password",
  "fullName",
  "phone",
  "referralCode",
  "newPassword",
  "currentPassword",
  "passwordConfirmation",
  "reason",
  "amount",
  "employeeId",
  "reference",
  "reference.kind",
  "reference.value",
  "gross",
  "address",
  "countedHours",
]);
const financialCodes = new Set([
  "CONFIGURATION_STALE",
  "CONFIGURATION_SUPERSEDED",
  "PURCHASE_QUOTE_STALE",
  "PURCHASE_TRANSITION_DENIED",
  "LEDGER_INVALID_INTENT",
  "LEDGER_FORBIDDEN",
  "LEDGER_IDENTITY_CONFLICT",
  "LEDGER_INSUFFICIENT_FUNDS",
  "LEDGER_AMOUNT_BOUNDS",
  "LEDGER_INTERNAL",
]);
const taskCodes = new Set([
  "TASK_REVISION_CONFLICT",
  "TASK_DATE_LOCKED",
  "TASK_DATE_OCCUPIED",
  "CODE_ALREADY_EXISTS",
  "CODE_VERSION_CONFLICT",
  "CODE_UNAVAILABLE",
  "TASK_WINDOW_CLOSED",
  "TASK_UNAVAILABLE",
  "TASK_ELIGIBILITY_DENIED",
  "DAILY_CLAIM_EXISTS",
  "SUBMISSION_VERSION_CONFLICT",
  "EVIDENCE_VERSION_CONFLICT",
  "SUBMISSION_FINAL",
  "EVIDENCE_CONFLICT",
  "ASSET_NOT_READY",
  "IDEMPOTENCY_CONFLICT",
  "COMMAND_CANCELLED",
  "UPLOAD_CANCELLED",
  "UPLOAD_TOO_LARGE",
  "UNSUPPORTED_IMAGE",
  "INVALID_IMAGE",
  "STORAGE_UNAVAILABLE",
  "IMAGE_PROCESSING_UNAVAILABLE",
  "UPLOAD_INTERRUPTED",
  "UPLOAD_EXPIRED",
]);
const depositCodes = new Set([
  "DEPOSIT_NOT_FOUND",
  "DEPOSIT_UNAVAILABLE",
  "DEPOSIT_UNRESOLVED",
  "MANUAL_CREDIT_REFERENCE_INVALID",
  "MANUAL_CREDIT_CONFLICT",
  "FINANCIAL_AMOUNT_OVERFLOW",
  "FINANCIAL_WRITES_FENCED",
]);
const withdrawalCodes = new Set([
  "WITHDRAWAL_VERSION_CONFLICT",
  "WITHDRAWAL_STATE_CONFLICT",
  "WITHDRAWAL_AMOUNT_INVALID",
  "WITHDRAWAL_QUOTE_STALE",
  "WITHDRAWAL_ACTIVE",
  "WITHDRAWAL_DESTINATION_REQUIRED",
  "WITHDRAWAL_ADDRESS_INVALID",
  "WITHDRAWAL_PROOF_INVALID",
  "WITHDRAWAL_DESTINATION_FIXED",
  "WITHDRAWAL_DESTINATION_STALE",
  "WITHDRAWAL_BLOCKED",
  "WITHDRAWAL_UNAVAILABLE",
  "WITHDRAWAL_UNRESOLVED",
  "WITHDRAWAL_INTERNAL",
]);

export const getApiError = (failure: unknown): ApiError => {
  if (failure instanceof ApiFailure) return failure;
  if (axios.isCancel(failure)) return safeApiError("cancelled", "CANCELLED");
  if (!axios.isAxiosError(failure))
    return safeApiError("request", "REQUEST_ERROR");
  const status = failure.response?.status ?? 0;
  const body: unknown = failure.response?.data;
  if (
    record(body) &&
    body["success"] === false &&
    body["statusCode"] !== status
  )
    return safeApiError("contract", "CONTRACT_ERROR");
  const category =
    status === 0 || (status >= 500 && status <= 504)
      ? "transient"
      : status === 401 || status === 403
        ? "denied"
        : "request";
  const financialEnvelope = errorEnvelopeSchema.safeParse(body);
  const originalConfigurationPatch =
    failure.config?.method?.toLowerCase() === "patch" &&
    /^\/admin\/(?:packages\/(?:S1|S2|O1|O2|A1)|referral-settings)$/u.test(
      failure.config.url ?? "",
    ) &&
    financialEnvelope.success &&
    financialEnvelope.data.path.endsWith(failure.config.url ?? "");
  const financialCode =
    financialEnvelope.success &&
    financialEnvelope.data.statusCode === status &&
    (financialCodes.has(financialEnvelope.data.code) ||
      taskCodes.has(financialEnvelope.data.code) ||
      depositCodes.has(financialEnvelope.data.code) ||
      (withdrawalCodes.has(financialEnvelope.data.code) &&
        /^\/(?:admin\/)?withdrawals(?:\/|$)/u.test(failure.config?.url ?? "") &&
        financialEnvelope.data.path.endsWith(failure.config?.url ?? ""))) &&
    (financialEnvelope.data.code !== "CONFIGURATION_SUPERSEDED" ||
      originalConfigurationPatch)
      ? financialEnvelope.data.code
      : undefined;
  const code =
    financialCode ??
    (record(body) &&
    body["success"] === false &&
    typeof body["code"] === "string" &&
    knownCodes.has(body["code"])
      ? body["code"]
      : status === 0
        ? "NETWORK_ERROR"
        : "HTTP_ERROR");
  const fields: Record<string, readonly string[]> = {};
  if (
    code === "VALIDATION_ERROR" &&
    record(body) &&
    Array.isArray(body["errors"])
  ) {
    for (const issue of body["errors"].slice(0, 20)) {
      if (!record(issue) || typeof issue["field"] !== "string") continue;
      const field = issue["field"].replace(/^body\./u, "");
      if (knownFields.has(field))
        fields[field] = Object.freeze(["راجع هذه القيمة."]);
    }
  }
  return safeApiError(category, code, status, Object.freeze(fields));
};
