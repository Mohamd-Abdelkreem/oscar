import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { now, actorId, reply } from "@/test/p04-network";
import { day } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { TaskCodeGate } from "./task-code-gate";

cleanupQueries();
describe("employee-only task code gate", () => {
  it("uses server unlock authority without demo disclosure or privileged requests", async () => {
    const requests: string[] = [];
    let commandId = "";
    const unlocked = {
      day: {
        ...day,
        canUnlock: false,
        canSubmit: true,
        unavailableReason: null,
        unlock: {
          id: actorId,
          taskId: actorId,
          businessDate: day.businessDate,
          unlockedAt: now,
        },
      },
    };
    const h = queryHarness("USER", (config) => {
      requests.push(config.url ?? "");
      if (config.method === "post") {
        const body: unknown = JSON.parse(String(config.data));
        if (
          body === null ||
          typeof body !== "object" ||
          !("commandId" in body) ||
          typeof body.commandId !== "string"
        )
          throw new Error("Missing identity");
        commandId = body.commandId;
        expect(body).toMatchObject({ code: "CODE", expectedTaskRevision: 1 });
        return reply(config, unlocked);
      }
      return reply(config, {
        state: "OBSERVED",
        command: {
          kind: "TASK_UNLOCK",
          commandId,
          targetId: actorId,
          committedAt: now,
          outcome: unlocked,
        },
      });
    });
    render(<TaskCodeGate day={day} />, { wrapper: h.wrapper });
    expect(
      screen.queryByText(/رمز المعاينة التجريبي/u),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " code " },
    });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "فتح المهمة" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "فتح المهمة" }));
    await screen.findByText("تم فتح المهمة.");
    expect(requests).toEqual([
      `/tasks/${actorId}/unlock`,
      `/task-commands/${commandId}`,
    ]);
  });
});
