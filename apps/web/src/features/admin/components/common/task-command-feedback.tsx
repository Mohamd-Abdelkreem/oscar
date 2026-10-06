"use client";
import type { useTaskCommand } from "@/features/proofs/hooks/use-task-command";
import { AdminButton } from "./admin-button";

export function TaskCommandFeedback({
  command,
}: {
  readonly command: ReturnType<typeof useTaskCommand>;
}) {
  const reconcile = async (action: "observe" | "cancel") => {
    try {
      await command[action]();
    } catch {
      /* The command exposes a safe error below. */
    }
  };
  return (
    <>
      {command.error && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {command.error.message}
        </p>
      )}
      {command.retained && (
        <div className="flex items-center gap-2">
          <AdminButton
            variant="outline"
            disabled={command.isPending}
            onClick={() => {
              void reconcile("observe");
            }}
          >
            التحقق من الطلب
          </AdminButton>
          <AdminButton
            variant="outline"
            disabled={command.isPending}
            onClick={() => {
              void reconcile("cancel");
            }}
          >
            إلغاء الطلب غير المؤكد
          </AdminButton>
        </div>
      )}
    </>
  );
}
