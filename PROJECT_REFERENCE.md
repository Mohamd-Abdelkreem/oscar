# Project reference

This is the implemented architecture and operations reference for the generic
authentication foundation.

## Boundaries

```text
Next.js UI
  -> @template/contracts
  -> Axios API client
  -> Express routes / middleware / controllers / services
  -> Prisma
  -> PostgreSQL
```

- `@template/contracts` owns request bodies, safe user output, field errors,
  pagination metadata, and success/error envelopes.
- `@template/database` owns Prisma schema, migrations, generated types, seed
  behavior, and the client factory.
- `@template/api` owns HTTP security, account rules, delivery adapters, and
  persistence orchestration.
- `@template/web` imports contracts but no API/database implementation.

All packages use ESM and emitted `.js` relative imports. TypeScript strictness
and exact optional property checking stay enabled.

## Web

`src/services/api/api-client.ts` is the only transport. It uses Axios with a
validated, trailing-slash-normalized base URL and `withCredentials: true`.
Access-token and refresh-promise state are discriminated module-memory values;
no token is written to local/session storage.

Request interception adds:

- `Authorization: Bearer ...` when memory contains a token
- `x-csrf-token` from the readable cookie for POST/PUT/PATCH/DELETE only

Response interception classifies exact public auth paths, coalesces concurrent
refresh, marks replayed requests with `_templateRetried`, and replays once.
Only exact refresh `400/BAD_REQUEST` and `401/UNAUTHORIZED` failures clear
memory and perform a safe full navigation without credential-bearing return
parameters. Network, CSRF, rate-limit, and server refresh failures remain
visible, and replay failures are reported separately from refresh failures.

`src/app/providers.tsx` contains only `QueryClientProvider`.
`AUTH_SESSION_QUERY_KEY` is the sole session cache. A missing access token
attempts refresh; only `400/BAD_REQUEST` and `401/UNAUTHORIZED` refresh
responses mean anonymous. Only those exact code/status pairs from the
current-user request are also normalized to anonymous after clearing the
in-memory token; unexpected `400`/`401` codes remain errors. Other failures are
rendered with retry and request ID. Logout and logout-all clear local session
state only after confirmed server success; failures stay visible and retryable,
and logout-all does not claim other-device revocation after a failure.

Pure guest/protected route-state functions cover pending, error, redirecting,
and authorized states. Protected accounts must be active, email-verified, and
match any requested generic `USER`/`ADMIN` role.

## API

`createApp` is the composition boundary. It constructs the selected
`EmailDelivery`, then `EmailService`; the router constructs
`AuthService(database, emailService)`, controllers, and authentication
middleware. Authentication modules do not import provider clients or
singletons.

Security infrastructure is in `src/infrastructure/security`:

- `password-hasher.ts`: Argon2id hash/verify
- `token-hasher.ts`: SHA-256 token fingerprint
- `jwt.service.ts`: issue/verify purpose-bound access, refresh, verification,
  and reset JWTs

Auth DTOs use file-per-DTO modules. Auth rate-limit configuration is separate
from CSRF configuration. All API password DTOs use the fixed 15-to-128-character
schemas from `@template/contracts`; there is no API environment override. Role
authorization is a generic allowlist middleware.

Email verification consumes the normalized email, pending status, null
verification timestamp, token hash, and unexpired credential in one conditional
transaction. Exactly one concurrent request succeeds; reused tokens and tokens
replaced by resend fail, and the final response uses the safe-user projection.

Request validation uses `safeParseAsync`, aggregates body/query/params failures
with target-prefixed field paths, and stores parsed data on `req.validated`.
Only that boundary converts schema failures into operational 400 responses;
Zod errors raised by internal response or application schemas remain 500-class
server bugs.

The response helper uses `@template/contracts` types directly. Success always
has `data`; valid nested pagination is promoted to `paginationMeta`. Error
envelopes never contain `data: null`.

The Prisma mapper exposes only stable generic errors. Approved check-constraint
names are limited to the two User constraints. Raw messages, SQL, metadata,
database URLs, and provider secrets are never returned.

