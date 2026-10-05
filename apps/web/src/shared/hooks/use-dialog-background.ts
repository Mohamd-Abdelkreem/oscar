"use client";

import { useEffect, type RefObject } from "react";

export const useDialogBackground = (
  dialog: RefObject<HTMLElement | null>,
  open: boolean,
) => {
  useEffect(() => {
    if (!open) return;
    const background: { element: HTMLElement; inert: boolean }[] = [];
    let ancestor = dialog.current;
    while (ancestor !== null && ancestor !== document.body) {
      for (const sibling of ancestor.parentElement?.children ?? []) {
        if (sibling instanceof HTMLElement && sibling !== ancestor) {
          background.push({
            element: sibling,
            inert: sibling.hasAttribute("inert"),
          });
          sibling.setAttribute("inert", "");
        }
      }
      ancestor = ancestor.parentElement;
    }
    return () => {
      for (const entry of background) {
        if (!entry.inert) entry.element.removeAttribute("inert");
      }
    };
  }, [dialog, open]);
};
