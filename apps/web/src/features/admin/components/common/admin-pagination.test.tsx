import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { AdminPagination } from "./admin-pagination";

it("keeps a bounded current-page window and previous/next navigation for large server lists", () => {
  const change = vi.fn();
  const { rerender } = render(
    <AdminPagination
      currentPage={1}
      totalPages={26}
      totalItems={260}
      pageSize={10}
      onPageChange={change}
    />,
  );
  expect(screen.getAllByRole("button")).toHaveLength(5);
  expect(screen.getByRole("button", { name: "السابق" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "التالي" }));
  expect(change).toHaveBeenLastCalledWith(2);
  rerender(
    <AdminPagination
      currentPage={25}
      totalPages={26}
      totalItems={260}
      pageSize={10}
      onPageChange={change}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "26" }));
  expect(change).toHaveBeenLastCalledWith(26);
  rerender(
    <AdminPagination
      currentPage={26}
      totalPages={26}
      totalItems={260}
      pageSize={10}
      onPageChange={change}
    />,
  );
  expect(screen.getByRole("button", { name: "التالي" })).toBeDisabled();
  fireEvent.click(screen.getByRole("button", { name: "السابق" }));
  expect(change).toHaveBeenLastCalledWith(25);
});
