"use client";

import { CheckCircle2, Eye, Search, X, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { submissionStatusSchema } from "@template/contracts";
import {
  useAdminTaskSubmissions,
  useAdminTaskSubmission,
  useAdminSubmissionEvidence,
} from "../../hooks/task-submissions.hooks";
import { useAdminTaskCommand } from "../../hooks/tasks.hooks";
import { useSubmissionReviewDialog } from "../../hooks/use-submission-review-dialog";
import { adminTaskSubmissionsApi } from "../../api/task-submissions.api";
import { usePrivateProof } from "@/features/proofs/hooks/use-private-proof";
import { PrivateTaskImage } from "../common/private-task-image";
import { TaskCommandFeedback } from "../common/task-command-feedback";
import { TaskQueryState } from "../common/task-query-state";
import { AdminPagination } from "../common/admin-pagination";
import { useSearchParams } from "next/navigation";
import { SubmissionReviewContext } from "./submission-review-context";

// Function-size exception: preview and rejection share one selected submission and
// review workflow. Revisit when either dialog gains independent state or reuse.
export function SubmissionsScreen() {
  const params = useSearchParams();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedSubmission] = useState<string | null>(
    params.get("submission"),
  );

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const parsedStatus = submissionStatusSchema.safeParse(
    statusFilter.toUpperCase(),
  );
  const query = useAdminTaskSubmissions({
    ...(searchQuery.trim() ? { search: searchQuery.trim() } : {}),
    ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
  });
  const filteredSubmissions = query.data?.items ?? [],
    counts = query.data?.statusCounts;
  const detail = useAdminTaskSubmission(selectedId);
  const selectedSubmission = detail.data
    ? {
        ...detail.data.submission,
        employee: detail.data.employee,
        review: detail.data.review,
      }
    : null;
  const evidenceHistory = useAdminSubmissionEvidence(
    selectedSubmission?.id ?? null,
    selectedSubmission?.currentEvidenceVersion ?? null,
  );
  const command = useAdminTaskCommand({
    kind: "FINAL_REVIEW",
    targetId: selectedId,
  });
  const [decision, setDecision] = useState<"APPROVE" | "REJECT">("REJECT");
  const [reviewed, setReviewed] = useState<{
    id: string;
    version: number;
    evidence: number;
  } | null>(null);
  const proof = usePrivateProof({
    purpose: "PROOF",
    assetId: selectedSubmission?.evidence.assetId ?? null,
    evidenceIdentity:
      (selectedId ?? "") +
      ":" +
      String(selectedSubmission?.currentEvidenceVersion),
    role: "ADMIN",
    open: !!selectedSubmission && !rejectModalOpen,
  });
  const closeReview = useCallback(() => {
    setSelectedSubmission(null);
    setReviewed(null);
  }, []);
  const dialogRef = useSubmissionReviewDialog(
    !!selectedSubmission && !rejectModalOpen,
    closeReview,
  );
  const contextReady =
    detail.allowed &&
    detail.isSuccess &&
    !detail.isFetching &&
    evidenceHistory.allowed &&
    evidenceHistory.isSuccess &&
    !evidenceHistory.isFetching;
  const readyToReview =
    contextReady &&
    !!selectedSubmission &&
    selectedSubmission.status === "PENDING" &&
    !!proof.url &&
    !command.retained &&
    command.allowed;
  const beginReview = (intent: "APPROVE" | "REJECT") => {
    if (!selectedSubmission || !readyToReview) return;
    setReviewed({
      id: selectedSubmission.id,
      version: selectedSubmission.version,
      evidence: selectedSubmission.currentEvidenceVersion,
    });
    setDecision(intent);
    setRejectModalOpen(true);
  };
  const stale =
    !selectedSubmission ||
    reviewed?.id !== selectedSubmission.id ||
    reviewed.version !== selectedSubmission.version ||
    reviewed.evidence !== selectedSubmission.currentEvidenceVersion ||
    selectedSubmission.status !== "PENDING";
  const confirm = async (reason?: string) => {
    if (
      !selectedSubmission ||
      !contextReady ||
      stale ||
      !reason ||
      command.retained ||
      !command.allowed
    )
      return false;
    try {
      const result = await command.execute((commandId) =>
        adminTaskSubmissionsApi.review(selectedSubmission.id, {
          commandId,
          confirmed: true,
          decision,
          reason,
          expectedSubmissionVersion: selectedSubmission.version,
          expectedEvidenceVersion: selectedSubmission.currentEvidenceVersion,
        }),
      );
      if (result?.state !== "OBSERVED") return false;
      setFeedback(
        decision === "APPROVE"
          ? "تم اعتماد التسليم وصرف المكافأة بنجاح."
          : "تم رفض التسليم نهائياً دون خصم من الرصيد.",
      );
      setRejectModalOpen(false);
      setSelectedSubmission(null);
      return true;
    } catch {
      await detail.refetch();
      return false;
    }
  };
  const statusBadgeMap = {
    PENDING: { label: "قيد المراجعة والتدقيق", variant: "warning" },
    APPROVED: { label: "معتمد ومصروف", variant: "success" },
    REJECTED: { label: "مرفوض دون صرف مكافأة", variant: "danger" },
  } as const;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="مراجعة وتدقيق مهام الموظفين"
        description="طابور فحص لقطات الشاشة، اعتماد المهام المطابقة وصرف المكافأة، أو الرفض النهائي دون خصم من الرصيد"
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
                {
                  value: "all",
                  label: `كل الحالات (${String(counts?.all ?? 0)})`,
                },
                {
                  value: "pending",
                  label: `قيد المراجعة (${String(counts?.pending ?? 0)})`,
                },
                {
                  value: "approved",
                  label: `المعتمدة (${String(counts?.approved ?? 0)})`,
                },
                {
                  value: "rejected",
                  label: `المرفوضة (${String(counts?.rejected ?? 0)})`,
                },
              ]}
              ariaLabel="تصفية حسب حالة التسليم"
            />
          </div>
        </div>
      </div>

      {/* Submissions Table */}
      <TaskCommandFeedback command={command} />
      {!query.data && (
        <TaskQueryState error={query.error?.message} retry={query.refetch} />
      )}
      {selectedId && !detail.data && (
        <TaskQueryState error={detail.error?.message} retry={detail.refetch} />
      )}
      {query.data && (
        <AdminTableShell
          footer={
            <AdminPagination
              currentPage={query.page}
              totalPages={query.data.pagination.totalPages}
              totalItems={query.data.pagination.total}
              pageSize={25}
              onPageChange={query.setPage}
            />
          }
        >
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
                            href={`/admin/employees/${sub.employee.id}`}
                            className="block font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                          >
                            {sub.employee.fullName}
                          </Link>
                          <bdi
                            dir="ltr"
                            className="block text-[11px] text-slate-500"
                          >
                            {sub.employee.email}
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
                            setSelectedSubmission(sub.id);
                          }}
                          className="group relative flex h-10 w-16 overflow-hidden rounded border border-slate-200 bg-slate-100"
                          title="انقر لمعاينة لقطة الشاشة بالحجم الكامل"
                        >
                          {}
                          <PrivateTaskImage
                            assetId={sub.evidence.assetId}
                            identity={
                              sub.id + ":" + String(sub.currentEvidenceVersion)
                            }
                            alt="لقطة الشاشة"
                            className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          />
                        </button>
                      </td>

                      <td
                        className="px-4 py-3 font-mono font-bold text-emerald-700"
                        dir="ltr"
                      >
                        +{sub.reward} USDT
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
                              setSelectedSubmission(sub.id);
                            }}
                          >
                            معاينة
                          </AdminButton>

                          {sub.status === "PENDING" && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSubmission(sub.id);
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
                                  setSelectedSubmission(sub.id);
                                }}
                                className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 hover:bg-rose-100"
                                title="رفض التسليم نهائياً"
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
      )}

      {/* Submission Review Drawer / Modal */}
      {selectedSubmission && !rejectModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="تدقيق تسليم المهمة"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedSubmission(null);
          }}
        >
          <div
            ref={dialogRef}
            tabIndex={-1}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-xl"
          >
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
                    href={`/admin/employees/${selectedSubmission.employee.id}`}
                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline"
                  >
                    {selectedSubmission.employee.fullName}
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
                    +{selectedSubmission.reward} USDT
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
                      selectedSubmission.status === "APPROVED"
                        ? "success"
                        : selectedSubmission.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                  >
                    {selectedSubmission.status === "APPROVED"
                      ? "معتمد"
                      : selectedSubmission.status === "REJECTED"
                        ? "مرفوض"
                        : "قيد المراجعة"}
                  </AdminBadge>
                </div>
              </div>

              <div className="text-xs leading-relaxed text-slate-700">
                <p>
                  {selectedSubmission.snapshot.capturedTaskContent.description}
                </p>
                <a
                  href={
                    selectedSubmission.snapshot.capturedTaskContent.targetUrl
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 underline"
                >
                  فتح رابط المهمة المسجل
                </a>
                <p>
                  إقرار التنفيذ محفوظ — الإصدار {selectedSubmission.version} —
                  الدليل {selectedSubmission.currentEvidenceVersion}
                </p>
              </div>
              {/* Full Screenshot Preview */}
              <SubmissionReviewContext
                submission={selectedSubmission}
                history={evidenceHistory}
              />
              <div>
                <span className="mb-2 block text-xs font-bold text-slate-700">
                  لقطة الشاشة المرفقة من الموظف:
                </span>
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-900/5 p-2 text-center">
                  {proof.url && (
                    // Authenticated transient URLs must bypass the image optimizer.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={proof.url}
                      alt="لقطة الشاشة بالحجم الكامل"
                      className="mx-auto max-h-80 rounded object-contain"
                    />
                  )}
                  {!proof.url && (
                    <p role="status">
                      {proof.availability === "REMOVED"
                        ? "حُذفت الصورة بعد مدة الاحتفاظ"
                        : "الصورة غير متاحة حالياً"}
                    </p>
                  )}
                </div>
              </div>

              {selectedSubmission.review?.reason && (
                <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                  <span className="mb-1 block font-bold">
                    سبب القرار المسجل:
                  </span>
                  <p>{selectedSubmission.review.reason}</p>
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

              {selectedSubmission.status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <AdminButton
                    variant="destructive"
                    size="sm"
                    icon={XCircle}
                    disabled={!readyToReview}
                    onClick={() => {
                      beginReview("REJECT");
                    }}
                  >
                    رفض نهائي
                  </AdminButton>
                  <AdminButton
                    variant="primary"
                    size="sm"
                    icon={CheckCircle2}
                    disabled={!readyToReview}
                    onClick={() => {
                      beginReview("APPROVE");
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
          title={
            decision === "APPROVE"
              ? "اعتماد تسليم المهمة وصرف المكافأة"
              : "رفض تسليم المهمة نهائياً"
          }
          description={
            decision === "APPROVE"
              ? "سيصرف الاعتماد المكافأة المسجلة مرة واحدة: " +
                selectedSubmission.reward +
                " USDT"
              : "الرفض نهائي، ولا يصرف مكافأة أو يخصم من الرصيد."
          }
          confirmLabel={
            decision === "APPROVE"
              ? "تأكيد الاعتماد وصرف المكافأة"
              : "تأكيد الرفض النهائي"
          }
          variant={decision === "APPROVE" ? "primary" : "destructive"}
          affectedRecord={{
            id: selectedSubmission.id,
            label: selectedSubmission.employee.fullName,
            subtitle: `المهمة: ${selectedSubmission.taskTitle} | المكافأة: ${selectedSubmission.reward} USDT`,
          }}
          requireReason={true}
          reasonLabel="سبب القرار الإلزامي لسجل التدقيق"
          isLoading={command.isPending}
          confirmDisabled={
            stale || !contextReady || !command.allowed || !!command.retained
          }
          error={
            stale
              ? "تغير التسليم أو الدليل؛ أغلق التأكيد وراجع النسخة الحالية."
              : (command.error?.message ?? null)
          }
          onConfirm={confirm}
          onClose={() => {
            setRejectModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
