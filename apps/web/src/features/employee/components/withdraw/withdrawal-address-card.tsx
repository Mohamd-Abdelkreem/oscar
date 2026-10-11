"use client";

import { Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSessionScope } from "@/features/auth/hooks/auth.hooks";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { withdrawalDestinationBodySchema } from "@template/contracts";
import {
  useEmployeeWithdrawalDestination,
  useEmployeeWithdrawalStatus,
  useWithdrawalDestinationCommand,
} from "../../hooks/withdrawals.hooks";
import { ConfirmationSheet } from "../common/confirmation-sheet";
import { FinancialFeedback } from "../common/financial-feedback";
import { WithdrawalDestinationDetails } from "./withdrawal-destination-details";
import { Button } from "../common/button";
import { CopyAction } from "../common/copy-action";

export function WithdrawalAddressCard() {
  const scope = useSessionScope();
  return <AddressCard key={JSON.stringify([scope.epoch, scope.accountId])} />;
}
function AddressCard() {
  const read = useEmployeeWithdrawalDestination();
  const status = useEmployeeWithdrawalStatus();
  const command = useWithdrawalDestinationCommand();
  const form = useForm<z.infer<typeof withdrawalDestinationBodySchema>>({
    resolver: zodResolver(withdrawalDestinationBodySchema),
    defaultValues: { address: "" },
  });
  const [review, setReview] = useState<{
    address: string;
    network: NonNullable<typeof status.data>["network"];
    identity: string;
  } | null>(null);
  const identity = JSON.stringify([read.scope.epoch, read.scope.accountId]);
  const destination = read.displayData;
  const savedAddress =
    destination?.state === "CONFIRMED" ? destination.address : null;
  const network = status.displayData?.network;
  const current = read.data !== undefined && status.data !== undefined;
  const enabled =
    command.allowed &&
    read.allowed &&
    status.allowed &&
    current &&
    destination?.state === "UNSET" &&
    network != null &&
    !command.isPending &&
    !command.uncertain;
  const addressInput = useWatch({ control: form.control, name: "address" });
  const handleSaveAddress = form.handleSubmit(({ address }) => {
    if (enabled) setReview({ address, network, identity });
  });
  const activeReview = review?.identity === identity ? review : null;

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs sm:p-5">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900 sm:text-base">
          <ShieldCheck
            size={18}
            className="text-emerald-700"
            aria-hidden="true"
          />
          <span>عنوان محفظة السحب (TRON / TRC20)</span>
        </h2>
        {savedAddress && (
          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
            مثبت ومؤمن
          </span>
        )}
      </div>

      {savedAddress ? (
        <div className="space-y-2">
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <span className="mb-1 block text-xs text-slate-500">
              العنوان المحفوظ المعتمد لاستلام الحوالات:
            </span>
            <div className="flex items-center justify-between gap-2">
              <bdi
                dir="ltr"
                className="font-mono text-xs font-semibold break-all text-slate-900 select-all sm:text-sm"
              >
                {savedAddress}
              </bdi>
              <CopyAction value={savedAddress} variant="icon" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <Lock size={13} aria-hidden="true" />
              العنوان مقفل للحماية المالية
            </span>
            <Link
              href="/employee/support"
              className="font-semibold text-emerald-700 hover:text-emerald-800"
            >
              طلب تعديل العنوان عبر الدعم
            </Link>
          </div>
        </div>
      ) : destination?.state === "UNSET" ? (
        <form
          onSubmit={(event) => {
            void handleSaveAddress(event);
          }}
          className="space-y-3"
        >
          <p className="text-xs leading-relaxed text-slate-600">
            يتم تثبيت عنوان محفظتك لأول مرة لضمان وصول السحوبات بأمان. أي تعديل
            مستقبلي يتطلب التواصل مع الدعم الفني.
          </p>

          <div className="space-y-1">
            <label
              htmlFor="address-input"
              className="block text-xs font-semibold text-slate-700"
            >
              أدخل عنوان محفظة TRON (TRC20):
            </label>
            <input
              id="address-input"
              type="text"
              dir="ltr"
              {...form.register("address")}
              disabled={
                !command.allowed || command.isPending || command.uncertain
              }
              placeholder="T..."
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2 font-mono text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          {form.formState.errors.address && (
            <p role="alert" className="text-xs text-rose-600">
              أدخل عنوان TRON صالحاً.
            </p>
          )}
          {network == null && (
            <p role="alert" className="text-xs text-rose-600">
              شبكة السحب غير متاحة حالياً.
            </p>
          )}

          <Button
            type="submit"
            variant="dark"
            size="default"
            fullWidth
            disabled={!enabled}
          >
            حفظ وتأمين عنوان السحب
          </Button>
        </form>
      ) : null}
      <FinancialFeedback
        pending={
          (!destination && read.isPending && !read.observationExhausted) ||
          (!status.displayData &&
            status.isPending &&
            !status.observationExhausted)
        }
        error={read.error ?? status.error}
        retry={() => Promise.all([read.refetch(), status.refetch()])}
      />
      <WithdrawalDestinationDetails
        current={current}
        stale={
          read.isDisplayStale ||
          status.isDisplayStale ||
          read.observationExhausted ||
          status.observationExhausted
        }
        refresh={() =>
          Promise.all([
            read.refetch(),
            status.refetch(),
            command.observation.refetch(),
          ])
        }
        destination={destination}
        network={network}
        command={command}
      />
      <ConfirmationSheet
        isOpen={activeReview !== null}
        onClose={() => {
          if (!command.isPending) setReview(null);
        }}
        title="مراجعة عنوان السحب"
        description="راجع العنوان والشبكة قبل طلب رابط البريد"
      >
        {activeReview && (
          <div className="space-y-3 text-xs text-slate-600">
            <bdi dir="ltr" className="block font-mono break-all">
              {activeReview.address}
            </bdi>
            <p>
              الشبكة: <bdi dir="ltr">{activeReview.network}</bdi>
            </p>
            <p>طلب البريد لا يؤكد العنوان ولا يضمن وصول الرسالة.</p>
            <Button
              variant="dark"
              fullWidth
              disabled={
                !enabled ||
                activeReview.address !== addressInput ||
                activeReview.network !== network
              }
              loading={command.isPending}
              onClick={() => {
                if (
                  !enabled ||
                  activeReview.address !== addressInput ||
                  activeReview.network !== network
                )
                  return;
                void command
                  .issue(activeReview.address, network)
                  .then(() => {
                    setReview(null);
                  })
                  .catch(() => {
                    setReview(null);
                  });
              }}
            >
              تأكيد العنوان وإرسال رابط البريد
            </Button>
          </div>
        )}
      </ConfirmationSheet>
    </div>
  );
}
