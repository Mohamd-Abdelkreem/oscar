"use client";

import Link from "next/link";

import { publicEnvironment } from "@/config/public-environment";
import { useSession } from "@/features/auth/hooks/auth.hooks";

const runtimeSteps = [
  ["01", "Access", "Bearer token held in browser memory"],
  ["02", "Refresh", "HttpOnly cookie rotated after one use"],
  ["03", "Defense", "CSRF token required for unsafe requests"],
] as const;

export function DashboardOverview() {
  const user = useSession().data?.user ?? null;
  if (user === null) return null;

  return (
    <main className="workspace-main">
      <header className="workspace-title">
        <div>
          <p className="eyebrow">Authenticated workspace</p>
          <h1>Good to see you, {user.fullName.split(" ")[0]}.</h1>
        </div>
        <span className="status-badge">
          <i aria-hidden="true" />
          {user.status === "ACTIVE" ? "Session active" : user.status}
        </span>
      </header>

      <section className="session-board" aria-labelledby="session-title">
        <div className="session-board__heading">
          <p className="eyebrow">Live protocol</p>
          <h2 id="session-title">Your current trust chain</h2>
          <p>
            The UI guard keeps navigation coherent. Every protected API call
            still verifies the access token and active user at the data
            boundary.
          </p>
        </div>
        <ol>
          {runtimeSteps.map(([number, title, description]) => (
            <li key={number}>
              <span>{number}</span>
              <div>
                <strong>{title}</strong>
                <small>{description}</small>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="workspace-grid">
        <article className="workspace-card workspace-card--profile">
          <p className="eyebrow">Safe user DTO</p>
          <h2>Account snapshot</h2>
          <dl className="profile-list">
            <div>
              <dt>Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{user.phone ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div>
              <dt>Verified</dt>
              <dd>{user.emailVerifiedAt === null ? "Pending" : "Yes"}</dd>
            </div>
          </dl>
          <Link className="text-link" href="/settings">
            Manage account →
          </Link>
        </article>
        <article className="workspace-card workspace-card--contract">
          <p className="eyebrow">Developer surface</p>
          <h2>Contract-first API</h2>
          <p>
            Explore the complete auth and profile contract, including error
            envelopes and security schemes.
          </p>
          <a
            className="button button--ghost"
            href={`${publicEnvironment.NEXT_PUBLIC_API_URL}/openapi.json`}
          >
            Open API document
          </a>
        </article>
      </section>
    </main>
  );
}
