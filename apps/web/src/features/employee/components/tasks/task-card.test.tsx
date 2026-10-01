import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";

import { EmployeeStateProvider } from "../../context/employee-state.context";
import { TaskCard } from "./task-card";

function TaskRouteExample() {
  const [visible, setVisible] = useState(true);
  return (
    <>
      <button
        onClick={() => {
          setVisible(!visible);
        }}
      >
        {visible ? "مغادرة المهام" : "عودة للمهام"}
      </button>
      {visible ? <TaskCard /> : null}
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("keeps committed screenshots alive across task-route changes and releases replaced screenshots", () => {
  vi.useFakeTimers();
  let urlCount = 0;
  const revokeObjectURL = vi.fn<(url: string) => void>();
  vi.stubGlobal(
    "URL",
    Object.assign(class extends URL {}, {
      createObjectURL: () => `blob:task-${(++urlCount).toString()}`,
      revokeObjectURL,
    }),
  );
  const { container, unmount } = render(
    <EmployeeStateProvider>
      <TaskRouteExample />
    </EmployeeStateProvider>,
  );
  const selectFile = (name: string) => {
    const input = container.querySelector('input[type="file"]');
    if (!(input instanceof HTMLInputElement))
      throw new Error("Screenshot input is missing");
    fireEvent.change(input, {
      target: { files: [new File([name], name, { type: "image/png" })] },
    });
  };

  selectFile("first.png");
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "تأكيد وإرسال المهمة للاعتماد" }),
  );
  act(() => {
    vi.advanceTimersByTime(400);
  });
  const committedSource = screen
    .getByRole("img", { name: "معاينة لقطة الشاشة المرفوعة" })
    .getAttribute("src");
  expect(committedSource).toMatch(/^blob:/);
  expect(revokeObjectURL).not.toHaveBeenCalledWith(committedSource);

  fireEvent.click(screen.getByRole("button", { name: "مغادرة المهام" }));
  expect(revokeObjectURL).not.toHaveBeenCalledWith(committedSource);
  fireEvent.click(screen.getByRole("button", { name: "عودة للمهام" }));
  expect(
    screen.getByRole("img", { name: "معاينة لقطة الشاشة المرفوعة" }),
  ).toHaveAttribute("src", committedSource);

  fireEvent.click(screen.getByRole("button", { name: "إلغاء الصورة" }));
  selectFile("replacement.png");
  fireEvent.click(
    screen.getByRole("button", { name: "تحديث لقطة الشاشة المرفقة" }),
  );
  expect(revokeObjectURL).toHaveBeenCalledWith(committedSource);
  unmount();
  expect(new Set(revokeObjectURL.mock.calls.map(([url]) => url)).size).toBe(
    urlCount,
  );
});
