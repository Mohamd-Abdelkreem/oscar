"use client";

import { Edit } from "lucide-react";
import { useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminPackage } from "../../types/admin.types";

export function PackagesScreen() {
  const { packages, updatePackage } = useAdminState();
  const [editingPackage, setEditingPackage] = useState<AdminPackage | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDailyReward, setEditDailyReward] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editFee, setEditFee] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleOpenEdit = (pkg: AdminPackage) => {
    setEditingPackage(pkg);
    setEditPrice(pkg.price.toString());
    setEditDailyReward(pkg.dailyReward.toString());
    setEditDuration(pkg.durationDays.toString());
    setEditFee(pkg.withdrawalFeePercent.toString());
    setFeedback(null);
  };

  const handleSave = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!editingPackage) return;

    const price = parseFloat(editPrice);
    const dailyReward = parseFloat(editDailyReward);
    const durationDays = parseInt(editDuration, 10);
    const withdrawalFeePercent = parseFloat(editFee);

    if (isNaN(price) || isNaN(dailyReward) || isNaN(durationDays) || isNaN(withdrawalFeePercent)) {
      return;
    }

    updatePackage(editingPackage.id, {
      price,
      dailyReward,
      durationDays,
      withdrawalFeePercent,
    });

    setFeedback(`تم تحديث إعدادات ${editingPackage.name} بنجاح.`);
    setEditingPackage(null);
  };

  // Derive expected return: dailyReward * durationDays
  const calculatedExpected = (dailyReward: number, durationDays: number) => {
    return (dailyReward * durationDays).toFixed(2);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة الباقات والمناصب التشغيلية"
        description="إعدادات المناصب الخمسة المعتمدة، أسعار الاشتراك، العوائد اليومية، ودورات العمل"
        breadcrumbs={[{ label: "الباقات والمناصب" }]}
      />

      {feedback && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => { setFeedback(null); }}
            className="text-xs underline hover:no-underline"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Operational Packages Table */}
      <AdminTableShell>
        <table className="w-full text-right text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
            <tr>
              <th className="px-4 py-3">رمز المنصب</th>
              <th className="px-4 py-3">المسمى المعتمد</th>
              <th className="px-4 py-3">سعر الاشتراك</th>
              <th className="px-4 py-3">الربح اليومي</th>
              <th className="px-4 py-3">أيام العمل</th>
              <th className="px-4 py-3">الدخل الإجمالي المتوقع</th>
              <th className="px-4 py-3">رسوم السحب</th>
              <th className="px-4 py-3">الاشتراكات النشطة</th>
              <th className="px-4 py-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((pkg) => {
              const expectedGross = calculatedExpected(
                pkg.dailyReward,
                pkg.durationDays,
              );

              return (
                <tr key={pkg.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono font-bold text-emerald-800 text-sm">
                    {pkg.id}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {pkg.name}
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900" dir="ltr">
                    {pkg.price.toFixed(2)} USDT
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-emerald-700" dir="ltr">
                    +{pkg.dailyReward.toFixed(2)} USDT
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">
                    {pkg.durationDays} يوم ({pkg.cycle})
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-900" dir="ltr">
                    {expectedGross} USDT
                  </td>
                  <td className="px-4 py-3 font-mono font-bold text-slate-600" dir="ltr">
                    {pkg.withdrawalFeePercent}%
                  </td>
                  <td className="px-4 py-3">
                    <AdminBadge variant="info" size="sm">
                      {pkg.activeSubscriptionsCount} موظف
                    </AdminBadge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AdminButton
                      variant="outline"
                      size="sm"
                      icon={Edit}
                      onClick={() => { handleOpenEdit(pkg); }}
                    >
                      تعديل
                    </AdminButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </AdminTableShell>

      {/* Package Edit Modal */}
      {editingPackage && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-[2px]"
        >
          <div className="w-full max-w-md overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-900">
              تعديل إعدادات {editingPackage.name}
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-4 text-xs sm:text-sm">
              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  سعر الاشتراك (USDT):
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={editPrice}
                  onChange={(e) => { setEditPrice(e.target.value); }}
                  className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  المكافأة اليومية (USDT):
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editDailyReward}
                  onChange={(e) => { setEditDailyReward(e.target.value); }}
                  className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  مدة الاشتراك بالأيام:
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={editDuration}
                  onChange={(e) => { setEditDuration(e.target.value); }}
                  className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-slate-700">
                  نسبة رسوم السحب (%):
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={editFee}
                  onChange={(e) => { setEditFee(e.target.value); }}
                  className="w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
                  required
                />
              </div>

              {/* Dynamic expected total preview */}
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 text-xs">
                <span className="text-slate-500">إجمالي الدخل المتوقع المحسوب: </span>
                <span className="font-mono font-bold text-emerald-700" dir="ltr">
                  {(
                    (parseFloat(editDailyReward) || 0) *
                    (parseInt(editDuration, 10) || 0)
                  ).toFixed(2)}{" "}
                  USDT
                </span>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                <AdminButton
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditingPackage(null); }}
                >
                  إلغاء
                </AdminButton>
                <AdminButton type="submit" variant="primary" size="sm">
                  حفظ التعديلات
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
