"use client";

import {
  ChevronLeft,
  HelpCircle,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  Shield,
  ShieldCheck,
  User,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AccountNavigationRow } from "@/features/employee/components/account/account-navigation-row";
import { ChangePasswordModal } from "@/features/employee/components/account/change-password-modal";
import { Button } from "@/features/employee/components/common/button";
import { CopyAction } from "@/features/employee/components/common/copy-action";
import { MoneyAmount } from "@/features/employee/components/common/money-amount";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { useEmployeeState } from "@/features/employee/context/employee-state.context";

export function EmployeeAccountScreen() {
  const router = useRouter();
  const { user, balance, currentPackage } = useEmployeeState();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleLogout = () => {
    router.push("/employee/auth/login");
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="حسابي وإعدادات الموظف"
        subtitle="إدارة الهوية الشخصية، عنوان السحب، وبيانات الأمان"
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* Profile Card */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-emerald-200 bg-emerald-100 text-lg font-bold text-emerald-800">
              <User size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold text-slate-900">
                {user.name}
              </h2>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                <bdi dir="ltr">{user.email}</bdi>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-slate-200/80 bg-slate-50 p-2.5">
              <span className="mb-0.5 block text-[11px] font-medium text-slate-400">
                المنصب المفعل
              </span>
              <span className="block font-bold text-slate-900">
                {currentPackage.name}
              </span>
            </div>

            <div className="rounded-md border border-slate-200/80 bg-slate-50 p-2.5">
              <span className="mb-0.5 block text-[11px] font-medium text-slate-400">
                الرصيد المتاح
              </span>
              <MoneyAmount
                amount={balance.available}
                size="sm"
                color="positive"
              />
            </div>
          </div>
        </div>

        {/* Security & Address Section */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="bg-slate-50/50 p-4">
            <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              الأمان وإعدادات السحب
            </h3>
          </div>

          {/* Change Password */}
          <button
            type="button"
            onClick={() => {
              setIsPasswordModalOpen(true);
            }}
            className="flex min-h-[48px] w-full cursor-pointer items-center justify-between p-4 text-right transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <KeyRound size={18} aria-hidden="true" />
              </div>
              <div>
                <span className="block text-sm font-semibold text-slate-900">
                  تغيير كلمة المرور
                </span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  تحديث كلمة المرور المحلية (15 - 128 حرفاً)
                </span>
              </div>
            </div>
            <ChevronLeft
              size={16}
              className="shrink-0 text-slate-400"
              aria-hidden="true"
            />
          </button>

          {/* Saved Withdrawal Address */}
          <div className="space-y-2 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-700">
                <Lock
                  size={14}
                  className="shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <span>عنوان السحب المحفوظ (TRC20)</span>
              </span>
              <Link
                href="/employee/support"
                className="font-semibold text-emerald-700 hover:text-emerald-800"
              >
                طلب تغيير العنوان
              </Link>
            </div>

            {user.savedWithdrawalAddress ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                <bdi
                  dir="ltr"
                  className="truncate font-mono text-xs text-slate-800 select-all"
                >
                  {user.savedWithdrawalAddress}
                </bdi>
                <CopyAction
                  value={user.savedWithdrawalAddress}
                  variant="icon"
                />
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                لم يتم حفظ وتأمين عنوان سحب حتى الآن. يمكنك حفظه في صفحة السحب.
              </p>
            )}
          </div>
        </div>

        {/* Shortcuts & Support links */}
        <div className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xs">
          <div className="bg-slate-50/50 p-4">
            <h3 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              المساعدة والروابط التنظيمية
            </h3>
          </div>

          <AccountNavigationRow
            href="/employee/wallet"
            icon={Wallet}
            label="المحفظة وسجل المعاملات"
          />

          <AccountNavigationRow
            href="/employee/faq"
            icon={HelpCircle}
            label="الأسئلة الشائعة (FAQ)"
          />

          <AccountNavigationRow
            href="/employee/support"
            icon={Mail}
            label="الدعم الفني والمراسلة"
          />

          <AccountNavigationRow
            href="/employee/terms"
            icon={Shield}
            label="الشروط والأحكام"
          />

          <AccountNavigationRow
            href="/employee/privacy"
            icon={ShieldCheck}
            label="سياسة الخصوصية"
          />
        </div>

        {/* Sign Out Action using Button component */}
        <div className="pt-2">
          <Button
            variant="destructive"
            size="default"
            fullWidth
            icon={LogOut}
            onClick={handleLogout}
          >
            تسجيل الخروج من الحساب
          </Button>
        </div>
      </div>

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
        }}
      />
    </div>
  );
}
