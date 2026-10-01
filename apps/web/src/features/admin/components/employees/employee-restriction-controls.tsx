"use client";
import { useState } from "react";
import { CheckCircle2, Lock, ShieldAlert, Unlock } from "lucide-react";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import type { AdminEmployee } from "../../types/admin.types";
import { useAdminState } from "../../context/admin-state.context";

export function EmployeeRestrictionControls({
  employee,
  setFeedback,
}: {
  readonly employee: AdminEmployee;
  readonly setFeedback: (feedback: {
    success: boolean;
    message: string;
  }) => void;
}) {
  const {
    toggleEmployeeAccountStatus,
    toggleEmployeeTaskRestriction,
    toggleEmployeeWithdrawalRestriction,
  } = useAdminState();
  const [accountStatusConfirmOpen, setAccountStatusConfirmOpen] =
    useState(false);
  const [taskRestrictionConfirmOpen, setTaskRestrictionConfirmOpen] =
    useState(false);
  const [
    withdrawalRestrictionConfirmOpen,
    setWithdrawalRestrictionConfirmOpen,
  ] = useState(false);
  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="space-y-1">
            <h2 className="text-sm font-bold text-slate-900">
              التحكم التشغيلي والقيود الإدارية المستقلة
            </h2>
            <p className="text-xs text-slate-500">
              كل قيد إداري مستقل تماماً عن الآخر ويتم تسجيله في سجل التدقيق
              فوراً
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* 1. Account Access: Active <-> Suspended */}
            <AdminButton
              variant={
                employee.accountStatus === "active" ? "secondary" : "primary"
              }
              size="sm"
              icon={employee.accountStatus === "active" ? Lock : Unlock}
              onClick={() => {
                setAccountStatusConfirmOpen(true);
              }}
            >
              {employee.accountStatus === "active"
                ? "تعليق الحساب"
                : "تفعيل الحساب"}
            </AdminButton>

            {/* 2. Tasks Restriction: Block <-> Unblock */}
            <AdminButton
              variant={
                employee.restrictions.tasksBlocked ? "primary" : "secondary"
              }
              size="sm"
              icon={
                employee.restrictions.tasksBlocked ? CheckCircle2 : ShieldAlert
              }
              onClick={() => {
                setTaskRestrictionConfirmOpen(true);
              }}
            >
              {employee.restrictions.tasksBlocked
                ? "إلغاء حظر المهام"
                : "حظر تنفيذ المهام"}
            </AdminButton>

            {/* 3. Withdrawals Restriction: Block <-> Unblock */}
            <AdminButton
              variant={
                employee.restrictions.withdrawalsBlocked
                  ? "primary"
                  : "secondary"
              }
              size="sm"
              icon={
                employee.restrictions.withdrawalsBlocked
                  ? CheckCircle2
                  : ShieldAlert
              }
              onClick={() => {
                setWithdrawalRestrictionConfirmOpen(true);
              }}
            >
              {employee.restrictions.withdrawalsBlocked
                ? "إلغاء حظر السحب"
                : "حظر طلبات السحب"}
            </AdminButton>
          </div>
        </div>
      </div>
      <AdminConfirmDialog
        isOpen={accountStatusConfirmOpen}
        title={
          employee.accountStatus === "active"
            ? `تعليق حساب الموظف: ${employee.name}`
            : `إعادة تفعيل حساب الموظف: ${employee.name}`
        }
        description={
          employee.accountStatus === "active"
            ? "سيؤدي تعليق الحساب إلى منع الموظف من تسجيل الدخول والوصول للمهام أو تقديم أي طلبات جديدة حتى تتم إعادة التفعيل."
            : "سيتم إعادة تفعيل الحساب وتمكين الموظف من تسجيل الدخول وتنفيذ مهامه بشكل طبيعي."
        }
        confirmLabel={
          employee.accountStatus === "active"
            ? "تأكيد تعليق الحساب"
            : "تأكيد تفعيل الحساب"
        }
        variant={
          employee.accountStatus === "active" ? "destructive" : "primary"
        }
        affectedRecord={{
          id: employee.id,
          label: employee.name,
          subtitle: `البريد: ${employee.email} | الرصيد: ${employee.balance.toFixed(2)} USDT`,
        }}
        requireReason={employee.accountStatus === "active"}
        reasonLabel="سبب تعليق الحساب لسجل التدقيق"
        onConfirm={() => {
          toggleEmployeeAccountStatus(employee.id);
          setFeedback({
            success: true,
            message:
              employee.accountStatus === "active"
                ? `تم تعليق حساب الموظف ${employee.name} بنجاح.`
                : `تم تفعيل حساب الموظف ${employee.name} بنجاح.`,
          });
          setAccountStatusConfirmOpen(false);
        }}
        onClose={() => {
          setAccountStatusConfirmOpen(false);
        }}
      />
      <AdminConfirmDialog
        isOpen={taskRestrictionConfirmOpen}
        title={
          employee.restrictions.tasksBlocked
            ? `إلغاء حظر المهام للموظف: ${employee.name}`
            : `حظر تنفيذ المهام للموظف: ${employee.name}`
        }
        description={
          employee.restrictions.tasksBlocked
            ? "سيتم رفع الحظر والسماح للموظف باستئناف استلام وتنفيذ المهام اليومية ورفع لقطات الشاشة."
            : "سيؤدي حظر المهام إلى منع الموظف من فتح المهام اليومية أو تقديم أي تسليمات جديدة، مع بقاء رصيده وإمكانية سحبه كما هي."
        }
        confirmLabel={
          employee.restrictions.tasksBlocked
            ? "تأكيد إلغاء حظر المهام"
            : "تأكيد حظر المهام"
        }
        variant={employee.restrictions.tasksBlocked ? "primary" : "destructive"}
        affectedRecord={{
          id: employee.id,
          label: employee.name,
          subtitle: `الحالة التشغيلية: ${employee.restrictions.tasksBlocked ? "المهام محظورة" : "المهام متاحة"}`,
        }}
        requireReason={!employee.restrictions.tasksBlocked}
        reasonLabel="سبب حظر المهام لسجل التدقيق"
        onConfirm={() => {
          toggleEmployeeTaskRestriction(employee.id);
          setFeedback({
            success: true,
            message: employee.restrictions.tasksBlocked
              ? `تم إلغاء حظر المهام عن ${employee.name} بنجاح.`
              : `تم فرض حظر المهام على ${employee.name} بنجاح.`,
          });
          setTaskRestrictionConfirmOpen(false);
        }}
        onClose={() => {
          setTaskRestrictionConfirmOpen(false);
        }}
      />
      <AdminConfirmDialog
        isOpen={withdrawalRestrictionConfirmOpen}
        title={
          employee.restrictions.withdrawalsBlocked
            ? `إلغاء حظر السحب للموظف: ${employee.name}`
            : `حظر طلبات السحب للموظف: ${employee.name}`
        }
        description={
          employee.restrictions.withdrawalsBlocked
            ? "سيتم السماح للموظف بتقديم طلبات سحب الأرباح وفق شروط الباقة ودورة المعالجة المعتمدة."
            : "سيؤدي هذا الإجراء إلى منع الموظف من إنشاء أي طلبات سحب جديدة فوراً، لحين مراجعة الحساب أو إنهاء التدقيق الإداري."
        }
        confirmLabel={
          employee.restrictions.withdrawalsBlocked
            ? "تأكيد إلغاء حظر السحب"
            : "تأكيد حظر السحب"
        }
        variant={
          employee.restrictions.withdrawalsBlocked ? "primary" : "destructive"
        }
        affectedRecord={{
          id: employee.id,
          label: employee.name,
          subtitle: `الرصيد المتاح للسحب: ${employee.balance.toFixed(2)} USDT`,
        }}
        requireReason={!employee.restrictions.withdrawalsBlocked}
        reasonLabel="سبب حظر السحب لسجل التدقيق"
        onConfirm={() => {
          toggleEmployeeWithdrawalRestriction(employee.id);
          setFeedback({
            success: true,
            message: employee.restrictions.withdrawalsBlocked
              ? `تم إلغاء حظر طلبات السحب عن ${employee.name} بنجاح.`
              : `تم فرض حظر طلبات السحب على ${employee.name} بنجاح.`,
          });
          setWithdrawalRestrictionConfirmOpen(false);
        }}
        onClose={() => {
          setWithdrawalRestrictionConfirmOpen(false);
        }}
      />
    </>
  );
}
