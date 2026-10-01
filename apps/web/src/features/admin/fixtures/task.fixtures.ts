import type { AdminTask } from "../types/admin.types";

export const SEED_TASKS: readonly AdminTask[] = [
  {
    id: "tsk_today_1001",
    title: "مراجعة جودة محتوى وتقييم تطبيق الشريك",
    description:
      "قم بزيارة رابط الشريك المعتمد أدناه، وإبداء الرأي الموضوعي في واجهة الاستخدام، ثم التقط لقطة شاشة تثبت تفاعلك وارفعها للمراجعة.",
    targetUrl: "https://partner.example.com/review-app",
    platform: "منصة التقييم المعتمدة أوسكار",
    previewImageUrl: "/employee/task-preview.svg",
    windowStart: "12:00",
    windowEnd: "18:00",
    timezone: "Asia/Baghdad",
    rewardAmount: 2.0,
    status: "active",
    isCodeRequired: true,
    startDate: "2026-10-01",
    endDate: "2026-10-01",
    createdAt: "2026-10-01 07:30",
  },
  {
    id: "tsk_past_1000",
    title: "اختبار تجربة التفاعل وإبداء الرأي الترويجي",
    description:
      "مهمة استطلاعية لاختبار سرعة الاستجابة وكفاءة واجهة المستخدم لدى الشريك التقني.",
    targetUrl: "https://partner.example.com/ux-test",
    platform: "تطبيق الشريك المعتمد",
    previewImageUrl: "/employee/task-preview.svg",
    windowStart: "12:00",
    windowEnd: "18:00",
    timezone: "Asia/Baghdad",
    rewardAmount: 2.0,
    status: "closed",
    isCodeRequired: true,
    startDate: "2026-09-30",
    endDate: "2026-09-30",
    createdAt: "2026-09-30 08:00",
  },
];
