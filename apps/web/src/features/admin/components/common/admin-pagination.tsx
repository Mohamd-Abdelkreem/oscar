import { ChevronLeft, ChevronRight } from "lucide-react";

interface AdminPaginationProps {
  readonly currentPage: number;
  readonly totalPages: number;
  readonly totalItems: number;
  readonly pageSize: number;
  readonly onPageChange: (page: number) => void;
}

export function AdminPagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
}: AdminPaginationProps) {
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);
  const visiblePages = Math.min(3, totalPages);
  const firstPage = Math.max(
    1,
    Math.min(currentPage - 1, totalPages - visiblePages + 1),
  );

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:px-6">
      <div className="text-xs text-slate-500">
        عرض السجلات من{" "}
        <span className="font-bold text-slate-900">{startItem}</span> إلى{" "}
        <span className="font-bold text-slate-900">{endItem}</span> من إجمالي{" "}
        <span className="font-bold text-slate-900">{totalItems}</span> سجل
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            onPageChange(currentPage - 1);
          }}
          disabled={currentPage <= 1}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronRight size={14} aria-hidden="true" />
          <span>السابق</span>
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: visiblePages }, (_, i) => firstPage + i).map(
            (page) => (
              <button
                key={page}
                type="button"
                onClick={() => {
                  onPageChange(page);
                }}
                className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition-colors ${
                  currentPage === page
                    ? "bg-emerald-700 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                {page}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            onPageChange(currentPage + 1);
          }}
          disabled={currentPage >= totalPages}
          className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span>التالي</span>
          <ChevronLeft size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
