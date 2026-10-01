import { Clock, HelpCircle, Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { BRANDING } from "@/features/employee/constants/branding";
import { CopyAction } from "@/features/employee/components/common/copy-action";
import { PageHeader } from "@/features/employee/components/navigation/page-header";

export function EmployeeSupportScreen() {
  const supportEmail = BRANDING.supportEmail;

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        title="الدعم والتواصل"
        subtitle="فريق المساعدة الفنية لخدمة موظفي منصة أوسكار"
        showBackButton={true}
        backHref="/employee/account"
      />

      <div className="space-y-4 p-4 sm:p-5">
        {/* Support Channel Card */}
        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700">
            <Mail size={28} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-base font-bold text-slate-900 sm:text-lg">
              قناة الدعم الفني عبر البريد الإلكتروني
            </h2>
            <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-slate-500">
              لأي استفسارات بخصوص تفعيل الحسابات، تغيير عنوان محفظة السحب
              المقفلة، أو مشكلات التوثيق، يسعدنا تواصلكم عبر البريد الرسمي.
            </p>
          </div>

          {/* Email Box & Actions */}
          <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
              <span className="text-xs font-medium text-slate-500">
                البريد المعتمد:
              </span>
              <bdi
                dir="ltr"
                className="font-mono text-sm font-bold text-slate-900"
              >
                {supportEmail}
              </bdi>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <CopyAction
                  value={supportEmail}
                  label="نسخ البريد"
                  className="w-full"
                />
              </div>
              <a
                href={`mailto:${supportEmail}?subject=استفسار موظف - منصة أوسكار`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <Mail size={16} aria-hidden="true" />
                <span>إرسال بريد الآن</span>
              </a>
            </div>
          </div>

          {/* Working Hours & Scope */}
          <div className="space-y-1 rounded-md border border-slate-200/80 bg-slate-50 p-3 text-right text-xs text-slate-600">
            <p className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Clock size={14} className="text-slate-500" aria-hidden="true" />
              أوقات الاستجابة والمتابعة:
            </p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              يتم الرد على استفسارات الموظفين خلال 24 ساعة من أوقات العمل
              الرسمية (10:00 صباحاً - 6:00 مساءً بتوقيت بغداد).
            </p>
          </div>
        </div>

        {/* Notice on Real Email */}
        <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <p className="flex items-center gap-1.5 font-bold text-amber-900">
            <ShieldAlert
              size={15}
              className="shrink-0 text-amber-700"
              aria-hidden="true"
            />
            تنويه توثيقي للواجهة التجريبية:
          </p>
          <p className="text-[11px] leading-relaxed text-amber-800">
            البريد المعروض أعلاه ({supportEmail}) نموذج إيضاحي تجريبي، وسيتم
            استبداله بعنوان البريد الرسمي المعتمد للشركة فور تزويده من العميل.
            لا توجد قنوات شات فورية مدمجة بالواجهة.
          </p>
        </div>

        {/* Shortcut to FAQ */}
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600">
              <HelpCircle size={16} aria-hidden="true" />
            </div>
            <div>
              <span className="block text-xs font-bold text-slate-900 sm:text-sm">
                هل لديك استفسار شائع؟
              </span>
              <span className="block text-[11px] text-slate-400">
                استعرض إجابات القواعد المالية والمهام
              </span>
            </div>
          </div>

          <Link
            href="/employee/faq"
            className="p-2 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
          >
            تصفح الأسئلة الشائعة
          </Link>
        </div>
      </div>
    </div>
  );
}
