import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QRCodeSVG } from "qrcode.react";
import { depositHistoryQuerySchema } from "@template/contracts";
import { safeApiError } from "@/services/api/safe-error";
import { reply } from "@/test/p04-network";
import { cleanupQueries, deferred, queryHarness } from "@/test/p04-query";
import {
  depositMetadata,
  emptyDepositHistory,
  readyAssignment,
  receivingAddress,
  recordedDepositHistory,
  secondAddress,
  employeeDepositPage,
} from "@/test/p07-deposits";
import { DepositCard } from "./deposit-card";

cleanupQueries();
const originalClipboard = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);
afterEach(() => {
  if (originalClipboard)
    Object.defineProperty(navigator, "clipboard", originalClipboard);
  else Reflect.deleteProperty(navigator, "clipboard");
});
describe("real employee deposit presentation", () => {
  it("shows Baghdad chronology, preserves known rows on refresh failure and recovers failed navigation", async () => {
    let failed = false;
    const h = queryHarness("USER", (config) => {
      if (config.url === "/deposits/me/address")
        return reply(config, readyAssignment);
      if (failed) throw safeApiError("transient", "NETWORK_ERROR");
      return reply(
        config,
        employeeDepositPage(
          depositHistoryQuerySchema.parse(config.params).page,
        ),
      );
    });
    render(<DepositCard />, { wrapper: h.wrapper });
    await screen.findByText("+1.000001");
    expect(screen.getAllByText("2026-10-05 12:00")).toHaveLength(25);
    failed = true;
    fireEvent.click(screen.getByRole("button", { name: "تحديث الحالة" }));
    await screen.findByRole("alert");
    expect(screen.getByText("+1.000001")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "التالي" }));
    await waitFor(() => {
      expect(screen.queryByText("+1.000001")).not.toBeInTheDocument();
    });
    failed = false;
    fireEvent.click(
      await screen.findByRole("button", { name: "إعادة المحاولة" }),
    );
    expect(await screen.findByText("+1.000001")).toBeVisible();
  });
  it("offers one configured READY address with equal QR/copy and exact real chain/manual facts", async () => {
    const copied: string[] = [];
    const completed = deferred<undefined>();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          copied.push(text);
          return completed.promise;
        },
      },
    });
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.url === "/deposits/me/history"
          ? recordedDepositHistory
          : readyAssignment,
      ),
    );
    const view = render(<DepositCard />, { wrapper: h.wrapper });
    await waitFor(() => {
      expect(screen.getAllByText(receivingAddress)).toHaveLength(2);
    });
    const addresses = screen.getAllByText(receivingAddress);
    for (const address of addresses)
      expect(address).toHaveAttribute("dir", "ltr");
    expect(screen.getByText("TRON_NILE")).toBeVisible();
    expect(screen.getByText(secondAddress)).toBeVisible();
    // Generator equality proves wiring only; independent phone decoding is T045.
    const reference = render(
      <QRCodeSVG
        value={receivingAddress}
        size={180}
        level="M"
        marginSize={0}
      />,
    );
    const actualQr = view.container.querySelector("svg[width='180']");
    expect(actualQr?.innerHTML).toBe(
      reference.container.querySelector("svg")?.innerHTML,
    );
    reference.unmount();
    expect(screen.getByText("+1.000001")).toBeVisible();
    expect(screen.getByText("+2.000002")).toBeVisible();
    expect(screen.getByText(/إضافة يدوية/)).toBeVisible();
    expect(
      screen.queryByText(/إيداع تجريبي|قيد الاعتماد النهائي/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "نسخ العنوان" }));
    expect(screen.queryByText("تم النسخ بنجاح")).not.toBeInTheDocument();
    await act(async () => {
      completed.resolve(undefined);
      await completed.promise;
    });
    expect(await screen.findByText("تم النسخ بنجاح")).toBeVisible();
    expect(copied).toEqual([receivingAddress]);
  });

  it("reports clipboard refusal while preserving the full inspectable address", async () => {
    let refused = true;
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          refused
            ? Promise.reject(new Error("PRIVATE DIAGNOSTIC"))
            : Promise.resolve(),
      },
    });
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.url === "/deposits/me/history"
          ? emptyDepositHistory
          : readyAssignment,
      ),
    );
    render(<DepositCard />, { wrapper: h.wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "نسخ العنوان" }));
    expect(await screen.findByText(/تعذر نسخ العنوان/)).toBeVisible();
    expect(screen.getByText(receivingAddress)).toBeVisible();
    expect(screen.queryByText("تم النسخ بنجاح")).not.toBeInTheDocument();
    expect(screen.queryByText("PRIVATE DIAGNOSTIC")).not.toBeInTheDocument();
    refused = false;
    fireEvent.click(screen.getByRole("button", { name: "نسخ العنوان" }));
    expect(await screen.findByText("تم النسخ بنجاح")).toBeVisible();
    expect(screen.queryByText(/تعذر نسخ العنوان/)).not.toBeInTheDocument();
  });

  it.each([
    {
      ...depositMetadata,
      state: "PROVISIONING",
      assignmentId: "00000000-0000-4000-8000-000000000001",
      readiness: "RECOVERY_ACKED",
    },
    {
      ...depositMetadata,
      state: "UNAVAILABLE",
      reasonCode: "EVIDENCE_CONFLICT",
      retryable: false,
    },
    { ...readyAssignment, state: "PROVISIONING" },
  ])(
    "offers no usable receiving instructions for nonready or malformed data",
    async (assignment) => {
      const h = queryHarness("USER", (config) =>
        reply(
          config,
          config.url === "/deposits/me/history"
            ? emptyDepositHistory
            : assignment,
        ),
      );
      const view = render(<DepositCard />, { wrapper: h.wrapper });
      await waitFor(() => {
        expect(view.container.textContent).toMatch(
          /جارٍ تجهيز|غير متاح|تعذر تحميل/,
        );
      });
      await waitFor(() => {
        expect(view.container.textContent).not.toContain(
          "جارٍ تحميل البيانات المالية",
        );
      });
      expect(
        screen.queryByRole("button", { name: "نسخ العنوان" }),
      ).not.toBeInTheDocument();
      expect(view.container.querySelector("svg[width='180']")).toBeNull();
      expect(screen.queryByText(receivingAddress)).not.toBeInTheDocument();
    },
  );

  it("separates degraded detection from real persisted credits and never simulates confirmation", async () => {
    const h = queryHarness("USER", (config) =>
      reply(
        config,
        config.url === "/deposits/me/history"
          ? {
              ...recordedDepositHistory,
              detection: { ...emptyDepositHistory.detection, status: "PAUSED" },
            }
          : readyAssignment,
      ),
    );
    render(<DepositCard />, { wrapper: h.wrapper });
    expect(await screen.findByText(/رصد التحويلات متوقف مؤقتًا/)).toBeVisible();
    expect(screen.getByText("+1.000001")).toBeVisible();
    expect(screen.queryByText("قيد التحقق")).not.toBeInTheDocument();
    expect(screen.queryByText("مرفوض")).not.toBeInTheDocument();
  });

  it("distinguishes unavailable history from a successful empty page and hides all data on retirement", async () => {
    const h = queryHarness("USER", (config) => {
      if (config.url === "/deposits/me/history")
        throw safeApiError("transient", "NETWORK_ERROR");
      return reply(config, readyAssignment);
    });
    render(<DepositCard />, { wrapper: h.wrapper });
    await screen.findByText(receivingAddress);
    await screen.findByRole("alert");
    expect(
      screen.queryByText("لا توجد إيداعات مسجلة."),
    ).not.toBeInTheDocument();
    act(() => {
      h.runtime.retire();
    });
    expect(screen.queryByText(receivingAddress)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "نسخ العنوان" }),
    ).not.toBeInTheDocument();
  });
});
