"use client";

import {
  Clock,
  HelpCircle,
  Mail,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { BRANDING } from "@/features/employee/constants/branding";
import { CopyAction } from "@/features/employee/components/common/copy-action";
import { PageHeader } from "@/features/employee/components/navigation/page-header";

export default function EmployeeSupportPage() {
  const supportEmail = BRANDING.supportEmail;

  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="الدعم والتواصل"
        subtitle="فريق المساعدة الفنية لخدمة موظفي منصة أوسكار"
        showBackButton={true}
        backHref="/employee/account"
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Support Channel Card */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center mx-auto border border-emerald-200">
            <Mail size={28} aria-hidden="true" />
          </div>

          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              قناة الدعم الفني عبر البريد الإلكتروني
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              لأي استفسارات بخصوص تفعيل الحسابات، تغيير عنوان محفظة السحب المقفلة، أو مشكلات التوثيق، يسعدنا تواصلكم عبر البريد الرسمي.
            </p>
          </div>

          {/* Email Box & Actions */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-xs text-slate-500 font-medium">البريد المعتمد:</span>
              <bdi dir="ltr" className="text-sm font-bold text-slate-900 font-mono">
                {supportEmail}
              </bdi>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <CopyAction value={supportEmail} label="نسخ البريد" className="w-full" />
              </div>
              <a
                href={`mailto:${supportEmail}?subject=استفسار موظف - منصة أوسكار`}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-semibold rounded-md bg-emerald-700 hover:bg-emerald-800 text-white transition-colors focus-visible:outline-2 focus-visible:outline-emerald-600"
              >
                <Mail size={16} aria-hidden="true" />
                <span>إرسال بريد الآن</span>
              </a>
            </div>
          </div>

          {/* Working Hours & Scope */}
          <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-md text-xs text-slate-600 space-y-1 text-right">
            <p className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Clock size={14} className="text-slate-500" aria-hidden="true" />
              أوقات الاستجابة والمتابعة:
            </p>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              يتم الرد على استفسارات الموظفين خلال 24 ساعة من أوقات العمل الرسمية (10:00 صباحاً - 6:00 مساءً بتوقيت بغداد).
            </p>
          </div>
        </div>

        {/* Notice on Real Email */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-900">
            <ShieldAlert size={15} className="text-amber-700 shrink-0" aria-hidden="true" />
            تنويه توثيقي للواجهة التجريبية:
          </p>
          <p className="text-amber-800 text-[11px] leading-relaxed">
            البريد المعروض أعلاه ({supportEmail}) نموذج إيضاحي تجريبي، وسيتم استبداله بعنوان البريد الرسمي المعتمد للشركة فور تزويده من العميل. لا توجد قنوات شات فورية مدمجة بالواجهة.
          </p>
        </div>

        {/* Shortcut to FAQ */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <HelpCircle size={16} aria-hidden="true" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 block">
                هل لديك استفسار شائع؟
              </span>
              <span className="text-[11px] text-slate-400 block">
                استعرض إجابات القواعد المالية والمهام
              </span>
            </div>
          </div>

          <Link
            href="/employee/faq"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 p-2"
          >
            تصفح الأسئلة الشائعة
          </Link>
        </div>
      </div>
    </div>
  );
}
