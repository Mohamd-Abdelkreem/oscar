"use client";
import type { SyntheticEvent } from "react";
import { Banknote } from "lucide-react";
import { AdminButton } from "../common/admin-button";
import { AdminInput } from "../common/admin-input";
import type { AdminEmployee } from "../../types/admin.types";

export function EmployeeBalanceDialog({
  employee,
  form,
  handleBalanceSubmit,
  onClose,
}: {
  readonly employee: AdminEmployee;
  readonly form: {
    readonly balanceAmount: string;
    readonly setBalanceAmount: (amount: string) => void;
    readonly balanceDirection: "credit" | "debit";
    readonly setBalanceDirection: (direction: "credit" | "debit") => void;
    readonly balanceReason: string;
    readonly setBalanceReason: (reason: string) => void;
  };
  readonly handleBalanceSubmit: (event: SyntheticEvent) => void;
  readonly onClose: () => void;
}) {
  const {
    balanceAmount,
    setBalanceAmount,
    balanceDirection,
    setBalanceDirection,
    balanceReason,
    setBalanceReason,
  } = form;
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 p-4 text-base font-bold text-slate-900">
          تسوية وتعديل رصيد الموظف
        </div>
        <form
          onSubmit={handleBalanceSubmit}
          className="space-y-4 p-5 text-xs sm:text-sm"
        >
          <div className="space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex justify-between text-xs text-slate-600">
              <span>الموظف:</span>
              <span className="font-bold text-slate-900">{employee.name}</span>
            </div>
            <div className="flex justify-between text-xs text-slate-600">
              <span>الرصيد الحالي:</span>
              <span className="font-mono font-bold text-slate-900">
                {employee.balance.total.toFixed(2)} USDT
              </span>
            </div>
            {parseFloat(balanceAmount) > 0 && (
              <div className="flex justify-between border-t border-slate-200 pt-1 text-xs font-bold">
                <span>الرصيد بعد التسوية:</span>
                <span
                  className={`font-mono ${balanceDirection === "credit" ? "text-emerald-700" : "text-rose-700"}`}
                >
                  {(balanceDirection === "credit"
                    ? employee.balance.total + parseFloat(balanceAmount)
                    : Math.max(
                        0,
                        employee.balance.total - parseFloat(balanceAmount),
                      )
                  ).toFixed(2)}{" "}
                  USDT
                </span>
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-slate-700">
              نوع التسوية:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setBalanceDirection("credit");
                }}
                className={`h-11 rounded-lg border p-2 font-bold transition-colors ${
                  balanceDirection === "credit"
                    ? "border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-600"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                إضافة رصيد (+)
              </button>
              <button
                type="button"
                onClick={() => {
                  setBalanceDirection("debit");
                }}
                className={`h-11 rounded-lg border p-2 font-bold transition-colors ${
                  balanceDirection === "debit"
                    ? "border-rose-600 bg-rose-50 text-rose-800 ring-1 ring-rose-600"
                    : "border-slate-300 text-slate-700 hover:bg-slate-50"
                }`}
              >
                خصم رصيد (-)
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-slate-700">
              المبلغ (USDT):
            </label>
            <AdminInput
              type="number"
              step="0.01"
              min="0.01"
              icon={Banknote}
              value={balanceAmount}
              onChange={(e) => {
                setBalanceAmount(e.target.value);
              }}
              placeholder="0.00"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block font-bold text-slate-700">
              سبب التسوية الإلزامي:
            </label>
            <textarea
              rows={3}
              value={balanceReason}
              onChange={(e) => {
                setBalanceReason(e.target.value);
              }}
              placeholder="توضيح سبب التسوية لسجل التدقيق..."
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
              تأكيد وحفظ التسوية
            </AdminButton>
          </div>
        </form>
      </div>
    </div>
  );
}
