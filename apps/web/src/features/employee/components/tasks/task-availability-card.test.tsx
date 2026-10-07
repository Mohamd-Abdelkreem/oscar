import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { day } from "@/test/p05-network";
import { TaskAvailabilityCard } from "./task-availability-card";
import type { EmployeeTaskDay } from "@template/contracts";

describe("server task availability", () => {
  it.each<[Partial<EmployeeTaskDay>, string]>([
    [
      { workEligibility: "FREE", unavailableReason: "FREE" },
      "لا يوجد منصب نشط للمهام",
    ],
    [
      { workEligibility: "EXPIRED", unavailableReason: "EXPIRED" },
      "انتهت مدة المنصب",
    ],
    [
      {
        workEligibility: "TASK_RESTRICTED",
        unavailableReason: "TASK_RESTRICTED",
      },
      "المهام مقيدة لحسابك",
    ],
    [
      { calendarState: "HOLIDAY", unavailableReason: "HOLIDAY" },
      "اليوم عطلة للمهام",
    ],
    [
      { opportunityState: "NO_TASK", unavailableReason: "NO_TASK" },
      "لا توجد مهمة منشورة اليوم",
    ],
    [
      { opportunityState: "PAUSED", unavailableReason: "PAUSED" },
      "المهمة متوقفة مؤقتاً",
    ],
  ])(
    "keeps unavailable work read-only with its returned reason %s",
    (state, label) => {
      render(
        <TaskAvailabilityCard
          day={{
            ...day,
            ...state,
            canSubmit: false,
            canUnlock: false,
            canReplace: false,
          }}
        />,
      );
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    },
  );
  it("shows the returned next Baghdad opening instead of promising tomorrow", () => {
    render(
      <TaskAvailabilityCard
        day={{ ...day, calendarState: "CLOSED", unavailableReason: "CLOSED" }}
      />,
    );
    expect(screen.queryByText(/غداً/u)).not.toBeInTheDocument();
    expect(screen.getByText(/النافذة القادمة/u)).toHaveTextContent(/٢٠٢٦/u);
    expect(
      screen.queryByRole("button", { name: /إرسال/u }),
    ).not.toBeInTheDocument();
  });
});
