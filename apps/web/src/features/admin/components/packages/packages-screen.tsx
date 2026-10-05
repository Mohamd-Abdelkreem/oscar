"use client";

import { Edit } from "lucide-react";
import { useState } from "react";
import {
  packageEditSchema,
  type PackageEdit,
  type PackageTerms,
} from "@template/contracts";
import { getApiError } from "@/services/api/safe-error";
import { formatMoney } from "@/features/employee/utils/money-display";
import { FinancialFeedback } from "@/features/employee/components/common/financial-feedback";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import {
  useAdminCatalog,
  useConfigurationCommand,
} from "../../hooks/packages.hooks";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";

export function PackagesScreen() {
  const catalog = useAdminCatalog();
  const command = useConfigurationCommand();
  const [editor, setEditor] = useState<{
    terms: PackageTerms;
    actor: string;
  } | null>(null);
  const actor = JSON.stringify([
    catalog.scope.accountId,
    catalog.scope.role,
    catalog.scope.epoch,
  ]);
  const editingPackage = editor?.actor === actor ? editor.terms : null;
  const [editPrice, setEditPrice] = useState("");
  const [editDailyReward, setEditDailyReward] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editFee, setEditFee] = useState("");
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<PackageEdit | null>(null);
  const [feedback, setFeedback] = useState<{
    actor: string;
    text: string;
  } | null>(null);
  const message = (text: string) => {
    setFeedback({ actor, text });
  };
  const packages = catalog.data?.items ?? [];
  const handleOpenEdit = async (code: PackageTerms["code"]) => {
    if (
      !catalog.allowed ||
      !command.allowed ||
      command.retained ||
      command.save.isPending
    )
      return;
    const current = await catalog.refetch();
    const terms = current.data?.items.find(
      (item) => item.terms.code === code,
    )?.terms;
    if (!terms || current.isError) return;
    setEditor({ terms, actor });
    setEditPrice(terms.price);
    setEditDailyReward(terms.dailyReward);
    setEditDuration(String(terms.countedWorkDates));
    setEditFee(String(terms.withdrawalFeeBps / 100));
    setReason("");
    setReview(null);
    setFeedback(null);
  };
  const prepare = () => {
    if (!editingPackage || !catalog.allowed || command.retained) return;
    const [feeInteger = "", feeFraction = ""] = editFee.split(".");
    const fee = /^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,2})?$/u.test(editFee)
      ? Number(feeInteger) * 100 + Number(feeFraction.padEnd(2, "0"))
      : NaN;
    const parsed = packageEditSchema.safeParse({
      commandId: crypto.randomUUID(),
      expectedVersion: editingPackage.version,
      price: editPrice,
      dailyReward: editDailyReward,
      countedWorkDates: /^\d+$/u.test(editDuration)
        ? Number(editDuration)
        : NaN,
      withdrawalFeeBps: fee,
      reason,
      confirmed: true,
    });
    if (!parsed.success) {
      message("تحقق من المبالغ الدقيقة وأيام العمل والرسوم وسبب التعديل.");
      return;
    }
    setReview(parsed.data);
  };
  const submit = async () => {
    const retainedIntent = command.state.intent;
    const code = retainedIntent?.packageCode ?? editingPackage?.code;
    const body = retainedIntent?.body ?? review;
    if (!code || !body || !command.allowed || !catalog.allowed) return false;
    try {
      await command.save.mutateAsync({ code, body });
      message("تم حفظ الشروط المستقبلية. الاشتراكات السابقة تحتفظ بشروطها.");
      setEditor(null);
      setReview(null);
      return true;
    } catch (error: unknown) {
      message(
        getApiError(error).code === "CONFIGURATION_SUPERSEDED"
          ? "تجاوزت نسخة أحدث العملية الأصلية. أعد تحميل الشروط ثم راجع تعديلاً جديداً."
          : "لم تتأكد نتيجة الحفظ. تحقق من العملية الأصلية أو راجع إعادة المحاولة المطابقة.",
      );
      return false;
    }
  };
  const uncertain = command.retained !== null;
  const pending =
    command.state.state === "pending" ||
    command.save.isPending ||
    command.observation.isPending;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة الباقات والمناصب التشغيلية"
        description="إعدادات المناصب الخمسة المعتمدة، أسعار الاشتراك، العوائد اليومية، ودورات العمل"
        breadcrumbs={[{ label: "الباقات والمناصب" }]}
      />

      {feedback?.actor === actor && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <span>{feedback.text}</span>
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

      <FinancialFeedback
        pending={catalog.isPending}
        error={catalog.error}
        retry={catalog.refetch}
      />
      {command.coordinationError && (
        <p role="alert">تعذر تنسيق العملية. لا يمكن إرسال تعديل جديد.</p>
      )}
      {uncertain && (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs"
        >
          يوجد تعديل لم تتأكد نتيجته.
          <AdminButton
            variant="outline"
            size="sm"
            disabled={!command.allowed || pending}
            onClick={() => {
              void command.observation
                .mutateAsync()
                .then((outcome) => {
                  message(
                    outcome?.status === "COMMITTED"
                      ? "تم التحقق من الحفظ. أُعيد تحميل الشروط الحالية."
                      : "لم تُرصد العملية بعد. تظل غير محسومة.",
                  );
                })
                .catch(() => {
                  message("تعذر التحقق. تظل العملية غير محسومة.");
                });
            }}
          >
            التحقق من الحفظ
          </AdminButton>
          {command.state.intent && (
            <AdminButton
              variant="outline"
              size="sm"
              disabled={!command.allowed || pending}
              onClick={() => {
                const intent = command.state.intent;
                const terms = catalog.data?.items.find(
                  (item) => item.terms.code === intent?.packageCode,
                )?.terms;
                if (intent && terms) {
                  setEditor({ terms, actor });
                  setReview(intent.body);
                }
              }}
            >
              مراجعة إعادة المحاولة الأصلية
            </AdminButton>
          )}
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
              <th className="px-4 py-3">
                الإجمالي المشروط بالمهام المعتمدة قبل تكلفة الباقة ورسوم السحب
              </th>
              <th className="px-4 py-3">رسوم السحب</th>
              <th className="px-4 py-3">الاشتراكات النشطة</th>
              <th className="px-4 py-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((entry) => {
              const pkg = entry.terms;
              const expectedGross = formatMoney(pkg.conditionalGross);

              return (
                <tr key={pkg.code} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 font-mono text-sm font-bold text-emerald-800">
                    {pkg.code}
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    {`منصب ${pkg.code}`}
                  </td>
                  <td
                    className="px-4 py-3 font-mono font-bold text-slate-900"
                    dir="ltr"
                  >
                    {formatMoney(pkg.price)} USDT
                  </td>
                  <td
                    className="px-4 py-3 font-mono font-bold text-emerald-700"
                    dir="ltr"
                  >
                    +{formatMoney(pkg.dailyReward)} USDT
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-700">
                    {pkg.countedWorkDates} يوم ({"أيام محتسبة"})
                  </td>
                  <td
                    className="px-4 py-3 font-mono font-bold text-slate-900"
                    dir="ltr"
                  >
                    {expectedGross} USDT
                  </td>
                  <td
                    className="px-4 py-3 font-mono font-bold text-slate-600"
                    dir="ltr"
                  >
                    {pkg.withdrawalFeeBps / 100}%
                  </td>
                  <td className="px-4 py-3">
                    <AdminBadge variant="info" size="sm">
                      {entry.activeSubscriptionsCount} موظف
                    </AdminBadge>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <AdminButton
                      variant="outline"
                      size="sm"
                      icon={Edit}
                      disabled={
                        !catalog.allowed ||
                        !command.allowed ||
                        uncertain ||
                        pending
                      }
                      onClick={() => {
                        void handleOpenEdit(pkg.code);
                      }}
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

      <AdminConfirmDialog
        isOpen={editingPackage !== null}
        title={
          editingPackage
            ? `تعديل إعدادات منصب ${editingPackage.code}`
            : "تعديل إعدادات المنصب"
        }
        variant="primary"
        isLoading={pending}
        confirmDisabled={!catalog.allowed || !command.allowed}
        confirmLabel={review ? "تأكيد حفظ الشروط المراجعة" : "مراجعة التعديلات"}
        error={feedback?.actor === actor ? feedback.text : null}
        onClose={() => {
          setEditor(null);
          setReview(null);
        }}
        onConfirm={() => {
          if (!review) {
            prepare();
            return false;
          }
          return submit();
        }}
        description={
          <div className="space-y-4 text-xs sm:text-sm">
            {review ? (
              <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <p>تعديل للشروط المستقبلية فقط. لن يغيّر شراءً سابقاً.</p>
                <p>النسخة المراجعة: {review.expectedVersion}</p>
                <p>
                  السعر:{" "}
                  <bdi>
                    {!uncertain && `${editingPackage?.price ?? ""} → `}
                    {review.price}
                  </bdi>{" "}
                  USDT
                </p>
                <p>
                  المكافأة:{" "}
                  <bdi>
                    {!uncertain && `${editingPackage?.dailyReward ?? ""} → `}
                    {review.dailyReward}
                  </bdi>{" "}
                  USDT
                </p>
                <p>
                  أيام العمل:{" "}
                  {!uncertain &&
                    `${String(editingPackage?.countedWorkDates ?? "")} → `}{" "}
                  {review.countedWorkDates}
                </p>
                <p>
                  رسوم السحب:{" "}
                  {!uncertain &&
                    `${String((editingPackage?.withdrawalFeeBps ?? 0) / 100)}% → `}{" "}
                  {(review.withdrawalFeeBps ?? 0) / 100}%
                </p>
                <p>سبب التعديل: {review.reason}</p>
                {!uncertain && (
                  <AdminButton
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setReview(null);
                    }}
                  >
                    العودة للتعديل
                  </AdminButton>
                )}
              </div>
            ) : (
              <>
                {[
                  {
                    label: "سعر الاشتراك (USDT)",
                    value: editPrice,
                    set: setEditPrice,
                  },
                  {
                    label: "المكافأة اليومية (USDT)",
                    value: editDailyReward,
                    set: setEditDailyReward,
                  },
                  {
                    label: "أيام العمل المحتسبة",
                    value: editDuration,
                    set: setEditDuration,
                  },
                  {
                    label: "نسبة رسوم السحب (%)",
                    value: editFee,
                    set: setEditFee,
                  },
                ].map((field) => (
                  <label
                    key={field.label}
                    className="block font-bold text-slate-700"
                  >
                    {field.label}
                    <input
                      inputMode="decimal"
                      value={field.value}
                      onChange={(event) => {
                        field.set(event.target.value);
                      }}
                      className="mt-1 w-full rounded-md border border-slate-300 p-2 font-mono text-sm"
                      required
                    />
                  </label>
                ))}
                <label className="block font-bold text-slate-700">
                  سبب التعديل
                  <textarea
                    value={reason}
                    maxLength={500}
                    onChange={(event) => {
                      setReason(event.target.value);
                    }}
                    className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm"
                  />
                </label>
                {catalog.data?.items.find(
                  (item) => item.terms.code === editingPackage?.code,
                )?.terms.version !== editingPackage?.version && (
                  <p role="alert">
                    تغيّرت الشروط الحالية. احتُفظ بالمسودة؛ إما متابعة مراجعة
                    النسخة الأصلية أو إغلاقها وإعادة تحميل الشروط.
                  </p>
                )}
              </>
            )}
          </div>
        }
      />
    </div>
  );
}
