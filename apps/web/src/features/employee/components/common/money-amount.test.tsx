import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { MoneyAmount } from "./money-amount";

it("isolates exact micro-unit amounts and retains legacy presentation", () => {
  const view = render(<MoneyAmount amount="-1.000001" showSign />);
  expect(screen.getByText("-1.000001")).toHaveAttribute("dir", "ltr");
  expect(screen.getByText("USDT")).toBeVisible();
  view.rerender(<MoneyAmount amount={64.8} showSign />);
  expect(screen.getByText("+64.80")).toHaveAttribute("dir", "ltr");
});
