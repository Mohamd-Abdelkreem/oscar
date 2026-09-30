import type { ReactNode } from "react";

import { BrandMark } from "@/components/brand/brand-mark";
import { ProtocolTrace } from "@/components/brand/protocol-trace";

export function AuthShell({
  eyebrow,
  title,
  summary,
  children,
}: {
  eyebrow: string;
  title: string;
  summary: string;
  children: ReactNode;
}) {
  return (
    <main className="auth-shell">
      <aside className="auth-shell__context">
        <BrandMark />
        <div className="auth-shell__context-copy">
          <p className="eyebrow">Protected by default</p>
          <h2>
            One identity.
            <br />A deliberate chain of trust.
          </h2>
          <ProtocolTrace />
        </div>
        <p className="auth-shell__aside-note">
          Access tokens remain in memory. Refresh credentials stay HttpOnly.
        </p>
      </aside>
      <section className="auth-shell__form">
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p className="auth-card__summary">{summary}</p>
          {children}
        </div>
      </section>
    </main>
  );
}
