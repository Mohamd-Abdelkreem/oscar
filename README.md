# OSCAR

A Next.js 16, Express 5, PostgreSQL, and Prisma 7 application built on the
authentication foundation. Implemented domains include packages, subscriptions,
wallet accounting, referrals, tasks, TRON deposits, and withdrawal backend flows.
Some dashboard and withdrawal screens still use fixtures; see the
[local development guide](docs/engineering/local-development.md) for usable flows.

## OSCAR governance

OSCAR work follows the [project constitution](.specify/memory/constitution.md),
the approved [roadmap](PLAN.md), the [engineering guides](docs/engineering/README.md),
and the [workflow operating contract](docs/workflow/speckit-prompts.txt).
Read all eight engineering guides at each phase start and revisit relevant sections
for each task batch and review. Execute only the owner's selected command, phase,
and task scope; satisfy predecessor and verification gates before completion.
Approved employee/admin designs are frozen, with missing UI or conflicting
presentation changes requiring an explicit owner decision.

The remaining sections document the existing authentication foundation and runtime
setup; they do not establish OSCAR financial acceptance or release authorization.

## What is included

- React 19 and Next.js App Router
- Axios credentialed transport with an in-memory access token
- React Query as the only browser session-state owner
- Express, Zod validation, OpenAPI 3.1, and Pino
- Argon2id passwords and purpose-bound JWTs
- rotating, one-time refresh sessions
- HttpOnly refresh cookie plus readable double-submit CSRF cookie
- console, Resend, and SMTP email delivery
- request IDs, URL credential sanitization, rate limits, and safe errors
- unit tests and disposable PostgreSQL Testcontainers integration tests

## Local setup

Requirements: Node.js 24, pnpm 11, and Docker with Linux containers running.
An internet connection is required for image/dependency downloads and Nile reads.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

`pnpm dev` now prepares an isolated Nile environment, applies migrations, starts
PostgreSQL, Redis, the API, worker, signer, SSH recovery store and local operator,
then starts Next.js. It generates missing auth secrets, local account passwords,
database roles and protected custody files. Existing data and keys persist between
runs. Backend services run built JavaScript in Linux containers.

Useful commands:

```sh
pnpm dev:setup     # prepare/rebuild and leave backend services running
pnpm dev:services  # rebuild/restart backend services after backend edits
pnpm dev:status    # show local containers
pnpm dev:stop      # stop local containers, retain data and keys
```

Open the generated `credentials.json` under `%LOCALAPPDATA%/OSCAR/oscar-dev`
on Windows (or `~/.local/share/OSCAR/oscar-dev` on Linux/macOS) for the admin and
employee passwords. Email verification/reset previews are written to the
Git-ignored `.local-emails` directory. SMTP/Resend accounts are not required.

The local topology uses `localhost` consistently:

| Service | URL                            |
| ------- | ------------------------------ |
| Web     | `http://localhost:3000`        |
| API     | `http://localhost:4000/api/v1` |

The local database uses `127.0.0.1:55438`; Redis uses `127.0.0.1:6381`.
See the [local development guide](docs/engineering/local-development.md) for
runtime separation, testnet funding, limitations and a workshop workflow.

`NEXT_PUBLIC_API_URL` is validated at module load and has no silent fallback.
If `apps/web/.env.local` changes, restart the Next.js development server.

## Authentication model

Registration normalizes email, stores an Argon2id password hash, stores only a
SHA-256 fingerprint of the verification token, and awaits email delivery. The
account becomes active only after the one-time verification link is consumed.
Consumption is conditional and atomic: exactly one concurrent request can
activate the pending account, while reused tokens and tokens replaced by resend
fail.
If delivery fails, the API removes only the pending account created by that
request before returning the failure, so the same address can be retried.

Password length is a fixed shared contract: 15 through 128 characters. The Web,
API DTOs, and optional seed validation consume those contract constants; there
is no environment override that can make their policies drift.

Login returns only an access token in JSON and sets:

- `refreshToken`: HttpOnly, `SameSite=Lax` by default, path
  `/api/v1/auth`
- `csrfToken`: readable by the web app, same policy, path `/`

Both are session cookies unless `rememberMe=true`; remembered lifetimes match
the configured refresh-session TTL. Cookie domain is omitted.

