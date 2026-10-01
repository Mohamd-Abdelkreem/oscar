import { Suspense } from "react";
import { CodeCreateScreen } from "@/features/admin/components/codes/code-create-screen";

export default function AdminNewCodePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-400">جارٍ التحميل...</div>}>
      <CodeCreateScreen />
    </Suspense>
  );
}
