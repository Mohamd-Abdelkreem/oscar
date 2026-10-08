import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { deferred } from "@/test/p04-query";
import { CopyAction } from "./copy-action";

afterEach(() => vi.unstubAllGlobals());
function clipboard(writeText: (value: string) => Promise<void>) {
  vi.stubGlobal("navigator", { clipboard: { writeText } });
}
it("announces copy only after the clipboard accepts the current value", async () => {
  const pending = deferred<undefined>();
  clipboard((value) => {
    expect(value).toBe("current-address");
    return pending.promise;
  });
  render(
    <CopyAction value="current-address" label="Copy" copiedLabel="Copied" />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Copy" }));
  expect(screen.queryByText("Copied")).toBeNull();
  await act(async () => {
    pending.resolve(undefined);
    await pending.promise;
  });
  expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
});
it("reports clipboard refusal without announcing success or passing diagnostics", async () => {
  clipboard(() => Promise.reject(new Error("PRIVATE_SENTINEL")));
  const rejected = vi.fn();
  render(
    <CopyAction
      value="address"
      label="Copy"
      copiedLabel="Copied"
      onCopyError={rejected}
    />,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
  });
  expect(rejected).toHaveBeenCalledExactlyOnceWith();
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  expect(screen.queryByText("Copied")).toBeNull();
});
it("does not restore an earlier copy announcement when the displayed address returns", async () => {
  clipboard(() => Promise.resolve());
  const view = render(
    <CopyAction value="first" label="Copy" copiedLabel="Copied" />,
  );
  await act(async () => {
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
  });
  expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  view.rerender(
    <CopyAction value="second" label="Copy" copiedLabel="Copied" />,
  );
  view.rerender(<CopyAction value="first" label="Copy" copiedLabel="Copied" />);
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
});
it.each(["success", "failure"])(
  "ignores obsolete pending clipboard %s after value change or unmount",
  async (outcome) => {
    let resolve!: () => void;
    let reject!: (error: Error) => void;
    clipboard(
      () =>
        new Promise<void>((accept, deny) => {
          resolve = accept;
          reject = deny;
        }),
    );
    const rejected = vi.fn();
    const view = render(
      <CopyAction
        value="old"
        label="Copy"
        copiedLabel="Copied"
        onCopyError={rejected}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    view.rerender(
      <CopyAction
        value="new"
        label="Copy"
        copiedLabel="Copied"
        onCopyError={rejected}
      />,
    );
    await act(async () => {
      if (outcome === "success") resolve();
      else reject(new Error("private"));
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(rejected).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button"));
    view.unmount();
    await act(async () => {
      if (outcome === "success") resolve();
      else reject(new Error("private"));
      await Promise.resolve();
    });
    expect(rejected).not.toHaveBeenCalled();
  },
);
