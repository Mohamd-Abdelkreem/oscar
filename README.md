# Full-stack TypeScript authentication boilerplate

A generic Next.js 16, Express 5, PostgreSQL, and Prisma 7 foundation with a
complete email/password account lifecycle. It contains no product domain,
organization, tenant, payment, or demo data model.

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

Requirements: Node.js 24, pnpm 11, and Docker (or PostgreSQL 18).

Install dependencies and create both environment files.

Unix/macOS:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
cp apps/web/.env.example apps/web/.env.local
```

PowerShell:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Replace every `AUTH_*_SECRET` placeholder in `.env` with an independent
random value of at least 32 characters. Development and tests default to
`EMAIL_PROVIDER=console`, which writes complete HTML previews beneath the
workspace-root, Git-ignored `.local-emails` directory, requesting owner-only
filesystem modes where the platform supports them, without making a provider
network call. Open the newest `.html` file and click its verification or reset
button. The API log reports the preview file path, not the link or token.

Start the database, deploy the migration, and run both applications:

```bash
docker compose up -d postgres
pnpm db:generate
pnpm db:migrate:deploy
pnpm dev
```

If port `5432` is already owned by a local PostgreSQL installation, choose a
free `POSTGRES_PORT` in `.env` and use the same port in `DATABASE_URL` before
starting Compose. A healthy container cannot make the API ready when the host
URL resolves to a different PostgreSQL server.

The local topology uses `localhost` consistently:

| Service | URL                            |
| ------- | ------------------------------ |
| Web     | `http://localhost:3000`        |
| API     | `http://localhost:4000/api/v1` |

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

Logout revokes the current refresh record. Logout-all, password change, and
password reset revoke every refresh record. Refresh and reset tokens are
single-use. These operations cannot immediately revoke an already issued,
stateless access JWT: it remains usable until its short configured expiry (15
minutes by default). The boilerplate intentionally has no token blacklist.
Browser session state is cleared only after the server confirms logout.
Failures stay visible and retryable, and a failed logout-all never claims that
sessions on other devices were revoked.

## Email delivery

- `console`: development/test only; no provider network call
- `resend`: requires a non-placeholder `RESEND_API_KEY`
- `smtp`: production requires host, user, and password

Production rejects `EMAIL_PROVIDER=console` and requires an HTTPS
`WEB_APP_URL`. Registration does not report success if verification email
delivery fails. Provider failure logs contain only safe classifications such as
provider, attempt, error name, and status code; raw provider messages are not
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
