import {
  submissionReviewSchema,
  boundedPageQuerySchema,
} from "@template/contracts";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
  act,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { adminSubmission } from "@/test/p05-network";
import { reply } from "@/test/p04-network";
import { adminRead, observed, onePage } from "@/test/p05-admin-ui";
import { SubmissionsScreen } from "./submissions-screen";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));
cleanupQueries();
afterEach(() => vi.unstubAllGlobals());
it.each(["APPROVE", "REJECT"] as const)(
  "requires evidence then a reasoned versioned %s, with no direct list mutation",
  async (decision) => {
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: () => "blob:private",
        revokeObjectURL: vi.fn(),
      }),
    );
    let sent: Record<string, unknown> | null = null;
    let detail = adminSubmission;
    const h = queryHarness("ADMIN", (config) => {
      if (config.url?.endsWith("/review")) {
        sent = submissionReviewSchema.parse(JSON.parse(String(config.data)));
        detail = {
          ...adminSubmission,
          submission: {
            ...adminSubmission.submission,
            status: decision === "APPROVE" ? "APPROVED" : "REJECTED",
            version: 2,
            canReplace: false,
            finalDecision: {
              decision,
              reason: "سبب محفوظ",
              decidedAt: adminSubmission.submission.submittedAt,
              reviewedSubmissionVersion: 1,
              reviewedEvidenceVersion: 1,
            },
          },
          review: { reason: "سبب محفوظ", actor: adminSubmission.employee },
        };
        return reply(config, detail);
      }
      if (config.url?.startsWith("/task-commands/"))
        return reply(
          config,
          observed(
            String(sent?.["commandId"]),
            "FINAL_REVIEW",
            adminSubmission.submission.id,
            detail,
          ),
        );
      if (
        config.url ===
        "/admin/task-submissions/" + adminSubmission.submission.id
      )
        return reply(config, detail);
      return adminRead(config);
    });
    render(<SubmissionsScreen />, { wrapper: h.wrapper });
    fireEvent.click(await screen.findByRole("button", { name: "اعتماد" }));
    expect(sent).toBeNull();
    const preview = await screen.findByRole("dialog");
    await waitFor(() =>
      expect(within(preview).getByRole("img")).toHaveAttribute(
        "src",
        "blob:private",
      ),
    );
    expect(
      within(preview).getByText(/إقرار التنفيذ محفوظ/),
    ).toBeInTheDocument();
    fireEvent.click(
      within(preview).getByRole("button", {
        name: decision === "APPROVE" ? "اعتماد وصرف المكافأة" : "رفض نهائي",
      }),
    );
    const confirm = screen.getByRole("dialog");
    fireEvent.click(
      within(confirm).getByRole("button", {
        name:
          decision === "APPROVE"
            ? "تأكيد الاعتماد وصرف المكافأة"
            : "تأكيد الرفض النهائي",
      }),
    );
    expect(sent).toBeNull();
    fireEvent.change(within(confirm).getByRole("textbox"), {
      target: { value: "سبب محفوظ" },
    });
    fireEvent.click(
      within(confirm).getByRole("button", {
        name:
          decision === "APPROVE"
            ? "تأكيد الاعتماد وصرف المكافأة"
            : "تأكيد الرفض النهائي",
      }),
    );
    await waitFor(() => {
      expect(sent).toMatchObject({
        confirmed: true,
        decision,
        reason: "سبب محفوظ",
        expectedSubmissionVersion: 1,
        expectedEvidenceVersion: 1,
      });
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  },
);
it("restores focus and background when the existing review popup closes with Escape", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:private",
      revokeObjectURL: vi.fn(),
    }),
  );
  const h = queryHarness("ADMIN", adminRead);
  render(<SubmissionsScreen />, { wrapper: h.wrapper });
  const trigger = await screen.findByRole("button", { name: "معاينة" });
  trigger.focus();
  fireEvent.click(trigger);
  const dialog = await screen.findByRole("dialog");
  await waitFor(() =>
    expect(
      within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }),
    ).toBeEnabled(),
  );
  within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }).focus();
  fireEvent.keyDown(window, { key: "Tab" });
  expect(dialog.contains(document.activeElement)).toBe(true);
  fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(
    within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }),
  ).toHaveFocus();
  fireEvent.keyDown(window, { key: "Escape" });
  await waitFor(() =>
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
  );
  expect(trigger).toHaveFocus();
});

