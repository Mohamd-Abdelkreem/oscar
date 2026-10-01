import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { expect, it } from "vitest";

import { ConfirmationSheet } from "./confirmation-sheet";

function SheetExample() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
      >
        فتح
      </button>
      <ConfirmationSheet
        isOpen={open}
        onClose={() => {
          setOpen(false);
        }}
        title="تأكيد"
      >
        <button
          onClick={() => {
            setCount(count + 1);
          }}
        >
          تحديث {count}
        </button>
      </ConfirmationSheet>
    </>
  );
}

it("keeps focus during sheet updates and returns it with the original scroll style on Escape", () => {
  document.body.style.overflow = "auto";
  render(<SheetExample />);
  const opener = screen.getByRole("button", { name: "فتح" });
  opener.focus();
  fireEvent.click(opener);
  expect(document.body.style.overflow).toBe("hidden");
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
    true,
  );

  fireEvent.click(screen.getByRole("button", { name: "تحديث 0" }));
  expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(
    true,
  );
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(opener).toHaveFocus();
  expect(document.body.style.overflow).toBe("auto");
  document.body.style.overflow = "";
});
