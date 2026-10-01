import { act, cleanup, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AdminStateProvider, useAdminState } from "./admin-state.context";
import type { UnlockCodeResult } from "../types/admin.types";

function wrapper({ children }: { readonly children: ReactNode }) {
  return <AdminStateProvider>{children}</AdminStateProvider>;
}

const defaultUnlockResult: UnlockCodeResult = {
  success: false,
  reason: "invalid_code",
  message: "الرمز غير صحيح",
};

describe("Admin State and Task Unlock Code Domain Actions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 1, 14, 0, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("unlocks a task when a valid, active, matching code is provided", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    // Seeded code: OSCAR-TASK-2026 linked to tsk_today_1001
    // usr_9981 (Ahmed Marwan) hasn't unlocked tsk_today_1001 yet
    expect(
      result.current.isTaskUnlockedForEmployee("tsk_today_1001", "usr_9981"),
    ).toBe(false);

    let unlockResult: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      unlockResult = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "oscar-task-2026", // tests case normalization (lowercase should be normalized)
      );
    });

    expect(unlockResult).toEqual({
      success: true,
      message: "تم فتح المهمة بنجاح",
    });

    expect(
      result.current.isTaskUnlockedForEmployee("tsk_today_1001", "usr_9981"),
    ).toBe(true);

    // Verify usage record was created
    const usage = result.current.codeUsages.find(
      (u) => u.taskId === "tsk_today_1001" && u.employeeId === "usr_9981",
    );
    expect(usage).toBeDefined();
    expect(usage?.code).toBe("OSCAR-TASK-2026");
    expect(usage?.submissionState).toBe("not_submitted");

    // Verify audit log entry
    const auditEntry = result.current.auditLogs.find(
      (a) => a.action === "فتح مهمة بواسطة رمز" && a.targetId === "cod_2026_01",
    );
    expect(auditEntry).toBeDefined();
  });

  it("fails without recording successful usage when code is invalid, paused, or for wrong task", () => {
    const { result } = renderHook(useAdminState, { wrapper });
    const initialUsagesCount = result.current.codeUsages.length;

    // 1. Invalid code
    let res1: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      res1 = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "INVALID-CODE-XYZ",
      );
    });
    expect(res1).toEqual({
      success: false,
      reason: "invalid_code",
      message: "الرمز غير صحيح",
    });
    expect(result.current.codeUsages.length).toBe(initialUsagesCount);

    // 2. Code for another task
    // Create a new code for tsk_past_1000
    act(() => {
      const res = result.current.createCode({
        code: "PAST-TASK-CODE",
        taskId: "tsk_past_1000",
        status: "active",
      });
      expect(res.success).toBe(true);
    });

    let res2: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      res2 = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "PAST-TASK-CODE",
      );
    });
    expect(res2).toEqual({
      success: false,
      reason: "wrong_task",
      message: "هذا الرمز مخصص لمهمة أخرى",
    });
    expect(result.current.codeUsages.length).toBe(initialUsagesCount);

    // 3. Paused code
    // Create and pause a code
    act(() => {
      const created = result.current.createCode({
        code: "PAUSED-CODE-123",
        taskId: "tsk_today_1001",
        status: "paused",
      });
      expect(created.success).toBe(true);
    });

    let res3: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      res3 = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "PAUSED-CODE-123",
      );
    });
    expect(res3).toEqual({
      success: false,
      reason: "code_paused",
      message: "هذا الرمز متوقف حالياً",
    });
    expect(result.current.codeUsages.length).toBe(initialUsagesCount);
  });

  it("does not create duplicate usage records on repeated attempts by the same employee", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    // usr_9981 unlocks for the first time
    act(() => {
      result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "OSCAR-TASK-2026",
      );
    });

    const usagesAfterFirst = result.current.codeUsages.filter(
      (u) => u.taskId === "tsk_today_1001" && u.employeeId === "usr_9981",
    );
    expect(usagesAfterFirst).toHaveLength(1);

    // Attempt second unlock with the same code
    let secondRes: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      secondRes = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "OSCAR-TASK-2026",
      );
    });

    expect(secondRes.success).toBe(true);
    const usagesAfterSecond = result.current.codeUsages.filter(
      (u) => u.taskId === "tsk_today_1001" && u.employeeId === "usr_9981",
    );
    expect(usagesAfterSecond).toHaveLength(1);
  });

  it("allows multiple employees to use the same code and correctly tracks distinct user counts", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    // Create a brand new task and code
    let newCodeId = "";
    act(() => {
      result.current.createTask({
        title: "مهمة اختبار جديدة",
        description: "وصف المهمة التجريبية",
        targetUrl: "https://example.com/test",
        platform: "TikTok",
        previewImageUrl: "/employee/task-preview.svg",
        windowStart: "12:00",
        windowEnd: "18:00",
        timezone: "Asia/Baghdad",
        rewardAmount: 5,
        status: "active",
        isCodeRequired: true,
        startDate: "2026-10-01",
        endDate: "2026-10-01",
      });
    });

    const newTask = result.current.tasks[0];
    if (!newTask) throw new Error("newTask was not created");

    act(() => {
      const res = result.current.createCode({
        code: "MULTI-USER-CODE",
        taskId: newTask.id,
        status: "active",
      });
      newCodeId = res.code?.id ?? "";
    });

    expect(result.current.getDistinctCodeUsersCount(newCodeId)).toBe(0);

    // Employee 1 (usr_9981) unlocks
    act(() => {
      result.current.unlockTaskWithCode(
        newTask.id,
        "usr_9981",
        "MULTI-USER-CODE",
      );
    });
    expect(result.current.getDistinctCodeUsersCount(newCodeId)).toBe(1);

    // Employee 2 (usr_1006) unlocks
    act(() => {
      result.current.unlockTaskWithCode(
        newTask.id,
        "usr_1006",
        "MULTI-USER-CODE",
      );
    });
    expect(result.current.getDistinctCodeUsersCount(newCodeId)).toBe(2);

    // Employee 1 enters it again -> distinct count remains 2
    act(() => {
      result.current.unlockTaskWithCode(
        newTask.id,
        "usr_9981",
        "MULTI-USER-CODE",
      );
    });
    expect(result.current.getDistinctCodeUsersCount(newCodeId)).toBe(2);
  });

  it("pausing a code preserves past usage records and blocks new unlocks", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    // usr_1002 already has an existing seeded unlock with OSCAR-TASK-2026
    const priorUsageCount = result.current.codeUsages.filter(
      (u) => u.codeId === "cod_2026_01",
    ).length;
    expect(priorUsageCount).toBeGreaterThanOrEqual(3);

    // Admin pauses the code
    act(() => {
      result.current.toggleCodeStatus("cod_2026_01");
    });

    const code = result.current.codes.find((c) => c.id === "cod_2026_01");
    expect(code?.status).toBe("paused");

    // All previous usage records are preserved
    const usageCountAfterPause = result.current.codeUsages.filter(
      (u) => u.codeId === "cod_2026_01",
    ).length;
    expect(usageCountAfterPause).toBe(priorUsageCount);

    // Previously unlocked employee remains unlocked
    expect(
      result.current.isTaskUnlockedForEmployee("tsk_today_1001", "usr_1002"),
    ).toBe(true);

    // New employee attempt to use the paused code is blocked
    let newAttempt: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      newAttempt = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "OSCAR-TASK-2026",
      );
    });
    expect(newAttempt).toEqual({
      success: false,
      reason: "code_paused",
      message: "هذا الرمز متوقف حالياً",
    });
  });

  it("does not allow code unlock to bypass account or task restrictions", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    // Block task execution for active employee usr_9981
    act(() => {
      result.current.toggleEmployeeTaskRestriction("usr_9981");
    });

    let restrictedAttempt: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      restrictedAttempt = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "OSCAR-TASK-2026",
      );
    });

    expect(restrictedAttempt).toEqual({
      success: false,
      reason: "task_restricted",
      message: "تم إيقاف صلاحية تنفيذ المهام لحسابك من قبل الإدارة",
    });

    // Suspend account for active employee usr_1006
    act(() => {
      result.current.toggleEmployeeAccountStatus("usr_1006");
    });

    let suspendedAttempt: UnlockCodeResult = defaultUnlockResult;
    act(() => {
      suspendedAttempt = result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_1006",
        "OSCAR-TASK-2026",
      );
    });

    expect(suspendedAttempt).toEqual({
      success: false,
      reason: "account_suspended",
      message: "حسابك معلق حالياً من قبل الإدارة",
    });
  });

  it("unlocking only opens access and does NOT submit task or credit reward", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    const emp = result.current.employees.find((e) => e.id === "usr_9981");
    const initialBalance = emp?.balance.available ?? 0;
    const initialSubmissionsCount = result.current.submissions.length;

    act(() => {
      result.current.unlockTaskWithCode(
        "tsk_today_1001",
        "usr_9981",
        "OSCAR-TASK-2026",
      );
    });

    const empAfterUnlock = result.current.employees.find(
      (e) => e.id === "usr_9981",
    );
    expect(empAfterUnlock?.balance.available).toBe(initialBalance);
    expect(result.current.submissions.length).toBe(initialSubmissionsCount);
  });

  it("rejecting a submission reverses credited reward ONCE and creates financial & audit records", () => {
    const { result } = renderHook(useAdminState, { wrapper });

    // sub_01 is for usr_1003 (reward 38 USDT, currently pending review)
    const empBefore = result.current.employees.find((e) => e.id === "usr_1003");
    if (!empBefore) throw new Error("empBefore not found");
    const availableBefore = empBefore.balance.available;
    const initialTxsCount = result.current.financeTransactions.length;

    let res: { success: boolean; message: string } = {
      success: false,
      message: "",
    };
    act(() => {
      res = result.current.rejectSubmission(
        "sub_01",
        "لقطة شاشة غير مطابقة للشروط",
      );
    });

    expect(res.success).toBe(true);

    // Verify employee balance was debited by the 38 USDT reward
    const empAfter = result.current.employees.find((e) => e.id === "usr_1003");
    if (!empAfter) throw new Error("empAfter not found");
    expect(empAfter.balance.available).toBe(availableBefore - 38);

    // Verify submission status updated to rejected
    const sub = result.current.submissions.find((s) => s.id === "sub_01");
    if (!sub) throw new Error("sub not found");
    expect(sub.status).toBe("rejected");
    expect(sub.isReversed).toBe(true);
    expect(sub.rejectionReason).toBe("لقطة شاشة غير مطابقة للشروط");

    // Verify reversal transaction in financial ledger
    expect(result.current.financeTransactions.length).toBe(initialTxsCount + 1);
    const revTx = result.current.financeTransactions[0];
    expect(revTx?.type).toBe("task_reward_reversal");
    expect(revTx?.amount).toBe(-38);
    expect(revTx?.direction).toBe("debit");

    // Second rejection attempt is rejected to prevent duplicate deduction
    let duplicateRes: { success: boolean; message: string } = {
      success: false,
      message: "",
    };
    act(() => {
      duplicateRes = result.current.rejectSubmission(
        "sub_01",
        "محاولة رفض مكررة",
      );
    });
    expect(duplicateRes.success).toBe(false);
    expect(duplicateRes.message).toBe("تم رفض هذا التسليم مسبقاً");
    expect(
      result.current.employees.find((e) => e.id === "usr_1003")?.balance
        .available,
    ).toBe(availableBefore - 38);
    expect(result.current.financeTransactions).toHaveLength(
      initialTxsCount + 1,
    );
  });

  it("maintains independent controls for account status, task restriction, and withdrawal restriction", () => {
    const { result } = renderHook(useAdminState, { wrapper });
    const empId = "usr_1002";

    // Initial state: active, tasks allowed, withdrawals allowed
    let emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.accountStatus).toBe("active");
    expect(emp.restrictions.tasksBlocked).toBe(false);
    expect(emp.restrictions.withdrawalsBlocked).toBe(false);

    // Block only withdrawals
    act(() => {
      result.current.toggleEmployeeWithdrawalRestriction(empId);
    });
    emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.restrictions.withdrawalsBlocked).toBe(true);
    expect(emp.restrictions.tasksBlocked).toBe(false);
    expect(emp.accountStatus).toBe("active");

    // Block tasks independently
    act(() => {
      result.current.toggleEmployeeTaskRestriction(empId);
    });
    emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.restrictions.withdrawalsBlocked).toBe(true);
    expect(emp.restrictions.tasksBlocked).toBe(true);
    expect(emp.accountStatus).toBe("active");

    // Unblock withdrawals independently
    act(() => {
      result.current.toggleEmployeeWithdrawalRestriction(empId);
    });
    emp = result.current.employees.find((e) => e.id === empId);
    if (!emp) throw new Error("emp not found");
    expect(emp.restrictions.withdrawalsBlocked).toBe(false);
    expect(emp.restrictions.tasksBlocked).toBe(true);
    expect(emp.accountStatus).toBe("active");
  });

  it("records audit log entries on code creation and status changes", () => {
    const { result } = renderHook(useAdminState, { wrapper });
    const initialLogCount = result.current.auditLogs.length;

    // Create code
    let codeId = "";
    act(() => {
      const res = result.current.createCode({
        code: "AUDIT-TEST-CODE",
        taskId: "tsk_today_1001",
        status: "active",
        description: "رمز لاختبار سجل التدقيق",
      });
      codeId = res.code?.id ?? "";
    });

    expect(result.current.auditLogs.length).toBe(initialLogCount + 1);
    const createLog = result.current.auditLogs[0];
    expect(createLog?.action).toBe("إنشاء رمز فتح مهمة");
    expect(createLog?.targetTitle).toBe("AUDIT-TEST-CODE");

    // Toggle status
    act(() => {
      result.current.toggleCodeStatus(codeId);
    });

    expect(result.current.auditLogs.length).toBe(initialLogCount + 2);
    const toggleLog = result.current.auditLogs[0];
    expect(toggleLog?.action).toBe("تعديل حالة رمز المهمة");
    expect(toggleLog?.newState).toBe("متوقف");
  });

  describe("extendWithdrawalSchedule action", () => {
    it("extends a scheduled withdrawal's dueAt and tracks cumulative added hours", () => {
      const { result } = renderHook(useAdminState, { wrapper });
      const wthId = "wth_8092";

      const initialWth = result.current.withdrawals.find((w) => w.id === wthId);
      if (!initialWth) throw new Error("initialWth not found");
      expect(initialWth.status).toBe("scheduled");
      const initialDueAtMs = new Date(initialWth.dueAt).getTime();
      const initialAmount = initialWth.amount;
      const initialFee = initialWth.fee;
      const initialNet = initialWth.netAmount;
      const initialLogsCount = result.current.auditLogs.length;

      // 1. First extension: +12 hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          12,
          "تمديد أول للتحقق الأمني",
        );
        expect(res.success).toBe(true);
      });

      let updatedWth = result.current.withdrawals.find((w) => w.id === wthId);
      if (!updatedWth) throw new Error("updatedWth not found");
      expect(new Date(updatedWth.dueAt).getTime()).toBe(
        initialDueAtMs + 12 * 3600 * 1000,
      );
      expect(updatedWth.originalDurationHours).toBe(72);
      expect(updatedWth.addedHours).toBe(12);

      // Financial values remain untouched
      expect(updatedWth.amount).toBe(initialAmount);
      expect(updatedWth.fee).toBe(initialFee);
      expect(updatedWth.netAmount).toBe(initialNet);

      // 2. Second extension: +6 hours -> cumulative +18 hours
      act(() => {
        const res2 = result.current.extendWithdrawalSchedule(
          wthId,
          6,
          "تمديد إضافي لطلب مستندات",
        );
        expect(res2.success).toBe(true);
      });

      updatedWth = result.current.withdrawals.find((w) => w.id === wthId);
      if (!updatedWth) throw new Error("updatedWth not found");
      expect(new Date(updatedWth.dueAt).getTime()).toBe(
        initialDueAtMs + (12 + 6) * 3600 * 1000,
      );
      expect(updatedWth.addedHours).toBe(18);

      // Audit logs were written
      expect(result.current.auditLogs.length).toBe(initialLogsCount + 2);
      const latestAudit = result.current.auditLogs[0];
      expect(latestAudit?.action).toBe("زيادة جدولة السحب");
      expect(latestAudit?.reason).toBe("تمديد إضافي لطلب مستندات");
      expect(latestAudit?.newState).toContain("+6 ساعة");
      expect(latestAudit?.newState).toContain("+18 ساعة");
    });

    it("rejects extending non-scheduled withdrawals", () => {
      const { result } = renderHook(useAdminState, { wrapper });

      // wth_8091 is completed
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          "wth_8091",
          10,
          "محاولة تمديد طلب مكتمل",
        );
        expect(res.success).toBe(false);
        expect(res.message).toBe("لا يمكن تمديد جدولة طلب غير مجدول.");
      });
    });

    it("validates positive safe-integer hours and non-empty reason", () => {
      const { result } = renderHook(useAdminState, { wrapper });
      const wthId = "wth_8092";

      // Zero hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          0,
          "سبب تجريبي",
        );
        expect(res.success).toBe(false);
      });

      // Negative hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          -5,
          "سبب تجريبي",
        );
        expect(res.success).toBe(false);
      });

      // Fractional hours
      act(() => {
        const res = result.current.extendWithdrawalSchedule(
          wthId,
          3.5,
          "سبب تجريبي",
        );
        expect(res.success).toBe(false);
      });

      // Empty reason
      act(() => {
        const res = result.current.extendWithdrawalSchedule(wthId, 10, "   ");
        expect(res.success).toBe(false);
        expect(res.message).toBe("يرجى إدخال سبب زيادة الجدولة الإلزامي.");
      });
    });
  });
});
