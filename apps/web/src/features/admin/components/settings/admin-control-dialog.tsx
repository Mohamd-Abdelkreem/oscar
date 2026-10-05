"use client";

import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import {
  useAdminDetail,
  useInvitationDetail,
  useAdminStatus,
  useReissueInvitation,
  useRevokeInvitation,
} from "../../hooks/admins.hooks";
import { getApiError } from "@/services/api/api-client";
import { useState } from "react";
import type { AdminInvitation } from "@template/contracts";

export type AdminControlTarget =
  | { kind: "admin"; id: string; status: "ACTIVE" | "DEACTIVATED" }
  | { kind: "invitation"; id: string; action: "read" | "reissue" | "revoke" };
export const invitationDisposition: Readonly<
  Record<AdminInvitation["status"], string>
> = {
  PENDING: "بانتظار القبول",
  ACCEPTED: "مقبولة",
  REVOKED: "ملغاة",
  EXPIRED: "منتهية",
};
export const invitationDelivery: Readonly<
  Record<AdminInvitation["deliveryStatus"], string>
> = {
  NOT_ATTEMPTED: "لم تتم محاولة الإرسال",
  UNKNOWN: "نتيجة الإرسال غير مؤكدة",
  ACKNOWLEDGED: "قبل مزود البريد الإرسال؛ لا يؤكد وصوله",
  REJECTED: "رفض مزود البريد الإرسال",
};

export function AdminControlDialog({
  target,
  onClose,
  onCommitted,
}: {
  readonly target: AdminControlTarget;
  readonly onClose: () => void;
  readonly onCommitted: () => void;
}) {
  const admin = useAdminDetail(target.kind === "admin" ? target.id : null);
  const invitation = useInvitationDetail(
    target.kind === "invitation" ? target.id : null,
  );
  const status = useAdminStatus(target.kind === "admin" ? target.id : null);
  const reissue = useReissueInvitation(
    target.kind === "invitation" ? target.id : null,
  );
  const revoke = useRevokeInvitation(
    target.kind === "invitation" ? target.id : null,
  );
  const command =
    target.kind === "admin"
      ? status
      : target.action === "revoke"
        ? revoke
        : reissue;
  const [failure, setFailure] = useState<string | null>(null);
  const detail = target.kind === "admin" ? admin : invitation;
  const isRead = target.kind === "invitation" && target.action === "read";
  const title =
    target.kind === "admin"
      ? target.status === "ACTIVE"
        ? "تفعيل حساب المسؤول"
        : "تعطيل حساب المسؤول"
      : target.action === "read"
        ? "تفاصيل دعوة المسؤول"
        : target.action === "reissue"
          ? "إعادة إصدار دعوة المسؤول"
          : "إلغاء دعوة المسؤول";
  const confirmLabel =
    target.kind === "admin"
      ? target.status === "ACTIVE"
        ? "تأكيد التفعيل"
        : "تأكيد التعطيل"
      : target.action === "read"
        ? "إغلاق"
        : target.action === "reissue"
          ? "تأكيد إعادة الإصدار"
          : "تأكيد إلغاء الدعوة";
  const confirm = async (reason?: string) => {
    if (isRead) return;
    if (
      !reason ||
      detail.isFetching ||
      !detail.isSuccess ||
      command.isPending ||
      command.uncertain
    )
      return false;
    try {
      if (target.kind === "admin" && admin.data !== undefined)
        await status.mutateAsync({
          status: target.status,
          expectedVersion: admin.data.admin.accountVersion,
          reason,
          confirmed: true,
        });
      else if (target.kind === "invitation" && invitation.data !== undefined) {
        const body = {
          expectedVersion: invitation.data.invitation.tokenVersion,
          reason,
          confirmed: true as const,
        };
        if (target.action === "revoke") await revoke.mutateAsync(body);
        else await reissue.mutateAsync(body);
      } else return false;
      if (command.isCurrentFlow()) onCommitted();
      return true;
    } catch (error: unknown) {
      const safe = getApiError(error);
      if (safe.category !== "obsolete")
        setFailure(
          safe.statusCode === 409
            ? "تغير السجل أو تعذر تنفيذ الإجراء. راجع الحالة والإصدار الحاليين قبل التأكيد مجدداً."
            : ["transient", "uncertain", "contract"].includes(safe.category)
              ? "تعذر تأكيد نتيجة الطلب. الحالة المقروءة لا تثبت أن هذا الطلب هو الذي غيرها. لا تكرر الإجراء."
              : safe.message,
        );
      return false;
    }
  };
  return (
    <AdminConfirmDialog
      isOpen
      title={title}
      description={
        <>
          {detail.isPending && <p role="status">جارٍ قراءة السجل الحالي...</p>}
          {admin.data && target.kind === "admin" && (
            <p>
              {admin.data.admin.fullName} — {admin.data.admin.status} — الإصدار{" "}
              {admin.data.admin.accountVersion}
            </p>
          )}
          {invitation.data && target.kind === "invitation" && (
            <div className="space-y-2">
              <p>{invitation.data.invitation.fullName}</p>
              <p dir="ltr" className="break-all">
                {invitation.data.invitation.email}
              </p>
              <p>{invitationDisposition[invitation.data.invitation.status]}</p>
              <p>
                {invitationDelivery[invitation.data.invitation.deliveryStatus]}
              </p>
              <p>الإصدار {invitation.data.invitation.tokenVersion}</p>
            </div>
          )}
          {!isRead && (
            <p>
              راجع السجل الحالي وأدخل سبب الإجراء. صلاحية التنفيذ والحالة
              النهائية يحددهما الخادم.
            </p>
          )}
        </>
      }
      requireReason={!isRead}
      confirmLabel={confirmLabel}
      variant={
        target.kind === "admin" && target.status === "ACTIVE"
          ? "primary"
          : "destructive"
      }
      isLoading={command.isPending}
      confirmDisabled={
        !isRead && (!detail.isSuccess || detail.isFetching || command.uncertain)
      }
      error={
        failure ??
        (detail.error
          ? getApiError(detail.error).message
          : command.uncertain
            ? "تعذر تأكيد نتيجة الطلب. لا تكرره حتى تتضح النتيجة."
            : null)
      }
      onConfirm={confirm}
      onClose={onClose}
    />
  );
}
