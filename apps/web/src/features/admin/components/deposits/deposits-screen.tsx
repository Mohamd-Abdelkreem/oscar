"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { Banknote, Check, Copy, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAdminDeposits, useManualCredit } from "../../hooks/deposits.hooks";
import { useManualCreditDialog } from "../../hooks/use-manual-credit-dialog";
import { formatBaghdadDateTime } from "@/shared/time/baghdad-time";
import { formatMoney } from "@/features/employee/utils/money-display";
import { TaskQueryState } from "../common/task-query-state";
import { getSessionRuntime } from "@/services/api/session-runtime";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";

const PAGE_SIZE = 10;

// Function-size exception: the credit form and deposit list share one confirmation
// workflow. Revisit when the form is reused or acquires a separate lifecycle.
export function DepositsScreen() {
  const scheduleTimeout = useManagedTimeout();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const history = useAdminDeposits({
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
    ...(statusFilter === "CHAIN_DEPOSIT" || statusFilter === "MANUAL_CREDIT"
      ? { kind: statusFilter }
      : {}),
  });
  const visibleHistory = history.visibleHistory;
  const copyAttempt = useRef(0);
  const copyScope = JSON.stringify([
    history.scope,
    searchQuery.trim(),
    statusFilter,
    history.page,
  ]);
  useEffect(
    () => () => {
      copyAttempt.current++;
    },
    [copyScope],
  );
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Manual deposit modal
  const [modalOpen, setModalOpen] = useState(false);
  const grant = useManualCredit(modalOpen, history.refetch);
  const { draft, reviewed } = grant;
  const formTitleId = useId();
  const formOpen = modalOpen && history.allowed && grant.allowed;
  const closeForm = useCallback(() => {
    if (!grant.pending) setModalOpen(false);
  }, [grant.pending]);
  const formRef = useManualCreditDialog({
    open: formOpen,
    active: formOpen && reviewed === null,
    close: closeForm,
  });
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleCopy = async (text: string) => {
    if (!history.allowed) return;
    const attempt = ++copyAttempt.current;
    const scope = history.scope;
    setCopiedTxId(null);
    try {
      await navigator.clipboard.writeText(text);
      if (
        attempt !== copyAttempt.current ||
        !getSessionRuntime().isCurrentCheck(scope)
      )
        return;
      setCopiedTxId(copyScope + text);
      setFeedback(null);
      scheduleTimeout(() => {
        if (attempt === copyAttempt.current) setCopiedTxId(null);
      }, 1500);
    } catch {
      if (
        attempt !== copyAttempt.current ||
        !getSessionRuntime().isCurrentCheck(scope)
      )
        return;
      setFeedback({
        success: false,
        message: "تعذر نسخ المعرف. يمكنك تحديد القيمة ونسخها يدويًا.",
      });
    }
  };
  const handleOpenConfirmDeposit = (event: React.SyntheticEvent) => {
    event.preventDefault();
    grant.review();
  };
  const handleExecuteManualDeposit = async () => {
    const committed = await grant.confirm();
    if (committed && getSessionRuntime().isCurrentCheck(grant.scope)) {
      setModalOpen(false);
      setFeedback({
        success: true,
        message: "تم تسجيل الإيداع اليدوي المعتمد.",
      });
    }
    return committed;
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة عمليات الإيداع"
        description="متابعة الإيداعات الواردة عبر شبكة TRON (TRC20)، التحقق من المعاملات، وتنفيذ الإيداع اليدوي الاستثنائي"
        breadcrumbs={[{ label: "الإيداعات" }]}
        action={
          <AdminButton
            variant="primary"
            icon={Plus}
            disabled={!history.allowed || !grant.allowed || grant.pending}
            onClick={() => {
              if (!history.allowed) return;
              setModalOpen(true);
            }}
          >
            إيداع يدوي معتمد
          </AdminButton>
        }
      />

      {grant.allowed && grant.uncertain && (
        <TaskQueryState
          error="نتيجة الإيداع اليدوي غير محسومة. تُراجع العملية الأصلية فقط؛ لا يمكن إنشاء إضافة بديلة."
          retry={grant.original.refetch}
        />
      )}
      {grant.allowed && grant.error && !grant.uncertain && (
        <TaskQueryState
          error="تعذر تنفيذ الإيداع اليدوي بأمان. احتُفظ بالمدخلات؛ تحقق من الاتصال والتنسيق قبل المحاولة."
          retry={grant.targets.refetch}
        />
      )}

      {history.allowed && feedback && (
        <div
          className={`flex items-center justify-between rounded-lg p-3.5 text-xs font-bold sm:text-sm ${
            feedback.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="alert"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
            }}
            className="text-xs underline hover:no-underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <AdminInput
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
              }}
              placeholder="بحث بالموظف، البريد، TxID، أو المرجع..."
              aria-label="بحث في الإيداعات"
            />
          </div>

          <div>
            <AdminSelect
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
              }}
              options={[
                { value: "all", label: "كل أنواع الإيداع" },
                { value: "CHAIN_DEPOSIT", label: "آلي" },
                { value: "MANUAL_CREDIT", label: "يدوي (إدارة)" },
              ]}
              ariaLabel="تصفية حسب نوع الإيداع"
            />
          </div>
        </div>
      </div>

      {history.isPending || history.error || history.observationExhausted ? (
        <TaskQueryState
          error={
            history.error
              ? history.error.category === "denied"
                ? "غير مسموح بالوصول إلى هذه البيانات."
                : "تعذر تحميل سجل الإيداعات. لا توجد نتيجة مؤكدة."
              : history.observationExhausted
                ? "توقف التحديث التلقائي. أعد التحديث للتحقق من السجل الحالي."
                : undefined
          }
          retry={
            visibleHistory === undefined
              ? history.recoverFirstPage
              : history.refetch
          }
        />
      ) : null}
      {/* Deposits Table */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={history.page}
            totalPages={visibleHistory?.pagination.totalPages ?? 0}
            totalItems={visibleHistory?.pagination.total ?? 0}
            pageSize={PAGE_SIZE}
            onPageChange={history.setPage}
          />
        }
      >
        {visibleHistory === undefined ? null : visibleHistory.items.length ===
          0 ? (
          <AdminEmptyState
            title="لا توجد إيداعات مطابقة"
            description="لم يتم العثور على أي إيداعات تطابق معايير البحث الحالية."
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">الشبكة</th>
                <th className="px-4 py-3">معرف المعاملة (TxID) / المرجع</th>
                <th className="px-4 py-3">عنوان الاستلام</th>
                <th className="px-4 py-3">وقت الرصد</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">النوع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleHistory.items.map((dep) => {
                const isManual = dep.kind === "MANUAL_CREDIT";
                const publicReference =
                  dep.kind === "CHAIN_DEPOSIT"
                    ? dep.transactionId
                    : dep.reference.kind === "EXTERNAL"
                      ? dep.reference.value
                      : dep.reference.operationId;

                return (
                  <tr key={dep.operationId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <Link
                          href={`/admin/employees/${dep.employee.id}`}
                          className="block font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {dep.employee.name}
                        </Link>
                        <bdi
                          dir="ltr"
                          className="block text-[11px] text-slate-500"
                        >
                          {dep.employee.email}
                        </bdi>
                      </div>
                    </td>

                    <td
                      className="px-4 py-3 font-mono text-sm font-bold whitespace-nowrap text-emerald-700"
                      dir="ltr"
                    >
                      +{formatMoney(dep.amount)} USDT
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {dep.kind === "CHAIN_DEPOSIT" ? dep.network : "—"}
                    </td>

                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600"
                        dir="ltr"
                      >
                        <span
                          className="max-w-[12rem] truncate"
                          title={publicReference}
                        >
                          {publicReference}
                        </span>
                        {dep.kind === "CHAIN_DEPOSIT" ? (
                          <button
                            type="button"
                            onClick={() => {
                              void handleCopy(publicReference);
                            }}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                            title="نسخ معرف المعاملة"
                            aria-label={`نسخ المعرف ${publicReference}`}
                          >
                            {copiedTxId === copyScope + publicReference ? (
                              <Check
                                size={12}
                                className="text-emerald-600"
                                aria-hidden="true"
                              />
                            ) : (
                              <Copy size={12} aria-hidden="true" />
                            )}
                          </button>
                        ) : null}
                      </div>
                      <span className="block font-mono text-[10px] text-slate-400">
                        {dep.kind === "MANUAL_CREDIT" ? (
                          <>
                            {dep.actor.name} (
                            <bdi dir="ltr">{dep.actor.email}</bdi>) —{" "}
                            {dep.reason}
                          </>
                        ) : null}
                      </span>
                      {dep.kind === "MANUAL_CREDIT" ? (
                        <span className="block font-mono text-[10px] text-slate-400">
                          معرف الإضافة: <bdi dir="ltr">{dep.operationId}</bdi>
                        </span>
                      ) : null}
                    </td>

                    <td
                      className="max-w-[10rem] truncate px-4 py-3 font-mono text-[11px] text-slate-500"
                      dir="ltr"
                      title={
                        dep.kind === "CHAIN_DEPOSIT" ? dep.address : undefined
                      }
                    >
                      {dep.kind === "CHAIN_DEPOSIT" ? dep.address : "—"}
                    </td>

                    <td
                      className="px-4 py-3 font-mono whitespace-nowrap text-slate-500"
                      dir="ltr"
                    >
                      {formatBaghdadDateTime(dep.recordedAt)}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge variant="success" size="sm" dot>
                        {isManual ? "مسجل" : "مؤكد"}
                      </AdminBadge>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {isManual ? (
                        <span className="rounded border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-[10px] font-bold text-sky-800">
                          يدوي (إدارة)
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">آلي</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminTableShell>

      {/* Manual Deposit Modal */}
      {formOpen && (
        <div
          ref={formRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-labelledby={formTitleId}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div
              id={formTitleId}
              className="border-b border-slate-100 p-4 font-bold text-slate-900"
            >
              إضافة إيداع يدوي استثنائي معتمد
            </div>

            {!grant.targets.data || grant.targets.isError ? (
              <TaskQueryState
                error={
                  grant.targets.error
                    ? "تعذر تحميل الموظفين. لا يمكن تأكيد إضافة حتى استعادة الاختيار المعتمد."
                    : undefined
                }
                retry={grant.targets.refetch}
              />
            ) : grant.targets.data.items.length === 0 ? (
              <p className="px-5 pt-4 text-xs text-slate-600" role="status">
                لا يوجد موظفون مطابقون.
              </p>
            ) : null}
            <form
              onSubmit={handleOpenConfirmDeposit}
              className="space-y-4 p-5 text-xs sm:text-sm"
            >
              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  الموظف المستفيد: <span className="text-rose-600">*</span>
                </label>
                <AdminSelect
                  value={grant.selected?.id ?? ""}
                  onValueChange={grant.select}
                  options={grant.options}
                  disabled={
                    grant.blocked ||
                    !grant.targets.isSuccess ||
                    grant.targets.isFetching
                  }
                  ariaLabel="الموظف المستفيد"
                />
                {grant.targets.data && !grant.blocked && (
                  <AdminPagination
                    currentPage={grant.targets.page}
                    totalPages={grant.targets.data.pagination.totalPages}
                    totalItems={grant.targets.data.pagination.total}
                    pageSize={25}
                    onPageChange={grant.targets.setPage}
                  />
                )}
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  المبلغ (USDT): <span className="text-rose-600">*</span>
                </label>
                <AdminInput
                  type="text"
                  inputMode="decimal"
                  icon={Banknote}
                  value={draft.amount}
                  aria-label="المبلغ (USDT)"
                  disabled={grant.blocked}
                  onChange={(e) => {
                    grant.edit("amount", e.target.value);
                  }}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  المرجع الإداري: <span className="text-rose-600">*</span>
                </label>
                <AdminInput
                  type="text"
                  dir="ltr"
                  value={draft.reference}
                  aria-label="المرجع الإداري"
                  disabled={grant.blocked}
                  onChange={(e) => {
                    grant.edit("reference", e.target.value);
                  }}
                  placeholder="MAN-DEP-..."
                  required
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  تُحمى العملية نفسها من التكرار؛ يمكن استخدام المرجع في عمليات
                  مستقلة مؤكدة.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  سبب الإيداع اليدوي الإلزامي:{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={draft.reason}
                  aria-label="سبب الإيداع اليدوي الإلزامي"
                  disabled={grant.blocked}
                  onChange={(e) => {
                    grant.edit("reason", e.target.value);
                  }}
                  placeholder="مثال: تسوية تحويل بنكي خارجي مؤكد أو مطابقة يدوية لإيداع شبكة..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <AdminButton
                  variant="outline"
                  size="default"
                  disabled={grant.pending}
                  onClick={closeForm}
                >
                  إلغاء
                </AdminButton>
                <AdminButton
                  type="submit"
                  variant="primary"
                  size="default"
                  disabled={!grant.canReview}
                >
                  مراجعة وتأكيد الإيداع
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Manual Deposit Dialog */}
      <AdminConfirmDialog
        isOpen={reviewed !== null && history.allowed && grant.allowed}
        isLoading={grant.pending}
        confirmDisabled={!grant.canReview}
        error={
          grant.uncertain
            ? "نتيجة العملية غير محسومة؛ تُراجع العملية الأصلية فقط."
            : grant.error
              ? "تعذر تنفيذ الإضافة بأمان. لم يُعلن نجاح مالي."
              : null
        }
        title="تأكيد إضافة الإيداع اليدوي الاستثنائي"
        description={
          <div className="space-y-2">
            <p>
              أنت على وشك إضافة رصيد يدوي معتمد بقيمة{" "}
              <strong className="font-mono text-emerald-700">
                <bdi dir="ltr">{reviewed?.body.amount} USDT</bdi>
              </strong>{" "}
              إلى حساب الموظف{" "}
              <strong>
                {reviewed?.employee.name} (
                <bdi dir="ltr">{reviewed?.employee.email}</bdi>)
              </strong>
              .
            </p>
            <p className="text-slate-500">السبب: {reviewed?.body.reason}</p>
            <p className="text-slate-500">
              المرجع:{" "}
              <bdi dir="ltr">
                {reviewed?.body.reference.kind === "EXTERNAL"
                  ? reviewed.body.reference.value
                  : ""}
              </bdi>{" "}
              | سيتم تسجيل القيد فوراً في السجل المالي وسجل التدقيق.
            </p>
          </div>
        }
        confirmLabel="تأكيد إضافة الرصيد"
        variant="primary"
        affectedRecord={{
          id: reviewed?.employee.id,
          label: reviewed?.employee.name ?? "موظف",
          subtitle: `المبلغ: ${reviewed?.body.amount ?? ""} USDT`,
        }}
        onConfirm={handleExecuteManualDeposit}
        onClose={() => {
          grant.closeReview();
        }}
      />
    </div>
  );
}
