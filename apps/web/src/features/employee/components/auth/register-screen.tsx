"use client";

import { registerBodySchema } from "@template/contracts";
import { useRegister } from "@/features/auth/hooks/auth.hooks";
import { useCredentialFieldCleanup } from "@/features/auth/hooks/credential-commands.hooks";
import { getApiError } from "@/services/api/api-client";
import { safeApiError } from "@/services/api/safe-error";

import { AlertCircle, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PasswordVisibilityToggle } from "@/features/employee/components/common/password-visibility-toggle";
import { Button } from "@/features/employee/components/common/button";

export function EmployeeRegisterScreen() {
  const router = useRouter();
  const registration = useRegister();
  const submitting = useRef(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [invitationCode, setInvitationCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useCredentialFieldCleanup(() => {
    setPassword("");
    setConfirmPassword("");
  }, registration.isCurrentFlow);

  const handleSubmit = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (
      submitting.current ||
      registration.isPending ||
      registration.uncertain ||
      unknownOutcome
    )
      return;
    setError(null);

    if (password !== confirmPassword) {
      setError("كلمتا المرور غير متطابقتين.");
      return;
    }

    const parsed = registerBodySchema.safeParse({
      fullName: fullName.trim(),
      email,
      password,
      referralCode: invitationCode,
    });
    if (!parsed.success) {
      setError(
        "راجع الاسم والبريد وكلمة المرور (15–128 حرفاً) وكود الدعوة المكون من 32 حرفاً سداسياً.",
      );
      return;
    }
    submitting.current = true;
    try {
      const { referralCode, ...body } = parsed.data;
      const pending = await registration.mutateAsync({
        ...body,
        ...(referralCode === undefined ? {} : { referralCode }),
      });
      if (
        pending.data.user.role !== "USER" ||
        pending.data.user.status !== "PENDING_VERIFICATION" ||
        pending.data.user.emailVerifiedAt !== null
      )
        throw safeApiError("contract", "CONTRACT_ERROR");
      setPassword("");
      setConfirmPassword("");
      if (registration.isCurrentFlow()) {
        setAccepted(true);
        router.replace("/employee/auth/verify-email");
      }
    } catch (failure: unknown) {
      const safe = getApiError(failure);
      if (["transient", "uncertain", "contract"].includes(safe.category)) {
        setUnknownOutcome(true);
        setPassword("");
        setConfirmPassword("");
      }
      if (safe.category !== "obsolete")
        setError(
          ["transient", "uncertain", "contract"].includes(safe.category)
            ? "تعذر تأكيد النتيجة. قد يكون الحساب قد أُنشئ دون تأكيد إرسال الرسالة. لا تكرر التسجيل؛ اطلب رابط تفعيل للبريد نفسه."
            : safe.statusCode === 429
              ? "محاولات كثيرة. انتظر قليلاً ثم حاول مجدداً."
              : safe.statusCode === 409
                ? "تعذر إنشاء الحساب بهذه البيانات. قد يكون البريد مستخدماً؛ جرب تسجيل الدخول أو طلب رابط تفعيل."
                : safe.message,
        );
    } finally {
      submitting.current = false;
    }
  };

  return (
    <div className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="space-y-1 text-center">
        <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
          إنشاء حساب موظف جديد
        </h1>
        <p className="text-xs text-slate-500 sm:text-sm">
          انضم لمنصة أوسكار للبدء في تنفيذ المهام اليومية
        </p>
      </div>

      {accepted ? (
        <div className="space-y-4" role="status">
          <p className="text-sm text-slate-600">
            تم إنشاء الحساب بانتظار تفعيل البريد. تحقق من صندوق البريد؛ قبول
            الطلب لا يؤكد وصول الرسالة.
          </p>
          <Link
            href="/employee/auth/verify-email"
            className="font-bold text-emerald-700 hover:text-emerald-800"
          >
            متابعة تفعيل البريد الإلكتروني
          </Link>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            void handleSubmit(event);
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label
              htmlFor="reg-name"
              className="block text-xs font-semibold text-slate-700"
            >
              الاسم الكامل
            </label>
            <input
              id="reg-name"
              type="text"
              value={fullName}
              onChange={(e) => {
                setFullName(e.target.value);
              }}
              placeholder="أحمد مروان"
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-email"
              className="block text-xs font-semibold text-slate-700"
            >
              البريد الإلكتروني للعمل
            </label>
            <input
              id="reg-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
              }}
              placeholder="name@example.com"
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-password"
              className="block text-xs font-semibold text-slate-700"
            >
              كلمة المرور (15 - 128 حرفاً)
            </label>
            <div className="relative">
              <input
                id="reg-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                }}
                minLength={15}
                maxLength={128}
                className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 pl-12 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                required
              />
              <PasswordVisibilityToggle
                visible={showPassword}
                onToggle={() => {
                  setShowPassword(!showPassword);
                }}
              />
            </div>
            <p className="text-[11px] text-slate-400">
              الحد الأدنى 15 حرفاً طبقاً للسياسة الأمنية للمنصة.
            </p>
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-confirm"
              className="block text-xs font-semibold text-slate-700"
            >
              تأكيد كلمة المرور
            </label>
            <input
              id="reg-confirm"
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
              }}
              minLength={15}
              maxLength={128}
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 text-base focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              required
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="reg-invite"
              className="block text-xs font-semibold text-slate-700"
            >
              كود الدعوة (اختياري)
            </label>
            <input
              id="reg-invite"
              type="text"
              dir="ltr"
              value={invitationCode}
              onChange={(e) => {
                setInvitationCode(e.target.value.toUpperCase());
              }}
              placeholder="0123456789abcdef0123456789abcdef"
              className="min-h-[48px] w-full rounded-md border border-slate-300 px-3.5 py-2.5 font-mono text-base uppercase focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          {error && (
            <p
              className="flex items-center gap-1.5 text-xs font-medium text-rose-600"
              role="alert"
            >
              <AlertCircle size={14} className="shrink-0" aria-hidden="true" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant="primary"
            size="default"
            fullWidth
            loading={registration.isPending}
            disabled={
              registration.isPending || registration.uncertain || unknownOutcome
            }
            icon={UserPlus}
          >
            إنشاء الحساب
          </Button>
        </form>
      )}

      {error &&
        !accepted &&
        (unknownOutcome || registration.error?.statusCode === 409) && (
          <Link
            href="/employee/auth/verify-email"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800"
          >
            طلب رابط تفعيل للبريد نفسه
          </Link>
        )}

      <div className="border-t border-slate-100 pt-3 text-center text-xs text-slate-500">
        لديك حساب بالفعل؟{" "}
        <Link
          href="/employee/auth/login"
          className="font-bold text-emerald-700 hover:text-emerald-800"
        >
          تسجيل الدخول
        </Link>
      </div>
    </div>
  );
}
