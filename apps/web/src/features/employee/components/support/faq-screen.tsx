"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";

interface FAQItem {
  readonly id: string;
  readonly category: string;
  readonly question: string;
  readonly answer: string;
}

const FAQS: readonly FAQItem[] = [
  {
    id: "faq_1",
    category: "المهام اليومية",
    question: "ما هي أوقات ونافذة تنفيذ المهمة اليومية؟",
    answer:
      "تفتح نافذة المهمة يومياً بين الساعة 12:00 ظهراً والساعة 18:00 مساءً بتوقيت بغداد (GMT+3). يجب رفع لقطة الشاشة والموافقة على إقرار الإنجاز خلال هذه النافذة حصراً.",
  },
  {
    id: "faq_2",
    category: "المهام اليومية",
    question: "هل يمكنني تعديل لقطة الشاشة بعد إرسال المهمة؟",
    answer:
      "نعم، طالما أن المهمة ما زالت 'قيد التدقيق والمراجعة'، يمكنك استبدال لقطة الشاشة بصورة أوضح من خلال صفحة المهام، مع العلم أن استبدال الصورة لا يضيف أي مكافأة إضافية مكررة.",
  },
  {
    id: "faq_3",
    category: "المهام اليومية",
    question: "ماذا يحدث إذا فاتني تنفيذ المهمة خلال اليوم؟",
    answer:
      "عدم تنفيذ المهمة خلال النافذة يعني عدم احتساب مكافأة ذلك اليوم فقط، ولا يتم خصم أي مبالغ أو رصيد سابق من حسابك.",
  },
  {
    id: "faq_4",
    category: "الباقات والترقية",
    question: "كيف يتم احتساب تكلفة ترقية الباقة؟",
    answer:
      "يحق لك تفعيل باقة نشطة واحدة فقط. عند الترقية (مثلاً من S1 بسعر 60 إلى O1 بسعر 600)، يتم خصم سعر باقتك الحالية ليصبح صافي التكلفة 540 USDT. يتم خصم هذا المبلغ من رصيدك المتاح، وفي حال كان الرصيد أقل (مثلاً 40 USDT)، يتطلب إيداع الفارق (500 USDT) لتغذية الرصيد قبل تأكيد الترقية.",
  },
  {
    id: "faq_5",
    category: "الباقات والترقية",
    question: "هل يمكن إلغاء الاشتراك في الباقة واسترجاع قيمتها؟",
    answer:
      "لا، بمجرد تأكيد شراء أو ترقية الباقة لا يمكن إلغاؤها أو استرجاع قيمتها، وتستمر المزايا والعوائد اليومية طوال فترة صلاحية الباقة.",
  },
  {
    id: "faq_6",
    category: "السحب والأرصدة",
    question: "ما هي حدود ورسوم سحب الأرباح؟",
    answer:
      "الحد الأدنى لطلب السحب هو 16 USDT والحد الأقصى هو 500 USDT لكل طلب. تطبق نسبة رسوم معالجة قدرها 21% تخصم من المبلغ المطلوب (مثال: طلب 100 USDT يقتطع منه 21 رسوم ويصلك صافي 79 USDT).",
  },
  {
    id: "faq_7",
    category: "السحب والأرصدة",
    question: "كم يستغرق طلب السحب وما هي شروطه؟",
    answer:
      "تتم معالجة الطلبات تلقائياً خلال 72 ساعة من التقديم. يشترط وجود طلب سحب واحد فقط قيد المعالجة في نفس الوقت، مع فاصل زمني لا يقل عن 24 ساعة بين كل طلب والطلب الذي يليه.",
  },
  {
    id: "faq_8",
    category: "السحب والأرصدة",
    question: "لماذا تم قفل عنوان محفظة السحب الخاصة بي؟",
    answer:
      "يتم قفل عنوان محفظة TRON (TRC20) لمرة واحدة لحماية مستحقات الموظف وأمان حسابه من أي اختراق. لتغيير العنوان، يجب التواصل مع فريق الدعم الفني للتحقق من الهوية.",
  },
  {
    id: "faq_9",
    category: "الإيداع",
    question: "ما هي الشبكة والعملة المقبولة للإيداع؟",
    answer:
      "تقبل المنصة عملة USDT حصرياً عبر شبكة TRON (TRC20). علماً بأن توقيت توفر الرصيد وتأكيدات الشبكة تخضع لضوابط التدقيق المعتمدة.",
  },
  {
    id: "faq_10",
    category: "الفريق والإحالات",
    question: "كيف يتم احتساب عمولات الفريق وما هي نسبها؟",
    answer:
      "تمنح العمولات حتى 5 مستويات: المستوى الأول 12%، المستوى الثاني 6%، المستوى الثالث 4%، المستوى الرابع 2%، المستوى الخامس 2%. تضاف العمولات فقط عند شراء أو ترقية الأعضاء لباقاتهم، ولا تمنح على الإيداعات أو المهام اليومية.",
  },
];

function FAQAccordion() {
  const [openId, setOpenId] = useState<string | null>("faq_1");

  const toggle = (id: string) => {
    setOpenId(openId === id ? null : id);
  };

  return (
    <div className="space-y-3">
      {FAQS.map((faq) => {
        const isOpen = openId === faq.id;
        return (
          <div
            key={faq.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white transition-all"
          >
            <button
              type="button"
              onClick={() => {
                toggle(faq.id);
              }}
              className="flex w-full items-center justify-between gap-3 p-4 text-right transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-600"
              aria-expanded={isOpen}
              aria-controls={`faq-answer-${faq.id}`}
              id={`faq-question-${faq.id}`}
            >
              <div className="min-w-0 space-y-1">
                <span className="inline-block rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  {faq.category}
                </span>
                <h3 className="text-sm leading-snug font-bold text-slate-900">
                  {faq.question}
                </h3>
              </div>

              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-transform ${
                  isOpen ? "rotate-180 bg-slate-200" : ""
                }`}
              >
                <ChevronDown size={16} aria-hidden="true" />
              </div>
            </button>

            {isOpen && (
              <div
                id={`faq-answer-${faq.id}`}
                role="region"
                aria-labelledby={`faq-question-${faq.id}`}
                className="border-t border-slate-100 bg-slate-50/50 p-4 pt-0 text-xs leading-relaxed text-slate-600 sm:text-sm"
              >
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EmployeeFaqScreen() {
  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="الأسئلة الشائعة"
        subtitle="الإجابات الرسمية حول قواعد المهام والباقات والعمليات المالية"
        showBackButton={true}
        backHref="/employee/account"
      />

      <div className="p-4 sm:p-5">
        <FAQAccordion />
      </div>
    </div>
  );
}
