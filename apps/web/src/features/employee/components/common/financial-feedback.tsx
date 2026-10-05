import { getApiError } from "@/services/api/safe-error";
import { Button } from "./button";

export function FinancialFeedback({
  pending,
  error,
  retry,
}: {
  pending: boolean;
  error: Error | null;
  retry: () => unknown;
}) {
  if (!pending && error === null) return null;
  return (
    <div
      className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"
      role={error ? "alert" : "status"}
    >
      {error && getApiError(error).category === "denied"
        ? "غير مسموح بالوصول إلى هذه البيانات."
        : error
          ? "تعذر تحميل البيانات المالية. لا توجد نتيجة مؤكدة."
          : "جارٍ تحميل البيانات المالية…"}
      {error && (
        <Button
          variant="outline"
          size="compact"
          onClick={() => {
            void retry();
          }}
        >
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}
export function FinancialPages({
  page,
  pages,
  setPage,
}: {
  page: number;
  pages: number;
  setPage: (page: number) => void;
}) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center justify-between gap-2 pt-3 text-xs">
      <Button
        variant="outline"
        size="compact"
        disabled={page <= 1}
        onClick={() => {
          setPage(page - 1);
        }}
      >
        السابق
      </Button>
      <span>
        {page} / {pages}
      </span>
      <Button
        variant="outline"
        size="compact"
        disabled={page >= pages}
        onClick={() => {
          setPage(page + 1);
        }}
      >
        التالي
      </Button>
    </div>
  );
}
