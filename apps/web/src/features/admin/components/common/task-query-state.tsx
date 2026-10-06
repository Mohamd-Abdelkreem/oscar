"use client";
import { AdminButton } from "./admin-button";

export function TaskQueryState({
  error,
  retry,
}: {
  readonly error?: string | undefined;
  readonly retry: () => unknown;
}) {
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-5 text-sm"
      role={error ? "alert" : "status"}
    >
      {error ?? "جارٍ تحميل البيانات..."}
      {error && (
        <AdminButton
          variant="outline"
          onClick={() => {
            void retry();
          }}
        >
          إعادة المحاولة
        </AdminButton>
      )}
    </div>
  );
}