Request logging sanitizes credential values in `req.url`,
`req.originalUrl`, and query objects while retaining non-sensitive query
parameters. Header/body redaction continues to cover authorization, cookies,
the `x-csrf-token` header, passwords, tokens, SMTP/Resend credentials, database
URLs, and API keys. Email provider failure logs omit raw provider messages.
Tests exercise serialized Pino output and assert that credential fields contain
the redaction marker rather than their original values.

The development-only console email provider writes complete HTML previews to
the workspace-root, Git-ignored `.local-emails` directory, requesting owner-only
filesystem modes where supported, and logs only each preview path. Open the
newest `.html` file and click its verification or reset button. A failed
registration delivery triggers a guarded compensating delete of the newly
created pending user so the address can retry.

## Generic utilities

- `core/pagination`: decimal-digit-only query parsing, defaults, maximum
  limit, safe integer checks, skip/take, and contract pagination metadata
- `core/date-only.ts`: real `YYYY-MM-DD` calendar validation and UTC-safe
  parsing/serialization
- `core/serialization/decimal.ts`: canonical Decimal strings without
  two-decimal money rounding; deep handling for arrays/plain objects while
  preserving Date, nullish, primitives, and unrelated class instances

## Local and production HTTP topology

Local values use only `localhost`:

```dotenv
CORS_ORIGINS=http://localhost:3000
WEB_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
AUTH_COOKIE_SAME_SITE=lax
```

HTTP integration tests prove the exact allowed CORS origin, credentials,
preflight including requested authorization/content-type/CSRF headers, rejected
origins, refresh/CSRF cookies, missing/mismatched CSRF, missing refresh cookie,
request IDs, and real auth/profile/recovery flows.

Production uses the same origin with `/api/v1` routed to Express. Cookie
domain remains omitted. Unrelated registrable domains require a different
architecture and are intentionally unsupported.

The root Compose file provisions PostgreSQL only. The Caddyfile is a routing
template for separately deployed `api` and `web` services, not a complete or
verified one-command production stack.

## Tests

Unit suites cover contracts, transport/error parsing, single-flight refresh,
query retry policy (network and 500-504, at most twice), session restoration,
route guards, safe return paths/forms, security services, authorization, CSRF,
cookie options, delivery injection/failure propagation, logger sanitization,
Prisma mapping, seed behavior, and generic utilities.

Contracts production builds exclude test/spec TypeScript and TSX sources. The
root build-output assertion verifies required entry artifacts and rejects any
emitted test/spec JavaScript, declaration, or source-map artifact.

Database integration starts PostgreSQL 18, deploys the real migration, tests
constraints with direct SQL, validates schema inventory/cascade, and deploys a
second time.

API integration starts another disposable PostgreSQL 18 instance, deploys the
real migration, builds the actual Express app with fake email delivery, and
uses Supertest agents for cookies. Independent tests cover CORS, validation,
register/verify/login, safe JSON, refresh rotation/replay, CSRF failures,
users/me/profile, current-session logout, logout-all, password change, neutral
forgot-password, reset single-use, session revocation, and new-password login.
Verification coverage also proves that concurrent service and HTTP requests
produce exactly one success, reused/replaced tokens fail, and suspended users
remain suspended.

Logout, logout-all, password change, and password reset revoke refresh records,
not already-issued stateless access JWTs. An access JWT can therefore remain
usable until its short configured expiry (15 minutes by default); no blacklist
or other immediate-revocation store is included.

## Extension rules

1. Add cross-package contracts only when API and web both consume them.
2. Add a new migration after this initial baseline is released; do not rewrite
   applied production history.
3. Keep route/controller/service responsibilities within one API module.
4. Inject external services from the composition boundary.
5. Authorize close to protected data; browser guards are not security.
6. Add OpenAPI and tests with each endpoint.
7. Never store refresh tokens in JavaScript storage, expose Prisma users, log
   credentials or production links, or add domain-specific defaults to the
   template. Local console action links belong only in ignored preview files.
