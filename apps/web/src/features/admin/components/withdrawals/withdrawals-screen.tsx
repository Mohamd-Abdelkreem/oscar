"use client";
import { Search } from "lucide-react";
import { useState } from "react";
import { withdrawalStateSchema } from "@template/contracts";
import { getApiError } from "@/services/api/safe-error";
import { getSessionRuntime } from "@/services/api/session-runtime";
import type { AdminWithdrawalRequest } from "../../api/withdrawals.api";
import {
  useAdminWithdrawalHistory,
  useAdminWithdrawalDetail,
} from "../../hooks/withdrawals.hooks";
import { useWithdrawalAction } from "../../hooks/use-withdrawal-action";
import {
  canChangeWithdrawal,
  withdrawalStates,
} from "../../utils/withdrawal-presentation";
import type { AdminWithdrawalIntent } from "../../utils/withdrawal-command-runtime";
import { AdminConfirmDialog } from "../common/admin-confirm-dialog";
import { AdminEmptyState } from "../common/admin-empty-state";
import { AdminInput } from "../common/admin-input";
import { AdminPageHeader } from "../common/admin-page-header";
import { AdminPagination } from "../common/admin-pagination";
import { AdminSelect } from "../common/admin-select";
import { AdminTableShell } from "../common/admin-table";
import { AdminButton } from "../common/admin-button";
import { TaskQueryState } from "../common/task-query-state";
import { ExtendScheduleDialog } from "./extend-schedule-dialog";
import { WithdrawalRow } from "./withdrawal-row";

