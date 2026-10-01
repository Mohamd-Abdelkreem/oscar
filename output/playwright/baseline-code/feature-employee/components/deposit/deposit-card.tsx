"use client";

import {
  AlertTriangle,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { useState } from "react";
import { BRANDING } from "../../constants/branding";
import { useEmployeeState } from "../../context/employee-state.context";
import { CopyAction } from "../common/copy-action";
import { MoneyAmount } from "../common/money-amount";
import { StatusBadge } from "../common/status-badge";
import { AddressQR } from "./address-qr";

export function DepositCard() {
  const { deposits, checkDepositStatus } = useEmployeeState();
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const depositAddress = BRANDING.defaultDepositAddress;
  const network = BRANDING.defaultNetwork;
  const currency = BRANDING.defaultCurrency;

  const handleCheckStatus = (depositId: string) => {
    setCheckingId(depositId);
    setTimeout(() => {
      checkDepositStatus(depositId);
      setCheckingId(null);
    }, 700);
  };

  return (
    <div className="space-y-4">
      {/* Disclaimer Alert */}
      <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 flex items-start gap-2.5">
        <AlertTriangle size={18} className="shrink-0 mt-0.5 text-amber-700" aria-hidden="true" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-900">
            {BRANDING.demoAddressWarning}
          </p>
          <p className="text-amber-800 leading-relaxed">
            هذا العنوان نموذج تجريبي مخصص للعرض والاختبار في واجهة الموظفين، وليس محفظة إيداع حقيقية معتمدة على شبكة البلوكشين. لا تقم بتحويل أي أموال حقيقية إليه.
          </p>
        </div>
      </div>

      {/* Main Receiving Address & QR Card */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              عنوان استلام الإيداع
            </h2>
            <span className="px-2 py-0.5 text-xs font-bold rounded bg-emerald-100 text-emerald-800">
              {network}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            العملة المقبولة: <span className="font-bold text-slate-800">{currency}</span> عبر شبكة TRON فقط.
          </p>
        </div>

        {/* QR Code Center */}
        <div className="flex justify-center py-1">
          <AddressQR value={depositAddress} size={180} />
        </div>

        {/* Address Copy Block */}
        <div className="space-y-1.5">
          <span className="text-xs text-slate-500 font-medium">عنوان المحفظة المخصص:</span>
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
            <bdi
              dir="ltr"
              className="text-xs sm:text-sm font-mono text-slate-800 break-all select-all font-semibold"
            >
              {depositAddress}
            </bdi>
            <div className="shrink-0 flex justify-end">
              <CopyAction value={depositAddress} label="نسخ العنوان" />
            </div>
          </div>
        </div>

        {/* Notice bullets */}
        <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">إرشادات هامة قبل التحويل:</p>
          <ul className="list-disc list-inside space-y-0.5 text-slate-500 text-[11px]">
            <li>تحويل أي أصل رقمي غير USDT عبر TRC20 قد يؤدي إلى فقدان التحويل.</li>
            <li>الحد الأدنى لعملية الإيداع التجريبية هو 10 USDT.</li>
            <li>مدة تأكيد الشبكة وتوقيت إتاحة الرصيد قيد الاعتماد النهائي من الإدارة.</li>
          </ul>
        </div>
      </div>

      {/* Deposit History */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">
          سجل عمليات الإيداع السابقة
        </h3>

        {deposits.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            لا توجد إيداعات مسجلة.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
            {deposits.map((dep) => (
              <div key={dep.id} className="p-3 text-xs space-y-2 hover:bg-slate-50 transition-colors">
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
                  <span className="text-slate-500 font-medium">المبلغ المودع:</span>
                  <MoneyAmount amount={dep.amount} size="md" color="positive" showSign />
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-400">
                  <div className="truncate max-w-[200px]">
                    معرف التحويل (TxID): <bdi dir="ltr">{dep.txId.slice(0, 14)}...</bdi>
                  </div>

                  {dep.status === "verifying" && (
                    <button
                      type="button"
                      disabled={checkingId === dep.id}
                      onClick={() => { handleCheckStatus(dep.id); }}
                      className="inline-flex items-center gap-1 text-emerald-700 hover:text-emerald-800 font-semibold p-1 rounded focus-visible:outline-2 focus-visible:outline-emerald-600"
                    >
                      <RefreshCw
                        size={12}
                        className={checkingId === dep.id ? "animate-spin" : ""}
                        aria-hidden="true"
                      />
                      <span>{checkingId === dep.id ? "جارٍ التحقق..." : "تحديث الحالة"}</span>
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
