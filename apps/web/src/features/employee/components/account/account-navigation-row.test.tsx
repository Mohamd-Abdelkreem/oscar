import { render, screen } from "@testing-library/react";
import { Wallet } from "lucide-react";
import { expect, it } from "vitest";

import { AccountNavigationRow } from "./account-navigation-row";

it("exposes an account shortcut as a destination instead of an action button", () => {
  render(
    <AccountNavigationRow
      href="/employee/wallet"
      icon={Wallet}
      label="المحفظة وسجل المعاملات"
    />,
  );
  expect(
    screen.getByRole("link", { name: "المحفظة وسجل المعاملات" }),
  ).toHaveAttribute("href", "/employee/wallet");
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
});
