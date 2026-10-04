"use client";
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
import { useCallback, useState } from "react";
import { adminInvitationIssueBodySchema } from "@template/contracts";
import { useSessionScope } from "@/features/auth/hooks/auth.hooks";
import { getApiError } from "@/services/api/api-client";
import { useAdminLists, useIssueInvitation } from "../../hooks/admins.hooks";
import { AdminBadge } from "../common/admin-badge";
import { AdminButton } from "../common/admin-button";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminTableShell } from "../common/admin-table";
import { AdminPagination } from "../common/admin-pagination";
import { CreateAdminDialog } from "./add-admin-dialog";
import {
  AdminControlDialog,
  type AdminControlTarget,
} from "./admin-control-dialog";
import { AdminInvitationsSection } from "./admin-invitations-section";

export function AdminsListScreen() {
  const scope = useSessionScope();
  const { admins: adminQuery, invitations: invitationQuery } = useAdminLists();
  const issue = useIssueInvitation();
  const admins = adminQuery.isSuccess ? adminQuery.data.items : [];
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [reviewIssue, setReviewIssue] = useState(false);
  const [target, setTarget] = useState<AdminControlTarget | null>(null);
  const closeAdd = useCallback(() => {
    setIsAddModalOpen(false);
  }, []);
  const closeReview = useCallback(() => {
    setReviewIssue(false);
  }, []);
  const closeTarget = useCallback(() => {
    setTarget(null);
  }, []);
  const reviewInvitation = (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (issue.isPending || issue.uncertain) return;
    if (!newName.trim() || !newEmail.trim()) {
      setAddError("أدخل الاسم والبريد الإلكتروني.");
      return;
    }
    setAddError(null);
    setReviewIssue(true);
  };
  const confirmIssue = async (reason?: string) => {
    const parsed = adminInvitationIssueBodySchema.safeParse({
      fullName: newName,
      email: newEmail,
      reason,
      confirmed: true,
    });
    if (!parsed.success) {
      setAddError("راجع الاسم والبريد وسبب الإجراء.");
      return false;
    }
    try {
      await issue.mutateAsync(parsed.data);
      if (!issue.isCurrentFlow()) return false;
      setIsAddModalOpen(false);
      setNewName("");
      setNewEmail("");
      setFeedback("تم تسجيل الدعوة. لا يصبح المستلم مسؤولاً حتى يقبلها.");
      return true;
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (safe.category !== "obsolete")
        setAddError(
          ["transient", "uncertain", "contract"].includes(safe.category)
            ? "تعذر تأكيد نتيجة الطلب. لا تكرره حتى تتضح النتيجة. غياب الدعوة عن صفحة واحدة لا يثبت فشل إصدارها."
            : safe.message,
        );
      return false;
    }
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
          <AdminButton
            variant="primary"
            onClick={() => {
              setFeedback(null);
              setIsAddModalOpen(true);
            }}
          >
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
            {adminQuery.isSuccess
              ? adminQuery.data.pagination.total
              : "غير متاح حالياً"}
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
            غير متاح حالياً
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
            غير متاح حالياً
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
            disabled
            aria-label="بحث المسؤولين غير متاح"
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 py-2 pr-9 pl-3 text-xs text-neutral-900 transition outline-none focus:border-emerald-600 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-neutral-500">الحالة:</span>
          <select
            disabled
            defaultValue="all"
            aria-label="تصفية الحالة غير متاحة"
            className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-800 transition outline-none focus:border-emerald-600 focus:bg-white"
          >
            <option value="all">جميع الحالات </option>
            <option value="active">نشط (غير متاح حالياً)</option>
            <option value="inactive">معطل (غير متاح حالياً)</option>
          </select>
        </div>
      </div>

      {/* Admins Table */}
      <AdminTableShell>
        <table
          aria-label="حسابات المسؤولين"
          className="w-full text-right text-xs"
        >
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
            {admins.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8">
                  <AdminEmptyState
                    title={
                      adminQuery.isSuccess
                        ? "لم يتم العثور على مسؤولين"
                        : "تعذر عرض المسؤولين"
                    }
                    description={
                      adminQuery.isPending
                        ? "جارٍ قراءة الحسابات..."
                        : adminQuery.error
                          ? getApiError(adminQuery.error).message
                          : "لا توجد حسابات في هذه الصفحة."
                    }
                  />
                </td>
              </tr>
            ) : (
              admins.map((admin) => {
                const isCurrent = admin.id === scope.accountId;
                return (
                  <tr
                    key={admin.id}
                    className="transition-colors hover:bg-neutral-50/70"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-bold text-neutral-700">
                          {admin.fullName.slice(0, 1)}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 font-bold text-neutral-900">
                            <span>{admin.fullName}</span>
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
                          admin.status === "ACTIVE" ? "success" : "neutral"
                        }
                      >
                        {admin.status === "ACTIVE"
                          ? "نشط"
                          : admin.status === "DEACTIVATED"
                            ? "معطل"
                            : "بانتظار التحقق"}
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
                      غير متاح حالياً
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <AdminButton
                          variant="ghost"
                          size="sm"
                          disabled
                          title="تعديل بيانات المسؤول"
                        >
                          <Edit2 size={14} aria-hidden="true" />
                          <span className="sr-only">تعديل</span>
                        </AdminButton>

                        <AdminButton
                          variant={
                            admin.status === "ACTIVE"
                              ? "destructive"
                              : "outline"
                          }
                          size="sm"
                          disabled={
                            isCurrent ||
                            admin.status === "PENDING_VERIFICATION" ||
                            adminQuery.isFetching
                          }
                          onClick={() => {
                            setTarget({
                              kind: "admin",
                              id: admin.id,
                              status:
                                admin.status === "ACTIVE"
                                  ? "DEACTIVATED"
                                  : "ACTIVE",
                            });
                          }}
                          title={
                            isCurrent
                              ? "لا يمكن تعطيل حسابك الحالي"
                              : admin.status === "ACTIVE"
                                ? "تعطيل الحساب"
                                : "تفعيل الحساب"
                          }
                        >
                          <Power size={14} aria-hidden="true" />
                          <span>
                            {admin.status === "ACTIVE" ? "تعطيل" : "تفعيل"}
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

      {adminQuery.error && (
        <AdminButton
          variant="outline"
          onClick={() => {
            void adminQuery.refetch();
          }}
        >
          إعادة قراءة الحسابات
        </AdminButton>
      )}
      {adminQuery.isSuccess && (
        <section aria-label="صفحات المسؤولين">
          <AdminPagination
            currentPage={adminQuery.page}
            totalPages={adminQuery.data.pagination.totalPages}
            totalItems={adminQuery.data.pagination.total}
            pageSize={25}
            onPageChange={adminQuery.setPage}
          />
        </section>
      )}
      <AdminInvitationsSection query={invitationQuery} onSelect={setTarget} />
      {isAddModalOpen && !reviewIssue && (
        <CreateAdminDialog
          form={{
            newName,
            newEmail,
            addError:
              addError ??
              (issue.uncertain
                ? "تعذر تأكيد نتيجة الطلب. لا تكرره حتى تتضح النتيجة."
                : null),
            setNewName,
            setNewEmail,
          }}
          blocked={issue.isPending || issue.uncertain}
          handleCreateAdmin={reviewInvitation}
          onClose={closeAdd}
        />
      )}
      {reviewIssue && (
        <AdminConfirmDialog
          isOpen
          title="تأكيد إرسال دعوة المسؤول"
          description={
            <>
              <p>{newName}</p>
              <p dir="ltr" className="break-all">
                {newEmail}
              </p>
              <p>
                ستسجل دعوة معلقة. قبول مزود البريد للإرسال لا يؤكد وصول الرسالة.
              </p>
            </>
          }
          requireReason
          variant="primary"
          confirmLabel="تأكيد إرسال الدعوة"
          error={addError}
          isLoading={issue.isPending}
          confirmDisabled={issue.uncertain}
          onConfirm={confirmIssue}
          onClose={closeReview}
        />
      )}
      {target && (
        <AdminControlDialog
          key={target.kind + ":" + target.id}
          target={target}
          onClose={closeTarget}
          onCommitted={() => {
            setFeedback("تم تأكيد الإجراء من الخادم.");
          }}
        />
      )}
    </div>
  );
}
