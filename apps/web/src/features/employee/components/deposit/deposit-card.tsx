"use client";

import { AlertTriangle, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { DepositAddressData } from "@template/contracts";
import { formatBaghdadDateTime } from "@/shared/time/baghdad-time";
import { useEmployeeDeposits } from "../../hooks/deposits.hooks";
import { CopyAction } from "../common/copy-action";
import {
  FinancialFeedback,
  FinancialPages,
} from "../common/financial-feedback";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";
import { AddressQR } from "./address-qr";

function readinessNotice(assignment: DepositAddressData | undefined) {
  if (assignment === undefined) return "جارٍ تحميل عنوان الاستلام.";
  if (assignment.state === "UNASSIGNED")
    return "لم يُخصص عنوان الاستلام بعد. لا تحول الأموال قبل ظهور العنوان الجاهز.";
  if (assignment.state === "UNAVAILABLE") {
    const reasons = {
      RECOVERY_UNAVAILABLE: "العنوان غير متاح حتى اكتمال الاسترداد الآمن.",
      EVIDENCE_CONFLICT: "العنوان غير متاح لحين التحقق من بيانات التخصيص.",
      PROVIDER_UNAVAILABLE:
        "العنوان غير متاح مؤقتًا بسبب تعذر الاتصال بالشبكة.",
    };
    return reasons[assignment.reasonCode];
  }
  return "جارٍ تجهيز عنوان الاستلام. لا تحول الأموال قبل ظهور العنوان الجاهز.";
}
const detectionNotices = {
  NOT_STARTED: "لم يبدأ رصد التحويلات بعد. ظهور العنوان لا يعني تسجيل إيداع.",
  SCANNING: "جارٍ رصد التحويلات. السجل يعرض الإضافات المسجلة فقط.",
  RETRYING:
    "رصد التحويلات متأخر ويُعاد الاتصال. السجل يعرض الإضافات المسجلة فقط.",
  PAUSED: "رصد التحويلات متوقف مؤقتًا. السجل يعرض الإضافات المسجلة فقط.",
  UNRESOLVED: "رصد التحويلات غير محسوم. لا توجد نتيجة جديدة مؤكدة.",
};

export function DepositCard() {
  const {
    address,
    history,
    ready,
    visibleHistory,
    detection,
    provisioning,
    provisionError,
    refresh,
  } = useEmployeeDeposits();
  const assignment =
    address.allowed && history.allowed ? address.data : undefined;
  const copyIdentity = JSON.stringify([address.scope, ready?.assignmentId]);
  const [failedCopy, setFailedCopy] = useState<string | null>(null);
  const detectionNotice = detection ? detectionNotices[detection.status] : null;
  const refreshing = address.isFetching || history.isFetching || provisioning;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
        <AlertTriangle
          size={18}
          className="mt-0.5 shrink-0 text-amber-700"
          aria-hidden="true"
        />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-amber-900">
            تحقق من شبكة وعنوان الاستلام قبل التحويل
          </p>
          <p className="leading-relaxed text-amber-800">
            استخدم عنوانك المخصص بعد اكتمال تجهيزه، وأرسل USDT على الشبكة والعقد
            الموضحين فقط. تأكد من تطابق العنوان مع محفظتك قبل التحويل.
          </p>
        </div>
      </div>
      <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              عنوان استلام الإيداع
            </h2>
            {assignment ? (
              <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
                {assignment.network}
              </span>
            ) : null}
          </div>
          {assignment ? (
            <p className="text-xs text-slate-500">
              العملة المقبولة:{" "}
              <span className="font-bold text-slate-800">
                {assignment.token.symbol}
              </span>{" "}
              عبر شبكة TRON فقط. عقد العملة:{" "}
              <bdi dir="ltr" className="break-all select-all">
                {assignment.token.contract}
              </bdi>
            </p>
          ) : null}
        </div>
        <FinancialFeedback
          pending={address.isPending || provisioning}
          error={address.error ?? provisionError}
          retry={refresh}
        />
        {ready ? (
          <>
            <div className="flex justify-center py-1">
              <AddressQR value={ready.address} size={180} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-slate-500">
                عنوان المحفظة المخصص:
              </span>
              <div className="flex flex-col items-stretch justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
                <bdi
                  dir="ltr"
                  className="font-mono text-xs font-semibold break-all text-slate-800 select-all sm:text-sm"
                >
                  {ready.address}
                </bdi>
                <div
                  className="flex shrink-0 justify-end"
                  onClickCapture={() => {
                    setFailedCopy(null);
                  }}
                >
                  <CopyAction
                    value={ready.address}
                    label="نسخ العنوان"
                    onCopyError={() => {
                      setFailedCopy(copyIdentity);
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-xs text-slate-500" role="status">
            {address.error
              ? "تعذر تحميل عنوان الاستلام. لا تحول الأموال قبل التحقق من العنوان الجاهز."
              : readinessNotice(assignment)}
          </p>
        )}
        {ready && failedCopy === copyIdentity ? (
          <p className="text-xs text-slate-600" role="alert">
            تعذر نسخ العنوان. يمكنك تحديد العنوان الكامل ونسخه يدويًا.
          </p>
        ) : null}
        {detectionNotice ? (
          <p className="text-xs text-slate-600" role="status">
            {detectionNotice}
          </p>
        ) : null}
        <button
          type="button"
          disabled={refreshing || !address.canRefresh || !history.canRefresh}
          onClick={() => {
            void refresh();
          }}
          className="inline-flex items-center gap-1 rounded p-1 font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
        >
          <RefreshCw
            size={12}
            className={refreshing ? "animate-spin" : ""}
            aria-hidden="true"
          />
          <span>{refreshing ? "جارٍ التحقق..." : "تحديث الحالة"}</span>
        </button>
        <div className="space-y-1 rounded-md border border-slate-200/80 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">
            إرشادات هامة قبل التحويل:
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-500">
            <li>
              تحويل أي أصل رقمي غير USDT عبر TRC20 قد يؤدي إلى فقدان التحويل.
            </li>
            <li>
              لا يوجد حد تجاري أدنى أو أقصى للإيداع، ولا انتظار لمدة 72 ساعة.
            </li>
            <li>
              يُضاف الإيداع تلقائيًا بعد التحقق من التحويل المؤكد، دون موافقة أو
              رفض من الإدارة. وقت التأكيد والرصد يختلف حسب الشبكة ومزود الخدمة.
            </li>
          </ul>
        </div>
      </div>
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">
          سجل عمليات الإيداع السابقة
        </h3>
        <FinancialFeedback
          pending={history.isPending}
          error={history.error}
          retry={
            visibleHistory === undefined ? history.recoverFirstPage : refresh
          }
        />
        {visibleHistory === undefined ? null : visibleHistory.items.length ===
          0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            لا توجد إيداعات مسجلة.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
            {visibleHistory.items.map((deposit) => (
              <div
                key={deposit.operationId}
                className="space-y-2 p-3 text-xs transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar size={13} aria-hidden="true" />
                    <bdi dir="ltr">
                      {formatBaghdadDateTime(deposit.recordedAt)}
                    </bdi>
                  </div>
                  {deposit.kind === "CHAIN_DEPOSIT" ? (
                    <StatusBadge status="confirmed" size="sm" />
                  ) : (
                    <span className="text-xs text-slate-500">
                      إضافة يدوية مسجلة
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">
                    المبلغ المودع:
                  </span>
                  <MoneyAmount
                    amount={deposit.amount}
                    size="md"
                    color="positive"
                    showSign
                  />
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-[11px] text-slate-400">
                  <div className="max-w-[200px] truncate">
                    {deposit.kind === "CHAIN_DEPOSIT" ? (
                      <>
                        معرف التحويل (TxID):{" "}
                        <bdi dir="ltr" title={deposit.transactionId}>
                          {deposit.transactionId.slice(0, 14)}...
                        </bdi>
                        <bdi
                          dir="ltr"
                          title={deposit.address}
                          className="block truncate"
                        >
                          {deposit.address}
                        </bdi>
                      </>
                    ) : (
                      <>
                        معرف الإضافة:{" "}
                        <bdi dir="ltr" title={deposit.operationId}>
                          {deposit.operationId.slice(0, 14)}...
                        </bdi>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {visibleHistory ? (
          <FinancialPages
            page={history.page}
            pages={visibleHistory.pagination.totalPages}
            setPage={history.setPage}
          />
        ) : null}
      </div>
    </div>
  );
}
