import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import { finance, reply, reject } from "@/test/p04-network";
import { queryHarness, cleanupQueries } from "@/test/p04-query";
import { useFinanceLedger } from "./finance.hooks";

cleanupQueries();
it("current denial hides cached finance rather than restoring former authority", async () => {
  let denied = false;
  const h = queryHarness("ADMIN", (config) =>
    denied
      ? Promise.resolve().then(() => reject(config, "FORBIDDEN", 403))
      : reply(config, finance),
  );
  const hook = renderHook(() => useFinanceLedger({ q: "source" }), {
    wrapper: h.wrapper,
  });
  await waitFor(() => {
    expect(hook.result.current.data).toEqual(finance);
  });
  denied = true;
  await act(async () => {
    await hook.result.current.refetch();
  });
  expect(hook.result.current.data).toBeUndefined();
  await waitFor(() => {
    expect(hook.result.current.isError).toBe(true);
  });
  expect(hook.result.current.error).toMatchObject({ category: "denied" });
  denied = false;
  await waitFor(() => {
    expect(
      h.client
        .getQueryCache()
        .getAll()
        .find((query) => query.queryKey[0] === "auth")?.state.status,
    ).toBe("success");
  });
  await act(async () => {
    await hook.result.current.refetch();
  });
  await waitFor(() => {
    expect(hook.result.current.data).toEqual(finance);
  });
});
