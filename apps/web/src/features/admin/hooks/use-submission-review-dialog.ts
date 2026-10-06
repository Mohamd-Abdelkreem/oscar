"use client";
import { useEffect, useRef } from "react";
import { useDialogBackground } from "@/shared/hooks/use-dialog-background";

export function useSubmissionReviewDialog(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);

  useDialogBackground(ref, open);
  useEffect(() => {
    if (!open) return;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    ref.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
      event.preventDefault();
      if (controls.length === 0) {
        ref.current?.focus();
        return;
      }
      const current = controls.findIndex(
        (control) => control === document.activeElement,
      );
      const next = event.shiftKey
        ? current <= 0
          ? controls.length - 1
          : current - 1
        : (current + 1) % controls.length;
      controls[next]?.focus();
    };
    window.addEventListener("keydown", keyboard, true);
    return () => {
      window.removeEventListener("keydown", keyboard, true);
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open, close]);
  return ref;
}
