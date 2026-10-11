"use client";

import type { ReactNode } from "react";
import type { WithdrawalRequest } from "@template/contracts";
import { Calendar, Clock } from "lucide-react";
import {
  useEmployeeWithdrawalHistory,
  useEmployeeWithdrawalStatus,
} from "../../hooks/withdrawals.hooks";
import {
  withdrawalActions,
  withdrawalBlockers,
  withdrawalInstant,
  withdrawalRate,
  withdrawalStates,
} from "../../utils/withdrawal-presentation";
import { Button } from "../common/button";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";

function Fact({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
      <dt>{label}</dt>
      <dd className="min-w-0 break-all text-slate-900">{children}</dd>
    </div>
  );
}
function Schedule({ request }: { readonly request: WithdrawalRequest }) {
  return (
    <dl className="space-y-1 text-[11px] text-slate-500">
      <Fact label="الموعد الحالي (بغداد):">
        {withdrawalInstant(request.dueAt)}
      </Fact>
      <Fact label="أقرب وقت للإرسال (بغداد):">
        {withdrawalInstant(request.dispatchAt)}
      </Fact>
      <Fact label="الساعات المحتسبة المتبقية:">
        <bdi dir="ltr">{request.remainingCountedHours}</bdi>
      </Fact>
      <Fact label="وقت لقطة الخادم (بغداد):">
        {withdrawalInstant(request.serverNow)}
      </Fact>
    </dl>
  );
}
function Disposition({ request }: { readonly request: WithdrawalRequest }) {
  if (request.release !== null)
    return (
      <div className="space-y-1 rounded border border-rose-200 bg-rose-50 p-2 text-[11px] text-rose-800">
        <p>أُعيد المبلغ إلى مصادره الأصلية؛ رسوم محصلة: 0 USDT.</p>
        <p>لا توجد مهلة 24 ساعة؛ الطلب الجديد يخضع للأهلية الحالية.</p>
      </div>
    );
  if (request.settlement !== null)
    return (
      <p className="text-[11px] text-emerald-700">
        تم تأكيد دفع الصافي وتسوية الرسوم.
      </p>
    );
  return (
    <div className="space-y-1 text-[11px] text-amber-800">
      <p>
        {request.state === "UNKNOWN"
          ? "نتيجة الدفع غير مؤكدة؛ يبقى المبلغ محجوزاً حتى التسوية."
          : "يبقى المبلغ محجوزاً حتى تأكيد الدفع أو الإعادة الآمنة."}
      </p>
      <p>الساعات تستثني السبت والأحد؛ صفر لا يعني اكتمال الدفع.</p>
      {request.blocker !== null && <p>{withdrawalBlockers[request.blocker]}</p>}
    </div>
  );
}
function RequestDetails({ request }: { readonly request: WithdrawalRequest }) {
  return (
    <details className="space-y-2 text-[11px] text-slate-500">
      <summary className="cursor-pointer font-semibold text-slate-700">
        تفاصيل الطلب
      </summary>
      <dl className="space-y-1 pt-2">
        <Fact label="معرف الطلب:">
          <bdi dir="ltr">{request.id}</bdi>
        </Fact>
        <Fact label="المستلم الثابت:">
          <bdi dir="ltr" className="font-mono">
            {request.recipient}
          </bdi>
        </Fact>
        <Fact label="الشبكة:">
          <bdi dir="ltr">{request.network}</bdi>
        </Fact>
        <Fact label="تاريخ القبول (بغداد):">
          {withdrawalInstant(request.acceptedAt)}
        </Fact>
        <Fact label="الموعد الأصلي (بغداد):">
          {withdrawalInstant(request.originalDueAt)}
        </Fact>
        <Fact label="إصدار الطلب / الجدول:">
          <bdi dir="ltr">
            {request.version} / {request.scheduleVersion}
          </bdi>
        </Fact>
        <Fact label="المدة المحتسبة المتبقية (مللي ثانية):">
          <bdi dir="ltr">{request.remainingCountedMilliseconds} ms</bdi>
        </Fact>
        <Fact label="المصدر غير الإحالي:">
          <MoneyAmount
            amount={request.sourceAllocation.nonReferral}
            size="sm"
          />
        </Fact>
        <Fact label="مصدر الإحالات:">
          <MoneyAmount amount={request.sourceAllocation.referral} size="sm" />
        </Fact>
        <Fact label="العضوية عند القبول:">
          {request.effectiveMembership === "PAID" ? "مدفوعة" : "مجانية"}
        </Fact>
        {request.subscriptionExpiresAt !== null && (
          <Fact label="انتهاء العضوية المحفوظ (بغداد):">
            {withdrawalInstant(request.subscriptionExpiresAt)}
          </Fact>
        )}
        {request.transactionId !== null && (
          <Fact label="معرف المعاملة:">
            <bdi dir="ltr">{request.transactionId}</bdi>
          </Fact>
        )}
        {request.finalizedAt !== null && (
          <Fact label="وقت النتيجة النهائية (بغداد):">
            {withdrawalInstant(request.finalizedAt)}
          </Fact>
        )}
        {request.release !== null && (
          <>
            <Fact label="إجمالي المبلغ المعاد:">
              <MoneyAmount amount={request.release.gross} size="sm" />
            </Fact>
            <Fact label="المعاد للمصدر غير الإحالي:">
              <MoneyAmount
                amount={request.release.sourceAllocation.nonReferral}
                size="sm"
              />
            </Fact>
            <Fact label="المعاد لمصدر الإحالات:">
              <MoneyAmount
                amount={request.release.sourceAllocation.referral}
                size="sm"
              />
            </Fact>
          </>
        )}
        {request.settlement !== null && (
          <>
            <Fact label="الصافي المدفوع المؤكد:">
              <MoneyAmount amount={request.settlement.net} size="sm" />
            </Fact>
            <Fact label="الرسوم المحصلة:">
              <MoneyAmount amount={request.settlement.fee} size="sm" />
            </Fact>
          </>
        )}
      </dl>
      <p>آخر الإجراءات المحفوظة (حتى 100 إجراء):</p>
      <ol className="space-y-2">
        {request.actions.map((action) => (
          <li
            key={action.id}
            className="space-y-1 border-t border-slate-200 pt-2 break-all"
          >
            <p>
              {withdrawalActions[action.kind]} —{" "}
              {withdrawalInstant(action.occurredAt)} (بغداد)
            </p>
            <p>
              المنفذ:{" "}
              {action.actorUserId === null ? (
                "النظام"
              ) : (
                <bdi dir="ltr">{action.actorUserId}</bdi>
              )}
            </p>
            {action.reason !== null && <p>السبب: {action.reason}</p>}
            <p>
              الموعد المحفوظ: {withdrawalInstant(action.dueAt)} — إصدار الطلب /
              الجدول:{" "}
              <bdi dir="ltr">
                {action.committedVersion} / {action.scheduleVersion}
              </bdi>
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}
function RequestBody({ request }: { readonly request: WithdrawalRequest }) {
  const state = withdrawalStates[request.state];
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Calendar size={13} aria-hidden="true" />
          {withdrawalInstant(request.acceptedAt)}
        </div>
        <StatusBadge status={state.badge} label={state.label} size="sm" />
      </div>
      <dl className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600">
        <Fact
          label={
            request.release !== null
              ? "إجمالي الطلب الأصلي:"
              : request.settlement !== null
                ? "إجمالي الطلب المسوّى:"
                : "المبلغ المحجوز:"
          }
        >
          <MoneyAmount amount={request.gross} size="sm" />
        </Fact>
        <Fact
          label={`رسوم الطلب المحفوظة (${withdrawalRate(request.feeBps)}):`}
        >
          <MoneyAmount amount={request.fee} size="sm" />
        </Fact>
        <Fact
          label={
            request.settlement !== null
              ? "الصافي المدفوع:"
              : "الصافي المحفوظ للدفع:"
          }
        >
          <MoneyAmount amount={request.net} size="md" />
        </Fact>
      </dl>
      <Schedule request={request} />
      <Disposition request={request} />
      <RequestDetails request={request} />
    </>
  );
}
function ReadFeedback({
  read,
  subject,
}: {
  readonly read: Pick<
    ReturnType<typeof useEmployeeWithdrawalStatus>,
    "error" | "isError" | "isPending" | "isFetching"
  > & {
    readonly observationExhausted?: boolean;
    readonly isDisplayStale?: boolean;
  };
  readonly subject: "status" | "history";
}) {
  if (read.isError)
    return (
      <p role="alert" className="text-xs text-rose-800">
        {read.error?.category === "contract"
          ? "تعذر التحقق من بيانات السحب. حدّث البيانات للمحاولة مجدداً."
          : read.error?.statusCode === 401 || read.error?.statusCode === 403
            ? "غير مصرح بعرض بيانات السحب. تحقق من حسابك."
            : subject === "history"
              ? "تعذر تحميل سجل السحب. أعد المحاولة."
              : "تعذر تحميل حالة السحب. أعد المحاولة."}
      </p>
    );
  if (read.observationExhausted)
    return (
      <p role="status" className="text-xs text-slate-500">
        توقفت المتابعة التلقائية. آخر بيانات معروفة لا تعني اكتمال الدفع أو
        إعادة المبلغ؛ يمكنك التحديث.
      </p>
    );
  if (read.isDisplayStale)
    return <p role="status">آخر بيانات معروفة؛ يمكنك تحديث بيانات السحب.</p>;
  if (read.isPending || read.isFetching)
    return (
      <p role="status" className="text-xs text-slate-500">
        جارٍ تحديث بيانات السحب...
      </p>
    );
  return null;
}
export function WithdrawalStatusCard() {
  const status = useEmployeeWithdrawalStatus();
  const history = useEmployeeWithdrawalHistory();
  const active = status.displayData?.activeWithdrawal;
  const page = history.displayData;
  return (
    <div className="space-y-4">
      <ReadFeedback read={status} subject="status" />
      <Button
        variant="outline"
        size="compact"
        disabled={!status.canRefresh || status.isFetching}
        onClick={() => {
          void status.refetch();
        }}
      >
        تحديث حالة السحب
      </Button>
      {active && (
        <section
          aria-label="طلب السحب النشط"
          className="space-y-4 rounded-lg border-2 border-amber-300 bg-white p-4 shadow-xs sm:p-5"
        >
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <Clock size={16} aria-hidden="true" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">
              طلب سحب قيد الانتظار والمعالجة
            </h3>
          </div>
          <RequestBody request={active} />
        </section>
      )}
      <section
        aria-label="سجل طلبات السحب"
        className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5"
      >
        <h3 className="text-sm font-bold text-slate-900">سجل طلبات السحب</h3>
        <ReadFeedback read={history} subject="history" />
        <Button
          variant="outline"
          size="compact"
          disabled={!history.canRefresh || history.isFetching}
          onClick={() => {
            void history.refetch();
          }}
        >
          تحديث سجل السحب
        </Button>
        {page &&
          (page.items.length === 0 ? (
            <p className="py-4 text-center text-xs text-slate-500">
              {page.pagination.total === 0
                ? "لا توجد طلبات سحب مسجلة."
                : "هذه الصفحة خارج نطاق السجل الحالي. عد إلى أول صفحة."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
              {page.items.map((request) => (
                <article
                  key={request.id}
                  aria-label={`طلب ${request.id}`}
                  className="space-y-2 p-3 text-xs transition-colors hover:bg-slate-50"
                >
                  <RequestBody request={request} />
                </article>
              ))}
            </div>
          ))}
        {page && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <p>
              {page.pagination.totalPages === 0
                ? "0 طلب — 0 صفحة"
                : `الصفحة ${String(page.pagination.page)} من ${String(page.pagination.totalPages)} — ${String(page.pagination.total)} طلب`}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="compact"
                disabled={
                  !history.allowed ||
                  history.isFetching ||
                  !page.pagination.hasPreviousPage
                }
                onClick={() => {
                  history.setPage(history.page - 1);
                }}
              >
                السابق
              </Button>
              <Button
                variant="outline"
                size="compact"
                disabled={
                  !history.allowed ||
                  history.isFetching ||
                  !page.pagination.hasNextPage
                }
                onClick={() => {
                  history.setPage(history.page + 1);
                }}
              >
                التالي
              </Button>
            </div>
          </div>
        )}
        {history.page > 1 && (
          <Button
            variant="outline"
            size="compact"
            disabled={!history.canRefresh}
            onClick={history.recoverFirstPage}
          >
            العودة لأول صفحة
          </Button>
        )}
      </section>
    </div>
  );
}
