"use client";
import { X } from "lucide-react";
import type { SyntheticEvent } from "react";
import { AdminButton } from "../common/admin-button";

export function CreateAdminDialog({
  form,
  handleCreateAdmin,
  onClose,
}: {
  readonly form: {
    readonly newName: string;
    readonly newEmail: string;
    readonly addError: string | null;
    readonly setNewName: (text: string) => void;
    readonly setNewEmail: (text: string) => void;
  };
  readonly handleCreateAdmin: (event: SyntheticEvent) => void;
  readonly onClose: () => void;
}) {
  const { newName, newEmail, addError, setNewName, setNewEmail } = form;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-admin-title"
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2
            id="add-admin-title"
            className="text-base font-bold text-neutral-900"
          >
            إضافة مسؤول نظام جديد
          </h2>
          <button
            type="button"
            onClick={() => {
              onClose();
            }}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleCreateAdmin} className="mt-4 space-y-4">
          {addError && (
            <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
              {addError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">
              الاسم الكامل <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="مثال: حسام التميمي"
              value={newName}
              onChange={(e) => {
                setNewName(e.target.value);
              }}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-900 outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">
              البريد الإلكتروني <span className="text-rose-500">*</span>
            </label>
            <input
              type="email"
              required
              dir="ltr"
              placeholder="admin@oscar-platform.com"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
              }}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-900 outline-none focus:border-emerald-600 focus:bg-white"
            />
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
            <div className="font-semibold text-neutral-800">الصلاحيات:</div>
            <div className="mt-1 text-[11px] leading-relaxed text-neutral-500">
              سيمتلك الحساب صلاحية ADMIN الموحدة الكاملة للمنصة (المهام، الرموز،
              السحوبات، الإيداعات، وإعدادات النظام). لا توجد أدوار فرعية.
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-neutral-100 pt-3">
            <AdminButton
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
              }}
            >
              إلغاء
            </AdminButton>
            <AdminButton type="submit" variant="primary">
              إنشاء الحساب
            </AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}
