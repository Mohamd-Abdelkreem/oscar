import axios from "axios";

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
  const code =
    record(body) &&
    body["success"] === false &&
    typeof body["code"] === "string" &&
    knownCodes.has(body["code"])
      ? body["code"]
      : status === 0
        ? "NETWORK_ERROR"
        : "HTTP_ERROR";
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
