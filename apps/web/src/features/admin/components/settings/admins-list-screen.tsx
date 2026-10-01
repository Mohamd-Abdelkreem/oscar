"use client";

import { useManagedTimeout } from "@/shared/hooks/use-managed-timeout";

import {
  CheckCircle2,
  Edit2,
  Power,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useMemo, useState } from "react";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";
import { useAdminState } from "../../context/admin-state.context";
import type { AdminAccount } from "../../types/admin.types";

import { CreateAdminDialog } from "./add-admin-dialog";
import { EditAdminDialog } from "./edit-admin-dialog";

export function AdminsListScreen() {
  const scheduleTimeout = useManagedTimeout();
  const {
    admins,
    currentAdmin,
    createAdminAccount,
    updateAdminAccount,
    toggleAdminStatus,
  } = useAdminState();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add modal state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  // Edit modal state
  const [editingAdmin, setEditingAdmin] = useState<AdminAccount | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  // Toggle status confirm dialog state
  const [statusTargetAdmin, setStatusTargetAdmin] =
    useState<AdminAccount | null>(null);

  const filteredAdmins = useMemo(() => {
    return admins.filter((a) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesName = a.name.toLowerCase().includes(q);
        const matchesEmail = a.email.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail) {
          return false;
        }
      }

      if (statusFilter !== "all" && a.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [admins, searchQuery, statusFilter]);

  const activeCount = useMemo(
    () => admins.filter((a) => a.status === "active").length,
    [admins],
  );
  const inactiveCount = useMemo(
    () => admins.filter((a) => a.status === "inactive").length,
    [admins],
  );

  const handleOpenAddModal = () => {
    setNewName("");
    setNewEmail("");
    setAddError(null);
    setIsAddModalOpen(true);
  };

  const handleCreateAdmin = (e: React.SyntheticEvent) => {
    e.preventDefault();
    setAddError(null);

    const res = createAdminAccount({ name: newName, email: newEmail });
    if (!res.success) {
      setAddError(res.message);
      return;
    }

    setIsAddModalOpen(false);
    setFeedback(res.message);
    scheduleTimeout(() => {
      setFeedback(null);
    }, 3000);
  };

  const handleOpenEditModal = (admin: AdminAccount) => {
    setEditingAdmin(admin);
    setEditName(admin.name);
    setEditEmail(admin.email);
    setEditError(null);
  };

  const handleUpdateAdmin = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setEditError(null);

    const res = updateAdminAccount(editingAdmin.id, {
      name: editName,
      email: editEmail,
    });

    if (!res.success) {
      setEditError(res.message);
      return;
    }

    setEditingAdmin(null);
    setFeedback(res.message);
    scheduleTimeout(() => {
      setFeedback(null);
    }, 3000);
  };

  const handleConfirmToggleStatus = () => {
    if (!statusTargetAdmin) return;
    toggleAdminStatus(statusTargetAdmin.id);
    const isActivating = statusTargetAdmin.status !== "active";
    setFeedback(
      isActivating
        ? `تم تفعيل حساب المسؤول ${statusTargetAdmin.name} بنجاح.`
        : `تم تعطيل حساب المسؤول ${statusTargetAdmin.name} بنجاح.`,
    );
    setStatusTargetAdmin(null);
    scheduleTimeout(() => {
      setFeedback(null);
    }, 3000);
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة مسؤولي النظام"
        description="عرض وإدارة حسابات مسؤولي المنصة، تفعيل أو تعطيل الحسابات، وإضافة مسؤولو جدد بصلاحية ADMIN الموحدة"
        breadcrumbs={[
          { label: "الإعدادات", href: "/admin/settings" },
          { label: "مسؤولو النظام" },
        ]}
        action={
          <AdminButton variant="primary" onClick={handleOpenAddModal}>
            <UserPlus size={16} aria-hidden="true" />
            <span>إضافة مسؤول جديد</span>
          </AdminButton>
        }
      />

      {feedback && (
        <div
          className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <CheckCircle2 size={16} aria-hidden="true" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Overview Metric Blocks */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">إجمالي المسؤولين</span>
            <Shield size={18} className="text-neutral-400" aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-900">
            {admins.length}
          </div>
          <span className="mt-1 block text-xs text-neutral-400">
            حسابات مسجلة
          </span>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between text-emerald-600">
            <span className="text-xs font-medium">الحسابات النشطة</span>
            <UserCheck size={18} aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700">
            {activeCount}
          </div>
          <span className="mt-1 block text-xs text-emerald-600">
            يمكنهم الدخول للمنصة
          </span>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between text-neutral-500">
            <span className="text-xs font-medium">الحسابات المعطلة</span>
            <UserX size={18} aria-hidden="true" />
          </div>
          <div className="mt-2 text-2xl font-bold text-neutral-700">
            {inactiveCount}
          </div>
          <span className="mt-1 block text-xs text-neutral-400">
            موقوفة مؤقتاً
          </span>
        </div>

        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between text-cyan-600">
            <span className="text-xs font-medium">هيكل الصلاحيات</span>
            <ShieldCheck size={18} aria-hidden="true" />
          </div>
          <div className="mt-2 text-base font-bold text-cyan-800">
            صلاحية موحدة (ADMIN)
          </div>
          <span className="mt-1 block text-xs text-neutral-400">
            جميع المسؤولين يمتلكون نفس الصلاحيات
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="بحث بالاسم أو البريد الإلكتروني..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
            }}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-2 pr-9 pl-3 text-xs text-neutral-900 transition outline-none focus:border-emerald-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">الحالة:</span>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
            }}
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800 transition outline-none focus:border-emerald-600 focus:bg-white"
          >
            <option value="all">جميع الحالات ({admins.length})</option>
            <option value="active">نشط ({activeCount})</option>
            <option value="inactive">معطل ({inactiveCount})</option>
          </select>
        </div>
      </div>

      {/* Admins Table */}
      <AdminTableShell>
        <table className="w-full text-right text-xs">
          <thead className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
            <tr>
              <th className="px-4 py-3">مسؤول النظام</th>
              <th className="px-4 py-3">الدور الإداري</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">تاريخ الإنشاء</th>
              <th className="px-4 py-3">آخر نشاط</th>
              <th className="px-4 py-3 text-center">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filteredAdmins.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8">
                  <AdminEmptyState
                    title="لم يتم العثور على مسؤولين"
                    description="لا توجد حسابات تطابق معايير البحث الحالية."
                  />
                </td>
              </tr>
            ) : (
              filteredAdmins.map((admin) => {
                const isCurrent = admin.id === currentAdmin.id;
                return (
                  <tr
                    key={admin.id}
                    className="transition-colors hover:bg-neutral-50/70"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-700">
                          {admin.name.slice(0, 1)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                            <span>{admin.name}</span>
                            {isCurrent && (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                حسابك الحالي
                              </span>
                            )}
                          </div>
                          <div
                            className="font-mono text-[11px] text-neutral-500"
                            dir="ltr"
                          >
                            {admin.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge variant="info">ADMIN</AdminBadge>
                    </td>
                    <td className="px-4 py-3">
                      <AdminBadge
                        variant={
                          admin.status === "active" ? "success" : "neutral"
                        }
                      >
                        {admin.status === "active" ? "نشط" : "معطل"}
                      </AdminBadge>
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-neutral-500"
                      dir="ltr"
                    >
                      {admin.createdAt}
                    </td>
                    <td
                      className="px-4 py-3 font-mono text-neutral-500"
                      dir="ltr"
                    >
                      {admin.lastActiveAt}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AdminButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            handleOpenEditModal(admin);
                          }}
                          title="تعديل بيانات المسؤول"
                        >
                          <Edit2 size={14} aria-hidden="true" />
                          <span className="sr-only">تعديل</span>
                        </AdminButton>

                        <AdminButton
                          variant={
                            admin.status === "active"
                              ? "destructive"
                              : "outline"
                          }
                          size="sm"
                          disabled={isCurrent}
                          onClick={() => {
                            setStatusTargetAdmin(admin);
                          }}
                          title={
                            isCurrent
                              ? "لا يمكن تعطيل حسابك الحالي"
                              : admin.status === "active"
                                ? "تعطيل الحساب"
                                : "تفعيل الحساب"
                          }
                        >
                          <Power size={14} aria-hidden="true" />
                          <span>
                            {admin.status === "active" ? "تعطيل" : "تفعيل"}
                          </span>
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </AdminTableShell>

      {/* Add Admin Modal */}
      {isAddModalOpen && (
        <CreateAdminDialog
          form={{ newName, newEmail, addError, setNewName, setNewEmail }}
          handleCreateAdmin={handleCreateAdmin}
          onClose={() => {
            setIsAddModalOpen(false);
          }}
        />
      )}

      {/* Edit Admin Modal */}
      {editingAdmin && (
        <EditAdminDialog
          form={{ editName, editEmail, editError, setEditName, setEditEmail }}
          handleUpdateAdmin={handleUpdateAdmin}
          onClose={() => {
            setEditingAdmin(null);
          }}
          editingAdmin={editingAdmin}
        />
      )}

      {/* Confirm Status Toggle Dialog */}
      {statusTargetAdmin && (
        <AdminConfirmDialog
          isOpen={true}
          title={
            statusTargetAdmin.status === "active"
              ? `تعطيل حساب المسؤول: ${statusTargetAdmin.name}`
              : `تفعيل حساب المسؤول: ${statusTargetAdmin.name}`
          }
          description={
            statusTargetAdmin.status === "active"
              ? "سيؤدي تعطيل هذا الحساب إلى إيقاف إمكانية وصوله للمنصة الإدارية وتنفيذ أي عمليات حتى تتم إعادة تفعيله."
              : "سيتم إعادة تفعيل هذا الحساب والسماح له بالدخول وتنفيذ العمليات الإدارية مجدداً."
          }
          confirmLabel={
            statusTargetAdmin.status === "active"
              ? "تأكيد التعطيل"
              : "تأكيد التفعيل"
          }
          variant={
            statusTargetAdmin.status === "active" ? "destructive" : "primary"
          }
          onConfirm={handleConfirmToggleStatus}
          onClose={() => {
            setStatusTargetAdmin(null);
          }}
        />
      )}
    </div>
  );
}
