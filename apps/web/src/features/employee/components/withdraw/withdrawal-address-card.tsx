"use client";

import { Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useEmployeeState } from "../../context/employee-state.context";
import { Button } from "../common/button";
import { CopyAction } from "../common/copy-action";

export function WithdrawalAddressCard() {
  const { user, setupWithdrawalAddress } = useEmployeeState();
  const [addressInput, setAddressInput] = useState("");
  const [addressFeedback, setAddressFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const savedAddress = user.savedWithdrawalAddress;

  const handleSaveAddress = (event: React.SyntheticEvent) => {
    event.preventDefault();
    setAddressFeedback(setupWithdrawalAddress(addressInput));
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
          <ShieldCheck
            size={18}
            className="text-emerald-700"
            aria-hidden="true"
          />
          <span>عنوان محفظة السحب (TRON / TRC20)</span>
        </h2>
        {savedAddress && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            مثبت ومؤمن
          </span>
        )}
      </div>

      {savedAddress ? (
        <div className="space-y-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <span className="mb-1 block text-xs text-slate-500">
              العنوان المحفوظ المعتمد لاستلام الحوالات:
            </span>
            <div className="flex items-center justify-between gap-2">
              <bdi
                dir="ltr"
                className="font-mono text-xs font-semibold break-all text-slate-900 select-all sm:text-sm"
              >
                {savedAddress}
              </bdi>
              <CopyAction value={savedAddress} variant="icon" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Lock size={13} aria-hidden="true" />
              العنوان مقفل للحماية المالية
            </span>
            <Link
              href="/employee/support"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              طلب تعديل العنوان عبر الدعم
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSaveAddress} className="space-y-3">
          <p className="text-xs leading-relaxed text-slate-600">
            يتم تثبيت عنوان محفظتك لأول مرة لضمان وصول السحوبات بأمان. أي تعديل
            مستقبلي يتطلب التواصل مع الدعم الفني.
          </p>

          <div className="space-y-1">
            <label
              htmlFor="address-input"
              className="block text-xs font-semibold text-slate-700"
            >
              أدخل عنوان محفظة TRON (TRC20):
            </label>
            <input
              id="address-input"
              type="text"
              dir="ltr"
              value={addressInput}
              onChange={(e) => {
                setAddressInput(e.target.value);
              }}
              placeholder="T..."
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2 font-mono text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          {addressFeedback && (
            <p
              className={`text-xs font-medium ${
                addressFeedback.success ? "text-emerald-700" : "text-rose-600"
              }`}
            >
              {addressFeedback.message}
            </p>
          )}

          <Button type="submit" variant="dark" size="default" fullWidth>
            حفظ وتأمين عنوان السحب
          </Button>
        </form>
      )}
    </div>
  );
}
