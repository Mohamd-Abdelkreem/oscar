import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { summary, reply } from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { useTeamSummary } from "./referrals.hooks";

cleanupQueries();
it("current-check retirement hides prior private team earnings", async () => {
  const h = queryHarness("USER", (config) => reply(config, summary));
  const hook = renderHook(useTeamSummary, { wrapper: h.wrapper });
  await waitFor(() => {
    expect(hook.result.current.data).toEqual(summary);
  });
  act(() => {
    h.runtime.beginCheck();
  });
  expect(hook.result.current.data).toBeUndefined();
  await waitFor(() => {
    expect(hook.result.current.data).toEqual(summary);
  });
});
