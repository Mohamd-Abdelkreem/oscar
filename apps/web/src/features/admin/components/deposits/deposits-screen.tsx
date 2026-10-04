"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import { Banknote, Check, Copy, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminDepositStatus } from "../../types/admin.types";

const PAGE_SIZE = 10;

// Function-size exception: the credit form and deposit list share one confirmation
// workflow. Revisit when the form is reused or acquires a separate lifecycle.
export function DepositsScreen() {
  const scheduleTimeout = useManagedTimeout();
  const { deposits, employees, manualCreditDeposit } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedTxId, setCopiedTxId] = useState<string | null>(null);

  // Manual deposit modal
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDepositOpen, setConfirmDepositOpen] = useState(false);
  const [selectedEmpId, setSelectedEmpId] = useState<string>(
    employees[0]?.id ?? "",
  );
  const [depositAmount, setDepositAmount] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositReason, setDepositReason] = useState("");
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const filteredDeposits = useMemo(() => {
    return deposits.filter((d) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !d.employeeName.toLowerCase().includes(q) &&
          !d.employeeEmail.toLowerCase().includes(q) &&
          !d.txId.toLowerCase().includes(q) &&
          !d.reference.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (statusFilter !== "all" && d.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [deposits, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredDeposits.length / PAGE_SIZE) || 1;
  const paginatedDeposits = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredDeposits.slice(start, start + PAGE_SIZE);
  }, [filteredDeposits, currentPage]);

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text);
    setCopiedTxId(text);
    scheduleTimeout(() => {
      setCopiedTxId(null);
    }, 1500);
  };

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmpId),
    [employees, selectedEmpId],
  );

  const handleOpenConfirmDeposit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0 || !depositReference.trim() || !depositReason.trim()) {
      return;
    }
    setConfirmDepositOpen(true);
  };

  const handleExecuteManualDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;

    const res = manualCreditDeposit(
      selectedEmpId,
      amount,
      depositReference.trim(),
      depositReason.trim(),
    );

    setFeedback(res);
    if (res.success) {
      setConfirmDepositOpen(false);
      setModalOpen(false);
      setDepositAmount("");
      setDepositReference("");
      setDepositReason("");
    }
  };

  const statusBadgeMap: Record<
    AdminDepositStatus,
    { label: string; variant: "success" | "warning" | "danger" }
  > = {
    confirmed: { label: "مؤكد", variant: "success" },
    verifying: { label: "قيد التحقق", variant: "warning" },
    rejected: { label: "مرفوض", variant: "danger" },
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
            onClick={() => {
              setDepositReference(
                `MAN-DEP-${Date.now().toString(36).toUpperCase()}`,
              );
              setDepositReason("");
              setDepositAmount("");
              setModalOpen(true);
            }}
          >
            إيداع يدوي معتمد
          </AdminButton>
        }
      />

      {feedback && (
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
                setCurrentPage(1);
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
                setCurrentPage(1);
              }}
              options={[
                { value: "all", label: "كل حالات الإيداع" },
                { value: "confirmed", label: "مؤكد" },
                { value: "verifying", label: "قيد التحقق" },
                { value: "rejected", label: "مرفوض" },
              ]}
              ariaLabel="تصفية حسب حالة الإيداع"
            />
          </div>
        </div>
      </div>

      {/* Deposits Table */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredDeposits.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {filteredDeposits.length === 0 ? (
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
              {paginatedDeposits.map((dep) => {
                const statusMeta = statusBadgeMap[dep.status];

                return (
                  <tr key={dep.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <Link
                          href={`/admin/employees/${dep.employeeId}`}
                          className="block font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {dep.employeeName}
                        </Link>
                        <bdi
                          dir="ltr"
                          className="block text-[11px] text-slate-500"
                        >
                          {dep.employeeEmail}
                        </bdi>
                      </div>
                    </td>

                    <td
                      className="px-4 py-3 font-mono text-sm font-bold whitespace-nowrap text-emerald-700"
                      dir="ltr"
                    >
                      +{dep.amount.toFixed(2)} {dep.currency}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap text-slate-600">
                      {dep.network}
                    </td>

                    <td className="px-4 py-3">
                      <div
                        className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600"
                        dir="ltr"
                      >
                        <span
                          className="max-w-[12rem] truncate"
                          title={dep.txId}
                        >
                          {dep.txId}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            handleCopy(dep.txId);
                          }}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          title="نسخ معرف المعاملة"
                          aria-label={`نسخ المعرف ${dep.txId}`}
                        >
                          {copiedTxId === dep.txId ? (
                            <Check
                              size={12}
                              className="text-emerald-600"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy size={12} aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      <span className="block font-mono text-[10px] text-slate-400">
                        مرجع: {dep.reference}
                      </span>
                    </td>

                    <td
                      className="max-w-[10rem] truncate px-4 py-3 font-mono text-[11px] text-slate-500"
                      dir="ltr"
                      title={dep.toAddress}
                    >
                      {dep.toAddress}
                    </td>

                    <td
                      className="px-4 py-3 font-mono whitespace-nowrap text-slate-500"
                      dir="ltr"
                    >
                      {dep.createdAt}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      <AdminBadge variant={statusMeta.variant} size="sm" dot>
                        {statusMeta.label}
                      </AdminBadge>
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">
                      {dep.isManual ? (
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
      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-900">
              إضافة إيداع يدوي استثنائي معتمد
            </div>

            <form
              onSubmit={handleOpenConfirmDeposit}
              className="space-y-4 p-5 text-xs sm:text-sm"
            >
              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  الموظف المستفيد: <span className="text-rose-600">*</span>
                </label>
                <AdminSelect
                  value={selectedEmpId}
                  onValueChange={setSelectedEmpId}
                  options={employees
                    .filter((e) => !e.isDeleted)
                    .map((emp) => ({
                      value: emp.id,
                      label: `${emp.name} (${emp.email})`,
                    }))}
                  ariaLabel="الموظف المستفيد"
                />
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  المبلغ (USDT): <span className="text-rose-600">*</span>
                </label>
                <AdminInput
                  type="number"
                  step="0.01"
                  min="0.01"
                  icon={Banknote}
                  value={depositAmount}
                  onChange={(e) => {
                    setDepositAmount(e.target.value);
                  }}
                  placeholder="0.00"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  الرقم المرجعي الفريد: <span className="text-rose-600">*</span>
                </label>
                <AdminInput
                  type="text"
                  dir="ltr"
                  value={depositReference}
                  onChange={(e) => {
                    setDepositReference(e.target.value);
                  }}
                  placeholder="MAN-DEP-..."
                  required
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  يمنع النظام تكرار قيد الإيداع لنفس الرقم المرجعي.
                </p>
              </div>

              <div>
                <label className="mb-1.5 block font-bold text-slate-700">
                  سبب الإيداع اليدوي الإلزامي:{" "}
                  <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={3}
                  value={depositReason}
                  onChange={(e) => {
                    setDepositReason(e.target.value);
                  }}
                  placeholder="مثال: تسوية تحويل بنكي خارجي مؤكد أو مطابقة يدوية لإيداع شبكة..."
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <AdminButton
                  variant="outline"
                  size="default"
                  onClick={() => {
                    setModalOpen(false);
                  }}
                >
                  إلغاء
                </AdminButton>
                <AdminButton type="submit" variant="primary" size="default">
                  مراجعة وتأكيد الإيداع
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Manual Deposit Dialog */}
      <AdminConfirmDialog
        isOpen={confirmDepositOpen}
        title="تأكيد إضافة الإيداع اليدوي الاستثنائي"
        description={
          <div className="space-y-2">
            <p>
              أنت على وشك إضافة رصيد يدوي معتمد بقيمة{" "}
              <strong className="font-mono text-emerald-700">
                {parseFloat(depositAmount || "0").toFixed(2)} USDT
              </strong>{" "}
              إلى حساب الموظف <strong>{selectedEmployee?.name}</strong>.
            </p>
            <p className="text-slate-500">
              المرجع: <bdi dir="ltr">{depositReference}</bdi> | سيتم تسجيل القيد فوراً في السجل المالي وسجل التدقيق.
            </p>
          </div>
        }
        confirmLabel="تأكيد إضافة الرصيد"
        variant="primary"
        affectedRecord={{
          id: selectedEmpId,
          label: selectedEmployee?.name ?? "موظف",
          subtitle: `المبلغ: ${depositAmount} USDT | المرجع: ${depositReference}`,
        }}
        onConfirm={handleExecuteManualDeposit}
        onClose={() => {
          setConfirmDepositOpen(false);
        }}
      />
    </div>
  );
}
