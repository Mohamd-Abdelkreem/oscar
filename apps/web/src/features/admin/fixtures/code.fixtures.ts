import type { CodeUsageRecord, TaskUnlockCode } from "../types/admin.types";

export const SEED_CODES: readonly TaskUnlockCode[] = [
  {
    id: "cod_2026_01",
    code: "OSCAR-TASK-2026",
    taskId: "tsk_today_1001",
    status: "active",
    createdBy: "محمد عبد الكريم",
    createdAt: "2026-10-01 08:00",
    description: "رمز الفتح اليومي لمهمة التقييم والمراجعة",
  },
  {
    id: "cod_2026_02",
    code: "VIP-REWARD-77",
    taskId: "tsk_today_1001",
    status: "paused",
    createdBy: "محمد عبد الكريم",
    createdAt: "2026-10-01 08:30",
    description: "رمز تجريبي إضافي موقوف مؤقتاً للاختبار",
  },
];

export const SEED_CODE_USAGES: readonly CodeUsageRecord[] = [
  {
    id: "usg_01",
    codeId: "cod_2026_01",
    code: "OSCAR-TASK-2026",
    taskId: "tsk_today_1001",
    taskTitle: "مراجعة جودة محتوى وتقييم تطبيق الشريك",
    employeeId: "usr_1002",
    employeeName: "سارة كريم",
    employeeEmail: "sara.kareem@example.com",
    unlockedAt: "2026-10-01 12:15:30",
    submissionState: "approved",
  },
  {
    id: "usg_02",
    codeId: "cod_2026_01",
    code: "OSCAR-TASK-2026",
    taskId: "tsk_today_1001",
    taskTitle: "مراجعة جودة محتوى وتقييم تطبيق الشريك",
    employeeId: "usr_1003",
    employeeName: "محمود حسن",
    employeeEmail: "mahmoud.hassan@example.com",
    unlockedAt: "2026-10-01 12:30:10",
    submissionState: "submitted",
  },
  {
    id: "usg_03",
    codeId: "cod_2026_01",
    code: "OSCAR-TASK-2026",
    taskId: "tsk_today_1001",
    taskTitle: "مراجعة جودة محتوى وتقييم تطبيق الشريك",
    employeeId: "usr_1004",
    employeeName: "فاطمة علي",
    employeeEmail: "fatima.ali@example.com",
    unlockedAt: "2026-10-01 13:05:45",
    submissionState: "rejected",
  },
];
