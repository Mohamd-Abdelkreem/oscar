export function SessionLoader() {
  return (
    <main className="session-loader" aria-live="polite" aria-busy="true">
      <div className="session-loader__pulse" aria-hidden="true" />
      <p className="eyebrow">Session handshake</p>
      <h1>Restoring your workspace.</h1>
    </main>
  );
}
