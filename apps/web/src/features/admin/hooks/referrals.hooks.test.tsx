import { act, renderHook, waitFor } from "@testing-library/react";
import { expect, it } from "vitest";
import {
  actorId,
  otherId,
  now,
  pagination,
  adminSummary,
  reply,
} from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import {
  useReferralSummary,
  useReferralRoots,
  useReferralMembers,
} from "./referrals.hooks";
import {
  adminMemberFilterSchema,
  rootSearchFilterSchema,
} from "@template/contracts";

cleanupQueries();
it("a late previous-root response cannot populate a newly selected root", async () => {
  const pending = deferred<undefined>();
  let originalStarted = false;
  const h = queryHarness("ADMIN", (config) => {
    if (config.url?.endsWith(actorId)) {
      originalStarted = true;
      return pending.promise.then(() => reply(config, adminSummary));
    }
    return reply(config, {
      ...adminSummary,
      root: { ...adminSummary.root, id: otherId },
    });
  });
  const hook = renderHook(({ rootId }) => useReferralSummary(rootId), {
    wrapper: h.wrapper,
    initialProps: { rootId: actorId },
  });
  await waitFor(() => {
    expect(originalStarted).toBe(true);
  });
  hook.rerender({ rootId: otherId });
  await waitFor(() => {
    expect(hook.result.current.data?.root.id).toBe(otherId);
  });
  act(() => {
    pending.resolve(undefined);
  });
  expect(hook.result.current.data?.root.id).toBe(otherId);
});
it("root and member search stay independently bounded and changing a root resets paging", async () => {
  const requests: { path: string | undefined; query: unknown }[] = [];
  const h = queryHarness("ADMIN", (config) => {
    requests.push({ path: config.url, query: config.params });
    if (config.url === "/admin/referrals/roots") {
      const filter = rootSearchFilterSchema.parse(config.params);
      return reply(config, {
        items: [],
        pagination: {
          ...pagination,
          page: filter.page,
          hasPreviousPage: filter.page > 1,
        },
      });
    }
    const filter = adminMemberFilterSchema.parse(config.params);
    return reply(config, {
      items: [],
      pagination: {
        ...pagination,
        page: filter.page,
        hasPreviousPage: filter.page > 1,
      },
      rootId: config.url?.includes(otherId) ? otherId : actorId,
      memberCountScope: "FILTERED_MEMBERS",
      serverNow: now,
    });
  });
  const roots = renderHook(() => useReferralRoots("root"), {
    wrapper: h.wrapper,
  });
  const team = renderHook(
    ({ rootId, q }) => useReferralMembers(rootId, { q }),
    { wrapper: h.wrapper, initialProps: { rootId: actorId, q: "member" } },
  );
  await waitFor(() => {
    expect(team.result.current.isSuccess).toBe(true);
    expect(roots.result.current.isSuccess).toBe(true);
  });
  expect(requests).toContainEqual({
    path: "/admin/referrals/roots",
    query: { q: "root", page: 1, limit: 25 },
  });
  expect(requests).toContainEqual({
    path: `/admin/referrals/${actorId}/members`,
    query: { q: "member", page: 1, limit: 25 },
  });
  team.rerender({ rootId: otherId, q: "second" });
  expect(team.result.current.data).toBeUndefined();
  await waitFor(() => {
    expect(team.result.current.data?.rootId).toBe(otherId);
  });
  expect(requests).toContainEqual({
    path: `/admin/referrals/${otherId}/members`,
    query: { q: "second", page: 1, limit: 25 },
  });
});
