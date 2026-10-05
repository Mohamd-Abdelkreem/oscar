"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Eye,
  Receipt,
  Search,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect, type AdminSelectOption } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useFinanceLedger, useFinanceDetail } from "../../hooks/finance.hooks";
import { FinancialFeedback } from "@/features/employee/components/common/financial-feedback";
import { formatMoney } from "@/features/employee/utils/money-display";
import { operationLabels } from "@/features/employee/utils/ledger-presentation";
import {
  financialOriginSchema,
  ledgerDirectionSchema,
} from "@template/contracts";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";

const PAGE_SIZE = 25;

// Function-size exception: filters, aggregates and detail selection describe one
// ledger view. Revisit when a detail panel becomes an independently reused view.
export function FinanceLedgerScreen() {
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [directionFilter, setDirectionFilter] = useState("all");
  const [selection, setSelection] = useState<{
    id: string;
    identity: string;
  } | null>(null);
  const origin = financialOriginSchema.safeParse(typeFilter);
  const direction = ledgerDirectionSchema.safeParse(directionFilter);
  const ledger = useFinanceLedger({
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
    ...(origin.success ? { origin: origin.data } : {}),
    ...(direction.success ? { direction: direction.data } : {}),
  });
  const currentPage = ledger.page;
  const setCurrentPage = ledger.setPage;
  const identity = JSON.stringify([
    ledger.scope,
    searchQuery,
    typeFilter,
    directionFilter,
    currentPage,
  ]);
  const selectedId =
    selection?.identity === identity && ledger.allowed ? selection.id : null;
  const detail = useFinanceDetail(selectedId);
  const paginatedTransactions =
    ledger.data?.items.map((row) => ({
      id: row.operationId,
      employeeId: row.employee.id,
      employeeName: row.employee.fullName,
      title: operationLabels[row.origin],
      amount: row.signedOwnershipDelta,
      direction: row.direction.toLowerCase(),
      source: row.sourceMovements
        .map((movement) =>
          movement.source === "REFERRAL" ? "إحالات" : "غير إحالات",
        )
        .join(" / "),
      date: row.recordedAt,
      reference: row.referenceLabel,
    })) ?? [];
  const filteredTransactions = paginatedTransactions;
  const totalPages = ledger.data?.pagination.totalPages ?? 0;
  const totalCredits = ledger.data
    ? formatMoney(ledger.data.summary.credits)
    : "—";
  const totalDebits = ledger.data
    ? formatMoney(ledger.data.summary.debits)
    : "—";
  const neutralOperationsCount =
    ledger.data?.summary.neutralOperationsCount ?? "—";
  const typeFilterOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "كل أنواع العمليات" },
    ...financialOriginSchema.options.map((value) => ({
      value,
      label: operationLabels[value],
    })),
  ];
  const directionFilterOptions: readonly AdminSelectOption[] = [
    { value: "all", label: "كل الحركات" },
    { value: "CREDIT", label: "إضافة رصيد (+)" },
    { value: "DEBIT", label: "خصم رصيد (-)" },
    { value: "NEUTRAL", label: "حجز أو فك حجز الرصيد" },
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
            +{totalCredits} USDT
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
            -{totalDebits} USDT
          </div>
          <span className="mt-1 block text-[11px] text-rose-700">
            شراء باقات وتسويات مالية مسجلة
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

      <FinancialFeedback
        pending={ledger.isPending}
        error={ledger.error}
        retry={ledger.refetch}
      />
      {/* Ledger Table: Jargon replaced with clear labels */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={ledger.data?.pagination.total ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {ledger.data && filteredTransactions.length === 0 ? (
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
                        ? `+${formatMoney(tx.amount)}`
                        : tx.direction === "debit"
                          ? formatMoney(tx.amount)
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
                        setSelection({ id: tx.id, identity });
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

      <AdminConfirmDialog
        isOpen={selectedId !== null}
        title="تفاصيل العملية المالية"
        variant="primary"
        confirmLabel="إغلاق"
        cancelLabel="إغلاق"
        onClose={() => {
          setSelection(null);
        }}
        onConfirm={() => true}
        description={
          <div className="space-y-4 text-xs">
            <FinancialFeedback
              pending={detail.isPending}
              error={detail.error}
              retry={detail.refetch}
            />
            {detail.data && (
              <>
                <div className="space-y-2.5 rounded-md border border-slate-200 bg-slate-50 p-4">
                  <p>الموظف: {detail.data.employee.fullName}</p>
                  <p>البيان: {operationLabels[detail.data.origin]}</p>
                  <p>
                    المبلغ الصافي:{" "}
                    <bdi dir="ltr">
                      {formatMoney(detail.data.signedOwnershipDelta)} USDT
                    </bdi>
                  </p>
                  <p>
                    المرجع: <bdi dir="ltr">{detail.data.referenceLabel}</bdi>
                  </p>
                  <p>
                    التاريخ: <bdi dir="ltr">{detail.data.recordedAt}</bdi>
                  </p>
                  {detail.data.sourceMovements.map((movement) => (
                    <p key={movement.source}>
                      {movement.source === "REFERRAL" ? "إحالات" : "غير إحالات"}
                      : المتاح <bdi>{formatMoney(movement.availableDelta)}</bdi>{" "}
                      · المحجوز <bdi>{formatMoney(movement.reservedDelta)}</bdi>
                    </p>
                  ))}
                </div>
                {detail.data.actor && (
                  <p>منفذ التسوية: {detail.data.actor.fullName}</p>
                )}
                {detail.data.correction && (
                  <p>
                    السبب: {detail.data.correction.reason} · العملية المرجعية:{" "}
                    <bdi>{detail.data.correction.referenceOperationId}</bdi>
                  </p>
                )}
                {detail.data.savedTerms && (
                  <p>
                    شروط الشراء المحفوظة: {detail.data.savedTerms.code} ·{" "}
                    <bdi>{formatMoney(detail.data.savedTerms.price)} USDT</bdi>{" "}
                    · {detail.data.savedTerms.countedWorkDates} يوم
                  </p>
                )}
              </>
            )}
          </div>
        }
      />
    </div>
  );
}