The browser stores the access token only in module memory. Axios attaches the
bearer token and sends the CSRF header only for unsafe methods. One
single-flight refresh handles concurrent protected `401` responses and each
request is replayed at most once. Public authentication failures never trigger
refresh. Only exact refresh responses `400/BAD_REQUEST` and
`401/UNAUTHORIZED` clear the token and replace the page with login. Network,
CSRF, rate-limit, and server refresh failures remain visible; a replay failure
is reported separately from the refresh that enabled the replay. React Query
owns the current safe-user session. During restoration, only those same exact
anonymous code/status pairs become `null`; unexpected `400` or `401` codes and
all other restore failures remain visible and retryable.

Logout revokes the authenticated stable session, including its access and
refresh authority, even with a stale or absent refresh cookie. Logout-all,
password change, and password reset revoke every prior session for that account.
Protected requests check current account and persisted session authority, so
revoked access tokens fail on the next request. Refresh and reset tokens are
single-use; refresh rotation retains the original session expiry and remember-me
policy. Reset links bind the intended User ID, email and purpose to the current
stored credential; recovery requires an ACTIVE, verified account and does not
activate or restore it. Successful reset/change requires a fresh sign-in.
Browser session state is cleared only after the server confirms logout.
Failures stay visible and retryable, and a failed logout-all never claims that
sessions on other devices were revoked.

## Email delivery

- `console`: development/test only; no provider network call
- `resend`: requires a non-placeholder `RESEND_API_KEY`
- `smtp`: optional development/test transport

Production requires explicit `EMAIL_PROVIDER=resend`, company
`MAIL_FROM_NAME`, `MAIL_FROM_ADDRESS`, `MAIL_REPLY_TO`, an HTTPS `WEB_APP_URL`,
and an owner-approved same-origin `ADMIN_INVITATION_ACCEPT_URL`. Production
signing keys must be explicit and distinct across all four purposes.
Registration does not report success if verification email
delivery fails. Provider failure logs contain only safe classifications such as
provider, attempt, outcome, and finite failure code; raw provider messages are not
logged.

## Optional seed accounts

Both groups are disabled unless all three values in that group are present:

```dotenv
SEED_ADMIN_EMAIL=
SEED_ADMIN_NAME=
SEED_ADMIN_PASSWORD=

SEED_USER_EMAIL=
SEED_USER_NAME=
SEED_USER_PASSWORD=
```

Partial groups fail clearly and configured production seeding is refused.
Passwords use the fixed shared policy and Argon2id. Upserted accounts are forced
to the appropriate `ADMIN` or `USER` role, active/verified state, and have
stale verification/reset fields cleared. There are no default credentials.

## Production topology

The default security model expects the web app and API on one origin. The
included [Caddyfile](./Caddyfile) routes `/api/*` to Express and everything
else to Next.js:

```dotenv
APP_DOMAIN=example.com
CORS_ORIGINS=https://example.com
WEB_APP_URL=https://example.com
NEXT_PUBLIC_API_URL=https://example.com/api/v1
AUTH_COOKIE_SAME_SITE=lax
```

Deploying web and API on unrelated registrable domains is not supported by the
default cookie/CSRF design. `SameSite=None` alone cannot make frontend
JavaScript read an unrelated API-domain CSRF cookie.

`compose.yaml` provisions PostgreSQL only. The Caddyfile is a deployment routing
template for separately deployed services named `api` and `web`; this repository
does not provide or claim a verified one-command production Compose stack.

## Database invariants

The single initial migration creates only `users` and `refresh_tokens`. It
also enforces:

- `ck_users_email_normalized`
- `ck_users_status_timestamps_consistent`

Migration integration tests inspect both constraints, reject invalid direct
inserts, accept valid pending/active users, verify cascade behavior, and deploy
the migration a second time.

## Verification

```bash
pnpm verify
```

The command formats/validates/generates Prisma artifacts, checks formatting,
lints, type-checks, runs unit and disposable-database integration suites,
builds every package, and runs `git diff --check`. Docker is required for the
integration stage. Contracts test/spec sources are excluded from production
output, and the root build-output assertion verifies required emitted artifacts
while rejecting emitted test/spec JavaScript, declarations, and source maps.

Individual commands:

```bash
pnpm db:format
pnpm db:validate
pnpm db:generate
pnpm format
pnpm format:check
pnpm lint
pnpm check-types
pnpm test
pnpm test:integration
pnpm build
pnpm verify:build-output
```

See [PROJECT_REFERENCE.md](./PROJECT_REFERENCE.md) for boundaries and extension
guidance.
