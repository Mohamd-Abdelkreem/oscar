"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Receipt,
  Search,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect, type AdminSelectOption } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminFinanceTransaction } from "../../types/admin.types";

const PAGE_SIZE = 12;

// Function-size exception: filters, aggregates and detail selection describe one
// ledger view. Revisit when a detail panel becomes an independently reused view.
export function FinanceLedgerScreen() {
  const { financeTransactions } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [directionFilter, setDirectionFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedTx, setSelectedTx] = useState<AdminFinanceTransaction | null>(
    null,
  );

  const filteredTransactions = useMemo(() => {
    return financeTransactions.filter((tx) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !tx.title.toLowerCase().includes(q) &&
          !tx.employeeName.toLowerCase().includes(q) &&
          !tx.reference.toLowerCase().includes(q) &&
          !tx.source.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (typeFilter !== "all" && tx.type !== typeFilter) {
        return false;
      }

      if (directionFilter !== "all" && tx.direction !== directionFilter) {
        return false;
      }

      return true;
    });
  }, [financeTransactions, searchQuery, typeFilter, directionFilter]);

  // Aggregate summaries (balance-neutral events excluded from credit/debit to prevent double counting!)
  const totalCredits = useMemo(() => {
    return financeTransactions
      .filter((t) => t.direction === "credit" && !t.isBalanceNeutral)
      .reduce((sum, t) => sum + t.amount, 0);
  }, [financeTransactions]);

  const totalDebits = useMemo(() => {
    return financeTransactions
      .filter((t) => t.direction === "debit" && !t.isBalanceNeutral)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [financeTransactions]);

  const neutralOperationsCount = useMemo(() => {
    return financeTransactions.filter((t) => t.isBalanceNeutral).length;
  }, [financeTransactions]);

  const totalPages = Math.ceil(filteredTransactions.length / PAGE_SIZE) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredTransactions.slice(start, start + PAGE_SIZE);
  }, [filteredTransactions, currentPage]);

  const typeFilterOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "كل أنواع العمليات" },
    { value: "deposit", label: "إيداع رصيد" },
    { value: "task_reward", label: "مكافأة مهمة" },
    { value: "task_reward_reversal", label: "عكس مكافأة مهمة" },
    { value: "withdrawal_reservation", label: "حجز رصيد سحب" },
    { value: "withdrawal_completion", label: "تسوية سحب نهائية" },
    { value: "withdrawal_reversal", label: "فك حجز سحب" },
    { value: "package_purchase", label: "شراء باقة" },
    { value: "referral_commission", label: "عمولة إحالة" },
    { value: "admin_adjustment", label: "تسوية إدارية" },
  ];

  const directionFilterOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "كل الحركات (إضافة / خصم / حجز)" },
    { value: "credit", label: "إضافة رصيد (+)" },
    { value: "debit", label: "خصم رصيد (-)" },
    { value: "neutral", label: "حجز أو فك حجز الرصيد" },
  ];

  return (
    <div className="space-y-6">
      {/* Requirement 11: Title: السجل المالي */}
      <AdminPageHeader
        title="السجل المالي"
        description="سجل العمليات المالية الشامل: إيداعات، مكافآت مهام، عمولات، حجز وتسويات السحب، والتسويات الإدارية"
        breadcrumbs={[{ label: "السجل المالي" }]}
      />

      {/* Requirement 11: Three Renamed Aggregate Metric Summaries */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-emerald-800">
            <span>إجمالي المبالغ المضافة</span>
            <ArrowDownLeft size={16} aria-hidden="true" />
          </div>
          <div
            className="mt-2 font-mono text-2xl font-black text-emerald-950"
            dir="ltr"
          >
            +{totalCredits.toFixed(2)} USDT
          </div>
          <span className="mt-1 block text-[11px] text-emerald-700">
            إيداعات معتمدة، مكافآت مهام، عمولات إحالة، وتسويات إضافة
          </span>
        </div>

        <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-rose-800">
            <span>إجمالي المبالغ المخصومة</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </div>
          <div
            className="mt-2 font-mono text-2xl font-black text-rose-950"
            dir="ltr"
          >
            -{totalDebits.toFixed(2)} USDT
          </div>
          <span className="mt-1 block text-[11px] text-rose-700">
            تسويات سحب نهائية، شراء باقات، وعكس مكافآت
          </span>
        </div>

        {/* Third metric: Clearly labeled OPERATION COUNT */}
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between text-xs font-bold text-slate-600">
            <span>عمليات حجز وفك حجز الرصيد</span>
            <Receipt size={16} aria-hidden="true" />
          </div>
          <div
            className="mt-2 font-mono text-2xl font-black text-slate-900"
            dir="ltr"
          >
            {neutralOperationsCount} عملية
          </div>
          <span className="mt-1 block text-[11px] text-slate-500">
            عدد عمليات حجز الرصيد وفك الحجز لطلبات السحب (حركات محايدة لا تؤثر
            مزدوجاً)
          </span>
        </div>
      </div>

      {/* Filter and Search Bar: Standardized 44px Height Control Pair (Requirement 9) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
          <div className="sm:col-span-6">
            <AdminInput
              type="text"
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالموظف، البيان، أو المرجع..."
              aria-label="بحث في السجل المالي"
            />
          </div>

          <div className="sm:col-span-3">
            <AdminSelect
              value={typeFilter}
              onValueChange={(val) => {
                setTypeFilter(val);
                setCurrentPage(1);
              }}
              options={typeFilterOptions}
              aria-label="تصفية حسب نوع العملية"
            />
          </div>

          <div className="sm:col-span-3">
            <AdminSelect
              value={directionFilter}
              onValueChange={(val) => {
                setDirectionFilter(val);
                setCurrentPage(1);
              }}
              options={directionFilterOptions}
              aria-label="تصفية حسب طبيعة العملية"
            />
          </div>
        </div>
      </div>

      {/* Ledger Table: Jargon replaced with clear labels */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredTransactions.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {filteredTransactions.length === 0 ? (
          <AdminEmptyState
            title="لا توجد عمليات مالية مطابقة"
            description="لم يتم العثور على عمليات في السجل المالي تطابق معايير التصفية المحددة."
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">البيان</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">نوع العملية</th>
                <th className="px-4 py-3">المرجع</th>
                <th className="px-4 py-3">المصدر</th>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3 text-center">التفاصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedTransactions.map((tx) => (
                <tr key={tx.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/admin/employees/${tx.employeeId}`}
                      className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                    >
                      {tx.employeeName}
                    </Link>
                  </td>

                  <td className="px-4 py-3 font-bold text-slate-800">
                    {tx.title}
                  </td>

                  <td
                    className="px-4 py-3 font-mono font-bold whitespace-nowrap"
                    dir="ltr"
                  >
                    <span
                      className={
                        tx.direction === "credit"
                          ? "text-emerald-700"
                          : tx.direction === "debit"
                            ? "text-rose-600"
                            : "text-slate-500"
                      }
                    >
                      {tx.direction === "credit"
                        ? `+${tx.amount.toFixed(2)}`
                        : tx.direction === "debit"
                          ? tx.amount.toFixed(2)
                          : "0.00 (محايد)"}{" "}
                      USDT
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    {tx.direction === "credit" ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                        إضافة (+)
                      </span>
                    ) : tx.direction === "debit" ? (
                      <span className="rounded border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                        خصم (-)
                      </span>
                    ) : (
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        حجز الرصيد
                      </span>
                    )}
                  </td>

                  <td
                    className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-slate-500"
                    dir="ltr"
                  >
                    {tx.reference}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                    {tx.source}
                  </td>

                  <td
                    className="px-4 py-3 font-mono text-[11px] whitespace-nowrap text-slate-500"
                    dir="ltr"
                  >
                    {tx.date}
                  </td>

                  <td className="px-4 py-3 text-center whitespace-nowrap">
                    <AdminButton
                      variant="outline"
                      size="sm"
                      icon={Eye}
                      onClick={() => {
                        setSelectedTx(tx);
                      }}
                      title="عرض تفاصيل العملية"
                    >
                      تفاصيل
                    </AdminButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AdminTableShell>

      {/* Transaction Detail Modal */}
      {selectedTx && (
        <div
          role="dialog"
          aria-modal="true"
          className="admin-scope fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedTx(null);
          }}
        >
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-4">
              <h2 className="text-base font-bold text-slate-900">
                تفاصيل العملية: {selectedTx.reference}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedTx(null);
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-emerald-600"
                aria-label="إغلاق"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
              <div className="space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">الموظف:</span>
                  <Link
                    href={`/admin/employees/${selectedTx.employeeId}`}
                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {selectedTx.employeeName}
                  </Link>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">البيان:</span>
                  <span className="font-bold text-slate-800">
                    {selectedTx.title}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">المبلغ:</span>
                  <span className="font-mono text-sm font-bold" dir="ltr">
                    {selectedTx.amount.toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">
                    نوع العملية:
                  </span>
                  <span className="font-bold">
                    {selectedTx.direction === "credit"
                      ? "إضافة للرصيد (+)"
                      : selectedTx.direction === "debit"
                        ? "خصم من الرصيد (-)"
                        : "حجز أو فك حجز الرصيد (محايد)"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">المصدر:</span>
                  <span className="text-slate-700">{selectedTx.source}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-500">التاريخ:</span>
                  <span className="font-mono text-slate-600" dir="ltr">
                    {selectedTx.date}
                  </span>
                </div>
              </div>

              {selectedTx.details && (
                <div className="space-y-2">
                  <span className="block font-bold text-slate-700">
                    بيانات إضافية عن العملية:
                  </span>
                  <div className="space-y-1.5 rounded-md border border-slate-100 bg-slate-50 p-3 font-mono text-[11px]">
                    {Object.entries(selectedTx.details).map(([k, v]) => (
                      <div key={k} className="flex justify-between">
                        <span className="font-sans text-slate-500">{k}:</span>
                        <span className="font-bold text-slate-800" dir="ltr">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex shrink-0 justify-end border-t border-slate-100 bg-slate-50 p-4">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedTx(null);
                }}
              >
                إغلاق
              </AdminButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
