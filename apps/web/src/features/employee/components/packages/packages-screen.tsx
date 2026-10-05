"use client";

import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";
import { PackageCard } from "@/features/employee/components/packages/package-card";
import { PackageUpgradeModal } from "@/features/employee/components/packages/package-upgrade-modal";
import {
  usePackageCatalog,
  useMembership,
  usePurchaseQuote,
} from "../../hooks/packages.hooks";
import { usePurchaseCommand } from "../../hooks/purchase-command.hooks";
import { presentPackage } from "../../utils/package-presentation";
import { FinancialFeedback } from "../common/financial-feedback";
import { MoneyAmount } from "../common/money-amount";
import { SavedSubscriptionDetails } from "./saved-subscription-details";
import type { PackageCode } from "@template/contracts";

export function EmployeePackagesScreen() {
  const catalog = usePackageCatalog();
  const membership = useMembership();
  const quote = usePurchaseQuote();
  const command = usePurchaseCommand();
  const originalOutcome = command.observation.data;
  const [selection, setSelection] = useState<{
    code: PackageCode;
    scope: string;
  } | null>(null);
  const scope = JSON.stringify(catalog.scope);
  const selected = selection?.scope === scope ? selection.code : null;
  const current =
    membership.data?.effective === "PAID"
      ? membership.data.subscription?.terms.code
      : null;
  const tier =
    membership.data?.effective === "PAID"
      ? membership.data.subscription?.terms.tierOrder
      : 0;
  const paidPositions = catalog.data?.items.map(presentPackage) ?? [];
  const select = (code: PackageCode) => {
    if (
      !catalog.allowed ||
      !membership.allowed ||
      !quote.allowed ||
      !command.allowed ||
      command.retained !== null
    )
      return;
    setSelection({ code, scope });
    quote.reset();
    void quote.mutateAsync(code).catch(() => undefined);
  };

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="المناصب والباقات"
        subtitle="اختر المنصب المناسب لتفعيل المهام اليومية ومضاعفة العوائد"
      />

      <div className="space-y-4 p-4 sm:p-5">
        <FinancialFeedback
          pending={catalog.isPending || membership.isPending}
          error={
            catalog.error ??
            membership.error ??
            (selected === null ? quote.error : null)
          }
          retry={() => {
            quote.reset();
            return Promise.all([catalog.refetch(), membership.refetch()]);
          }}
        />
        {command.coordinationError && (
          <p role="alert">تعذر تنسيق عملية الشراء. لا يمكن إرسال شراء جديد.</p>
        )}
        {command.observation.isError && (
          <p role="alert">تعذر التحقق. تظل العملية الأصلية غير محسومة.</p>
        )}
        {command.retained && (
          <div
            role="status"
            className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs"
          >
            توجد عملية شراء لم تتأكد نتيجتها.
            <button
              type="button"
              disabled={
                !command.allowed ||
                command.observation.isPending ||
                command.isPending ||
                command.state.state === "pending"
              }
              onClick={() => {
                void command.observation.mutateAsync().catch(() => undefined);
              }}
            >
              التحقق من نتيجة العملية
            </button>
            {command.observation.data?.status === "NOT_OBSERVED" && (
              <button
                type="button"
                onClick={() => {
                  const outcome = command.observation.data;
                  if (outcome?.status === "NOT_OBSERVED")
                    setSelection({ code: outcome.quote.packageCode, scope });
                }}
              >
                مراجعة العملية الأصلية
              </button>
            )}
          </div>
        )}
        {originalOutcome?.status === "COMMITTED" && (
          <div
            role="status"
            aria-label="نتيجة العملية الأصلية"
            className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs"
          >
            <p className="font-semibold">تم تسجيل عملية الشراء الأصلية.</p>
            <p>هذه نتيجة العملية الأصلية وليست حالة العضوية الحالية.</p>
            <p>
              مرجع الشراء:{" "}
              <bdi dir="ltr" className="break-all">
                {originalOutcome.purchase.purchaseId}
              </bdi>
            </p>
            <p>
              مرجع العرض الأصلي:{" "}
              <bdi dir="ltr" className="break-all">
                {originalOutcome.quoteId}
              </bdi>
            </p>
            <p>
              وقت الشراء الأصلي:{" "}
              <bdi dir="ltr" className="break-all">
                {originalOutcome.purchase.purchasedAt}
              </bdi>
            </p>
            <p>
              إجمالي الخصم المسجل:{" "}
              <MoneyAmount
                amount={originalOutcome.purchase.fullDebit}
                size="sm"
              />
            </p>
            <SavedSubscriptionDetails
              subscription={originalOutcome.purchase.subscriptionAtPurchase}
            />
          </div>
        )}
        {originalOutcome?.status === "EXPIRED_UNCOMMITTED" && (
          <div
            role="status"
            aria-label="نتيجة العملية الأصلية"
            className="space-y-1 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs"
          >
            <p>انتهت صلاحية عرض الشراء الأصلي دون تسجيل شراء أو خصم.</p>
            <p>
              مرجع العرض الأصلي:{" "}
              <bdi dir="ltr" className="break-all">
                {originalOutcome.quoteId}
              </bdi>
            </p>
          </div>
        )}
        {paidPositions.map((pkg) => (
          <PackageCard
            key={pkg.id}
            pkg={pkg}
            isCurrent={pkg.id === current}
            subscription={
              pkg.id === current ? membership.data?.subscription : null
            }
            currentTier={tier}
            allowed={
              catalog.allowed &&
              membership.allowed &&
              command.allowed &&
              !command.retained &&
              !command.isPending
            }
            onSelectUpgrade={(target) => {
              select(target.code);
            }}
          />
        ))}
      </div>

      <PackageUpgradeModal
        quote={
          selected
            ? quote.data?.packageCode === selected
              ? quote.data
              : command.observation.data?.status === "NOT_OBSERVED" &&
                  command.observation.data.quote.packageCode === selected
                ? command.observation.data.quote
                : null
            : null
        }
        isOpen={selected !== null}
        loading={quote.isPending}
        quoteError={quote.error}
        onClose={() => {
          setSelection(null);
        }}
      />
    </div>
  );
}
