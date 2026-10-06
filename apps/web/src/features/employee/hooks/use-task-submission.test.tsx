import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { actorId, now, reply } from "@/test/p04-network";
import { day, proof, submission } from "@/test/p05-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { useTaskSubmission } from "./use-task-submission";

cleanupQueries();
describe("upload then declared task work", () => {
  it("uploads actual File before submitting its ready identity without wallet effects", async () => {
    const requests: string[] = [];
    let submittedCommandId = "";
    const open = {
      ...day,
      task: day.task ? { ...day.task, isCodeRequired: false } : null,
      canUnlock: false,
      canSubmit: true,
      unavailableReason: null,
    };
    const h = queryHarness("USER", (config) => {
      requests.push(config.url ?? "");
      if (config.url === "/proofs") {
        const response = reply(config, proof);
        response.status = 201;
        response.data.statusCode = 201;
        return response;
      }
      if (config.url?.startsWith("/proofs/uploads/"))
        return reply(config, {
          state: "READY",
          purpose: "PROOF",
          commandId: config.url.split("/").at(-1),
          asset: proof,
        });
      if (config.url === "/task-submissions") {
        const body: unknown = JSON.parse(String(config.data));
        expect(body).toMatchObject({
          proofAssetId: proof.id,
          declaredExecuted: true,
          taskId: actorId,
          expectedTaskRevision: 1,
        });
        if (
          body === null ||
          typeof body !== "object" ||
          !("commandId" in body) ||
          typeof body.commandId !== "string"
        )
          throw new Error("Missing identity");
        submittedCommandId = body.commandId;
        return reply(config, submission);
      }
      return reply(config, {
        state: "OBSERVED",
        command: {
          kind: "SUBMISSION_CREATE",
          commandId: submittedCommandId,
          targetId: submission.id,
          committedAt: now,
          outcome: submission,
        },
      });
    });
    const hook = renderHook(() => useTaskSubmission(open, null), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    act(() => {
      hook.result.current.setScreenshotFile(
        new File(["synthetic"], "proof.png", { type: "image/png" }),
      );
      hook.result.current.setAcknowledged(true);
    });
    await act(async () => {
      await hook.result.current.handleSubmit({ preventDefault: () => {} });
    });
    expect(hook.result.current.feedback?.success).toBe(true);
    expect(requests[0]).toBe("/proofs");
    expect(requests).toContain("/task-submissions");
    expect(requests.some((path) => /wallet|finance|admin/u.test(path))).toBe(
      false,
    );
  });
  it("guards final or late evidence at the handler without an upload", async () => {
    let sends = 0;
    const h = queryHarness("USER", () => {
      sends++;
      throw new Error("Unexpected upload");
    });
    const hook = renderHook(
      () => useTaskSubmission(day, { ...submission, canReplace: false }),
      { wrapper: h.wrapper },
    );
    await waitFor(() => {
      expect(hook.result.current.allowed).toBe(true);
    });
    act(() => {
      hook.result.current.setScreenshotFile(
        new File(["synthetic"], "proof.png", { type: "image/png" }),
      );
    });
    await act(async () => {
      await hook.result.current.handleReplaceScreenshot();
    });
    expect(hook.result.current.feedback?.success).toBe(false);
    expect(sends).toBe(0);
  });
});
