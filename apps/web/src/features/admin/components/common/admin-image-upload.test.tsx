import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AdminImageUpload } from "./admin-image-upload";
import { Activity } from "react";

afterEach(() => vi.unstubAllGlobals());
it("emits actual raster Files and null removal and owns only its transient URL", async () => {
  const selected = vi.fn(),
    revoke = vi.fn();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:draft",
      revokeObjectURL: revoke,
    }),
  );
  const view = render(<AdminImageUpload onImageSelected={selected} />);
  const input = view.container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("missing input");
  fireEvent.change(input, {
    target: { files: [new File(["svg"], "x.svg", { type: "image/svg+xml" })] },
  });
  expect(selected).not.toHaveBeenCalled();
  expect(screen.getByText(/نوع الملف غير مدعوم/)).toBeInTheDocument();
  const file = new File(["synthetic"], "x.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  expect(selected).toHaveBeenLastCalledWith(file);
  fireEvent.click(await screen.findByRole("button", { name: "إزالة" }));
  expect(selected).toHaveBeenLastCalledWith(null);
  expect(revoke).toHaveBeenCalledWith("blob:draft");
});

it("recreates the selected-file preview after the editor is hidden for revalidation", async () => {
  const selected = vi.fn(),
    revoke = vi.fn();
  let count = 0;
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => "blob:draft-" + String(++count),
      revokeObjectURL: revoke,
    }),
  );
  const upload = <AdminImageUpload onImageSelected={selected} />;
  const view = render(<Activity mode="visible">{upload}</Activity>);
  const input = view.container.querySelector('input[type="file"]');
  if (!(input instanceof HTMLInputElement)) throw new Error("missing input");
  const file = new File(["synthetic"], "draft.png", { type: "image/png" });
  fireEvent.change(input, { target: { files: [file] } });
  expect(await screen.findByRole("img")).toHaveAttribute("src", "blob:draft-1");
  view.rerender(<Activity mode="hidden">{upload}</Activity>);
  expect(revoke).toHaveBeenCalledWith("blob:draft-1");
  view.rerender(<Activity mode="visible">{upload}</Activity>);
  await waitFor(() => {
    expect(screen.getByRole("img")).toHaveAttribute("src", "blob:draft-2");
  });
  expect(selected).toHaveBeenCalledTimes(1);
  expect(selected).toHaveBeenCalledWith(file);
  view.unmount();
  expect(revoke).toHaveBeenCalledWith("blob:draft-2");
});
