import type { DailyTask, TaskHistoryItem } from "../types/employee.types";

export const INITIAL_TASK: DailyTask = {
  id: "tsk_today_1001",
  title: "مراجعة جودة محتوى وتقييم تطبيق الشريك",
  description:
    "قم بزيارة رابط الشريك المعتمد أدناه، وإبداء الرأي الموضوعي في واجهة الاستخدام، ثم التقط لقطة شاشة تثبت تفاعلك وارفعها للمراجعة.",
  instructions: [
    "اضغط على زر (الانتقال لمنصة الشريك) واستعرض واجهة الاستخدام.",
    "قم بكتابة تقييم موجز لا يقل عن سطرين حول سرعة الاستجابة وسهولة الوصول.",
    "التقط لقطة شاشة شاشة واضحة (Screenshot) تظهر التقييم وحسابك.",
    "ارفع ملف لقطة الشاشة (PNG أو JPG بحد أقصى 5 ميجابايت).",
    "فعّل خيار الإقرار الإلزامي ثم اضغط (تأكيد إرسال المهمة).",
  ],
  targetUrl: "#task-partner-preview",
  platform: "منصة التقييم المعتمدة أوسكار",
  rewardAmount: 2.0,
  windowStart: "12:00",
  windowEnd: "18:00",
  timezone: "Asia/Baghdad",
  previewImageUrl: "/employee/task-preview.svg",
  status: "open",
  isCodeRequired: true,
};

export const INITIAL_TASK_HISTORY: readonly TaskHistoryItem[] = [
  {
    id: "th_01",
    date: "2026-09-30",
    title: "اختبار تجربة التفاعل وإبداء الرأي",
    rewardAmount: 2.0,
    status: "approved",
  },
  {
    id: "th_02",
    date: "2026-09-29",
    title: "مراجعة محتوى وتوثيق تفاعل الحملة",
    rewardAmount: 2.0,
    status: "approved",
  },
  {
    id: "th_03",
    date: "2026-09-28",
    title: "تقييم سرعة تحميل تطبيق الشريك",
    rewardAmount: 2.0,
    status: "approved",
  },
  {
    id: "th_04",
    date: "2026-09-27",
    title: "مراجعة وتأكيد دقة البيانات الترويجية",
    rewardAmount: 2.0,
    status: "rejected",
    rejectionReason:
      "لقطة الشاشة المرفقة غير واضحة ولا تظهر تفاصيل التقييم المطلوبة.",
  },
  {
    id: "th_05",
    date: "2026-09-26",
    title: "استبيان رضا المستخدمين لشهر سبتمبر",
    rewardAmount: 2.0,
    status: "approved",
  },
];
