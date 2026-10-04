"use client";
import { X } from "lucide-react";
import type { SyntheticEvent } from "react";
import { AdminButton } from "../common/admin-button";
import type { AdminAccount } from "../../types/admin.types";

export function EditAdminDialog({
  form,
  handleUpdateAdmin,
  onClose,
  editingAdmin,
}: {
  readonly form: {
    readonly editName: string;
    readonly editEmail: string;
    readonly editError: string | null;
    readonly setEditName: (text: string) => void;
    readonly setEditEmail: (text: string) => void;
  };
  readonly handleUpdateAdmin: (event: SyntheticEvent) => void;
  readonly onClose: () => void;
  readonly editingAdmin: AdminAccount;
}) {
  const { editName, editEmail, editError, setEditName, setEditEmail } = form;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-admin-title"
    >
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
          <h2
            id="edit-admin-title"
            className="text-base font-bold text-neutral-900"
          >
            تعديل بيانات المسؤول: {editingAdmin.name}
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

        <form onSubmit={handleUpdateAdmin} className="mt-4 space-y-4">
          {editError && (
            <div className="rounded border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700">
              {editError}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-700">
              الاسم الكامل <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              disabled
              required
              value={editName}
              onChange={(e) => {
                setEditName(e.target.value);
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
              disabled
              required
              dir="ltr"
              value={editEmail}
              onChange={(e) => {
                setEditEmail(e.target.value);
              }}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-left text-xs text-neutral-900 outline-none focus:border-emerald-600 focus:bg-white"
            />
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
            <AdminButton type="submit" variant="primary" disabled>
              حفظ التعديلات
            </AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}
