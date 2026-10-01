import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useManagedTimeout } from "./use-managed-timeout";

afterEach(() => {
  vi.useRealTimers();
});

it("runs scheduled feedback at its delay and cancels pending work when the owner unmounts", () => {
  vi.useFakeTimers();
  const completed = vi.fn();
  const pending = vi.fn();
  const { result, unmount } = renderHook(useManagedTimeout);

  act(() => {
    result.current(completed, 400);
    result.current(pending, 1200);
    vi.advanceTimersByTime(399);
  });
  expect(completed).not.toHaveBeenCalled();
  act(() => {
    vi.advanceTimersByTime(1);
  });
  expect(completed).toHaveBeenCalledOnce();

  unmount();
  act(() => {
    vi.runAllTimers();
  });
  expect(pending).not.toHaveBeenCalled();
});
