"use client";

import { useManagedTimeout } from "@/features/employee/hooks/use-managed-timeout";

import { AlertTriangle, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";
import { BRANDING } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";
import { AddressQR } from "./address-qr";

export function DepositCard() {
  const scheduleTimeout = useManagedTimeout();
  const { deposits, checkDepositStatus } = useEmployeeState();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const depositAddress = BRANDING.defaultDepositAddress;
  const network = BRANDING.defaultNetwork;
  const currency = BRANDING.defaultCurrency;

  const handleCheckStatus = (depositId: string) => {
    setCheckingId(depositId);
    scheduleTimeout(() => {
      checkDepositStatus(depositId);
      setCheckingId(null);
    }, 700);
  };

  return (
    <div className="space-y-4">
      {/* Disclaimer Alert */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
        <AlertTriangle
          size={18}
          className="mt-0.5 shrink-0 text-amber-700"
          aria-hidden="true"
        />
        <div className="space-y-1 text-xs">
          <p className="font-bold text-amber-900">
            {BRANDING.demoAddressWarning}
          </p>
          <p className="leading-relaxed text-amber-800">
            هذا العنوان نموذج تجريبي مخصص للعرض والاختبار في واجهة الموظفين،
            وليس محفظة إيداع حقيقية معتمدة على شبكة البلوكشين. لا تقم بتحويل أي
            أموال حقيقية إليه.
          </p>
        </div>
      </div>

      {/* Main Receiving Address & QR Card */}
      <div className="space-y-5 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              عنوان استلام الإيداع
            </h2>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-800">
              {network}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            العملة المقبولة:{" "}
            <span className="font-bold text-slate-800">{currency}</span> عبر
            شبكة TRON فقط.
          </p>
        </div>

        {/* QR Code Center */}
        <div className="flex justify-center py-1">
          <AddressQR value={depositAddress} size={180} />
        </div>

        {/* Address Copy Block */}
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-slate-500">
            عنوان المحفظة المخصص:
          </span>
          <div className="flex flex-col items-stretch justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
            <bdi
              dir="ltr"
              className="font-mono text-xs font-semibold break-all text-slate-800 select-all sm:text-sm"
            >
              {depositAddress}
            </bdi>
            <div className="flex shrink-0 justify-end">
              <CopyAction value={depositAddress} label="نسخ العنوان" />
            </div>
          </div>
        </div>

        {/* Notice bullets */}
        <div className="space-y-1 rounded-md border border-slate-200/80 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">
            إرشادات هامة قبل التحويل:
          </p>
          <ul className="list-inside list-disc space-y-0.5 text-[11px] text-slate-500">
            <li>
              تحويل أي أصل رقمي غير USDT عبر TRC20 قد يؤدي إلى فقدان التحويل.
            </li>
            <li>الحد الأدنى لعملية الإيداع التجريبية هو 10 USDT.</li>
            <li>
              مدة تأكيد الشبكة وتوقيت إتاحة الرصيد قيد الاعتماد النهائي من
              الإدارة.
            </li>
          </ul>
        </div>
      </div>

      {/* Deposit History */}
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">
          سجل عمليات الإيداع السابقة
        </h3>

        {deposits.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            لا توجد إيداعات مسجلة.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 overflow-hidden rounded-md border border-slate-200">
            {deposits.map((dep) => (
              <div
                key={dep.id}
                className="space-y-2 p-3 text-xs transition-colors hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <Calendar size={13} aria-hidden="true" />
                    <bdi dir="ltr">{dep.createdAt}</bdi>
                  </div>
                  <StatusBadge
                    status={
                      dep.status === "confirmed"
                        ? "confirmed"
                        : dep.status === "verifying"
                          ? "verifying"
                          : "rejected"
                    }
                    size="sm"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <span className="font-medium text-slate-500">
                    المبلغ المودع:
                  </span>
                  <MoneyAmount
                    amount={dep.amount}
                    size="md"
                    color="positive"
                    showSign
                  />
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-1 text-[11px] text-slate-400">
                  <div className="max-w-[200px] truncate">
                    معرف التحويل (TxID):{" "}
                    <bdi dir="ltr">{dep.txId.slice(0, 14)}...</bdi>
                  </div>

                  {dep.status === "verifying" && (
                    <button
                      type="button"
                      disabled={checkingId === dep.id}
                      onClick={() => {
                        handleCheckStatus(dep.id);
                      }}
                      className="inline-flex items-center gap-1 rounded p-1 font-semibold text-emerald-700 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
                    >
                      <RefreshCw
                        size={12}
                        className={checkingId === dep.id ? "animate-spin" : ""}
                        aria-hidden="true"
                      />
                      <span>
                        {checkingId === dep.id
                          ? "جارٍ التحقق..."
                          : "تحديث الحالة"}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