it("shows captured entitlement and bounded evidence pages without changing the current decision versions", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:current",
      revokeObjectURL: vi.fn(),
    }),
  );
  let sent: Record<string, unknown> | null = null;
  let detail = {
    ...adminSubmission,
    submission: {
      ...adminSubmission.submission,
      version: 26,
      currentEvidenceVersion: 26,
      evidence: { ...adminSubmission.submission.evidence, version: 26 },
    },
  };
  const pages: number[] = [];
  const h = queryHarness("ADMIN", (config) => {
    if (config.url?.endsWith("/evidence")) {
      const query = boundedPageQuerySchema.parse(config.params);
      pages.push(query.page);
      expect(query.limit).toBe(25);
      const versions =
        query.page === 1
          ? Array.from({ length: 25 }, (_, index) => 26 - index)
          : [1];
      return reply(config, {
        items: versions.map((version) => ({
          ...detail.submission.evidence,
          id: "10000000-0000-4000-8000-" + String(version).padStart(12, "0"),
          version,
          assetId:
            version === 26
              ? detail.submission.evidence.assetId
              : "20000000-0000-4000-8000-" + String(version).padStart(12, "0"),
          asset: {
            ...detail.submission.evidence.asset,
            id:
              version === 26
                ? detail.submission.evidence.assetId
                : "20000000-0000-4000-8000-" +
                  String(version).padStart(12, "0"),
          },
        })),
        pagination: {
          page: query.page,
          limit: 25,
          total: 26,
          totalPages: 2,
          hasNextPage: query.page === 1,
          hasPreviousPage: query.page === 2,
        },
      });
    }
    if (config.url?.endsWith("/review")) {
      sent = submissionReviewSchema.parse(JSON.parse(String(config.data)));
      detail = {
        ...detail,
        submission: {
          ...detail.submission,
          version: 27,
          status: "APPROVED",
          canReplace: false,
          finalDecision: {
            decision: "APPROVE",
            reason: "مراجعة الدليل الحالي",
            decidedAt: detail.submission.submittedAt,
            reviewedSubmissionVersion: 26,
            reviewedEvidenceVersion: 26,
          },
        },
        review: { reason: "مراجعة الدليل الحالي", actor: detail.employee },
      };
      return reply(config, detail);
    }
    if (config.url?.startsWith("/task-commands/"))
      return reply(
        config,
        observed(
          String(sent?.["commandId"]),
          "FINAL_REVIEW",
          detail.submission.id,
          detail,
        ),
      );
    if (config.url === "/admin/task-submissions/" + detail.submission.id)
      return reply(config, detail);
    return adminRead(config);
  });
  render(<SubmissionsScreen />, { wrapper: h.wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "معاينة" }));
  const dialog = await screen.findByRole("dialog");
  const entitlement = await within(dialog).findByRole("region", {
    name: "شروط الاستحقاق المسجلة",
  });
  expect(entitlement).toHaveTextContent("S1");
  expect(entitlement).toHaveTextContent("60 USDT");
  expect(entitlement).toHaveTextContent("365");
  expect(entitlement).toHaveTextContent("21%");
  const history = await within(dialog).findByRole("region", {
    name: "سجل تغييرات الدليل",
  });
  expect(
    await within(history).findByText("الدليل 26 — الحالي"),
  ).toBeInTheDocument();
  expect(within(history).getAllByRole("listitem")).toHaveLength(25);
  expect(within(history).queryByRole("img")).not.toBeInTheDocument();
  fireEvent.click(within(history).getByRole("button", { name: "التالي" }));
  expect(
    await within(history).findByText("الدليل 1 — سابق"),
  ).toBeInTheDocument();
  expect(within(history).getAllByRole("listitem")).toHaveLength(1);
  expect(pages).toEqual([1, 2]);
  await waitFor(() => {
    expect(
      within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }),
    ).toBeEnabled();
  });
  fireEvent.click(
    within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }),
  );
  const confirm = screen.getByRole("dialog");
  fireEvent.change(within(confirm).getByRole("textbox"), {
    target: { value: "مراجعة الدليل الحالي" },
  });
  fireEvent.click(
    within(confirm).getByRole("button", {
      name: "تأكيد الاعتماد وصرف المكافأة",
    }),
  );
  await waitFor(() => {
    expect(sent).toMatchObject({
      expectedSubmissionVersion: 26,
      expectedEvidenceVersion: 26,
      decision: "APPROVE",
    });
  });
  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

it("blocks review on a history error and retains removed evidence metadata after the final decision", async () => {
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:current",
      revokeObjectURL: vi.fn(),
    }),
  );
  let failedHistory = true;
  let detail = adminSubmission;
  const h = queryHarness("ADMIN", (config) => {
    if (config.url?.endsWith("/evidence")) {
      if (failedHistory) throw new Error("history unavailable");
      return reply(config, onePage([detail.submission.evidence]));
    }
    if (config.url === "/admin/task-submissions/" + detail.submission.id)
      return reply(config, detail);
    if (config.url === "/proofs/" + detail.submission.evidence.assetId)
      return reply(config, detail.submission.evidence.asset);
    return adminRead(config);
  });
  render(<SubmissionsScreen />, { wrapper: h.wrapper });
  fireEvent.click(await screen.findByRole("button", { name: "معاينة" }));
  const dialog = await screen.findByRole("dialog");
  const history = within(dialog).getByRole("region", {
    name: "سجل تغييرات الدليل",
  });
  const retry = await within(history).findByRole("button", {
    name: "إعادة المحاولة",
  });
  expect(
    within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }),
  ).toBeDisabled();
  failedHistory = false;
  fireEvent.click(retry);
  await within(history).findByText("الدليل 1 — الحالي");
  await waitFor(() => {
    expect(
      within(dialog).getByRole("button", { name: "اعتماد وصرف المكافأة" }),
    ).toBeEnabled();
  });
  detail = {
    ...adminSubmission,
    submission: {
      ...adminSubmission.submission,
      status: "APPROVED",
      version: 2,
      canReplace: false,
      evidence: {
        ...adminSubmission.submission.evidence,
        asset: {
          ...adminSubmission.submission.evidence.asset,
          availability: "REMOVED",
        },
      },
      finalDecision: {
        decision: "APPROVE",
        reason: "قرار مسجل",
        decidedAt: adminSubmission.submission.submittedAt,
        reviewedSubmissionVersion: 1,
        reviewedEvidenceVersion: 1,
      },
    },
    review: { reason: "قرار مسجل", actor: adminSubmission.employee },
  };
  await act(async () => {
    await h.client.invalidateQueries({ queryKey: ["p05"] });
  });
  await within(history).findByText(/حُذفت الصورة بعد مدة الاحتفاظ/);
  expect(within(history).getByText("الدليل 1 — الحالي")).toBeInTheDocument();
  expect(
    within(dialog).queryByRole("button", { name: "اعتماد وصرف المكافأة" }),
  ).not.toBeInTheDocument();
  expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
  expect(
    within(dialog).getByRole("region", { name: "شروط الاستحقاق المسجلة" }),
  ).toHaveTextContent("2 USDT");
});
