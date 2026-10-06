import { act, renderHook, waitFor } from "@testing-library/react";
import { AxiosHeaders } from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";
import { actorId, otherId, now, reply } from "@/test/p04-network";
import { queryHarness, cleanupQueries, deferred } from "@/test/p04-query";
import { usePrivateProof } from "./use-private-proof";
import { safeApiError } from "@/services/api/safe-error";

cleanupQueries();
afterEach(() => vi.unstubAllGlobals());
const options = {
  purpose: "PROOF",
  assetId: actorId,
  evidenceIdentity: "submission:1",
  role: "USER",
  open: true,
} as const;
const asset = {
  id: actorId,
  purpose: "PROOF",
  uploadedAt: now,
  width: 1,
  height: 1,
  contentType: "image/png",
  byteCount: 9,
  availability: "PRESENT",
};
function binary(config: Parameters<typeof reply>[0]) {
  return {
    config,
    status: 200,
    statusText: "OK",
    data: new Blob(["synthetic"], { type: "image/png" }),
    headers: new AxiosHeaders({
      "content-type": "image/png",
      "content-length": "9",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": 'inline; filename="image.png"',
    }),
  };
}
describe("private preview ownership", () => {
  it("retains binary denial across remount without a revalidation loop", async () => {
    let contentReads = 0;
    const h = queryHarness("USER", (config) => {
      if (config.url?.endsWith("/content")) {
        contentReads++;
        throw safeApiError("denied", "FORBIDDEN", 403);
      }
      return reply(config, asset);
    });
    const first = renderHook(() => usePrivateProof(options), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(first.result.current.error).toMatchObject({ statusCode: 403 });
    });
    first.unmount();
    const next = renderHook(() => usePrivateProof(options), {
      wrapper: h.wrapper,
    });
    await waitFor(() => {
      expect(next.result.current.error).toMatchObject({ statusCode: 403 });
    });
    expect(contentReads).toBe(1);
    expect(next.result.current.url).toBeNull();
  });
  it("revokes accepted URLs on close and excludes bytes from query data", async () => {
    const created: Blob[] = [];
    const revoked: string[] = [];
    vi.stubGlobal(
      "URL",
      Object.assign(class extends URL {}, {
        createObjectURL: (blob: Blob) => {
          created.push(blob);
          return "blob:owned";
        },
        revokeObjectURL: (url: string) => {
          revoked.push(url);
        },
      }),
    );
    const h = queryHarness("USER", (config) =>
      Promise.resolve(
        config.url?.endsWith("/content")
          ? binary(config)
          : reply(config, asset),
      ),
    );
    const hook = renderHook(
      ({ open }) => usePrivateProof({ ...options, open }),
      { wrapper: h.wrapper, initialProps: { open: true } },
    );
    await waitFor(() => {
      expect(hook.result.current.url).toBe("blob:owned");
    });
    expect(created).toHaveLength(1);
    expect(
      JSON.stringify(
        h.client
          .getQueryCache()
          .getAll()
          .map((query) => query.state.data),
      ),
    ).not.toContain("blob:owned");
    hook.rerender({ open: false });
    expect(hook.result.current.url).toBeNull();
    expect(revoked).toEqual(["blob:owned"]);
  });
  it.each(["resource", "retirement"])(
    "discards delayed bytes after %s",
    async (change) => {
      const gate = deferred<undefined>();
      let reading = false;
      const create = vi.fn(() => "blob:obsolete");
      vi.stubGlobal(
        "URL",
        Object.assign(class extends URL {}, {
          createObjectURL: create,
          revokeObjectURL: vi.fn(),
        }),
      );
      const h = queryHarness("USER", async (config) => {
        if (config.url?.endsWith("/content")) {
          reading = true;
          await gate.promise;
          return binary(config);
        }
        return reply(config, asset);
      });
      const hook = renderHook(
        ({ assetId }) => usePrivateProof({ ...options, assetId }),
        { wrapper: h.wrapper, initialProps: { assetId: actorId } },
      );
      await waitFor(() => {
        expect(reading).toBe(true);
      });
      act(() => {
        if (change === "retirement") h.runtime.retire();
        else hook.rerender({ assetId: otherId });
      });
      await act(async () => {
        gate.resolve(undefined);
        await gate.promise;
      });
      expect(hook.result.current.url).toBeNull();
      expect(create).not.toHaveBeenCalled();
    },
  );
  it.each(["REMOVED", "STORAGE_UNAVAILABLE"])(
    "preserves %s without fetching missing bytes",
    async (availability) => {
      let reads = 0;
      const h = queryHarness("USER", (config) => {
        reads++;
        return Promise.resolve(reply(config, { ...asset, availability }));
      });
      const hook = renderHook(() => usePrivateProof(options), {
        wrapper: h.wrapper,
      });
      await waitFor(() => {
        expect(hook.result.current.availability).toBe(availability);
      });
      expect(reads).toBe(1);
      expect(hook.result.current.url).toBeNull();
    },
  );
});
