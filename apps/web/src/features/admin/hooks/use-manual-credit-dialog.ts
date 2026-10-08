"use client";

import { useEffect, useRef } from "react";
import { useDialogBackground } from "@/shared/hooks/use-dialog-background";

function ownsFocus(dialog: HTMLElement, target: Node) {
  if (dialog.contains(target)) return true;
  const popupId = dialog
    .querySelector('[role="combobox"][aria-expanded="true"]')
    ?.getAttribute("aria-controls");
  return popupId
    ? document.getElementById(popupId)?.contains(target) === true
    : false;
}

export function useManualCreditDialog({
  open,
  active,
  close,
}: {
  open: boolean;
  active: boolean;
  close: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDialogBackground(ref, active);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement;
    ref.current?.focus();
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, [open]);

  useEffect(() => {
    const dialog = ref.current;
    if (!active || dialog === null) return;
    const containFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !ownsFocus(dialog, event.target))
        dialog.focus();
    };
    const keyboard = (event: KeyboardEvent) => {
      // Radix owns its portalled selector; the final confirmation owns focus while reviewed.
      if (
        event.defaultPrevented ||
        !(event.target instanceof Node) ||
        !dialog.contains(event.target)
      )
        return;
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),textarea:not(:disabled),select:not(:disabled),[tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (first === undefined) {
        event.preventDefault();
        dialog.focus();
      } else if (
        document.activeElement === dialog ||
        (event.shiftKey
          ? document.activeElement === first
          : document.activeElement === last)
      ) {
        event.preventDefault();
        (event.shiftKey ? last : first)?.focus();
      }
    };
    document.addEventListener("focusin", containFocus);
    window.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("focusin", containFocus);
      window.removeEventListener("keydown", keyboard);
    };
  }, [active, close]);

  return ref;
}
