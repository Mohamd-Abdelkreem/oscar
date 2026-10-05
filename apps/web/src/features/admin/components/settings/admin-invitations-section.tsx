"use client";

import type { useAdminLists } from "../../hooks/admins.hooks";
import { getApiError } from "@/services/api/api-client";
import { AdminPagination } from "../common/admin-pagination";
import { AdminTableShell } from "../common/admin-table";
import { AdminButton } from "../common/admin-button";
import {
  invitationDelivery,
  invitationDisposition,
  type AdminControlTarget,
} from "./admin-control-dialog";

export function AdminInvitationsSection({
  query,
  onSelect,
}: {
  readonly query: ReturnType<typeof useAdminLists>["invitations"];
  readonly onSelect: (target: AdminControlTarget) => void;
}) {
  return (
    <section aria-label="دعوات المسؤولين" className="space-y-4">
      <h2 className="text-base font-bold text-neutral-900">دعوات المسؤولين</h2>
      {query.isPending && (
        <p role="status" className="text-xs text-neutral-500">
          جارٍ قراءة الدعوات...
        </p>
      )}
      {query.error && (
        <div role="alert" className="text-xs text-rose-700">
          <p>{getApiError(query.error).message}</p>
          <AdminButton
            variant="outline"
            onClick={() => {
              void query.refetch();
            }}
          >
            إعادة قراءة الدعوات
          </AdminButton>
        </div>
      )}
      {query.isSuccess && (
        <>
          <p className="text-xs text-neutral-500">
            إجمالي الدعوات: {query.data.pagination.total}
          </p>
          <AdminTableShell>
            <table className="w-full text-right text-xs">
              <thead className="border-b border-neutral-200 bg-neutral-50 font-semibold text-neutral-600">
                <tr>
                  <th className="px-4 py-3">المستلم</th>
                  <th className="px-4 py-3">حالة الدعوة</th>
                  <th className="px-4 py-3">حالة الإرسال</th>
                  <th className="px-4 py-3">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {query.data.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-neutral-500">
                      لا توجد دعوات في هذه الصفحة.
                    </td>
                  </tr>
                )}
                {query.data.items.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="transition-colors hover:bg-neutral-50/70"
                  >
                    <td className="px-4 py-3">
                      <p className="font-bold text-neutral-900">
                        {invitation.fullName}
                      </p>
                      <p
                        dir="ltr"
                        className="font-mono text-[11px] text-neutral-500"
                      >
                        {invitation.email}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {invitationDisposition[invitation.status]}
                    </td>
                    <td className="px-4 py-3">
                      {invitationDelivery[invitation.deliveryStatus]}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <AdminButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            onSelect({
                              kind: "invitation",
                              id: invitation.id,
                              action: "read",
                            });
                          }}
                        >
                          قراءة
                        </AdminButton>
                        <AdminButton
                          variant="outline"
                          size="sm"
                          disabled={
                            invitation.status === "ACCEPTED" || query.isFetching
                          }
                          onClick={() => {
                            onSelect({
                              kind: "invitation",
                              id: invitation.id,
                              action: "reissue",
                            });
                          }}
                        >
                          إعادة الإصدار
                        </AdminButton>
                        <AdminButton
                          variant="destructive"
                          size="sm"
                          disabled={
                            invitation.status !== "PENDING" || query.isFetching
                          }
                          onClick={() => {
                            onSelect({
                              kind: "invitation",
                              id: invitation.id,
                              action: "revoke",
                            });
                          }}
                        >
                          إلغاء الدعوة
                        </AdminButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </AdminTableShell>
          <AdminPagination
            currentPage={query.page}
            totalPages={query.data.pagination.totalPages}
            totalItems={query.data.pagination.total}
            pageSize={25}
            onPageChange={query.setPage}
          />
        </>
      )}
    </section>
  );
}
