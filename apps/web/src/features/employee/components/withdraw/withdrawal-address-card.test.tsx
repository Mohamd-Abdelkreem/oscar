import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { cleanupQueries, queryHarness } from "@/test/p04-query";
import { reply } from "@/test/p04-network";
import {
  destination,
  pendingDestination,
  withdrawalStatus,
} from "@/test/p09-withdrawals";
import { WithdrawalAddressCard } from "./withdrawal-address-card";

cleanupQueries();
describe("first withdrawal destination card", () => {
  it("requires exact address/network review before issuance and shows pending acknowledgement separately from confirmation", async () => {
    let issued = false,
      writes = 0;
    const h = queryHarness("USER", (config) => {
      const saved = issued
        ? pendingDestination
        : { state: "UNSET", serverNow: destination.serverNow };
      if (config.method === "post") {
        issued = true;
        writes++;
        return reply(config, pendingDestination, 201);
      }
      return reply(
        config,
        config.url === "/withdrawals/me"
          ? { ...withdrawalStatus, destination: saved }
          : saved,
      );
    });
    render(<WithdrawalAddressCard />, { wrapper: h.wrapper });
    const input = await screen.findByLabelText(
      "أدخل عنوان محفظة TRON (TRC20):",
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "حفظ وتأمين عنوان السحب" }),
      ).toBeEnabled();
    });
    fireEvent.change(input, { target: { value: destination.address } });
    fireEvent.click(
      screen.getByRole("button", { name: "حفظ وتأمين عنوان السحب" }),
    );
    const sheet = await screen.findByRole("dialog");
    expect(sheet).toHaveTextContent(destination.address);
    expect(sheet).toHaveTextContent("TRON_NILE");
    expect(writes).toBe(0);
    fireEvent.click(
      screen.getByRole("button", { name: "تأكيد العنوان وإرسال رابط البريد" }),
    );
    await screen.findByText(/قبل مزود البريد/u);
    expect(writes).toBe(1);
    expect(screen.queryByText("مثبت ومؤمن")).toBeNull();
    expect(
      screen.getByRole("button", { name: "إعادة إرسال رابط التأكيد" }),
    ).toBeDisabled();
  });
  it.each([null, "TRON_MAINNET"])(
    "disables incompatible network %s without relabeling pending facts",
    async (network) => {
      const h = queryHarness("USER", (config) =>
        reply(
          config,
          config.url === "/withdrawals/me"
            ? { ...withdrawalStatus, network, destination: pendingDestination }
            : pendingDestination,
        ),
      );
      render(<WithdrawalAddressCard />, { wrapper: h.wrapper });
      await screen.findByText("TRON_NILE");
      expect(
        screen.getByRole("button", { name: "إعادة إرسال رابط التأكيد" }),
      ).toBeDisabled();
      expect(screen.queryByRole("textbox")).toBeNull();
    },
  );
  it("renders confirmed server destination read-only without employee replacement", async () => {
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.url === "/withdrawals/me" ? withdrawalStatus : destination,
      ),
    );
    render(<WithdrawalAddressCard />, { wrapper: h.wrapper });
    await screen.findByText(destination.address);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "حفظ وتأمين عنوان السحب" }),
    ).toBeNull();
    expect(screen.getByText("مثبت ومؤمن")).toBeVisible();
  });
});
