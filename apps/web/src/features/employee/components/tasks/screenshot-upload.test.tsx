import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ScreenshotUpload } from "./screenshot-upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("replaces image previews, releases replaced URLs, and cleans up the final preview on unmount", () => {
  const createObjectURL = vi
    .fn()
    .mockReturnValueOnce("blob:first")
    .mockReturnValueOnce("blob:second");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }),
  );
  const selected = vi.fn();
  const { container, unmount } = render(
    <ScreenshotUpload onFileSelected={selected} />,
  );
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement))
    throw new Error("Screenshot file input is missing");

  fireEvent.change(input, {
    target: {
      files: [new File(["first"], "first.png", { type: "image/png" })],
    },
  });
  expect(
    screen.getByRole("img", { name: "معاينة لقطة الشاشة المرفوعة" }),
  ).toHaveAttribute("src", "blob:first");
  const secondFile = new File(["second"], "second.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [secondFile] } });
  expect(
    screen.getByRole("img", { name: "معاينة لقطة الشاشة المرفوعة" }),
  ).toHaveAttribute("src", "blob:second");
  expect(selected).toHaveBeenLastCalledWith(secondFile);
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:first");
  unmount();
  expect(revokeObjectURL).toHaveBeenCalledWith("blob:second");
});

it("rejects SVG and ignores disabled file events without allocating private previews", () => {
  const createObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL,
      revokeObjectURL: vi.fn(),
    }),
  );
  const selected = vi.fn();
  const { container, rerender } = render(
    <ScreenshotUpload onFileSelected={selected} />,
  );
  const input = container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement))
    throw new Error("Screenshot input missing");
  fireEvent.change(input, {
    target: {
      files: [new File(["<svg/>"], "proof.svg", { type: "image/svg+xml" })],
    },
  });
  expect(selected).not.toHaveBeenCalled();
  expect(createObjectURL).not.toHaveBeenCalled();
  rerender(<ScreenshotUpload onFileSelected={selected} disabled />);
  fireEvent.change(input, {
    target: {
      files: [new File(["image"], "proof.png", { type: "image/png" })],
    },
  });
  expect(selected).not.toHaveBeenCalled();
  expect(createObjectURL).not.toHaveBeenCalled();
});

it("follows a retained server preview without taking ownership of its URL", () => {
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: vi.fn(),
      revokeObjectURL,
    }),
  );
  const { rerender, unmount } = render(
    <ScreenshotUpload
      onFileSelected={vi.fn()}
      initialPreview="blob:server-first"
      disabled
    />,
  );
  rerender(
    <ScreenshotUpload
      onFileSelected={vi.fn()}
      initialPreview="blob:server-current"
      disabled
    />,
  );
  expect(screen.getByRole("img")).toHaveAttribute("src", "blob:server-current");
  unmount();
  expect(revokeObjectURL).not.toHaveBeenCalled();
});
