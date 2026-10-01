import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Button, ButtonLink } from "./button";

describe("employee buttons", () => {
  it.each([
    { loading: true, disabled: false },
    { loading: false, disabled: true },
  ])(
    "blocks actions while loading=$loading and disabled=$disabled",
    (props) => {
      const action = vi.fn();
      render(
        <Button {...props} onClick={action}>
          تأكيد
        </Button>,
      );
      const button = screen.getByRole("button", { name: "تأكيد" });
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute("aria-busy", String(props.loading));
      fireEvent.click(button);
      expect(action).not.toHaveBeenCalled();
    },
  );

  it("runs an enabled action using a button without submitting its parent form", () => {
    const action = vi.fn();
    const submit = vi.fn();
    render(
      <form onSubmit={submit}>
        <Button onClick={action}>نسخ</Button>
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "نسخ" }));
    expect(action).toHaveBeenCalledOnce();
    expect(submit).not.toHaveBeenCalled();
  });

  it("removes the destination and click action from a disabled navigation button", () => {
    const action = vi.fn();
    render(
      <ButtonLink href="/employee/deposit" disabled onClick={action}>
        إيداع
      </ButtonLink>,
    );
    const link = screen.getByRole("link", { name: "إيداع" });
    expect(link).toHaveAttribute("aria-disabled", "true");
    expect(link).not.toHaveAttribute("href");
    fireEvent.click(link);
    expect(action).not.toHaveBeenCalled();
  });
});
