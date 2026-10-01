import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/features/employee/components/navigation/page-header";

export default function EmployeeTermsPage() {
  return (
    <div className="flex-1 flex flex-col">
      <PageHeader
        title="الشروط والأحكام"
        subtitle="مسودة تجريبية للمراجعة والتنقيح القانوني"
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
              هذه النصوص إيضاحية مخصصة للتحقق من المظهر وتوزيع المحتوى، وليست عقداً قانونياً نهائياً معتمداً. سيتم استبدالها بالصياغة القانونية المعتمدة فور اعتمادها من إدارة المشروع.
            </p>
          </div>
        </div>

        {/* Content Sections */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. أهلية الاستخدام وحساب الموظف
            </h2>
            <p>
              يقتصر استخدام هذه البوابة على الموظفين والمستخدمين المصرح لهم بعد إتمام تفعيل البريد الإلكتروني عبر الرابط المعتمد. يلتزم المستخدم بالحفاظ على سرية بيانات تسجيل الدخول وتعيين كلمة مرور قوية لا تقل عن 15 حرفاً.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. تنفيذ المهام اليومية وضوابط النزاهة
            </h2>
            <p>
              تتاح المهام اليومية للمشتركين في الباقات المعتمدة ضمن نافذة زمنية محددة يومياً بين الساعة 12:00 والساعة 18:00 بتوقيت بغداد. يلتزم الموظف برفع لقطة شاشة حقيقية توثق التفاعل الفعلي مع رابط الشريك. يحظر استخدام لقطات شاشة مكررة أو مفبركة، وتخضع جميع المهام للمراجعة والتدقيق الإداري.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              3. الباقات والترقية
            </h2>
            <p>
              يحق للمستخدم الاشتراك في باقة نشطة واحدة في الوقت نفسه. عند الترقية من باقة إلى باقة أعلى، يتم احتساب فارق السعر وخصم قيمة الباقة الحالية من تكلفة الباقة الجديدة، ولا يمكن إلغاء الاشتراك أو استرجاعه بعد إتمام الترقية.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              4. العمليات المالية والسحب
            </h2>
            <p>
              تخضع طلبات السحب للحدود المقررة (16 إلى 500 USDT) بنسبة رسوم 21% تخصم من المبلغ المطلوب. يتم حجز رصيد السحب فورياً لمدة معالجة تلقائية تبلغ 72 ساعة، ويشترط وجود طلب سحب واحد فقط قيد المعالجة وبفاصل زمني لا يقل عن 24 ساعة بين الطلبات.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
              5. شبكة الإحالة والعمولات
            </h2>
            <p>
              تمنح المنصة عمولات إحالة بناءً على نسب المستويات المعتمدة (L1 إلى L5) عند شراء أو ترقية الباقات من قبل الأعضاء المدعوين، ولا تحتسب عمولات على عمليات الإيداع أو مكافآت المهام.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
