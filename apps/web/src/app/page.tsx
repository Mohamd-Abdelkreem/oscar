import Link from "next/link";

import { BrandMark } from "@/components/brand/brand-mark";
import { ProtocolTrace } from "@/components/brand/protocol-trace";
import { publicEnvironment } from "@/config/public-environment";

const capabilities = [
  [
    "01",
    "Rotating sessions",
    "Short-lived access tokens paired with hashed, one-time refresh records.",
  ],
  [
    "02",
    "Explicit boundaries",
    "Shared Zod contracts, safe user DTOs, and an OpenAPI 3.1 document.",
  ],
  [
    "03",
    "Operational footing",
    "Structured logs, rate limits, direct email delivery, and PostgreSQL tests.",
  ],
] as const;

export default function HomePage() {
  return (
    <main className="landing">
      <nav className="landing__nav" aria-label="Primary navigation">
        <BrandMark />
        <div className="landing__nav-actions">
          <Link className="text-link" href="/auth/login">
            Sign in
          </Link>
          <Link className="button button--small" href="/auth/register">
            Start building
          </Link>
        </div>
      </nav>

      <section className="landing__hero">
        <div className="landing__copy">
          <p className="eyebrow">Next.js / Express / PostgreSQL</p>
          <h1>The first mile is already secure.</h1>
          <p className="landing__lede">
            Relay is a production-oriented TypeScript foundation with the
            account lifecycle built in—from verification to session rotation and
            recovery.
          </p>
          <div className="landing__actions">
            <Link className="button" href="/auth/register">
              Create an account
            </Link>
            <a
              className="button button--ghost"
              href={`${publicEnvironment.NEXT_PUBLIC_API_URL}/openapi.json`}
            >
              Inspect the contract
            </a>
          </div>
        </div>
        <div className="landing__trace">
          <p className="trace-caption">A session, in motion</p>
          <ProtocolTrace />
        </div>
      </section>

      <section className="capability-strip" aria-labelledby="foundation-title">
        <header>
          <p className="eyebrow">Included foundation</p>
          <h2 id="foundation-title">
            Boring where it should be. Careful where it matters.
          </h2>
        </header>
        <ol className="capability-list">
          {capabilities.map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </li>
          ))}
        </ol>
      </section>
      <footer className="landing__footer">
        <BrandMark compact />
        <p>Generic by design. Ready for your product.</p>
      </footer>
    </main>
  );
}
