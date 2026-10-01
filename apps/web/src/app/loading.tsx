export default function Loading() {
  return (
    <main
      dir="rtl"
      lang="ar"
      role="status"
      aria-live="polite"
      className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 p-4 text-center select-none"
      style={{
        fontFamily: 'Cairo, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      <div className="flex flex-col items-center gap-4 rounded-xl border border-slate-200 bg-white p-8 shadow-sm max-w-sm w-full">
        {/* Restrained Logo / Brand Glyph */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-700 text-white font-bold text-xl shadow-xs">
          أ
        </div>

        {/* Loading Spinner with reduced-motion support */}
        <div className="relative flex items-center justify-center py-2">
          <div
            className="h-8 w-8 animate-spin rounded-full border-3 border-emerald-700 border-t-transparent motion-reduce:animate-none motion-reduce:border-dashed"
            aria-hidden="true"
          />
        </div>

        {/* Accessible Arabic Loading Message */}
        <div className="space-y-1">
          <h1 className="text-base font-bold text-slate-900 tracking-normal sm:text-lg">
            جارٍ تحميل أوسكار...
          </h1>
          <p className="text-xs text-slate-500">
            يرجى الانتظار قليلاً ريثما تكتمل تهيئة الواجهة
          </p>
        </div>
      </div>
    </main>
  );
}
