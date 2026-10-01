import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";

export default function EmployeePrivacyPage() {
  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="سياسة الخصوصية"
        subtitle="مسودة تجريبية للمراجعة والتنقيح"
        showBackButton={true}
        backHref="/employee/account"
      />

      <div className="p-4 sm:p-5 space-y-4">
        {/* Draft Notice Banner */}
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2.5">
          <ShieldAlert size={16} className="text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-0.5">
            <p className="font-bold">مسودة تجريبية للعرض والمراجعة (Draft Only)</p>
            <p className="text-amber-800 text-[11px] leading-relaxed">
              هذه النصوص توضيحية لغايات مراجعة الواجهة والتصميم ولا تشكل سياسة خصوصية قانونية ملزمة. سيتم استبدالها بالصيغة المعتمدة من العميل لاحقاً.
            </p>
          </div>
        </div>

        {/* Content Sections */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. البيانات التي يتم جمعها
            </h2>
            <p>
              تقتصر البيانات المسجلة على البريد الإلكتروني، الاسم الكامل، ولقطات الشاشة المرفوعة لإثبات تنفيذ المهام، بالإضافة إلى عنوان محفظة السحب (TRC20) المعتمد لتحويل المستحقات.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. استخدام وتأمين البيانات
            </h2>
            <p>
              تستخدم البيانات فقط لغايات إدارة حساب الموظف، تدقيق المهام اليومية المنجزة، والتحقق من صحة عمليات السحب والإيداع. لا يتم بيع البيانات أو مشاركتها مع أي أطراف تجارية ثالثة.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. أمان كلمات المرور وبيانات الدخول
            </h2>
            <p>
              تخضع كلمات المرور لمعايير التشفير القوية، ولا يتم تخزينها بنصوص صريحة. يتحمل الموظف مسؤولية عدم مشاركة كلمة المرور مع أي طرف آخر.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. عنوان محفظة السحب
            </h2>
            <p>
              يتم قفل عنوان محفظة السحب بعد تسجيله لمرة واحدة لمنع أي محاولات تعديل غير مصرح بها. يتطلب أي تعديل مستقبلي للعنوان التواصل مع فريق الدعم الفني وتأكيد الهوية.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
