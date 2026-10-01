"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect, type AdminSelectOption } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { ExtendScheduleDialog } from "./extend-schedule-dialog";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminWithdrawal } from "../../types/admin.types";

import { WithdrawalRow } from "./withdrawal-row";

const PAGE_SIZE = 10;
export function WithdrawalsScreen() {
  const {
    withdrawals,
    extendWithdrawalSchedule,
    releaseWithdrawal,
    rejectWithdrawal,
    completeWithdrawal,
  } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Shared screen-level clock (Requirement 3: updates every 30s + refreshes on tab visibility)
  const [currentTimeMs, setCurrentTimeMs] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTimeMs(Date.now());
    }, 30_000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setCurrentTimeMs(Date.now());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Dialog states
  const [selectedWithdrawal, setSelectedWithdrawal] =
    useState<AdminWithdrawal | null>(null);
  const [extendModalOpen, setExtendModalOpen] = useState(false);
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [completeConfirmOpen, setCompleteConfirmOpen] = useState(false);

  const filteredWithdrawals = useMemo(() => {
    return withdrawals.filter((w) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !w.employeeName.toLowerCase().includes(q) &&
          !w.employeeEmail.toLowerCase().includes(q) &&
          !w.targetAddress.toLowerCase().includes(q) &&
          !w.id.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (statusFilter !== "all" && w.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [withdrawals, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filteredWithdrawals.length / PAGE_SIZE) || 1;
  const paginatedWithdrawals = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredWithdrawals.slice(start, start + PAGE_SIZE);
  }, [filteredWithdrawals, currentPage]);

  const handleExtendConfirm = (additionalHours: number, reason: string) => {
    if (!selectedWithdrawal) return;
    const res = extendWithdrawalSchedule(
      selectedWithdrawal.id,
      additionalHours,
      reason,
    );
    setFeedback(res.message);
    setSelectedWithdrawal(null);
    setExtendModalOpen(false);
  };

  const handleReleaseConfirm = () => {
    if (!selectedWithdrawal) return;
    releaseWithdrawal(selectedWithdrawal.id);
    setFeedback(
      `تم فك تعليق طلب السحب ${selectedWithdrawal.id} واستئناف الجدولة بنجاح.`,
    );
    setSelectedWithdrawal(null);
    setReleaseModalOpen(false);
  };

  const handleRejectConfirm = (reason?: string) => {
    if (!selectedWithdrawal) return;
    const res = rejectWithdrawal(selectedWithdrawal.id, reason ?? "");
    setFeedback(res.message);
    setSelectedWithdrawal(null);
    setRejectModalOpen(false);
  };

  const handleCompleteConfirm = () => {
    if (!selectedWithdrawal) return;
    completeWithdrawal(selectedWithdrawal.id);
    setFeedback(`تم إتمام تسوية طلب السحب ${selectedWithdrawal.id} بنجاح.`);
    setSelectedWithdrawal(null);
    setCompleteConfirmOpen(false);
  };

  const filterOptions: readonly AdminSelectOption[] = [
    { value: "all", label: `كل حالات السحب (${String(withdrawals.length)})` },
    {
      value: "scheduled",
      label: `المجدولة (${String(withdrawals.filter((w) => w.status === "scheduled").length)})`,
    },
    {
      value: "held",
      label: `المعلقة (${String(withdrawals.filter((w) => w.status === "held").length)})`,
    },
    {
      value: "processing",
      label: `قيد المعالجة (${String(withdrawals.filter((w) => w.status === "processing").length)})`,
    },
    {
      value: "completed",
      label: `المكتملة (${String(withdrawals.filter((w) => w.status === "completed").length)})`,
    },
    {
      value: "rejected",
      label: `المرفوضة (${String(withdrawals.filter((w) => w.status === "rejected").length)})`,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة طلبات السحب المالي"
        description="متابعة طلبات سحب الأرباح (الحد الأدنى 16 USDT، الأقصى 500 USDT، الرسوم 21%)، زيادة الجدولة، والاعتماد النهائي"
        breadcrumbs={[{ label: "طلبات السحب" }]}
      />

      {feedback && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
            }}
            className="cursor-pointer text-xs underline hover:no-underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Filter and Search Bar: Standardized 44px Height Control Pair (Requirement 9) */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
          <div className="sm:col-span-8">
            <AdminInput
              type="text"
              icon={Search}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="بحث بالموظف، البريد، أو عنوان المحفظة..."
              aria-label="بحث في طلبات السحب"
            />
          </div>

          <div className="sm:col-span-4">
            <AdminSelect
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val);
                setCurrentPage(1);
              }}
              options={filterOptions}
              aria-label="تصفية حسب حالة السحب"
            />
          </div>
        </div>
      </div>

      {/* Withdrawals Table */}
      <AdminTableShell
        footer={
          <AdminPagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredWithdrawals.length}
            pageSize={PAGE_SIZE}
            onPageChange={setCurrentPage}
          />
        }
      >
        {filteredWithdrawals.length === 0 ? (
          <AdminEmptyState
            title="لا توجد طلبات سحب مطابقة"
            description="لم يتم العثور على أي طلبات سحب تطابق معايير البحث الحالية."
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">المبلغ المطلوب</th>
                <th className="px-4 py-3">الرسوم (21%)</th>
                <th className="px-4 py-3">الصافي المحول</th>
                <th className="px-4 py-3">عنوان المحفظة</th>
                <th className="px-4 py-3">الطلب / الاستحقاق</th>
                <th className="px-4 py-3">الوقت المتبقي</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedWithdrawals.map((wth) => (
                <WithdrawalRow
                  key={wth.id}
                  wth={wth}
                  currentTimeMs={currentTimeMs}
                  onExtend={(withdrawal) => {
                    setSelectedWithdrawal(withdrawal);
                    setExtendModalOpen(true);
                  }}
                  onRelease={(withdrawal) => {
                    setSelectedWithdrawal(withdrawal);
                    setReleaseModalOpen(true);
                  }}
                  onComplete={(withdrawal) => {
                    setSelectedWithdrawal(withdrawal);
                    setCompleteConfirmOpen(true);
                  }}
                  onReject={(withdrawal) => {
                    setSelectedWithdrawal(withdrawal);
                    setRejectModalOpen(true);
                  }}
                />
              ))}
            </tbody>
          </table>
        )}
      </AdminTableShell>

      {/* Requirement 10: Schedule Extension Dialog */}
      <ExtendScheduleDialog
        isOpen={extendModalOpen}
        withdrawal={selectedWithdrawal}
        currentTimeMs={currentTimeMs}
        onConfirm={handleExtendConfirm}
        onClose={() => {
          setExtendModalOpen(false);
        }}
      />

      {/* Release Held Withdrawal Confirmation Dialog */}
      <AdminConfirmDialog
        isOpen={releaseModalOpen}
        title="تأكيد فك تعليق طلب السحب"
        description={
          selectedWithdrawal ? (
            <p>
              سيتم فك تعليق طلب السحب بمبلغ{" "}
              <strong className="font-mono">
                {selectedWithdrawal.amount.toFixed(2)} USDT
              </strong>{" "}
              الخاص بالموظف <strong>{selectedWithdrawal.employeeName}</strong>{" "}
              واستئناف معالجته المجدولة.
            </p>
          ) : null
        }
        recordInfo={
          selectedWithdrawal
            ? {
                label: "طلب السحب",
                value: `${selectedWithdrawal.amount.toFixed(2)} USDT - ${selectedWithdrawal.employeeName}`,
                secondary: selectedWithdrawal.targetAddress,
              }
            : undefined
        }
        confirmLabel="تأكيد فك التعليق"
        variant="primary"
        onConfirm={handleReleaseConfirm}
        onClose={() => {
          setReleaseModalOpen(false);
        }}
      />

      {/* Reject Modal */}
      <AdminConfirmDialog
        isOpen={rejectModalOpen}
        title="رفض طلب السحب وإلغاء الحجز المالي"
        description={
          selectedWithdrawal ? (
            <div className="space-y-2">
              <p>
                سيتم رفض طلب السحب بمبلغ{" "}
                <strong className="font-mono">
                  {selectedWithdrawal.amount.toFixed(2)} USDT
                </strong>{" "}
                الخاص بالموظف <strong>{selectedWithdrawal.employeeName}</strong>
                .
              </p>
              <p className="text-slate-500">
                ملاحظة أمان: سيتم تحرير المبلغ المحجوز تلقائياً وإعادته إلى
                الرصيد المتاح للموظف فوراً، وتسجيل قيد عكسي في السجل المالي.
              </p>
            </div>
          ) : null
        }
        recordInfo={
          selectedWithdrawal
            ? {
                label: "الموظف والمبلغ",
                value: `${selectedWithdrawal.employeeName} — ${selectedWithdrawal.amount.toFixed(2)} USDT`,
                secondary: selectedWithdrawal.targetAddress,
              }
            : undefined
        }
        confirmLabel="تأكيد الرفض وتحرير الرصيد"
        variant="destructive"
        requireReason
        reasonLabel="سبب رفض السحب الإلزامي"
        reasonPlaceholder="يرجى ذكر سبب الرفض لحفظه في سجل التدقيق..."
        onConfirm={handleRejectConfirm}
        onClose={() => {
          setRejectModalOpen(false);
        }}
      />

      {/* Complete Settlement Modal */}
      <AdminConfirmDialog
        isOpen={completeConfirmOpen}
        title="إتمام تسوية طلب السحب"
        description={
          selectedWithdrawal ? (
            <div className="space-y-2">
              <p>
                هل تؤكد إتمام تحويل وتسوية مبلغ{" "}
                <strong className="font-mono text-emerald-800">
                  {selectedWithdrawal.netAmount.toFixed(2)} USDT
                </strong>{" "}
                (الصافي بعد خصم الرسوم {selectedWithdrawal.fee.toFixed(2)} USDT)
                إلى عنوان المحفظة:
              </p>
              <p
                className="rounded bg-slate-100 p-2 font-mono font-bold break-all text-slate-800"
                dir="ltr"
              >
                {selectedWithdrawal.targetAddress}
              </p>
            </div>
          ) : null
        }
        recordInfo={
          selectedWithdrawal
            ? {
                label: "الصافي المراد تحويله",
                value: `${selectedWithdrawal.netAmount.toFixed(2)} USDT`,
                secondary: selectedWithdrawal.targetAddress,
              }
            : undefined
        }
        confirmLabel="تأكيد اكتمال التحويل والتسوية"
        variant="primary"
        onConfirm={handleCompleteConfirm}
        onClose={() => {
          setCompleteConfirmOpen(false);
        }}
      />
    </div>
  );
}
