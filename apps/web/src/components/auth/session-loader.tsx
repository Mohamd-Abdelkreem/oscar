export function SessionLoader() {
  return (
    <main className="session-loader" aria-live="polite" aria-busy="true">
      <div className="session-loader__pulse" aria-hidden="true" />
      <p className="eyebrow">التحقق من الجلسة</p>
      <h1>جارٍ التحقق من صلاحية الدخول.</h1>
    </main>
  );
}
