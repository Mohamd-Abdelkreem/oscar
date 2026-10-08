"use client";

import { CheckCircle2, RotateCcw, Save } from "lucide-react";
import { useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminPageHeader } from "../common/admin-page-header";
import { useAdminState } from "../../context/admin-state.context";

export function SettingsScreen() {
  const { settings, updateSettings } = useAdminState();

  const [minWithdrawal, setMinWithdrawal] = useState(
    settings.withdrawalMinAmount.toString(),
  );
  const [maxWithdrawal, setMaxWithdrawal] = useState(
    settings.withdrawalMaxAmount.toString(),
  );
  const [feePercent, setFeePercent] = useState(
    settings.withdrawalFeePercent.toString(),
  );
  const [cooldownHours, setCooldownHours] = useState(
    settings.withdrawalCooldownHours.toString(),
  );
  const [processingHours, setProcessingHours] = useState(
    settings.withdrawalProcessingHours.toString(),
  );
  const [windowStart, setWindowStart] = useState(settings.taskWindowStart);
  const [windowEnd, setWindowEnd] = useState(settings.taskWindowEnd);
  const [timezone] = useState(settings.timezone);

  const [refL1, setRefL1] = useState(
    settings.referralPercentages[0].toString(),
  );
  const [refL2, setRefL2] = useState(
    settings.referralPercentages[1].toString(),
  );
  const [refL3, setRefL3] = useState(
    settings.referralPercentages[2].toString(),
  );
  const [refL4, setRefL4] = useState(
    settings.referralPercentages[3].toString(),
  );
  const [refL5, setRefL5] = useState(
    settings.referralPercentages[4].toString(),
  );

  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault();

    const minW = parseFloat(minWithdrawal);
    const maxW = parseFloat(maxWithdrawal);
    const fee = parseFloat(feePercent);
    const cooldown = parseInt(cooldownHours, 10);
    const proc = parseInt(processingHours, 10);

    const l1 = parseFloat(refL1);
    const l2 = parseFloat(refL2);
    const l3 = parseFloat(refL3);
    const l4 = parseFloat(refL4);
    const l5 = parseFloat(refL5);

    updateSettings({
      withdrawalMinAmount: minW,
      withdrawalMaxAmount: maxW,
      withdrawalFeePercent: fee,
      withdrawalCooldownHours: cooldown,
      withdrawalProcessingHours: proc,
      taskWindowStart: windowStart,
      taskWindowEnd: windowEnd,
      referralPercentages: [l1, l2, l3, l4, l5],
    });

    setFeedback(
      "تم حفظ وتطبيق إعدادات المنصة بنجاح وتسجيل التغيير في سجل التدقيق.",
    );
  };

  const handleReset = () => {
    setMinWithdrawal("16");
    setMaxWithdrawal("500");
    setFeePercent("21");
    setCooldownHours("24");
    setProcessingHours("72");
    setWindowStart("12:00");
    setWindowEnd("18:00");
    setRefL1("12");
    setRefL2("6");
    setRefL3("4");
    setRefL4("2");
    setRefL5("2");
    setFeedback(null);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إعدادات المنصة والقواعد التشغيلية"
        description="ضبط المعايير المعتمدة لعمليات السحب، نافذة المهام اليومية، ونسب توزيع عمولات الإحالة"
        breadcrumbs={[{ label: "الإعدادات" }]}
      />

      {feedback && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{feedback}</span>
          </div>
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

      <form onSubmit={handleSave} className="max-w-4xl space-y-6">
        {/* Group 1: Financial Rules */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
            قواعد ومعايير السحب المالي (USDT)
          </h2>

          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2 sm:text-sm lg:grid-cols-3">
            <div>
              <label className="mb-1 block font-bold text-slate-700">
                الحد الأدنى للسحب (USDT):
              </label>
              <input
                type="number"
                min="1"
                value={minWithdrawal}
                onChange={(e) => {
                  setMinWithdrawal(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                الحد الأقصى للسحب (USDT):
              </label>
              <input
                type="number"
                min="10"
                value={maxWithdrawal}
                onChange={(e) => {
                  setMaxWithdrawal(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                نسبة رسوم السحب المعتمدة (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={feePercent}
                onChange={(e) => {
                  setFeePercent(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                مدة انتظار المعالجة (ساعات):
              </label>
              <input
                type="number"
                min="1"
                value={processingHours}
                onChange={(e) => {
                  setProcessingHours(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
              <span className="mt-0.5 block text-[11px] text-slate-500">
                الافتراضي: 72 ساعة
              </span>
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                فترة التهدئة بين الطلبات (ساعات):
              </label>
              <input
                type="number"
                min="1"
                value={cooldownHours}
                onChange={(e) => {
                  setCooldownHours(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
              <span className="mt-0.5 block text-[11px] text-slate-500">
                الافتراضي: 24 ساعة
              </span>
            </div>
          </div>
        </div>

        {/* Group 2: Daily Task Window */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
            نافذة المهام اليومية والمنطقة الزمنية
          </h2>

          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-3 sm:text-sm">
            <div>
              <label className="mb-1 block font-bold text-slate-700">
                بداية نافذة المهام:
              </label>
              <input
                type="time"
                value={windowStart}
                onChange={(e) => {
                  setWindowStart(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                نهاية نافذة المهام:
              </label>
              <input
                type="time"
                value={windowEnd}
                onChange={(e) => {
                  setWindowEnd(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                المنطقة الزمنية المعتمدة:
              </label>
              <input
                type="text"
                value={timezone}
                disabled
                className="w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-100 p-2 font-mono text-slate-500"
              />
              <span className="mt-0.5 block text-[11px] text-slate-500">
                توقيت بغداد (Asia/Baghdad)
              </span>
            </div>
          </div>
        </div>

        {/* Group 3: Referral Percentages */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">
            نسب عمولات الإحالة للمستويات الخمسة (%)
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-5 sm:text-sm">
            <div>
              <label className="mb-1 block font-bold text-slate-700">
                L1 (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={refL1}
                onChange={(e) => {
                  setRefL1(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                L2 (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={refL2}
                onChange={(e) => {
                  setRefL2(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                L3 (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={refL3}
                onChange={(e) => {
                  setRefL3(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                L4 (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={refL4}
                onChange={(e) => {
                  setRefL4(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-bold text-slate-700">
                L5 (%):
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={refL5}
                onChange={(e) => {
                  setRefL5(e.target.value);
                }}
                className="w-full rounded-md border border-slate-300 p-2 font-mono"
                required
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between rounded-lg border-t border-slate-200 bg-white p-4">
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900"
          >
            <RotateCcw size={14} aria-hidden="true" />
            <span>استعادة الإعدادات الافتراضية</span>
          </button>

          <div className="flex items-center gap-2">
            <AdminButton type="submit" variant="primary" icon={Save}>
              حفظ وتطبيق الإعدادات
            </AdminButton>
          </div>
        </div>
      </form>
    </div>
  );
}
