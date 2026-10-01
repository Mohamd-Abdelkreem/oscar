"use client";

import { Banknote, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { useAdminState } from "../../context/admin-state.context";

import { EmployeeOverviewTab } from "./employee-overview-tab";
import { EmployeePackageTab } from "./employee-package-tab";
import { EmployeeLedgerTab } from "./employee-ledger-tab";
import { EmployeeTasksTab } from "./employee-tasks-tab";
import { EmployeeDepositsTab } from "./employee-deposits-tab";
import { EmployeeWithdrawalsTab } from "./employee-withdrawals-tab";
import { EmployeeTeamTab } from "./employee-team-tab";
import { EmployeeCodesTab } from "./employee-codes-tab";
import { EmployeeAuditTab } from "./employee-audit-tab";

import { EmployeeBalanceDialog } from "./employee-balance-dialog";
import { EmployeeAddressDialog } from "./employee-address-dialog";
import { EmployeeRestrictionControls } from "./employee-restriction-controls";

interface EmployeeDetailScreenProps {
  readonly employeeId: string;
}

type EmployeeTab =
  | "overview"
  | "package"
  | "ledger"
  | "tasks"
  | "deposits"
  | "withdrawals"
  | "team"
  | "codes"
  | "audit";

export function EmployeeDetailScreen({
  employeeId,
}: EmployeeDetailScreenProps) {
  const {
    employees,
    packages,
    submissions,
    deposits,
    withdrawals,
    financeTransactions,
    referralMembers,
    codeUsages,
    auditLogs,

    adjustEmployeeBalance,
    updateEmployeeWithdrawalAddress,
    deleteEmployeeAccount,
  } = useAdminState();

  const [activeTab, setActiveTab] = useState<EmployeeTab>("overview");
  const [feedback, setFeedback] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Dialog states
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceDirection, setBalanceDirection] = useState<"credit" | "debit">(
    "credit",
  );
  const [balanceReason, setBalanceReason] = useState("");

  const [addressModalOpen, setAddressModalOpen] = useState(false);
  const [newAddress, setNewAddress] = useState("");
  const [addressReason, setAddressReason] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  // Find employee
  const employee = useMemo(
    () => employees.find((e) => e.id === employeeId),
    [employees, employeeId],
  );

  // Related data
  const employeePackage = useMemo(
    () => packages.find((p) => p.id === employee?.packageId),
    [packages, employee?.packageId],
  );

  const employeeSubmissions = useMemo(
    () => submissions.filter((s) => s.employeeId === employeeId),
    [submissions, employeeId],
  );

  const employeeDeposits = useMemo(
    () => deposits.filter((d) => d.employeeId === employeeId),
    [deposits, employeeId],
  );

  const employeeWithdrawals = useMemo(
    () => withdrawals.filter((w) => w.employeeId === employeeId),
    [withdrawals, employeeId],
  );

  const employeeTransactions = useMemo(
    () => financeTransactions.filter((tx) => tx.employeeId === employeeId),
    [financeTransactions, employeeId],
  );

  const employeeCodeUsages = useMemo(
    () => codeUsages.filter((u) => u.employeeId === employeeId),
    [codeUsages, employeeId],
  );

  const employeeAuditLogs = useMemo(
    () =>
      auditLogs.filter(
        (a) =>
          a.targetId === employeeId ||
          a.targetTitle.includes(employee?.name ?? ""),
      ),
    [auditLogs, employeeId, employee?.name],
  );

  const employeeReferrals = useMemo(
    () => referralMembers.filter((m) => m.sponsorId === employeeId),
    [referralMembers, employeeId],
  );

  if (!employee) {
    return (
      <div className="space-y-6">
        <AdminPageHeader
          title="الموظف غير موجود"
          breadcrumbs={[
            { label: "الموظفون", href: "/admin/employees" },
            { label: "غير موجود" },
          ]}
        />
        <AdminEmptyState
          title="لم يتم العثور على حساب الموظف المطلوب"
          description={`معرف الموظف (${employeeId}) غير مسجل في قاعدة البيانات الحالية.`}
          action={
            <AdminButton href="/admin/employees" variant="primary">
              العودة لقائمة الموظفين
            </AdminButton>
          }
        />
      </div>
    );
  }

  // Handle balance adjustment
  const handleBalanceSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    const num = parseFloat(balanceAmount);
    if (isNaN(num) || num <= 0) return;

    const res = adjustEmployeeBalance(
      employee.id,
      num,
      balanceDirection,
      balanceReason,
    );

    setFeedback(res);
    setBalanceModalOpen(false);
    setBalanceAmount("");
    setBalanceReason("");
  };

  // Handle address update
  const handleAddressSubmit = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newAddress.trim()) return;

    const res = updateEmployeeWithdrawalAddress(
      employee.id,
      newAddress,
      addressReason,
    );

    setFeedback(res);
    setAddressModalOpen(false);
    setNewAddress("");
    setAddressReason("");
  };

  const tabs: { id: EmployeeTab; label: string; count?: number }[] = [
    { id: "overview", label: "نظرة عامة والحساب" },
    { id: "package", label: "المنصب والباقة" },
    { id: "ledger", label: "السجل المالي", count: employeeTransactions.length },
    {
      id: "tasks",
      label: "المهام والمشاركات",
      count: employeeSubmissions.length,
    },
    { id: "deposits", label: "الإيداعات", count: employeeDeposits.length },
    {
      id: "withdrawals",
      label: "طلبات السحب",
      count: employeeWithdrawals.length,
    },
    { id: "team", label: "فريق الإحالات", count: employeeReferrals.length },
    {
      id: "codes",
      label: "سجل استخدام الرموز",
      count: employeeCodeUsages.length,
    },
    {
      id: "audit",
      label: "سجل الرقابة والتدقيق",
      count: employeeAuditLogs.length,
    },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`ملف الموظف: ${employee.name}`}
        description={`المعرف: ${employee.id} — المسجل بتاريخ ${employee.registeredAt}`}
        breadcrumbs={[
          { label: "الموظفون", href: "/admin/employees" },
          { label: employee.name },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AdminButton
              variant="outline"
              size="sm"
              icon={Banknote}
              onClick={() => {
                setBalanceAmount("");
                setBalanceReason("");
                setBalanceModalOpen(true);
              }}
            >
              تسوية الرصيد
            </AdminButton>
            <AdminButton
              variant="outline"
              size="sm"
              icon={Wallet}
              onClick={() => {
                setNewAddress(employee.walletAddress);
                setAddressReason("");
                setAddressModalOpen(true);
              }}
            >
              تعديل عنوان السحب
            </AdminButton>
            <AdminButton
              variant="destructive"
              size="sm"
              icon={Trash2}
              onClick={() => {
                setDeleteModalOpen(true);
              }}
            >
              أرشفة الحساب
            </AdminButton>
          </div>
        }
      />

      {/* Operational Restrictions Quick Bar (INDEPENDENT CONTROLS) */}
      <EmployeeRestrictionControls
        employee={employee}
        setFeedback={setFeedback}
      />

      {feedback && (
        <div
          className={`flex items-center justify-between rounded-lg p-3.5 text-xs font-bold sm:text-sm ${
            feedback.success
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-rose-200 bg-rose-50 text-rose-800"
          }`}
          role="alert"
        >
          <span>{feedback.message}</span>
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

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav
          aria-label="أقسام ملف الموظف"
          className="flex space-x-1 space-x-reverse overflow-x-auto pb-px"
        >
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                }}
                className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 border-b-2 px-3.5 py-2.5 text-xs font-bold transition-colors select-none ${
                  isActive
                    ? "border-emerald-700 bg-emerald-50/40 text-emerald-800"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && (
                  <span
                    className={`py-0.2 rounded-full px-1.5 text-[10px] ${
                      isActive
                        ? "bg-emerald-200 text-emerald-900"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      {activeTab === "overview" && <EmployeeOverviewTab employee={employee} />}
      {activeTab === "package" && (
        <EmployeePackageTab employeePackage={employeePackage} />
      )}
      {activeTab === "ledger" && (
        <EmployeeLedgerTab employeeTransactions={employeeTransactions} />
      )}
      {activeTab === "tasks" && (
        <EmployeeTasksTab employeeSubmissions={employeeSubmissions} />
      )}
      {activeTab === "deposits" && (
        <EmployeeDepositsTab employeeDeposits={employeeDeposits} />
      )}
      {activeTab === "withdrawals" && (
        <EmployeeWithdrawalsTab employeeWithdrawals={employeeWithdrawals} />
      )}
      {activeTab === "team" && (
        <EmployeeTeamTab employeeReferrals={employeeReferrals} />
      )}
      {activeTab === "codes" && (
        <EmployeeCodesTab employeeCodeUsages={employeeCodeUsages} />
      )}
      {activeTab === "audit" && (
        <EmployeeAuditTab employeeAuditLogs={employeeAuditLogs} />
      )}

      {/* Balance Adjustment Modal */}
      {balanceModalOpen && (
        <EmployeeBalanceDialog
          employee={employee}
          form={{
            balanceAmount,
            setBalanceAmount,
            balanceDirection,
            setBalanceDirection,
            balanceReason,
            setBalanceReason,
          }}
          handleBalanceSubmit={handleBalanceSubmit}
          onClose={() => {
            setBalanceModalOpen(false);
          }}
        />
      )}

      {/* Address Change Modal */}
      {addressModalOpen && (
        <EmployeeAddressDialog
          form={{ newAddress, setNewAddress, addressReason, setAddressReason }}
          handleAddressSubmit={handleAddressSubmit}
          onClose={() => {
            setAddressModalOpen(false);
          }}
        />
      )}

      {/* Account Deletion Confirmation Dialog */}
      <AdminConfirmDialog
        isOpen={deleteModalOpen}
        title="أرشفة وحذف حساب الموظف"
        description={
          <div className="space-y-2">
            <p>
              هل أنت متأكد من رغبتك في أرشفة وحذف حساب الموظف{" "}
              <strong>{employee.name}</strong>؟
            </p>
            <p className="text-slate-500">
              ملاحظة أمان: لن يتم محو السجلات المالية أو طلبات السحب أو تاريخ
              استخدام الرموز؛ سيتم الاحتفاظ بها بالكامل في المعاينة وسجل
              التدقيق.
            </p>
          </div>
        }
        confirmLabel="تأكيد الحذف والأرشفة"
        variant="destructive"
        affectedRecord={{
          id: employee.id,
          label: employee.name,
          subtitle: `البريد: ${employee.email} | الرصيد: ${employee.balance.toFixed(2)} USDT`,
        }}
        requireReason
        reasonLabel="سبب أرشفة الحساب الإلزامي"
        onConfirm={(reason) => {
          if (reason) {
            deleteEmployeeAccount(employee.id, reason);
            setFeedback({
              success: true,
              message:
                "تم أرشفة الحساب بنجاح مع الاحتفاظ بكافة السجلات التاريخية.",
            });
          }
        }}
        onClose={() => {
          setDeleteModalOpen(false);
        }}
      />

      {/* Task Restriction Confirmation Dialog */}
    </div>
  );
}
