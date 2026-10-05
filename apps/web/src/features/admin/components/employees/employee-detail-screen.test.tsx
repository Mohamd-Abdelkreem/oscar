import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";

import { AdminStateProvider } from "../../context/admin-state.context";
import { EmployeeDetailScreen } from "./employee-detail-screen";

it("opens employee dialogs and previews adjustments to a balance with reserved funds", () => {
  // Regression: these dialogs treated the structured balance as a number.
  render(
    <AdminStateProvider>
      <EmployeeDetailScreen employeeId="usr_1003" />
    </AdminStateProvider>,
  );

  fireEvent.click(screen.getByRole("button", { name: "تسوية الرصيد" }));
  const balanceDialog = within(screen.getByRole("dialog"));
  expect(balanceDialog.getByText("850.00 USDT")).toBeInTheDocument();
  fireEvent.change(balanceDialog.getByRole("spinbutton"), {
    target: { value: "25" },
  });
  expect(balanceDialog.getByText("875.00 USDT")).toBeInTheDocument();
  fireEvent.click(balanceDialog.getByRole("button", { name: "خصم رصيد (-)" }));
  expect(balanceDialog.getByText("825.00 USDT")).toBeInTheDocument();
  fireEvent.click(balanceDialog.getByRole("button", { name: "إلغاء" }));

  fireEvent.click(screen.getByRole("button", { name: "أرشفة الحساب" }));
  expect(
    screen.getByRole("dialog", { name: "أرشفة وحذف حساب الموظف" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "إلغاء" }));

  fireEvent.click(screen.getByRole("button", { name: "تعليق الحساب" }));
  expect(
    screen.getByRole("dialog", { name: "تعليق حساب الموظف: محمود حسن" }),
  ).toBeInTheDocument();
});
