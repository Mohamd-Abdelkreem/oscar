"use client";
import type { SyntheticEvent } from "react";
import { Wallet } from "lucide-react";
import { AdminButton } from "../common/admin-button";
import { AdminInput } from "../common/admin-input";

export function EmployeeAddressDialog({
  form,
  handleAddressSubmit,
  onClose,
}: {
  readonly form: {
    readonly newAddress: string;
    readonly setNewAddress: (address: string) => void;
    readonly addressReason: string;
    readonly setAddressReason: (reason: string) => void;
  };
  readonly handleAddressSubmit: (event: SyntheticEvent) => void;
  readonly onClose: () => void;
}) {
  const { newAddress, setNewAddress, addressReason, setAddressReason } = form;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 p-4 text-base font-bold text-slate-900">
          تعديل وتأكيد عنوان السحب (TRC20)
        </div>
        <form
          onSubmit={handleAddressSubmit}
          className="space-y-4 p-5 text-xs sm:text-sm"
        >
          <div>
            <label className="mb-1.5 block font-bold text-slate-700">
              عنوان TRC20 الجديد:
            </label>
            <AdminInput
              type="text"
              dir="ltr"
              icon={Wallet}
              value={newAddress}
              onChange={(e) => {
                setNewAddress(e.target.value.trim());
              }}
              placeholder="TQj1xP8mB9k8Z7Y6X5W4V3U2T1S0R9Q8P7"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-slate-700">
              سبب التغيير الإلزامي:
            </label>
            <textarea
              rows={3}
              value={addressReason}
              onChange={(e) => {
                setAddressReason(e.target.value);
              }}
              placeholder="توضيح سبب تعديل العنوان لسجل التدقيق والرقابة..."
              className="w-full rounded-lg border border-slate-300 p-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 focus:outline-none"
              required
            />
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
            <AdminButton
              variant="outline"
              size="default"
              onClick={() => {
                onClose();
              }}
            >
              إلغاء
            </AdminButton>
            <AdminButton type="submit" variant="primary" size="default">
              تأكيد تغيير العنوان
            </AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}