export function WithdrawalsScreen() {
  const [searchQuery, setSearchQuery] = useState(""),
    [statusFilter, setStatusFilter] = useState("all");
  const stateFilter = withdrawalStateSchema.safeParse(statusFilter);
  const history = useAdminWithdrawalHistory({
    ...(searchQuery.trim() ? { q: searchQuery.trim() } : {}),
    ...(stateFilter.success ? { state: stateFilter.data } : {}),
  });
  const command = useWithdrawalAction();
  const page = history.displayData;
  const scopeId = JSON.stringify([
    history.scope.accountId,
    history.scope.role,
    history.scope.epoch,
  ]);
  const [selected, setSelected] = useState<{
    row: AdminWithdrawalRequest;
    kind: "EXTEND" | "REJECT";
    scope: string;
  } | null>(null);
  const resolvedSelection =
    selected !== null &&
    command.outcome?.status === "COMMITTED" &&
    command.outcome.withdrawalId === selected.row.id &&
    command.outcome.expectedVersion === selected.row.version &&
    command.outcome.kind === selected.kind;
  const selection =
    history.allowed &&
    command.allowed &&
    selected?.scope === scopeId &&
    !resolvedSelection
      ? selected
      : null;
  const detail = useAdminWithdrawalDetail(selection?.row.id ?? null);
  const current = detail.data;
  const retiredSelection =
    selected !== null &&
    (selected.scope !== scopeId ||
      resolvedSelection ||
      detail.error?.category === "denied" ||
      (selection !== null &&
        current !== undefined &&
        !canChangeWithdrawal(current, selection.kind)));
  if (retiredSelection) setSelected(null);
  const visible = retiredSelection ? null : selection;
  const [feedback, setFeedback] = useState<{
    scope: string;
    message: string;
  } | null>(null);
  const pending = command.state.state === "pending" || command.isPending;
  const unresolved = command.retained !== null;
  const reviewed =
    visible &&
    current &&
    current.id === visible.row.id &&
    current.version === visible.row.version &&
    !detail.isError &&
    !detail.isFetching &&
    canChangeWithdrawal(current, visible.kind);
  const retrying =
    command.canRetry &&
    command.retained?.target === visible?.row.id &&
    command.retained?.kind === visible?.kind &&
    command.retained?.expectedVersion === visible?.row.version;
  const ready = Boolean(reviewed) && !pending && (!unresolved || retrying);
  const canReviewNewVersion = Boolean(
    visible &&
    current &&
    current.id === visible.row.id &&
    current.version > visible.row.version &&
    !detail.isError &&
    !detail.isFetching &&
    !pending &&
    !unresolved &&
    canChangeWithdrawal(current, visible.kind),
  );
  const open = (row: AdminWithdrawalRequest, kind: "EXTEND" | "REJECT") => {
    const sameRetained =
      command.canRetry &&
      command.retained?.target === row.id &&
      command.retained.kind === kind &&
      command.retained.expectedVersion === row.version;
    if (
      history.allowed &&
      !history.isDisplayStale &&
      command.allowed &&
      !pending &&
      (!unresolved || sameRetained) &&
      canChangeWithdrawal(row, kind)
    )
      setSelected({ row, kind, scope: scopeId });
  };
  const close = () => {
    if (!pending) setSelected(null);
  };
  const submit = async (intent: AdminWithdrawalIntent) => {
    if (canReviewNewVersion && visible && current) {
      setSelected({ ...visible, row: current });
      return false;
    }
    if (!ready || !visible || intent.target !== visible.row.id) return false;
    const scope = history.scope;
    try {
      const saved = retrying
        ? await command.retryOriginal(intent)
        : await command.execute(intent);
      if (!getSessionRuntime().isCurrentCheck(scope)) return false;
      setFeedback({
        scope: scopeId,
        message:
          saved.withdrawal.state === "REJECTED"
            ? "تم رفض الطلب وإعادة المبلغ إلى مصادره الأصلية."
            : "تم حفظ الموعد الجديد المحتسب من الخادم.",
      });
      setSelected(null);
      return true;
    } catch (failure: unknown) {
      if (getSessionRuntime().isCurrentCheck(scope))
        setFeedback({ scope: scopeId, message: getApiError(failure).message });
      throw failure;
    }
  };
  const reviewError =
    visible && !ready
      ? pending
        ? "جارٍ التحقق من العملية الأصلية."
        : unresolved
          ? "النتيجة غير محسومة؛ تُراجع العملية الأصلية فقط."
          : "يلزم تحميل تفاصيل حالية مطابقة؛ راجع الإصدار الجديد ثم أكد الإجراء صراحةً."
      : null;
  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة طلبات السحب المالي"
        description="متابعة طلبات السحب المجدولة للدفع التلقائي، وزيادة الجدولة أو الرفض الآمن قبل بدء الدفع"
        breadcrumbs={[{ label: "طلبات السحب" }]}
      />
      {history.allowed && feedback?.scope === scopeId && (
        <div
          className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-bold text-emerald-800"
          role="alert"
        >
          <span>{feedback.message}</span>
          <button
            type="button"
            onClick={() => {
              setFeedback(null);
            }}
            className="cursor-pointer text-xs underline hover:no-underline"
          >
            إغلاق
          </button>
        </div>
      )}
      {command.allowed && unresolved && (
        <TaskQueryState
          error="نتيجة الإجراء غير محسومة؛ لا يمكن إنشاء إجراء بديل. تحقق من العملية الأصلية."
          retry={command.observation.refetch}
        />
      )}
      {command.coordinationError && (
        <TaskQueryState
          error="تعذر حفظ هوية الاسترداد؛ الإجراءات معطلة."
          retry={history.refetch}
        />
      )}
      {command.outcome?.status === "COMMITTED" && (
        <p role="status">
          تم العثور على الإجراء الأصلي: {command.outcome.action.reason} —{" "}
          {command.outcome.action.occurredAt} — المنفذ:{" "}
          <bdi>{command.outcome.action.actorUserId}</bdi>
        </p>
      )}
      {command.outcome?.status === "SUPERSEDED" && (
        <p role="status">
          تغير الطلب دون إثبات تنفيذ الإجراء الأصلي؛ راجع الإصدار الجديد قبل أي
          إجراء.
        </p>
      )}
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-xs">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-center">
          <div className="sm:col-span-8">
            <AdminInput
              type="text"
              icon={Search}
              value={searchQuery}
              maxLength={200}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                if (!pending) setSelected(null);
              }}
              placeholder="بحث بالموظف، البريد، أو عنوان المحفظة..."
              aria-label="بحث في طلبات السحب"
            />
          </div>
          <div className="sm:col-span-4">
            <AdminSelect
              value={statusFilter}
              onValueChange={(next) => {
                setStatusFilter(next);
                if (!pending) setSelected(null);
              }}
              options={[
                { value: "all", label: "كل حالات السحب" },
                ...withdrawalStateSchema.options.map((state) => ({
                  value: state,
                  label: withdrawalStates[state].label,
                })),
              ]}
              aria-label="تصفية حسب حالة السحب"
            />
          </div>
        </div>
      </div>
      <AdminButton
        variant="outline"
        disabled={!history.canRefresh}
        onClick={() => {
          void history.refetch();
        }}
      >
        تحديث طلبات السحب
      </AdminButton>
      {page && history.isError && (
        <TaskQueryState
          error={history.error?.message ?? "تعذر قراءة طلبات السحب الحالية."}
          retry={history.refetch}
        />
      )}
      {(history.observationExhausted || history.isDisplayStale) && (
        <p role="status">آخر بيانات معروفة؛ حدّث طلبات السحب قبل أي إجراء.</p>
      )}
      {!page ? (
        <TaskQueryState
          error={
            history.isError || !history.allowed || history.observationExhausted
              ? (history.error?.message ??
                "تعذر قراءة طلبات السحب الحالية. تحقق من الصلاحية والاتصال.")
              : undefined
          }
          retry={history.refetch}
        />
      ) : (
        <AdminTableShell
          footer={
            <>
              <p className="px-4 py-3 text-xs text-slate-500">
                الصفحة {history.page} من {page.pagination.totalPages} —{" "}
                {page.pagination.total} طلب مطابق
              </p>
              <AdminPagination
                currentPage={history.page}
                totalPages={page.pagination.totalPages}
                totalItems={page.pagination.total}
                pageSize={10}
                onPageChange={(next) => {
                  history.setPage(next);
                  if (!pending) setSelected(null);
                }}
              />
            </>
          }
        >
          {page.items.length === 0 ? (
            <AdminEmptyState
              title="لا توجد طلبات سحب مطابقة"
              description="لم يتم العثور على أي طلبات سحب تطابق معايير البحث الحالية."
            />
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-bold text-slate-600">
                <tr>
                  {[
                    "الموظف",
                    "المبلغ المطلوب",
                    "الرسوم المحفوظة",
                    "الصافي المحول",
                    "عنوان المحفظة",
                    "الطلب / الاستحقاق",
                    "الوقت المتبقي",
                    "الحالة",
                    "الإجراءات",
                  ].map((label) => (
                    <th key={label} className="px-4 py-3">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {page.items.map((row) => (
                  <WithdrawalRow
                    key={row.id}
                    wth={row}
                    disabled={
                      pending ||
                      (unresolved &&
                        !(
                          command.canRetry &&
                          command.retained?.target === row.id
                        )) ||
                      !history.allowed ||
                      history.isDisplayStale ||
                      history.isFetching ||
                      history.isError
                    }
                    retainedKind={
                      command.retained?.target === row.id
                        ? command.retained.kind
                        : undefined
                    }
                    onExtend={(saved) => {
                      open(saved, "EXTEND");
                    }}
                    onReject={(saved) => {
                      open(saved, "REJECT");
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </AdminTableShell>
      )}
      <ExtendScheduleDialog
        key={`extend:${scopeId}:${selected?.row.id ?? "none"}`}
        isOpen={visible?.kind === "EXTEND"}
        withdrawal={
          visible?.kind === "EXTEND"
            ? current?.version === visible.row.version
              ? current
              : visible.row
            : null
        }
        disabled={!ready && !canReviewNewVersion}
        isLoading={pending}
        errorMessage={reviewError}
        retryOriginal={retrying}
        reviewNewVersion={canReviewNewVersion}
        onConfirm={async (countedHours, reason, expectedVersion) => {
          if (visible) {
            const committed = await submit({
              target: visible.row.id,
              kind: "EXTEND",
              body: { expectedVersion, countedHours, reason, confirmed: true },
            });
            return committed;
          }
          return false;
        }}
        onClose={close}
      />
      <AdminConfirmDialog
        key={`reject:${scopeId}:${selected?.row.id ?? "none"}`}
        isOpen={visible?.kind === "REJECT"}
        title="رفض طلب السحب وإلغاء الحجز المالي"
        description={
          visible ? (
            <div className="space-y-2">
              <p>
                سيتم رفض طلب السحب بمبلغ{" "}
                <strong className="font-mono">{visible.row.gross} USDT</strong>{" "}
                الخاص بالموظف{" "}
                <strong>
                  {current?.employee.fullName ?? visible.row.employee.fullName}
                </strong>
                .
              </p>
              <p className="text-slate-500">
                سيتم تحرير المبلغ إلى مصادره الأصلية مرة واحدة؛ رسوم محصلة: 0
                USDT.
              </p>
              <p dir="ltr" className="break-all">
                {visible.row.id} — v{visible.row.version} —{" "}
                {visible.row.recipient}
              </p>
            </div>
          ) : null
        }
        confirmLabel={
          canReviewNewVersion
            ? "مراجعة الإصدار الجديد"
            : retrying
              ? "إعادة محاولة الإجراء الأصلي فقط"
              : "تأكيد الرفض وتحرير الرصيد"
        }
        variant="destructive"
        requireReason
        reasonLabel="سبب رفض السحب الإلزامي"
        reasonPlaceholder="يرجى ذكر سبب الرفض لحفظه في سجل التدقيق..."
        isLoading={pending}
        confirmDisabled={!ready && !canReviewNewVersion}
        error={reviewError}
        onConfirm={(reason) =>
          visible
            ? submit({
                target: visible.row.id,
                kind: "REJECT",
                body: {
                  expectedVersion: visible.row.version,
                  reason: reason ?? "",
                  confirmed: true,
                },
              })
            : false
        }
        onClose={close}
      />
    </div>
  );
}
