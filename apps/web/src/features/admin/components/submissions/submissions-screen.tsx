"use client";

import {
  CheckCircle2,
  Eye,
  Search,
  X,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type {
  AdminSubmission,
  AdminSubmissionStatus,
} from "../../types/admin.types";

// Function-size exception: preview and rejection share one selected submission and
// review workflow. Revisit when either dialog gains independent state or reuse.
export function SubmissionsScreen() {
  const { submissions, approveSubmission, rejectSubmission } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] =
    useState<AdminSubmission | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredSubmissions = useMemo(() => {
    return submissions.filter((sub) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (
          !sub.employeeName.toLowerCase().includes(q) &&
          !sub.employeeEmail.toLowerCase().includes(q) &&
          !sub.taskTitle.toLowerCase().includes(q)
        ) {
          return false;
        }
      }

      if (statusFilter !== "all" && sub.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [submissions, searchQuery, statusFilter]);

  const handleApprove = (sub: AdminSubmission) => {
    approveSubmission(sub.id);
    setFeedback(`تم اعتماد تسليم ${sub.employeeName} بنجاح.`);
    setSelectedSubmission(null);
  };

  const handleOpenReject = (sub: AdminSubmission) => {
    setSelectedSubmission(sub);
    setRejectModalOpen(true);
  };

  const statusBadgeMap: Record<
    AdminSubmissionStatus,
    { label: string; variant: "success" | "warning" | "danger" }
  > = {
    pending: { label: "قيد المراجعة والتدقيق", variant: "warning" },
    approved: { label: "معتمد ومصروف", variant: "success" },
    rejected: { label: "مرفوض وتم عكس المكافأة", variant: "danger" },
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="مراجعة وتدقيق مهام الموظفين"
        description="طابور فحص لقطات الشاشة، اعتماد المهام المطابقة، أو رفض المخالفات مع عكس المكافأة تلقائياً"
        breadcrumbs={[{ label: "مراجعة التنفيذ" }]}
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
              placeholder="بحث بالموظف، البريد، أو عنوان المهمة..."
              aria-label="بحث في التسليمات"
            />
          </div>

          <div>
            <AdminSelect
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={[
                { value: "all", label: `كل الحالات (${String(submissions.length)})` },
                {
                  value: "pending",
                  label: `قيد المراجعة (${String(submissions.filter((s) => s.status === "pending").length)})`,
                },
                {
                  value: "approved",
                  label: `المعتمدة (${String(submissions.filter((s) => s.status === "approved").length)})`,
                },
                {
                  value: "rejected",
                  label: `المرفوضة (${String(submissions.filter((s) => s.status === "rejected").length)})`,
                },
              ]}
              ariaLabel="تصفية حسب حالة التسليم"
            />
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <AdminTableShell>
        {filteredSubmissions.length === 0 ? (
          <AdminEmptyState
            title="لا توجد تسليمات في هذا الطابور"
            description="لا توجد مهام مطابقة لمعايير البحث والتصفية المحددة."
          />
        ) : (
          <table className="w-full text-right text-xs">
            <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
              <tr>
                <th className="px-4 py-3">الموظف</th>
                <th className="px-4 py-3">المهمة المرتبطة</th>
                <th className="px-4 py-3">توقيت الإرسال</th>
                <th className="px-4 py-3">لقطة الشاشة</th>
                <th className="px-4 py-3">مكافأة المهمة</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSubmissions.map((sub) => {
                const statusMeta = statusBadgeMap[sub.status];

                return (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        <Link
                          href={`/admin/employees/${sub.employeeId}`}
                          className="block font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                        >
                          {sub.employeeName}
                        </Link>
                        <bdi
                          dir="ltr"
                          className="block text-[11px] text-slate-500"
                        >
                          {sub.employeeEmail}
                        </bdi>
                      </div>
                    </td>

                    <td className="px-4 py-3 font-bold text-slate-800">
                      <Link
                        href={`/admin/tasks/${sub.taskId}`}
                        className="hover:underline"
                      >
                        {sub.taskTitle}
                      </Link>
                    </td>

                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {sub.submittedAt}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedSubmission(sub);
                        }}
                        className="group relative flex h-10 w-16 overflow-hidden rounded border border-slate-200 bg-slate-100"
                        title="انقر لمعاينة لقطة الشاشة بالحجم الكامل"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={sub.screenshotUrl}
                          alt="لقطة الشاشة"
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        />
                      </button>
                    </td>

                    <td
                      className="px-4 py-3 font-mono font-bold text-emerald-700"
                      dir="ltr"
                    >
                      +{sub.rewardAmount.toFixed(2)} USDT
                    </td>

                    <td className="px-4 py-3">
                      <AdminBadge variant={statusMeta.variant} size="sm" dot>
                        {statusMeta.label}
                      </AdminBadge>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <AdminButton
                          variant="outline"
                          size="sm"
                          icon={Eye}
                          onClick={() => {
                            setSelectedSubmission(sub);
                          }}
                        >
                          معاينة
                        </AdminButton>

                        {sub.status === "pending" && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                handleApprove(sub);
                              }}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                              title="اعتماد التسليم وصرف المكافأة"
                            >
                              <CheckCircle2 size={13} aria-hidden="true" />
                              <span>اعتماد</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                handleOpenReject(sub);
                              }}
                              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                              title="رفض التسليم وعكس المكافأة"
                            >
                              <XCircle size={13} aria-hidden="true" />
                              <span>رفض</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </AdminTableShell>

      {/* Submission Review Drawer / Modal */}
      {selectedSubmission && !rejectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSubmission(null);
          }}
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 p-4">
              <h2 className="text-base font-bold text-slate-900">
                تدقيق تسليم المهمة: {selectedSubmission.taskTitle}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubmission(null);
                }}
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-5">
              <div className="grid grid-cols-2 gap-4 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs">
                <div>
                  <span className="block text-slate-500">الموظف:</span>
                  <Link
                    href={`/admin/employees/${selectedSubmission.employeeId}`}
                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {selectedSubmission.employeeName}
                  </Link>
                </div>
                <div>
                  <span className="block text-slate-500">
                    المكافأة المسجلة:
                  </span>
                  <span
                    className="font-mono font-bold text-emerald-700"
                    dir="ltr"
                  >
                    +{selectedSubmission.rewardAmount.toFixed(2)} USDT
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">توقيت الإرسال:</span>
                  <span className="text-slate-700" dir="ltr">
                    {selectedSubmission.submittedAt}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">
                    حالة التدقيق الحالية:
                  </span>
                  <AdminBadge
                    variant={
                      selectedSubmission.status === "approved"
                        ? "success"
                        : selectedSubmission.status === "rejected"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                  >
                    {selectedSubmission.status === "approved"
                      ? "معتمد"
                      : selectedSubmission.status === "rejected"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </AdminBadge>
                </div>
              </div>

              {/* Full Screenshot Preview */}
              <div>
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  لقطة الشاشة المرفقة من الموظف:
                </span>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5 p-2 text-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedSubmission.screenshotUrl}
                    alt="لقطة الشاشة بالحجم الكامل"
                    className="mx-auto max-h-80 rounded object-contain"
                  />
                </div>
              </div>

              {selectedSubmission.rejectionReason && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <span className="mb-1 block font-bold">
                    سبب الرفض المسجل:
                  </span>
                  <p>{selectedSubmission.rejectionReason}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 p-4">
              <AdminButton
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedSubmission(null);
                }}
              >
                إغلاق
              </AdminButton>

              {selectedSubmission.status === "pending" && (
                <div className="flex items-center gap-2">
                  <AdminButton
                    variant="destructive"
                    size="sm"
                    icon={XCircle}
                    onClick={() => {
                      handleOpenReject(selectedSubmission);
                    }}
                  >
                    رفض وعكس المكافأة
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    size="sm"
                    icon={CheckCircle2}
                    onClick={() => {
                      handleApprove(selectedSubmission);
                    }}
                  >
                    اعتماد وصرف المكافأة
                  </AdminButton>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject Confirmation Dialog */}
      {selectedSubmission && (
        <AdminConfirmDialog
          isOpen={rejectModalOpen}
          title="رفض تسليم المهمة وعكس المكافأة"
          description={
            <div className="space-y-2">
              <p>
                سيؤدي الرفض إلى خصم مكافأة المهمة (
                <strong className="font-mono text-rose-700">
                  {selectedSubmission.rewardAmount.toFixed(2)} USDT
                </strong>
                ) من رصيد الموظف <strong>{selectedSubmission.employeeName}</strong> وتسجيل قيد عكسي في السجل المالي وسجل التدقيق لمرة واحدة فقط.
              </p>
              <p className="text-slate-500">
                الموظف: {selectedSubmission.employeeEmail} | المهمة: {selectedSubmission.taskTitle}
              </p>
            </div>
          }
          confirmLabel="تأكيد الرفض وعكس المكافأة"
          variant="destructive"
          affectedRecord={{
            id: selectedSubmission.id,
            label: selectedSubmission.employeeName,
            subtitle: `المهمة: ${selectedSubmission.taskTitle} | المكافأة: ${selectedSubmission.rewardAmount.toFixed(2)} USDT`,
          }}
          requireReason={true}
          reasonLabel="سبب الرفض الإلزامي لسجل التدقيق"
          onConfirm={(reason) => {
            if (!reason) return;
            const res = rejectSubmission(selectedSubmission.id, reason);
            if (res.success) {
              setFeedback(res.message);
              setRejectModalOpen(false);
              setSelectedSubmission(null);
            }
          }}
          onClose={() => {
            setRejectModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
