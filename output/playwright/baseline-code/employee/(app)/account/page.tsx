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
import { ChangePasswordModal } from "@/features/employee/components/account/change-password-modal";
import { Button } from "@/features/employee/components/common/button";
import { CopyAction } from "@/features/employee/components/common/copy-action";
import { MoneyAmount } from "@/features/employee/components/common/money-amount";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { useEmployeeState } from "@/features/employee/context/employee-state.context";

export default function EmployeeAccountPage() {
  const router = useRouter();
  const { user, balance, currentPackage } = useEmployeeState();
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  const handleLogout = () => {
    router.push("/employee/auth/login");
  };

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="حسابي وإعدادات الموظف"
        subtitle="إدارة الهوية الشخصية، عنوان السحب، وبيانات الأمان"
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Profile Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 space-y-4 shadow-xs">
          <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-lg border border-emerald-200 shrink-0">
              <User size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate">
                {user.name}
              </h2>
              <p className="text-xs text-slate-500 truncate mt-0.5">
                <bdi dir="ltr">{user.email}</bdi>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
              <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">المنصب المفعل</span>
              <span className="font-bold text-slate-900 block">{currentPackage.name}</span>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-md border border-slate-200/80">
              <span className="text-slate-400 block text-[11px] mb-0.5 font-medium">الرصيد المتاح</span>
              <MoneyAmount amount={balance.available} size="sm" color="positive" />
            </div>
          </div>
        </div>

        {/* Security & Address Section */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-xs">
          <div className="p-4 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              الأمان وإعدادات السحب
            </h3>
          </div>

          {/* Change Password */}
          <button
            type="button"
            onClick={() => {
              setIsPasswordModalOpen(true);
            }}
            className="w-full text-right p-4 min-h-[48px] flex items-center justify-between hover:bg-slate-50 transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600 cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <KeyRound size={18} aria-hidden="true" />
              </div>
              <div>
                <span className="text-sm font-semibold text-slate-900 block">
                  تغيير كلمة المرور
                </span>
                <span className="text-xs text-slate-400 block mt-0.5">
                  تحديث كلمة المرور المحلية (15 - 128 حرفاً)
                </span>
              </div>
            </div>
            <ChevronLeft size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          </button>

          {/* Saved Withdrawal Address */}
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <Lock size={14} className="text-slate-400 shrink-0" aria-hidden="true" />
                <span>عنوان السحب المحفوظ (TRC20)</span>
              </span>
              <Link
                href="/employee/support"
                className="text-emerald-700 hover:text-emerald-800 font-semibold"
              >
                طلب تغيير العنوان
              </Link>
            </div>

            {user.savedWithdrawalAddress ? (
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200 flex items-center justify-between gap-2">
                <bdi dir="ltr" className="font-mono text-xs text-slate-800 truncate select-all">
                  {user.savedWithdrawalAddress}
                </bdi>
                <CopyAction value={user.savedWithdrawalAddress} variant="icon" />
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                لم يتم حفظ وتأمين عنوان سحب حتى الآن. يمكنك حفظه في صفحة السحب.
              </p>
            )}
          </div>
        </div>

        {/* Shortcuts & Support links */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-xs">
          <div className="p-4 bg-slate-50/50">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              المساعدة والروابط التنظيمية
            </h3>
          </div>

          <Link
            href="/employee/wallet"
            className="p-4 min-h-[48px] flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <Wallet size={18} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                المحفظة وسجل المعاملات
              </span>
            </div>
            <ChevronLeft size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/employee/faq"
            className="p-4 min-h-[48px] flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <HelpCircle size={18} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                الأسئلة الشائعة (FAQ)
              </span>
            </div>
            <ChevronLeft size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/employee/support"
            className="p-4 min-h-[48px] flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <Mail size={18} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                الدعم الفني والمراسلة
              </span>
            </div>
            <ChevronLeft size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/employee/terms"
            className="p-4 min-h-[48px] flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <Shield size={18} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                الشروط والأحكام
              </span>
            </div>
            <ChevronLeft size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          </Link>

          <Link
            href="/employee/privacy"
            className="p-4 min-h-[48px] flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-600 shrink-0">
                <ShieldCheck size={18} aria-hidden="true" />
              </div>
              <span className="text-sm font-semibold text-slate-900">
                سياسة الخصوصية
              </span>
            </div>
            <ChevronLeft size={16} className="text-slate-400 shrink-0" aria-hidden="true" />
          </Link>
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
