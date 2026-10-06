import type { SubmissionDetail } from "@template/contracts";
import type { useAdminSubmissionEvidence } from "../../hooks/task-submissions.hooks";
import { AdminPagination } from "../common/admin-pagination";
import { TaskQueryState } from "../common/task-query-state";

type EvidenceHistory = ReturnType<typeof useAdminSubmissionEvidence>;

const availabilityText = {
  PRESENT: "الصورة متاحة",
  REMOVED: "حُذفت الصورة بعد مدة الاحتفاظ",
  STORAGE_UNAVAILABLE: "الصورة غير متاحة حالياً",
} as const;

export function SubmissionReviewContext({
  submission,
  history,
}: {
  readonly submission: SubmissionDetail;
  readonly history: EvidenceHistory;
}) {
  const terms = submission.snapshot.capturedSubscriptionTerms;
  return (
    <>
      <section
        aria-label="شروط الاستحقاق المسجلة"
        className="space-y-1 text-xs leading-relaxed text-slate-700"
      >
        <h3 className="font-bold">شروط الاستحقاق المسجلة</h3>
        <p>
          المنصب <bdi>{terms.code}</bdi> — إصدار الشروط {terms.version}
        </p>
        <p>
          سعر الاشتراك المسجل: <bdi>{terms.price} USDT</bdi>
        </p>
        <p>
          المكافأة اليومية المسجلة: <bdi>{terms.dailyReward} USDT</bdi>
        </p>
        <p>
          أيام العمل المحتسبة: {terms.countedWorkDates} — رسوم السحب المسجلة:{" "}
          <bdi>{terms.withdrawalFeeBps / 100}%</bdi>
        </p>
        <p>
          الإجمالي المشروط بإتمام أيام العمل:{" "}
          <bdi>{terms.conditionalGross} USDT</bdi>
        </p>
        <p>
          التوقيت المسجل: <bdi>{terms.calendar.zone}</bdi> — أيام العمل:{" "}
          <bdi>{terms.calendar.workdays.join(", ")}</bdi> — نهاية يوم العمل
          الأول: <bdi>{terms.calendar.firstDateCutoff}</bdi>
        </p>
      </section>
      <section
        aria-label="سجل تغييرات الدليل"
        className="space-y-2 text-xs leading-relaxed text-slate-700"
      >
        <h3 className="font-bold">سجل تغييرات الدليل</h3>
        {!history.data || history.isFetching ? (
          <TaskQueryState
            error={history.error?.message}
            retry={history.refetch}
          />
        ) : (
          <>
            {history.data.items.length === 0 ? (
              <p role="status">لا توجد سجلات دليل متاحة.</p>
            ) : (
              <ul className="space-y-2">
                {history.data.items.map((evidence) => (
                  <li key={evidence.id}>
                    <p className="font-bold">
                      الدليل {evidence.version} —{" "}
                      {evidence.version === submission.currentEvidenceVersion
                        ? "الحالي"
                        : "سابق"}
                    </p>
                    <p>
                      توقيت القبول: <bdi>{evidence.acceptedAt}</bdi>
                    </p>
                    <p>
                      توقيت رفع الصورة: <bdi>{evidence.asset.uploadedAt}</bdi> —{" "}
                      {availabilityText[evidence.asset.availability]}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <AdminPagination
              currentPage={history.page}
              totalPages={history.data.pagination.totalPages}
              totalItems={history.data.pagination.total}
              pageSize={history.data.pagination.limit}
              onPageChange={history.setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
