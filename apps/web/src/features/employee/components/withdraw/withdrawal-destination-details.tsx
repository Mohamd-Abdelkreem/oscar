"use client";

import type { WithdrawalDestination } from "@template/contracts";
import type { useWithdrawalDestinationCommand } from "../../hooks/withdrawals.hooks";
import { withdrawalInstant } from "../../utils/withdrawal-presentation";
import { Button } from "../common/button";
import { useDestinationLink } from "./withdrawal-destination-boundary";

const delivery = {
  ACKNOWLEDGED:
    "قبل مزود البريد طلب الإرسال؛ لا يعني ذلك وصول الرسالة إلى صندوق البريد.",
  UNKNOWN:
    "نتيجة إرسال البريد غير مؤكدة. تحقق من أحدث رسالة أو أعد الإرسال عندما يسمح الخادم.",
  REJECTED:
    "رفض مزود البريد الإرسال. العنوان لم يتأكد؛ أعد الإرسال عندما يسمح الخادم.",
  NOT_ATTEMPTED: "لم يتأكد إرسال البريد بعد. العنوان لم يتأكد.",
};
export function WithdrawalDestinationDetails({
  destination,
  network,
  command,
  refresh,
  current = true,
  stale = false,
}: {
  readonly destination: WithdrawalDestination | undefined;
  readonly network:
    | NonNullable<
        Extract<WithdrawalDestination, { state: "PENDING" }>["network"]
      >
    | null
    | undefined;
  readonly command: ReturnType<typeof useWithdrawalDestinationCommand>;
  readonly refresh: () => unknown;
  readonly current?: boolean;
  readonly stale?: boolean;
}) {
  const link = useDestinationLink();
  const pending = destination?.state === "PENDING" ? destination : null;
  const compatible = pending !== null && network === pending.network;
  const blocked =
    !current || !command.allowed || command.isPending || command.uncertain;
  return (
    <div className="space-y-2 text-xs text-slate-600">
      {stale && (
        <div>
          <p role="status">
            آخر بيانات معروفة؛ حدّث بيانات العنوان قبل أي إجراء.
          </p>
          <Button
            variant="outline"
            size="compact"
            disabled={!command.allowed || command.isPending}
            onClick={() => {
              void refresh();
            }}
          >
            تحديث آخر بيانات العنوان
          </Button>
        </div>
      )}
      {destination !== undefined && destination.state !== "UNSET" && (
        <p>
          الشبكة: <bdi dir="ltr">{destination.network}</bdi>
        </p>
      )}
      {pending && (
        <>
          <p>
            عنوان بانتظار تأكيد البريد:{" "}
            <bdi dir="ltr" className="font-mono break-all">
              {pending.address}
            </bdi>
          </p>
          <p>{delivery[pending.deliveryStatus]}</p>
          <p>
            {pending.proofStatus === "EXPIRED"
              ? "انتهت صلاحية الرابط"
              : "صلاحية الرابط حتى"}
            : {withdrawalInstant(pending.expiresAt)}
          </p>
          <p>
            إعادة الإرسال متاحة بعد: {withdrawalInstant(pending.nextIssuanceAt)}{" "}
            (بغداد)
          </p>
          {!compatible && (
            <p role="alert">
              الشبكة الحالية غير متاحة أو لا تطابق شبكة العنوان. لا يمكن إرسال
              رابط أو تأكيد هذا العنوان الآن.
            </p>
          )}
          <Button
            variant="outline"
            size="compact"
            disabled={!command.allowed || command.isPending}
            onClick={() => {
              void refresh();
            }}
          >
            تحديث بيانات العنوان
          </Button>
          <Button
            variant="outline"
            size="compact"
            disabled={
              blocked ||
              !compatible ||
              pending.serverNow < pending.nextIssuanceAt
            }
            onClick={() => {
              if (!blocked && compatible)
                void command.resend(pending, network).catch(() => undefined);
            }}
          >
            إعادة إرسال رابط التأكيد
          </Button>
          {link?.canConfirm && (
            <Button
              variant="dark"
              size="default"
              fullWidth
              disabled={
                blocked || !compatible || pending.proofStatus !== "PENDING"
              }
              onClick={() => {
                if (!blocked && compatible) void link.confirm(pending);
              }}
            >
              تأكيد عنوان السحب
            </Button>
          )}
        </>
      )}
      {command.uncertain && (
        <p role="status">
          نتيجة طلب البريد غير مؤكدة. نتحقق من الإصدار المحفوظ؛ لن نعيد الإرسال
          تلقائياً.
        </p>
      )}
      {command.isPending && <p role="status">جارٍ طلب إرسال رابط البريد…</p>}
      {command.error && !command.uncertain && !command.observed && (
        <p role="alert">
          تعذر طلب رابط البريد. حدّث بيانات العنوان وراجع أحدث رسالة.
        </p>
      )}
      {link?.state === "pending" && (
        <p role="status">جارٍ التحقق من تأكيد العنوان…</p>
      )}
      {link?.state === "confirmed" && (
        <p role="status">تم تأكيد عنوان السحب.</p>
      )}
      {link?.state === "uncertain" && (
        <div>
          <p role="status">
            نتيجة التأكيد غير مؤكدة. حدّث بيانات العنوان؛ لن نكرر التأكيد
            تلقائياً.
          </p>
          <Button
            variant="outline"
            size="compact"
            onClick={() => {
              void link.observation.refetch();
            }}
          >
            إعادة التحقق من التأكيد
          </Button>
        </div>
      )}
      {link?.state === "reopen" && (
        <p role="alert">
          افتح أحدث رابط بريد بعد تسجيل الدخول بالحساب المطابق. قد يكون الرابط
          منتهياً أو مستخدماً أو لحساب آخر.
        </p>
      )}
      {link?.state === "review" && (
        <p>
          راجع عنوان السحب والشبكة أعلاه ثم أكد صراحةً. فتح الرابط وحده لا يحفظ
          العنوان.
        </p>
      )}
    </div>
  );
}
