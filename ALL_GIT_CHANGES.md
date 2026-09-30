# All Git Changes and Code

Generated on: 2026-08-21T08:39:13.287Z
Total items: 206

## Summary Table

| Category              | Count   |
| :-------------------- | :------ |
| Modified Files        | 40      |
| New / Untracked Files | 156     |
| Deleted Files         | 10      |
| **Total**             | **206** |

## Deleted Files List

- ❌ `apps/api/src/modules/demo/demo.controller.ts` _(Deleted from repository)_
- ❌ `apps/api/src/modules/demo/demo.routes.ts` _(Deleted from repository)_
- ❌ `apps/api/src/modules/demo/demo.service.ts` _(Deleted from repository)_
- ❌ `apps/api/src/modules/demo/demo.types.ts` _(Deleted from repository)_
- ❌ `apps/api/src/modules/demo/index.ts` _(Deleted from repository)_
- ❌ `apps/web/src/features/platform/components/connection-check.tsx` _(Deleted from repository)_
- ❌ `apps/web/src/features/platform/components/platform-overview.tsx` _(Deleted from repository)_
- ❌ `apps/web/src/services/api-client.ts` _(Deleted from repository)_
- ❌ `apps/web/src/services/api.ts` _(Deleted from repository)_
- ❌ `packages/database/prisma/migrations/20260802184330_init_demo_message/migration.sql` _(Deleted from repository)_

---

## File Contents

### [MODIFIED] `.env.example`

```env
NODE_ENV=development
APP_NAME=Full-Stack Boilerplate API
API_HOST=0.0.0.0
API_PORT=4000
API_PREFIX=/api/v1
CORS_ORIGINS=http://localhost:3000
DATABASE_URL=postgresql://boilerplate:local_development_only@localhost:5432/boilerplate?schema=public
LOG_LEVEL=debug
TRUST_PROXY=false
BODY_LIMIT=1mb
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=100
REQUEST_TIMEOUT_MS=30000
HEADERS_TIMEOUT_MS=31000
KEEP_ALIVE_TIMEOUT_MS=5000
SHUTDOWN_TIMEOUT_MS=10000
POSTGRES_USER=boilerplate
POSTGRES_PASSWORD=local_development_only
POSTGRES_DB=boilerplate
POSTGRES_PORT=5432

# Authentication. Replace every secret before deployment.
AUTH_JWT_SECRET=replace-with-at-least-32-characters-of-random-data
AUTH_REFRESH_JWT_SECRET=replace-with-a-separate-32-character-refresh-secret
AUTH_VERIFICATION_JWT_SECRET=replace-with-a-separate-32-character-verify-secret
AUTH_RESET_JWT_SECRET=replace-with-a-separate-32-character-reset-secret
AUTH_JWT_ISSUER=full-stack-boilerplate
AUTH_JWT_AUDIENCE=full-stack-boilerplate-web
AUTH_JWT_CLOCK_TOLERANCE_SECONDS=5
AUTH_ACCESS_TOKEN_TTL_SECONDS=900
AUTH_REFRESH_FAMILY_TTL_SECONDS=86400
AUTH_REFRESH_REMEMBERED_TTL_SECONDS=2592000
AUTH_VERIFY_TOKEN_TTL_SECONDS=86400
AUTH_RESET_TOKEN_TTL_SECONDS=1800
AUTH_VERIFY_RESEND_COOLDOWN_SECONDS=60
AUTH_ARGON2_MEMORY_KIB=19456
AUTH_ARGON2_TIME_COST=2
AUTH_ARGON2_PARALLELISM=1
AUTH_COOKIE_SAME_SITE=lax

# Authentication route limits.
AUTH_LIMIT_REGISTER_PER_HOUR=5
AUTH_LIMIT_VERIFY_PER_15_MIN=20
AUTH_LIMIT_VERIFY_TOKEN_MAX_ATTEMPTS=5
AUTH_LIMIT_RESEND_PER_HOUR_SOURCE=20
AUTH_LIMIT_RESEND_PER_HOUR_ACCOUNT=5
AUTH_LIMIT_LOGIN_PER_15_MIN=20
AUTH_LIMIT_LOGIN_PER_15_MIN_ACCOUNT=5
AUTH_LIMIT_REFRESH_PER_15_MIN=60
AUTH_LIMIT_FORGOT_PER_HOUR_SOURCE=20
AUTH_LIMIT_FORGOT_PER_HOUR_ACCOUNT=5
AUTH_LIMIT_RESET_PER_15_MIN=20
AUTH_LIMIT_RESET_TOKEN_MAX_ATTEMPTS=5
AUTH_LIMIT_PASSWORD_CHANGE_PER_15_MIN=5
AUTH_LIMIT_LOGOUT_PER_15_MIN=30
AUTH_LIMIT_LOGOUT_ALL_PER_15_MIN=5

# Transactional email. Console is local-only; select Resend or SMTP in production.
EMAIL_PROVIDER=console
RESEND_API_KEY=
WEB_APP_URL=http://localhost:3000
MAIL_FROM_NAME=Full-Stack Boilerplate
MAIL_FROM_ADDRESS=no-reply@example.com
MAIL_REPLY_TO=
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_ALLOW_SELF_SIGNED_TLS=false
SMTP_CONNECTION_TIMEOUT_MS=10000
SMTP_GREETING_TIMEOUT_MS=10000
SMTP_SOCKET_TIMEOUT_MS=15000
SMTP_TLS_MIN_VERSION=TLSv1.2

# Optional local-only administrator seed. Set all three together.
# SEED_ADMIN_EMAIL=admin@example.com
# SEED_ADMIN_NAME=Local Administrator
# SEED_ADMIN_PASSWORD=

# Optional local-only user seed. Set all three together.
# SEED_USER_EMAIL=user@example.com
# SEED_USER_NAME=Local User
# SEED_USER_PASSWORD=
```

### [MODIFIED] `.gitignore`

```
# Dependencies
node_modules/
.pnpm-store/

# Turborepo
.turbo/

# Build outputs
.next/
out/
dist/
build/
coverage/
packages/database/src/generated/prisma/
apps/web/next-env.d.ts

# Environment variables
.env
.env.*
!.env.example
!**/.env.example

# Logs
*.log
.local-emails/
npm-debug.log*
pnpm-debug.log*
yarn-debug.log*
yarn-error.log*

# TypeScript
*.tsbuildinfo

# Deployment
.vercel/

# IDEs
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
.idea/

# Local read-only implementation reference
tas3er-pro/

# Operating systems
.DS_Store
Thumbs.db
```

### [MODIFIED] `.prettierignore`

```
node_modules/
.turbo/
.next/
dist/
coverage/
packages/database/src/generated/prisma/
packages/database/prisma/migrations/
pnpm-lock.yaml
apps/web/next-env.d.ts
apps/web/AGENTS.md
tas3er-pro/
```

### [MODIFIED] `PROJECT_REFERENCE.md`

````markdown
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
````

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
Refresh failure clears memory and performs a safe full navigation without
credential-bearing return parameters.

`src/app/providers.tsx` contains only `QueryClientProvider`.
`AUTH_SESSION_QUERY_KEY` is the sole session cache. A missing access token
attempts refresh; only `400/BAD_REQUEST` and `401/UNAUTHORIZED` refresh
responses mean anonymous. Expected `400`/`401` current-user responses are also
normalized to anonymous after clearing the in-memory token. Unexpected failures
are rendered with retry and request ID.

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

The development-only console email provider writes the exact verification or
reset action link to a Git-ignored `.local-emails` preview file, requesting
owner-only filesystem modes where supported, and logs only its path. A failed
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

Database integration starts PostgreSQL 18, deploys the real migration, tests
constraints with direct SQL, validates schema inventory/cascade, and deploys a
second time.

API integration starts another disposable PostgreSQL 18 instance, deploys the
real migration, builds the actual Express app with fake email delivery, and
uses Supertest agents for cookies. Independent tests cover CORS, validation,
register/verify/login, safe JSON, refresh rotation/replay, CSRF failures,
users/me/profile, current-session logout, logout-all, password change, neutral
forgot-password, reset single-use, session revocation, and new-password login.

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

````

### [MODIFIED] `README.md`

```markdown
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
````

PowerShell:

```powershell
pnpm install --frozen-lockfile
Copy-Item .env.example .env
Copy-Item apps/web/.env.example apps/web/.env.local
```

Replace every `AUTH_*_SECRET` placeholder in `.env` with an independent
random value of at least 32 characters. Development and tests default to
`EMAIL_PROVIDER=console`, which saves each verification or reset action link in
a Git-ignored `.local-emails` preview file, requesting owner-only filesystem
modes where the platform supports them, without making a provider network call.
The API log reports the preview file path, not the link or token.

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
refresh. React Query owns the current safe-user session and unexpected restore
failures remain visible and retryable.

Logout revokes the current refresh record. Logout-all, password change, and
password reset revoke every refresh record. Refresh and reset tokens are
single-use. These operations cannot immediately revoke an already issued,
stateless access JWT: it remains usable until its short configured expiry (15
minutes by default). The boilerplate intentionally has no token blacklist.

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
integration stage.

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
```

See [PROJECT_REFERENCE.md](./PROJECT_REFERENCE.md) for boundaries and extension
guidance.

````

### [MODIFIED] `apps/api/eslint.config.mjs`

```javascript
import { createNodeConfig } from "@template/eslint-config/node";

export default createNodeConfig({
  tsconfigRootDir: import.meta.dirname,
  allowDefaultProject: [
    "vitest.config.ts",
    "vitest.integration.config.ts",
    "vitest.setup.ts",
  ],
});
````

### [MODIFIED] `apps/api/package.json`

```json
{
  "name": "@template/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --conditions=development --import tsx --watch src/server.ts",
    "clean": "rimraf dist node_modules/.cache/tsconfig.build.tsbuildinfo",
    "build": "pnpm clean && tsc -p tsconfig.build.json",
    "start": "node --enable-source-maps dist/server.js",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "check-types": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:watch": "vitest --config vitest.config.ts"
  },
  "dependencies": {
    "@template/contracts": "workspace:*",
    "@template/database": "workspace:*",
    "argon2": "0.45.1",
    "compression": "1.8.1",
    "cookie-parser": "1.4.7",
    "cors": "2.8.6",
    "dotenv": "17.4.2",
    "express": "5.2.1",
    "express-rate-limit": "8.6.1",
    "helmet": "8.3.0",
    "jsonwebtoken": "9.0.3",
    "nodemailer": "9.0.4",
    "pino": "10.3.1",
    "pino-http": "11.0.0",
    "resend": "6.20.0",
    "zod": "4.4.3",
    "zod-openapi": "6.0.0"
  },
  "devDependencies": {
    "@template/eslint-config": "workspace:*",
    "@template/typescript-config": "workspace:*",
    "@testcontainers/postgresql": "12.1.0",
    "@types/compression": "1.8.1",
    "@types/cookie-parser": "1.4.10",
    "@types/cors": "2.8.19",
    "@types/express": "5.0.6",
    "@types/jsonwebtoken": "9.0.10",
    "@types/node": "24.13.3",
    "@types/nodemailer": "8.0.1",
    "@types/supertest": "6.0.3",
    "eslint": "9.39.1",
    "pino-pretty": "13.1.3",
    "rimraf": "6.1.3",
    "supertest": "7.1.4",
    "tsx": "4.23.1",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  },
  "engines": {
    "node": ">=24 <25"
  }
}
```

### [MODIFIED] `apps/api/src/app.ts`

```typescript
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import type { CorsOptions } from "cors";
import type { Logger } from "pino";

import type { DatabaseClient } from "@template/database";

import { appConfig } from "./core/config/app.config.js";
import { corsConfig } from "./core/config/cors.config.js";
import { ForbiddenException } from "./core/errors/forbidden.error.js";
import {
  createEmailDelivery,
  EmailService,
  type EmailDelivery,
} from "./infrastructure/email/index.js";
import {
  apiRateLimitMiddleware,
  createRequestLoggerMiddleware,
  errorHandler,
  notFound,
  requestId,
} from "./middlewares/index.js";
import { createApiRouter } from "./router.js";

type AppDependencies = Readonly<{
  database: DatabaseClient;
  logger: Logger;
  emailDelivery?: EmailDelivery;
}>;

const buildCorsOriginValidator = (): CorsOptions["origin"] => {
  const allowedOrigins = new Set(corsConfig.allowedOrigins);

  return (origin, callback) => {
    if (origin === undefined || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new ForbiddenException("Origin is not allowed by CORS."));
  };
};

export const createApp = ({
  database,
  logger,
  emailDelivery = createEmailDelivery(),
}: AppDependencies): Application => {
  const app = express();

  app.disable("x-powered-by");
  app.set("json escape", true);
  app.set("trust proxy", appConfig.trustProxy);

  const corsOptions: CorsOptions = {
    origin: buildCorsOriginValidator(),
    credentials: corsConfig.credentials,
  };

  // Global middleware
  app.use(requestId);
  app.use(createRequestLoggerMiddleware(logger));
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(cookieParser());
  app.use(compression());
  app.use(express.json({ limit: appConfig.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: appConfig.bodyLimit }));

  // API routes
  app.use(
    appConfig.apiPrefix,
    apiRateLimitMiddleware,
    createApiRouter(database, new EmailService(emailDelivery)),
  );

  // Final middleware
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
```

### [MODIFIED] `apps/api/src/core/config/index.ts`

```typescript
export { appConfig } from "./app.config.js";
export { authRouteLimits } from "./auth-rate-limit.config.js";
export { authConfig, jwtConfig } from "./auth.config.js";
export { cookieConfig } from "./cookie.config.js";
export { corsConfig } from "./cors.config.js";
export { csrfConfig } from "./csrf.config.js";
export { databaseConfig } from "./database.config.js";
export {
  emailConfig,
  parseEmailProvider,
  parseSmtpTlsMinVersion,
} from "./email.config.js";
export type { EmailProvider, SmtpTlsMinVersion } from "./email.config.js";
export {
  getEnvVarAsBoolean,
  getEnvVarAsInteger,
  getEnvVarAsNumber,
  getEnvVariable,
} from "./env.js";
export { loggerConfig } from "./logger.config.js";
export { getSmtpTransporter } from "./mailer.config.js";
export type { SmtpTransporter } from "./mailer.config.js";
export { rateLimitConfig } from "./rate-limit.config.js";
```

### [MODIFIED] `apps/api/src/core/responses/api-response.ts`

```typescript
import type { Response } from "express";

import {
  paginationMetaSchema,
  type PaginationMeta,
  type SuccessEnvelope,
} from "@template/contracts";

import { HTTP_STATUS } from "../constants/http-status.constants.js";

export type { FieldError, PaginationMeta } from "@template/contracts";

/* eslint-disable @typescript-eslint/no-extraneous-class, @typescript-eslint/no-unnecessary-type-parameters -- Static generic response helpers are the API response convention. */

const readPaginationMeta = (data: unknown): PaginationMeta | undefined => {
  if (
    data === null ||
    typeof data !== "object" ||
    Array.isArray(data) ||
    !("pagination" in data)
  ) {
    return undefined;
  }
  const pagination = (data as { pagination?: unknown }).pagination;
  return pagination === undefined
    ? undefined
    : paginationMetaSchema.parse(pagination);
};

export class ResponseHelper {
  static success<T>(
    response: Response,
    data: T,
    message: string,
    statusCode: number,
    path: string,
    requestId: string,
  ): Response {
    const paginationMeta = readPaginationMeta(data);
    const payload: SuccessEnvelope<T> = {
      success: true,
      message,
      statusCode,
      data,
      ...(paginationMeta === undefined ? {} : { paginationMeta }),
      requestId,
      timestamp: new Date().toISOString(),
      path,
    };
    return response.status(statusCode).json(payload);
  }

  static created<T>(
    response: Response,
    data: T,
    message: string,
    path: string,
    requestId: string,
  ): Response {
    return this.success(
      response,
      data,
      message,
      HTTP_STATUS.CREATED,
      path,
      requestId,
    );
  }

  static ok<T>(
    response: Response,
    data: T,
    message: string,
    path: string,
    requestId: string,
  ): Response {
    return this.success(
      response,
      data,
      message,
      HTTP_STATUS.OK,
      path,
      requestId,
    );
  }
}

export default ResponseHelper;
```

### [MODIFIED] `apps/api/src/core/responses/index.ts`

```typescript
export { ResponseHelper } from "./api-response.js";
export type {
  ErrorEnvelope as ErrorResponse,
  FieldError,
  PaginationMeta,
  SuccessEnvelope as HTTPResponse,
} from "@template/contracts";
```

### [MODIFIED] `apps/api/src/core/types/request-context.types.ts`

```typescript
import type { SafeUser } from "@template/contracts";

export type AuthenticatedUser = SafeUser;

export interface ValidatedRequestData {
  body?: unknown;
  params?: unknown;
  query?: unknown;
}
```

### [MODIFIED] `apps/api/src/infrastructure/logger/index.ts`

```typescript
export { createLogger, logger } from "./logger.js";
export {
  sanitizeRequestForLog,
  sanitizeRequestQuery,
  sanitizeRequestUrl,
} from "./request-sanitizer.js";
```

### [MODIFIED] `apps/api/src/infrastructure/logger/logger.ts`

```typescript
import pino, { type Logger } from "pino";

import { appConfig } from "../../core/config/app.config.js";
import { loggerConfig } from "../../core/config/logger.config.js";

export const LOGGER_REDACT_PATHS = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-csrf-token']",
  "req.body.password",
  "req.body.passwordConfirmation",
  "req.body.token",
  "req.body.newPassword",
  "req.body.currentPassword",
  "res.headers['set-cookie']",
  "*.password",
  "*.passwordConfirmation",
  "*.currentPassword",
  "*.newPassword",
  "*.accessToken",
  "*.refreshToken",
  "*.resetToken",
  "*.csrfToken",
  "*.secret",
  "*.apiKey",
  "*.databaseUrl",
  "*.smtpPassword",
  "*.resendApiKey",
  "*.verificationToken",
  "*.cookie",
  "*.cookies",
  "password",
  "token",
  "accessToken",
  "refreshToken",
  "resetToken",
  "csrfToken",
  "verificationToken",
  "SMTP_PASSWORD",
  "RESEND_API_KEY",
  "DATABASE_URL",
  "API_KEY",
] as const;

export const createLogger = (): Logger =>
  pino({
    level: loggerConfig.level,
    redact: { paths: [...LOGGER_REDACT_PATHS], censor: "[REDACTED]" },
    ...(appConfig.isDevelopment
      ? {
          transport: {
            target: "pino-pretty",
            options: { colorize: true, singleLine: true },
          },
        }
      : {}),
  });

export const logger = createLogger();
```

### [MODIFIED] `apps/api/src/middlewares/error-handler.middleware.ts`

```typescript
import type { ErrorRequestHandler } from "express";

import type { ErrorEnvelope } from "@template/contracts";

import { appConfig } from "../core/config/app.config.js";
import { AppError } from "../core/errors/app.error.js";
import { InternalServerError } from "../core/errors/internal-server.error.js";
import { mapPrismaError } from "../infrastructure/database/prisma-error.mapper.js";

const createErrorResponse = (
  error: AppError,
  path: string,
  requestId: string,
): ErrorEnvelope => ({
  success: false,
  statusCode: error.statusCode,
  code: error.code,
  message: error.message,
  errors: error.errors?.length === 0 ? undefined : error.errors,
  ...(appConfig.isDevelopment ? { stack: error.stack } : {}),
  requestId,
  timestamp: error.timestamp,
  path,
});

export const errorHandlerMiddleware: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else {
    appError = mapPrismaError(error);
    if (appError instanceof InternalServerError) {
      const fallback = new InternalServerError();
      if (error instanceof Error && error.stack !== undefined) {
        fallback.stack = error.stack;
      }
      appError = fallback;
    }
  }

  const logContext = {
    code: appError.code,
    requestId: request.requestId,
    statusCode: appError.statusCode,
    ...(appError.isOperational ? {} : { err: error }),
  };

  if (appError.isOperational) {
    request.log.warn(logContext, appError.message);
  } else {
    request.log.error(logContext, appError.message);
  }

  return response
    .status(appError.statusCode)
    .json(createErrorResponse(appError, request.path, request.requestId));
};

export const errorHandler = errorHandlerMiddleware;
```

### [MODIFIED] `apps/api/src/middlewares/index.ts`

```typescript
export {
  errorHandler,
  errorHandlerMiddleware,
} from "./error-handler.middleware.js";
export { notFound, notFoundMiddleware } from "./not-found.middleware.js";
export {
  apiRateLimitMiddleware,
  createKeyedAuthRateLimiter,
  createSourceRateLimiter,
} from "./rate-limit.middleware.js";
export { requestId, requestIdMiddleware } from "./request-id.middleware.js";
export { createRequestLoggerMiddleware } from "./request-logger.middleware.js";
export {
  validateRequest,
  validationMiddleware,
} from "./validation.middleware.js";
export { createAuthenticationMiddleware } from "./auth.middleware.js";
export { authorizeRoles } from "./authorization.middleware.js";
export {
  createCsrfMiddlewareWhenCookiePresent,
  csrfMiddleware,
} from "./csrf.middleware.js";
```

### [MODIFIED] `apps/api/src/middlewares/rate-limit.middleware.ts`

```typescript
import { rateLimit } from "express-rate-limit";
import type { NextFunction, Request, Response } from "express";

import type { AuthRouteLimit } from "../core/config/auth-rate-limit.config.js";
import { rateLimitConfig } from "../core/config/rate-limit.config.js";
import { TooManyRequestsException } from "../core/errors/too-many-requests.error.js";

const rateLimitHandler = (
  _request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  next(new TooManyRequestsException());
};

export const apiRateLimitMiddleware = rateLimit({
  windowMs: rateLimitConfig.windowMs,
  limit: rateLimitConfig.maxRequests,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  handler: rateLimitHandler,
});

export const createSourceRateLimiter = (config: AuthRouteLimit) =>
  rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: rateLimitHandler,
  });

export const createKeyedAuthRateLimiter = (
  config: AuthRouteLimit,
  keyBuilder: (request: Request) => string,
) =>
  rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    keyGenerator: (request) => `auth:${config.name}:${keyBuilder(request)}`,
    handler: rateLimitHandler,
  });
```

### [MODIFIED] `apps/api/src/middlewares/request-logger.middleware.ts`

```typescript
import { pinoHttp } from "pino-http";
import type { Request } from "express";
import type { Logger } from "pino";

import { sanitizeRequestForLog } from "../infrastructure/logger/request-sanitizer.js";

export const createRequestLoggerMiddleware = (logger: Logger) =>
  pinoHttp({
    logger,
    serializers: {
      req: (request) =>
        sanitizeRequestForLog(request as Record<string, unknown>),
    },
    genReqId: (request) => (request as Request).requestId,
    customProps: (request) => {
      const expressRequest = request as Request;

      return {
        requestId: expressRequest.requestId,
        userId: expressRequest.user?.id,
      };
    },
  });
```

### [MODIFIED] `apps/api/src/middlewares/validation.middleware.ts`

```typescript
import type { RequestHandler } from "express";
import type { z } from "zod";

import { ValidationException } from "../core/errors/validation.error.js";
import type { FieldError } from "../core/responses/api-response.js";

type RequestSchemas = Readonly<{
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}>;

type RequestTarget = keyof RequestSchemas;
type ParseResult =
  | Readonly<{ kind: "missing" }>
  | Readonly<{ kind: "valid"; data: unknown }>
  | Readonly<{ kind: "invalid"; errors: FieldError[] }>;

const formatIssuePath = (
  target: RequestTarget,
  path: readonly PropertyKey[],
): string => {
  const parts = path.map(String);
  return [target, ...(parts[0] === target ? parts.slice(1) : parts)].join(".");
};

export const formatValidationErrors = (
  target: RequestTarget,
  issues: readonly z.core.$ZodIssue[],
): FieldError[] =>
  issues.map((issue) => ({
    field: formatIssuePath(target, issue.path),
    message: issue.message,
  }));

const parseTarget = async (
  target: RequestTarget,
  schema: z.ZodType | undefined,
  value: unknown,
): Promise<ParseResult> => {
  if (schema === undefined) return { kind: "missing" };
  const result = await schema.safeParseAsync(value);
  return result.success
    ? { kind: "valid", data: result.data }
    : {
        kind: "invalid",
        errors: formatValidationErrors(target, result.error.issues),
      };
};

export const validationMiddleware =
  (schemas: RequestSchemas): RequestHandler =>
  async (request, _response, next) => {
    const [body, params, query] = await Promise.all([
      parseTarget("body", schemas.body, request.body),
      parseTarget("params", schemas.params, request.params),
      parseTarget("query", schemas.query, request.query),
    ]);

    const errors = [body, params, query].flatMap((result) =>
      result.kind === "invalid" ? result.errors : [],
    );
    if (errors.length > 0) throw new ValidationException(errors);

    request.validated = {
      ...request.validated,
      ...(body.kind === "valid" ? { body: body.data } : {}),
      ...(params.kind === "valid" ? { params: params.data } : {}),
      ...(query.kind === "valid" ? { query: query.data } : {}),
    };
    if (body.kind === "valid") request.body = body.data;
    if (params.kind === "valid") {
      request.params = params.data as typeof request.params;
    }
    next();
  };

export const validateRequest = validationMiddleware;
```

### [MODIFIED] `apps/api/src/modules/index.ts`

```typescript
export { AuthController, authRoutes, AuthService } from "./auth/index.js";
export {
  HealthController,
  healthRoutes,
  HealthService,
  type HealthResult,
} from "./health/index.js";
export { UsersController, usersRoutes, UsersService } from "./users/index.js";
```

### [MODIFIED] `apps/api/src/router.ts`

```typescript
import { Router } from "express";

import type { DatabaseClient } from "@template/database";

import { openApiRoutes } from "./infrastructure/openapi/openapi.routes.js";
import type { EmailService } from "./infrastructure/email/email.service.js";
import { createAuthenticationMiddleware } from "./middlewares/auth.middleware.js";
import {
  AuthController,
  authRoutes,
  AuthService,
  HealthController,
  healthRoutes,
  HealthService,
  UsersController,
  usersRoutes,
  UsersService,
} from "./modules/index.js";

export const createApiRouter = (
  database: DatabaseClient,
  emailService: EmailService,
): Router => {
  const router = Router();

  const healthService = new HealthService(database);
  const healthController = new HealthController(healthService);
  const authenticationMiddleware = createAuthenticationMiddleware(database);
  const authController = new AuthController(
    new AuthService(database, emailService),
  );
  const usersController = new UsersController(new UsersService(database));

  router.use(openApiRoutes());
  router.use("/auth", authRoutes(authController, authenticationMiddleware));
  router.use("/users", usersRoutes(usersController, authenticationMiddleware));
  router.use("/health", healthRoutes(healthController));

  return router;
};
```

### [MODIFIED] `apps/api/tsconfig.json`

```json
{
  "extends": "@template/typescript-config/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage", "tests"]
}
```

### [MODIFIED] `apps/web/eslint.config.mjs`

```javascript
import { createNextConfig } from "@template/eslint-config/next";

export default createNextConfig({
  tsconfigRootDir: import.meta.dirname,
  allowDefaultProject: ["vitest.config.ts"],
});
```

### [MODIFIED] `apps/web/next.config.ts`

```typescript
import path from "node:path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  typedRoutes: true,
  reactCompiler: true,
  transpilePackages: ["@template/contracts"],
  turbopack: {
    root: path.resolve(import.meta.dirname, "../.."),
  },
};

export default nextConfig;
```

### [MODIFIED] `apps/web/package.json`

```json
{
  "name": "@template/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "check-types": "tsc --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:watch": "vitest --config vitest.config.ts"
  },
  "dependencies": {
    "@hookform/resolvers": "5.7.1",
    "@tanstack/react-query": "5.101.4",
    "@template/contracts": "workspace:*",
    "axios": "1.19.0",
    "next": "16.2.12",
    "react": "19.2.8",
    "react-dom": "19.2.8",
    "react-hook-form": "7.84.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@template/eslint-config": "workspace:*",
    "@template/typescript-config": "workspace:*",
    "@tailwindcss/postcss": "4.3.3",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@types/node": "24.13.3",
    "@types/react": "19.2.18",
    "@types/react-dom": "19.2.4",
    "babel-plugin-react-compiler": "1.0.0",
    "eslint": "9.39.1",
    "jsdom": "30.0.1",
    "tailwindcss": "4.3.3",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  },
  "engines": {
    "node": ">=24 <25"
  }
}
```

### [MODIFIED] `apps/web/src/app/layout.tsx`

```tsx
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/app/providers";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: {
    default: "Relay — Full-stack TypeScript starter",
    template: "%s | Relay",
  },
  description:
    "An authentication-ready Next.js, Express, and PostgreSQL TypeScript foundation.",
};

type RootLayoutProps = Readonly<{ children: ReactNode }>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

### [MODIFIED] `apps/web/src/app/not-found.tsx`

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="state-page">
      <p className="eyebrow">404 / Not found</p>
      <h1>This route does not exist.</h1>
      <Link href="/">Return to Relay</Link>
    </main>
  );
}
```

### [MODIFIED] `apps/web/src/app/page.tsx`

```tsx
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
```

### [MODIFIED] `apps/web/src/config/public-environment.ts`

```typescript
import { z } from "zod";

const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

const result = publicEnvironmentSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!result.success) {
  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  throw new Error(`Invalid public environment: ${JSON.stringify(issues)}`);
}

export const publicEnvironment = Object.freeze(result.data);
```

### [MODIFIED] `apps/web/src/styles/globals.css`

```css
@import "tailwindcss";

:root {
  color-scheme: light;
  --ink: #12201d;
  --ink-soft: #38504a;
  --paper: #eff4f2;
  --surface: #ffffff;
  --wash: #dfeae6;
  --line: #cad7d3;
  --green: #176b61;
  --green-dark: #0d4b44;
  --green-pale: #d8ebe6;
  --coral: #ef6a52;
  --coral-pale: #fde8e3;
  --danger: #ad3729;
  --display: "Trebuchet MS", "Aptos Display", sans-serif;
  --body: "Segoe UI Variable", "Segoe UI", sans-serif;
  --mono: "Cascadia Code", "SFMono-Regular", Consolas, monospace;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 20rem;
  min-height: 100%;
  background: var(--paper);
}

body {
  min-height: 100vh;
  margin: 0;
  color: var(--ink);
  background: var(--paper);
  font-family: var(--body);
}

button,
input,
textarea,
select {
  font: inherit;
}

button,
a {
  -webkit-tap-highlight-color: transparent;
}

a {
  color: inherit;
  text-underline-offset: 0.25em;
}

h1,
h2,
h3,
p {
  margin-block-start: 0;
}

h1,
h2,
h3 {
  font-family: var(--display);
}

button:focus-visible,
a:focus-visible,
input:focus-visible {
  outline: 3px solid rgb(239 106 82 / 35%);
  outline-offset: 3px;
}

.eyebrow {
  margin: 0 0 0.85rem;
  color: var(--green);
  font-family: var(--mono);
  font-size: 0.69rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.brand-mark {
  display: inline-flex;
  gap: 0.75rem;
  align-items: center;
  width: fit-content;
  color: var(--ink);
  text-decoration: none;
}

.brand-mark__glyph {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 1px solid var(--ink);
  border-radius: 50%;
  color: var(--green);
  font-family: var(--display);
  font-weight: 900;
  letter-spacing: -0.08em;
}

.brand-mark > span:last-child {
  display: grid;
  line-height: 1.05;
}

.brand-mark strong {
  font-family: var(--display);
  font-size: 1rem;
}

.brand-mark small {
  margin-top: 0.2rem;
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.button {
  display: inline-flex;
  min-height: 3rem;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--green);
  border-radius: 0.35rem;
  padding: 0.75rem 1.15rem;
  color: #ffffff;
  background: var(--green);
  box-shadow: 0 0.35rem 0 var(--green-dark);
  cursor: pointer;
  font-weight: 750;
  text-decoration: none;
  transition:
    translate 150ms ease,
    box-shadow 150ms ease,
    background-color 150ms ease;
}

.button:hover:not(:disabled) {
  background: var(--green-dark);
  translate: 0 0.1rem;
  box-shadow: 0 0.25rem 0 #073b35;
}

.button:active:not(:disabled) {
  translate: 0 0.25rem;
  box-shadow: 0 0.05rem 0 var(--green-dark);
}

.button:disabled {
  cursor: wait;
  opacity: 0.6;
}

.button--small {
  min-height: 2.6rem;
  padding: 0.55rem 0.9rem;
}

.button--full {
  width: 100%;
}

.button--ghost {
  border-color: var(--line);
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 0.35rem 0 var(--line);
}

.button--ghost:hover:not(:disabled) {
  color: var(--surface);
  background: var(--ink);
  box-shadow: 0 0.25rem 0 #06100e;
}

.button--danger {
  border-color: var(--danger);
  background: var(--danger);
  box-shadow: 0 0.35rem 0 #752118;
}

.text-link {
  color: var(--green);
  font-weight: 750;
}

/* Landing */

.landing {
  overflow: hidden;
  min-height: 100vh;
  background:
    linear-gradient(
      90deg,
      transparent 49.95%,
      rgb(18 32 29 / 5%) 50%,
      transparent 50.05%
    ),
    var(--paper);
}

.landing__nav,
.landing__hero,
.capability-strip,
.landing__footer {
  width: min(75rem, calc(100% - 3rem));
  margin-inline: auto;
}

.landing__nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  padding-block: 1.25rem;
}

.landing__nav-actions,
.landing__actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.landing__hero {
  display: grid;
  min-height: 41rem;
  grid-template-columns: 1.15fr 0.85fr;
  gap: clamp(3rem, 8vw, 8rem);
  align-items: center;
  padding-block: clamp(4rem, 9vw, 8rem);
}

.landing__copy h1 {
  max-width: 10ch;
  margin-bottom: 1.7rem;
  font-size: clamp(3.8rem, 8vw, 7.4rem);
  line-height: 0.86;
  letter-spacing: -0.075em;
}

.landing__lede {
  max-width: 42rem;
  margin-bottom: 2.2rem;
  color: var(--ink-soft);
  font-size: clamp(1.05rem, 2vw, 1.35rem);
  line-height: 1.55;
}

.landing__trace {
  position: relative;
  padding: 2rem;
}

.landing__trace::before {
  position: absolute;
  z-index: 0;
  inset: -10% -25%;
  border: 1px solid rgb(23 107 97 / 15%);
  border-radius: 50%;
  content: "";
  rotate: -8deg;
}

.trace-caption {
  position: relative;
  margin-bottom: 1rem;
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 0.68rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.protocol-trace {
  position: relative;
  z-index: 1;
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.protocol-trace li {
  position: relative;
  display: grid;
  min-height: 6.8rem;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  align-items: start;
}

.protocol-trace__node {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  border: 1px solid var(--green);
  border-radius: 50%;
  color: var(--green);
  background: var(--paper);
  font-family: var(--mono);
  font-size: 0.7rem;
  font-weight: 800;
}

.protocol-trace li > div {
  display: grid;
  gap: 0.35rem;
  padding-top: 0.35rem;
}

.protocol-trace strong {
  font-family: var(--display);
  font-size: 1.15rem;
}

.protocol-trace small {
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 0.67rem;
}

.protocol-trace__pulse {
  position: absolute;
  top: 3.35rem;
  bottom: 0;
  left: 1.61rem;
  width: 1px;
  overflow: hidden;
  background: var(--line);
}

.protocol-trace__pulse::after {
  position: absolute;
  top: -40%;
  left: 0;
  width: 1px;
  height: 35%;
  background: var(--coral);
  content: "";
  animation: trace-pulse 2.8s ease-in-out infinite;
}

@keyframes trace-pulse {
  to {
    top: 110%;
  }
}

.capability-strip {
  display: grid;
  grid-template-columns: 0.7fr 1.3fr;
  gap: clamp(3rem, 8vw, 8rem);
  border-top: 1px solid var(--line);
  padding-block: clamp(4rem, 8vw, 7rem);
}

.capability-strip header h2 {
  max-width: 13ch;
  font-size: clamp(2rem, 4vw, 3.5rem);
  line-height: 1;
  letter-spacing: -0.045em;
}

.capability-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.capability-list li {
  display: grid;
  grid-template-columns: 3rem 0.6fr 1fr;
  gap: 1rem;
  border-top: 1px solid var(--line);
  padding-block: 1.5rem;
}

.capability-list li:last-child {
  border-bottom: 1px solid var(--line);
}

.capability-list span {
  color: var(--coral);
  font-family: var(--mono);
  font-size: 0.7rem;
}

.capability-list h3 {
  margin: 0;
  font-size: 1.05rem;
}

.capability-list p {
  margin: 0;
  color: var(--ink-soft);
  line-height: 1.55;
}

.landing__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid var(--line);
  padding-block: 1.5rem 2.5rem;
}

.landing__footer p {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.85rem;
}

/* Authentication */

.auth-shell {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(22rem, 0.8fr) minmax(31rem, 1.2fr);
}

.auth-shell__context {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: clamp(1.5rem, 4vw, 3.5rem);
  color: var(--paper);
  background:
    radial-gradient(
      circle at 90% 18%,
      rgb(239 106 82 / 24%),
      transparent 20rem
    ),
    var(--ink);
}

.auth-shell__context .brand-mark {
  color: var(--paper);
}

.auth-shell__context .brand-mark__glyph {
  border-color: var(--paper);
  color: #71c2b6;
}

.auth-shell__context .brand-mark small,
.auth-shell__context .protocol-trace small,
.auth-shell__aside-note {
  color: #b8c8c4;
}

.auth-shell__context .eyebrow {
  color: #71c2b6;
}

.auth-shell__context-copy {
  width: min(100%, 29rem);
  margin-block: 5rem;
}

.auth-shell__context-copy h2 {
  margin-bottom: 3.5rem;
  font-size: clamp(2.6rem, 5vw, 4.8rem);
  line-height: 0.92;
  letter-spacing: -0.055em;
}

.auth-shell__context .protocol-trace__node {
  border-color: #71c2b6;
  color: #71c2b6;
  background: var(--ink);
}

.auth-shell__context .protocol-trace__pulse {
  background: #38504a;
}

.auth-shell__aside-note {
  max-width: 30rem;
  margin: 0;
  font-family: var(--mono);
  font-size: 0.67rem;
  line-height: 1.6;
}

.auth-shell__form {
  display: grid;
  place-items: center;
  padding: clamp(2rem, 6vw, 6rem);
  background:
    linear-gradient(rgb(23 107 97 / 5%) 1px, transparent 1px),
    linear-gradient(90deg, rgb(23 107 97 / 5%) 1px, transparent 1px),
    var(--paper);
  background-size: 3rem 3rem;
}

.auth-card {
  width: min(100%, 32rem);
  border: 1px solid var(--line);
  padding: clamp(1.5rem, 5vw, 3.5rem);
  background: rgb(255 255 255 / 92%);
  box-shadow: 0.8rem 0.8rem 0 rgb(23 107 97 / 8%);
}

.auth-card > h1 {
  max-width: 12ch;
  margin-bottom: 1rem;
  font-size: clamp(2.6rem, 5vw, 4.2rem);
  line-height: 0.94;
  letter-spacing: -0.055em;
}

.auth-card__summary {
  margin-bottom: 2rem;
  color: var(--ink-soft);
  line-height: 1.6;
}

.auth-form,
.settings-form__fields {
  display: grid;
  gap: 1.15rem;
}

.form-field {
  display: grid;
  gap: 0.45rem;
  color: var(--ink);
  font-size: 0.83rem;
  font-weight: 700;
}

.form-field input {
  width: 100%;
  min-height: 3rem;
  border: 1px solid var(--line);
  border-radius: 0.2rem;
  padding: 0.7rem 0.8rem;
  color: var(--ink);
  background: var(--surface);
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;
}

.form-field input:hover:not(:disabled) {
  border-color: #93aaa4;
}

.form-field input:focus {
  border-color: var(--green);
  box-shadow: 0 0 0 3px rgb(23 107 97 / 10%);
  outline: none;
}

.form-field input:disabled {
  color: var(--ink-soft);
  background: var(--wash);
}

.form-field small {
  color: var(--ink-soft);
  font-size: 0.72rem;
  font-weight: 450;
}

.form-field__error {
  color: var(--danger) !important;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.8rem;
}

.form-row a,
.auth-form__footer a {
  color: var(--green);
  font-weight: 700;
}

.check-field {
  display: inline-flex;
  gap: 0.55rem;
  align-items: center;
  cursor: pointer;
}

.check-field input {
  width: 1rem;
  height: 1rem;
  accent-color: var(--green);
}

.form-notice {
  margin: 0;
  border-left: 3px solid var(--green);
  padding: 0.8rem 0.9rem;
  color: var(--ink-soft);
  background: var(--green-pale);
  font-size: 0.8rem;
  line-height: 1.5;
}

.form-notice--error {
  border-color: var(--coral);
  color: var(--danger);
  background: var(--coral-pale);
}

.auth-form__footer {
  margin: 0;
  color: var(--ink-soft);
  font-size: 0.82rem;
  text-align: center;
}

.success-panel {
  display: grid;
  gap: 1rem;
}

.success-panel__mark {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  place-items: center;
  border-radius: 50%;
  color: var(--green);
  background: var(--green-pale);
  font-size: 1.5rem;
}

.success-panel h2 {
  margin: 0;
  font-size: 2rem;
}

.success-panel p {
  color: var(--ink-soft);
  line-height: 1.6;
}

/* Protected workspace */

.workspace {
  min-height: 100vh;
  background:
    linear-gradient(
      90deg,
      transparent 49.95%,
      rgb(18 32 29 / 4%) 50%,
      transparent 50.05%
    ),
    var(--paper);
}

.workspace__header {
  display: grid;
  width: min(80rem, calc(100% - 3rem));
  grid-template-columns: 1fr auto 1fr;
  gap: 2rem;
  align-items: center;
  margin-inline: auto;
  border-bottom: 1px solid var(--line);
  padding-block: 1rem;
}

.workspace__header nav {
  display: flex;
  gap: 0.3rem;
  padding: 0.25rem;
  border-radius: 0.4rem;
  background: var(--wash);
}

.workspace__header nav a {
  border-radius: 0.25rem;
  padding: 0.55rem 0.85rem;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 700;
  text-decoration: none;
}

.workspace__header nav a[aria-current="page"] {
  color: var(--ink);
  background: var(--surface);
  box-shadow: 0 1px 0.4rem rgb(18 32 29 / 8%);
}

.workspace__identity {
  display: flex;
  gap: 0.65rem;
  align-items: center;
  justify-self: end;
}

.workspace__identity > span {
  display: grid;
  width: 2.25rem;
  height: 2.25rem;
  place-items: center;
  border-radius: 50%;
  color: var(--surface);
  background: var(--green);
  font-family: var(--display);
  font-weight: 800;
}

.workspace__identity > div {
  display: grid;
}

.workspace__identity strong {
  max-width: 10rem;
  overflow: hidden;
  font-size: 0.77rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.workspace__identity small {
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 0.58rem;
}

.workspace__identity button {
  border: 0;
  padding: 0.5rem;
  color: var(--ink-soft);
  background: transparent;
  cursor: pointer;
  font-size: 0.72rem;
  text-decoration: underline;
  text-underline-offset: 0.2rem;
}

.workspace-main {
  width: min(75rem, calc(100% - 3rem));
  margin-inline: auto;
  padding-block: clamp(3rem, 7vw, 6rem);
}

.workspace-title {
  display: flex;
  gap: 2rem;
  align-items: end;
  justify-content: space-between;
  margin-bottom: clamp(3rem, 6vw, 5rem);
}

.workspace-title h1 {
  max-width: 14ch;
  margin: 0;
  font-size: clamp(3rem, 7vw, 6rem);
  line-height: 0.9;
  letter-spacing: -0.065em;
}

.workspace-title__summary {
  max-width: 31rem;
  margin: 0;
  color: var(--ink-soft);
  line-height: 1.6;
}

.status-badge {
  display: inline-flex;
  gap: 0.55rem;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 999px;
  padding: 0.55rem 0.8rem;
  color: var(--green-dark);
  background: var(--surface);
  font-family: var(--mono);
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
}

.status-badge i {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 0 0.25rem var(--green-pale);
}

.session-board {
  display: grid;
  grid-template-columns: 0.85fr 1.15fr;
  gap: clamp(3rem, 8vw, 8rem);
  border: 1px solid var(--line);
  padding: clamp(1.5rem, 5vw, 3.5rem);
  background: var(--surface);
  box-shadow: 0.8rem 0.8rem 0 var(--green-pale);
}

.session-board__heading h2,
.workspace-card h2,
.settings-form h2,
.danger-panel h2 {
  margin-bottom: 1rem;
  font-size: clamp(1.8rem, 3vw, 2.5rem);
  line-height: 1;
  letter-spacing: -0.035em;
}

.session-board__heading > p:last-child,
.workspace-card > p:not(.eyebrow),
.settings-form__heading > p,
.danger-panel p {
  color: var(--ink-soft);
  line-height: 1.6;
}

.session-board ol {
  margin: 0;
  padding: 0;
  list-style: none;
}

.session-board li {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1rem;
  border-top: 1px solid var(--line);
  padding-block: 1.1rem;
}

.session-board li:last-child {
  border-bottom: 1px solid var(--line);
}

.session-board li > span {
  color: var(--coral);
  font-family: var(--mono);
  font-size: 0.65rem;
}

.session-board li > div {
  display: grid;
  gap: 0.3rem;
}

.session-board li small {
  color: var(--ink-soft);
}

.workspace-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 1rem;
  margin-top: 4rem;
}

.workspace-card {
  min-height: 24rem;
  border: 1px solid var(--line);
  padding: clamp(1.5rem, 4vw, 2.5rem);
  background: var(--surface);
}

.workspace-card--contract {
  display: flex;
  flex-direction: column;
  color: var(--paper);
  background: var(--ink);
}

.workspace-card--contract .eyebrow {
  color: #71c2b6;
}

.workspace-card--contract > p:not(.eyebrow) {
  color: #b8c8c4;
}

.workspace-card--contract .button {
  margin-top: auto;
}

.profile-list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin-block: 2rem;
}

.profile-list div {
  min-width: 0;
  border-top: 1px solid var(--line);
  padding: 1rem 1rem 1rem 0;
}

.profile-list dt {
  margin-bottom: 0.35rem;
  color: var(--ink-soft);
  font-family: var(--mono);
  font-size: 0.62rem;
  text-transform: uppercase;
}

.profile-list dd {
  overflow: hidden;
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  text-overflow: ellipsis;
}

.settings-stack {
  display: grid;
  gap: 1rem;
}

.settings-form,
.danger-panel {
  border: 1px solid var(--line);
  padding: clamp(1.5rem, 5vw, 3rem);
  background: var(--surface);
}

.settings-form__heading {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 2rem;
}

.settings-form__heading > p {
  margin: 0;
}

.settings-form__fields {
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 1.5rem;
}

.settings-form > .button {
  margin-top: 1rem;
}

.danger-panel {
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: space-between;
  border-color: #e7bcb4;
  background: var(--coral-pale);
}

.danger-panel p:last-child {
  margin: 0;
}

/* App states */

.session-loader,
.state-page {
  display: grid;
  min-height: 100vh;
  place-content: center;
  padding: 2rem;
  text-align: center;
}

.session-loader h1,
.state-page h1 {
  max-width: 16ch;
  margin-inline: auto;
  font-size: clamp(2.5rem, 7vw, 5rem);
  line-height: 0.95;
  letter-spacing: -0.05em;
}

.session-loader__pulse {
  width: 3rem;
  height: 3rem;
  margin: 0 auto 2rem;
  border: 1px solid var(--line);
  border-top-color: var(--coral);
  border-radius: 50%;
  animation: loader-spin 1s linear infinite;
}

@keyframes loader-spin {
  to {
    rotate: 360deg;
  }
}

.state-page a {
  color: var(--green);
  font-weight: 700;
}

.state-page button {
  justify-self: center;
  border: 0;
  border-radius: 0.25rem;
  padding: 0.8rem 1rem;
  color: var(--surface);
  background: var(--green);
  cursor: pointer;
}

@media (max-width: 900px) {
  .landing__hero,
  .capability-strip,
  .session-board {
    grid-template-columns: 1fr;
  }

  .landing__trace {
    width: min(100%, 28rem);
  }

  .capability-list li {
    grid-template-columns: 2.5rem 0.7fr 1fr;
  }

  .auth-shell {
    grid-template-columns: 1fr;
  }

  .auth-shell__context {
    min-height: auto;
  }

  .auth-shell__context-copy {
    margin-block: 4rem 2rem;
  }

  .auth-shell__context-copy .protocol-trace {
    display: none;
  }

  .workspace__header {
    grid-template-columns: 1fr auto;
  }

  .workspace__header nav {
    grid-row: 2;
    grid-column: 1 / -1;
    justify-self: stretch;
  }

  .workspace__header nav a {
    flex: 1;
    text-align: center;
  }

  .workspace-grid,
  .settings-form__fields {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 620px) {
  .landing__nav,
  .landing__hero,
  .capability-strip,
  .landing__footer,
  .workspace__header,
  .workspace-main {
    width: min(100% - 1.5rem, 75rem);
  }

  .landing__nav .text-link {
    display: none;
  }

  .landing__hero {
    min-height: auto;
    padding-block: 4rem;
  }

  .landing__copy h1 {
    font-size: clamp(3.4rem, 18vw, 5rem);
  }

  .landing__actions {
    align-items: stretch;
    flex-direction: column;
  }

  .capability-list li {
    grid-template-columns: 2rem 1fr;
  }

  .capability-list p {
    grid-column: 2;
  }

  .landing__footer {
    align-items: start;
    flex-direction: column;
    gap: 1rem;
  }

  .auth-shell__context {
    padding: 1.25rem;
  }

  .auth-shell__context-copy {
    margin-block: 3rem 1rem;
  }

  .auth-shell__context-copy h2 {
    margin: 0;
    font-size: 2.8rem;
  }

  .auth-shell__aside-note {
    display: none;
  }

  .auth-shell__form {
    padding: 1rem;
  }

  .auth-card {
    padding: 1.4rem;
    box-shadow: 0.4rem 0.4rem 0 rgb(23 107 97 / 8%);
  }

  .form-row,
  .workspace-title,
  .danger-panel {
    align-items: stretch;
    flex-direction: column;
  }

  .workspace__header {
    gap: 1rem;
  }

  .workspace__header .brand-mark > span:last-child,
  .workspace__identity > div {
    display: none;
  }

  .workspace-title {
    display: flex;
  }

  .workspace-title h1 {
    font-size: 3.4rem;
  }

  .profile-list {
    grid-template-columns: 1fr;
  }

  .settings-form__heading {
    grid-template-columns: 1fr;
    gap: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
```

### [MODIFIED] `package.json`

```json
{
  "name": "full-stack-boilerplate",
  "private": true,
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "check-types": "turbo run check-types",
    "test": "turbo run test",
    "test:integration": "turbo run test:integration",
    "db:format": "pnpm --filter @template/database db:format",
    "db:validate": "pnpm --filter @template/database db:validate",
    "db:generate": "pnpm --filter @template/database db:generate",
    "db:migrate:dev": "pnpm --filter @template/database db:migrate:dev",
    "db:migrate:deploy": "pnpm --filter @template/database db:migrate:deploy",
    "db:migrate:reset": "pnpm --filter @template/database db:migrate:reset",
    "db:push": "pnpm --filter @template/database db:push",
    "db:studio": "pnpm --filter @template/database db:studio",
    "db:seed": "pnpm --filter @template/database db:seed",
    "verify": "pnpm db:format && pnpm db:validate && pnpm db:generate && pnpm format:check && pnpm lint && pnpm check-types && pnpm test && pnpm test:integration && pnpm build && git diff --check",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yml,yaml,css}\"",
    "format:check": "prettier --check \"**/*.{ts,tsx,js,jsx,mjs,cjs,json,md,mdx,yml,yaml,css}\""
  },
  "devDependencies": {
    "@template/prettier-config": "workspace:*",
    "prettier": "3.9.6",
    "turbo": "2.10.8"
  },
  "engines": {
    "node": ">=24 <25",
    "pnpm": ">=11 <12"
  },
  "packageManager": "pnpm@11.17.0"
}
```

### [MODIFIED] `packages/database/eslint.config.mjs`

```javascript
import { createNodeConfig } from "@template/eslint-config/node";

export default createNodeConfig({
  tsconfigRootDir: import.meta.dirname,
  allowDefaultProject: [
    "prisma.config.ts",
    "prisma/seed.ts",
    "vitest.config.ts",
    "vitest.integration.config.ts",
  ],
});
```

### [MODIFIED] `packages/database/package.json`

```json
{
  "name": "@template/database",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "development": "./src/index.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "pnpm db:generate && rimraf dist node_modules/.cache/tsconfig.build.tsbuildinfo && tsc -p tsconfig.build.json",
    "check-types": "pnpm db:generate && tsc --noEmit",
    "test": "vitest run --config vitest.config.ts",
    "test:integration": "vitest run --config vitest.integration.config.ts",
    "test:watch": "vitest --config vitest.config.ts",
    "db:format": "prisma format",
    "db:migrate:dev": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:migrate:reset": "prisma migrate reset",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed",
    "db:validate": "prisma validate",
    "db:generate": "prisma generate",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "dependencies": {
    "@prisma/adapter-pg": "7.9.1",
    "@prisma/client": "7.9.1",
    "@template/contracts": "workspace:*",
    "argon2": "0.45.1",
    "pg": "8.22.0"
  },
  "devDependencies": {
    "@template/eslint-config": "workspace:*",
    "@template/typescript-config": "workspace:*",
    "@testcontainers/postgresql": "12.1.0",
    "@types/node": "24.13.3",
    "@types/pg": "8.20.3",
    "dotenv": "17.4.2",
    "eslint": "9.39.1",
    "prisma": "7.9.1",
    "rimraf": "6.1.3",
    "tsx": "4.23.1",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  },
  "engines": {
    "node": ">=24 <25"
  }
}
```

### [MODIFIED] `packages/database/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
}

enum UserRole {
  USER
  ADMIN

  @@map("user_role")
}

enum UserStatus {
  PENDING_VERIFICATION
  ACTIVE
  SUSPENDED

  @@map("user_status")
}

model User {
  id                         String     @id @default(uuid()) @db.Uuid
  email                      String     @unique @db.VarChar(320)
  passwordHash               String     @map("password_hash") @db.VarChar(255)
  fullName                   String     @map("full_name") @db.VarChar(150)
  phone                      String?    @db.VarChar(30)
  role                       UserRole   @default(USER)
  status                     UserStatus @default(PENDING_VERIFICATION)
  emailVerifiedAt            DateTime?  @map("email_verified_at") @db.Timestamptz(6)
  verificationTokenHash      String?    @map("verification_token_hash") @db.Char(64)
  verificationTokenExpiresAt DateTime?  @map("verification_token_expires_at") @db.Timestamptz(6)
  resetTokenHash             String?    @map("reset_token_hash") @db.Char(64)
  resetTokenExpiresAt        DateTime?  @map("reset_token_expires_at") @db.Timestamptz(6)
  createdAt                  DateTime   @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt                  DateTime   @updatedAt @map("updated_at") @db.Timestamptz(6)

  refreshTokens RefreshToken[]

  @@index([status, role], map: "users_status_role_idx")
  @@map("users")
}

model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  tokenHash String   @unique @map("token_hash") @db.Char(64)
  expiresAt DateTime @map("expires_at") @db.Timestamptz(6)
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], map: "refresh_tokens_user_idx")
  @@index([expiresAt], map: "refresh_tokens_expiry_idx")
  @@map("refresh_tokens")
}
```

### [MODIFIED] `packages/database/prisma/seed.ts`

```typescript
import { createDatabaseClient } from "../src/client.js";
import {
  buildSeedUpsert,
  parseSeedGroup,
  type SeedDecision,
} from "../src/seed-config.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined || databaseUrl.length === 0) {
  throw new Error("DATABASE_URL is required to seed the database.");
}

const nodeEnv = process.env["NODE_ENV"] ?? "development";
const decisions = await Promise.all([
  parseSeedGroup("ADMIN", process.env, nodeEnv),
  parseSeedGroup("USER", process.env, nodeEnv),
]);
const enabled = decisions.filter(
  (decision): decision is Extract<SeedDecision, { kind: "enabled" }> =>
    decision.kind === "enabled",
);

if (enabled.length === 0) {
  console.info("Seed skipped: no optional users were configured.");
} else {
  const database = createDatabaseClient(databaseUrl);
  try {
    const now = new Date();
    for (const decision of enabled) {
      await database.user.upsert(buildSeedUpsert(decision, now));
      console.info(`Seeded optional ${decision.group.toLowerCase()} account.`);
    }
  } finally {
    await database.$disconnect();
  }
}
```

### [MODIFIED] `packages/database/src/index.ts`

```typescript
export { createDatabaseClient } from "./client.js";
export type { DatabaseClient } from "./client.js";
export { Prisma, UserRole, UserStatus } from "./generated/prisma/client.js";
export type {
  PrismaClient,
  RefreshToken,
  User,
} from "./generated/prisma/client.js";
```

### [MODIFIED] `packages/typescript-config/base.json`

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "rewriteRelativeImportExtensions": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2023",
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true
  }
}
```

### [MODIFIED] `pnpm-lock.yaml`

```yaml
lockfileVersion: "9.0"

settings:
  autoInstallPeers: true
  excludeLinksFromLockfile: false

overrides:
  ajv@^6.0.0: 6.15.0
  brace-expansion@^1.0.0: 1.1.18
  brace-expansion@^2.0.0: 2.1.4
  flatted@^3.0.0: 3.4.4
  js-yaml@^4.0.0: 4.3.1
  minimatch@^3.0.0: 3.1.5
  minimatch@^9.0.0: 9.0.9
  picomatch@^2.0.0: 2.3.2
  picomatch@^4.0.0: 4.0.5
  postcss@^8.0.0: 8.5.25

importers:
  .:
    devDependencies:
      "@template/prettier-config":
        specifier: workspace:*
        version: link:packages/prettier-config
      prettier:
        specifier: 3.9.6
        version: 3.9.6
      turbo:
        specifier: 2.10.8
        version: 2.10.8

  apps/api:
    dependencies:
      "@template/contracts":
        specifier: workspace:*
        version: link:../../packages/contracts
      "@template/database":
        specifier: workspace:*
        version: link:../../packages/database
      argon2:
        specifier: 0.45.1
        version: 0.45.1
      compression:
        specifier: 1.8.1
        version: 1.8.1(supports-color@7.2.0)
      cookie-parser:
        specifier: 1.4.7
        version: 1.4.7
      cors:
        specifier: 2.8.6
        version: 2.8.6
      dotenv:
        specifier: 17.4.2
        version: 17.4.2
      express:
        specifier: 5.2.1
        version: 5.2.1(supports-color@7.2.0)
      express-rate-limit:
        specifier: 8.6.1
        version: 8.6.1(express@5.2.1(supports-color@7.2.0))(supports-color@7.2.0)
      helmet:
        specifier: 8.3.0
        version: 8.3.0
      jsonwebtoken:
        specifier: 9.0.3
        version: 9.0.3
      nodemailer:
        specifier: 9.0.4
        version: 9.0.4
      pino:
        specifier: 10.3.1
        version: 10.3.1
      pino-http:
        specifier: 11.0.0
        version: 11.0.0
      resend:
        specifier: 6.20.0
        version: 6.20.0
      zod:
        specifier: 4.4.3
        version: 4.4.3
      zod-openapi:
        specifier: 6.0.0
        version: 6.0.0(zod@4.4.3)
    devDependencies:
      "@template/eslint-config":
        specifier: workspace:*
        version: link:../../packages/eslint-config
      "@template/typescript-config":
        specifier: workspace:*
        version: link:../../packages/typescript-config
      "@testcontainers/postgresql":
        specifier: 12.1.0
        version: 12.1.0(supports-color@7.2.0)
      "@types/compression":
        specifier: 1.8.1
        version: 1.8.1
      "@types/cookie-parser":
        specifier: 1.4.10
        version: 1.4.10(@types/express@5.0.6)
      "@types/cors":
        specifier: 2.8.19
        version: 2.8.19
      "@types/express":
        specifier: 5.0.6
        version: 5.0.6
      "@types/jsonwebtoken":
        specifier: 9.0.10
        version: 9.0.10
      "@types/node":
        specifier: 24.13.3
        version: 24.13.3
      "@types/nodemailer":
        specifier: 8.0.1
        version: 8.0.1
      "@types/supertest":
        specifier: 6.0.3
        version: 6.0.3
      eslint:
        specifier: 9.39.1
        version: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      pino-pretty:
        specifier: 13.1.3
        version: 13.1.3
      rimraf:
        specifier: 6.1.3
        version: 6.1.3
      supertest:
        specifier: 7.1.4
        version: 7.1.4(supports-color@7.2.0)
      tsx:
        specifier: 4.23.1
        version: 4.23.1
      typescript:
        specifier: 5.9.3
        version: 5.9.3
      vitest:
        specifier: 4.1.10
        version: 4.1.10(@types/node@24.13.3)(jsdom@30.0.1(@noble/hashes@1.8.0))(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0))

  apps/web:
    dependencies:
      "@hookform/resolvers":
        specifier: 5.7.1
        version: 5.7.1(@standard-schema/spec@1.1.0)(ajv@8.20.0)(effect@3.20.0)(react-hook-form@7.84.0(react@19.2.8))(valibot@1.4.2(typescript@5.9.3))(zod@4.4.3)
      "@tanstack/react-query":
        specifier: 5.101.4
        version: 5.101.4(react@19.2.8)
      "@template/contracts":
        specifier: workspace:*
        version: link:../../packages/contracts
      axios:
        specifier: 1.19.0
        version: 1.19.0(debug@4.4.3(supports-color@7.2.0))(supports-color@7.2.0)
      next:
        specifier: 16.2.12
        version: 16.2.12(@babel/core@7.29.7(supports-color@7.2.0))(babel-plugin-react-compiler@1.0.0)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
      react:
        specifier: 19.2.8
        version: 19.2.8
      react-dom:
        specifier: 19.2.8
        version: 19.2.8(react@19.2.8)
      react-hook-form:
        specifier: 7.84.0
        version: 7.84.0(react@19.2.8)
      zod:
        specifier: 4.4.3
        version: 4.4.3
    devDependencies:
      "@tailwindcss/postcss":
        specifier: 4.3.3
        version: 4.3.3
      "@template/eslint-config":
        specifier: workspace:*
        version: link:../../packages/eslint-config
      "@template/typescript-config":
        specifier: workspace:*
        version: link:../../packages/typescript-config
      "@testing-library/jest-dom":
        specifier: 6.9.1
        version: 6.9.1
      "@testing-library/react":
        specifier: 16.3.2
        version: 16.3.2(@testing-library/dom@10.4.1)(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
      "@types/node":
        specifier: 24.13.3
        version: 24.13.3
      "@types/react":
        specifier: 19.2.18
        version: 19.2.18
      "@types/react-dom":
        specifier: 19.2.4
        version: 19.2.4(@types/react@19.2.18)
      babel-plugin-react-compiler:
        specifier: 1.0.0
        version: 1.0.0
      eslint:
        specifier: 9.39.1
        version: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      jsdom:
        specifier: 30.0.1
        version: 30.0.1(@noble/hashes@1.8.0)
      tailwindcss:
        specifier: 4.3.3
        version: 4.3.3
      typescript:
        specifier: 5.9.3
        version: 5.9.3
      vitest:
        specifier: 4.1.10
        version: 4.1.10(@types/node@24.13.3)(jsdom@30.0.1(@noble/hashes@1.8.0))(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0))

  packages/contracts:
    dependencies:
      zod:
        specifier: 4.4.3
        version: 4.4.3
    devDependencies:
      "@template/eslint-config":
        specifier: workspace:*
        version: link:../eslint-config
      "@template/typescript-config":
        specifier: workspace:*
        version: link:../typescript-config
      "@types/node":
        specifier: 24.13.3
        version: 24.13.3
      eslint:
        specifier: 9.39.1
        version: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      rimraf:
        specifier: 6.1.3
        version: 6.1.3
      typescript:
        specifier: 5.9.3
        version: 5.9.3
      vitest:
        specifier: 4.1.10
        version: 4.1.10(@types/node@24.13.3)(jsdom@30.0.1(@noble/hashes@1.8.0))(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0))

  packages/database:
    dependencies:
      "@prisma/adapter-pg":
        specifier: 7.9.1
        version: 7.9.1
      "@prisma/client":
        specifier: 7.9.1
        version: 7.9.1(prisma@7.9.1(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(typescript@5.9.3))(typescript@5.9.3)
      "@template/contracts":
        specifier: workspace:*
        version: link:../contracts
      argon2:
        specifier: 0.45.1
        version: 0.45.1
      pg:
        specifier: 8.22.0
        version: 8.22.0
    devDependencies:
      "@template/eslint-config":
        specifier: workspace:*
        version: link:../eslint-config
      "@template/typescript-config":
        specifier: workspace:*
        version: link:../typescript-config
      "@testcontainers/postgresql":
        specifier: 12.1.0
        version: 12.1.0(supports-color@7.2.0)
      "@types/node":
        specifier: 24.13.3
        version: 24.13.3
      "@types/pg":
        specifier: 8.20.3
        version: 8.20.3
      dotenv:
        specifier: 17.4.2
        version: 17.4.2
      eslint:
        specifier: 9.39.1
        version: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      prisma:
        specifier: 7.9.1
        version: 7.9.1(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(typescript@5.9.3)
      rimraf:
        specifier: 6.1.3
        version: 6.1.3
      tsx:
        specifier: 4.23.1
        version: 4.23.1
      typescript:
        specifier: 5.9.3
        version: 5.9.3
      vitest:
        specifier: 4.1.10
        version: 4.1.10(@types/node@24.13.3)(jsdom@30.0.1(@noble/hashes@1.8.0))(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0))

  packages/eslint-config:
    dependencies:
      eslint:
        specifier: ^9.39.1
        version: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript:
        specifier: ^5.9.3
        version: 5.9.3
    devDependencies:
      "@eslint/js":
        specifier: 9.39.1
        version: 9.39.1
      eslint-config-next:
        specifier: 16.2.12
        version: 16.2.12(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-plugin-import-x@4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      eslint-config-prettier:
        specifier: 10.1.8
        version: 10.1.8(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      eslint-plugin-import-x:
        specifier: 4.17.1
        version: 4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
      eslint-plugin-unused-imports:
        specifier: 4.4.1
        version: 4.4.1(@typescript-eslint/eslint-plugin@8.65.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      globals:
        specifier: 16.5.0
        version: 16.5.0
      typescript-eslint:
        specifier: 8.65.0
        version: 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)

  packages/prettier-config:
    dependencies:
      prettier:
        specifier: ^3.9.6
        version: 3.9.6
      prettier-plugin-tailwindcss:
        specifier: 0.8.1
        version: 0.8.1(prettier@3.9.6)

  packages/typescript-config: {}

packages:
  "@adobe/css-tools@4.5.0":
    resolution:
      {
        integrity: sha512-6OzddxPio9UiWTCemp4N8cYLV2ZN1ncRnV1cVGtve7dhPOtRkleRyx32GQCYSwDYgaHU3USMm84tNsvKzRCa1Q==,
      }

  "@alloc/quick-lru@5.2.0":
    resolution:
      {
        integrity: sha512-UrcABB+4bUrFABwbluTIBErXwvbsU/V7TZWfmbgJfbkwiBuziS9gxdODUyuiecfdGQ85jglMW6juS3+z5TsKLw==,
      }
    engines: { node: ">=10" }

  "@asamuzakjp/css-color@6.0.7":
    resolution:
      {
        integrity: sha512-vC/bk1Lz7Tn/EfU9/apOTBk80/8dyGyWMowPoV1tJ52muDGsDqt2HPT2klrFUiY60MQmQv9q8yIht15JnBgDGw==,
      }
    engines: { node: ^22.13.0 || >=24.0.0 }

  "@asamuzakjp/dom-selector@8.3.2":
    resolution:
      {
        integrity: sha512-93Z1N+BQNXysodoicpOIyNh2drHfz/CTf9nnT0FEx72GJcIiwgydD7tGAr78j41LsYn3hlRn+LdGPuBLn1Bl8Q==,
      }
    engines: { node: ^22.13.0 || >=24.0.0 }

  "@babel/code-frame@7.29.7":
    resolution:
      {
        integrity: sha512-Aup7aUOfpbAUg2ROOJN6Iw5f9DMBlzu0mIkm/malLQFN/YQgO48wCj0Kxa3sEHJvPVFg7siR+qRInwXd2qhQKw==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/compat-data@7.29.7":
    resolution:
      {
        integrity: sha512-locTkQyKvwIEgBzVrn8693ebc97F2U8ZHjbXwDXJ5Fn2TCpNwTlKcaKLkdHop5c/icOFE7qt7Q9JC5hnKNa6Gg==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/core@7.29.7":
    resolution:
      {
        integrity: sha512-RgHBCvtjbOK2gXSNBNIkNoEc9qoVEtau3hj8gEqKQuL3HZAibKarWFEI3Lfm6EYKkLalOh8eSrj9b+ch9H/VBA==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/generator@7.29.8":
    resolution:
      {
        integrity: sha512-gZbepsdh3WDtgZKWL+vTPh71LSBrm/Y4/QDZBVCcYfmeTEEuoOYwlSy+G1StfJg+/Zy550u/3TATbm7qDbbMtg==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helper-compilation-targets@7.29.7":
    resolution:
      {
        integrity: sha512-wem6WaBj4NaVYVdNhLPPVacES6ZJ+KBBfSkTMD3YZxbP3rm3Di85tJU5ljaUNhaOynt+Aj0xruhYuzQBt8n71g==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helper-globals@7.29.7":
    resolution:
      {
        integrity: sha512-3nQVUAtvkKH9zahfWgw96Jc/uFOmjACE1kQz82E2lqWmHBgjzbNlsC22nuQTfahmWeQtTq5nQ/4Nnd2A1wj4zA==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helper-module-imports@7.29.7":
    resolution:
      {
        integrity: sha512-ejHwrQQYcm9xnTivShn2IDOlIzInN34AXskvq9QicvCtEzq1Vzclu/tKF8Jq1Cg8JG2GL6/EmjgsCT7lXepE3g==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helper-module-transforms@7.29.7":
    resolution:
      {
        integrity: sha512-UPUVSyXbOh627KiCIGQSgwWzGeBKLkaJ9PJEdrngIwMSzxLR4jS4+f1f1jb7VzBbg8nFLaYotvVPFCTqdrmTAg==,
      }
    engines: { node: ">=6.9.0" }
    peerDependencies:
      "@babel/core": ^7.0.0

  "@babel/helper-string-parser@7.29.7":
    resolution:
      {
        integrity: sha512-Pb5ijPrZ89GDH8223L4UP8i6QApWxs04RbPQJTeWDV0/keR2E36MeKnyr6LYmUUvqRRI+Iv87SuF1W6ErINzYw==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helper-validator-identifier@7.29.7":
    resolution:
      {
        integrity: sha512-qehxGkRj55h/ff8EMaJ+cYhyaKlHIxqYDn682wQD7RNp9UujOQsHog2uS0r2vzr4pW+sXf90NeeayjcNaX3fFg==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helper-validator-option@7.29.7":
    resolution:
      {
        integrity: sha512-N9ZErrD+yW5geCDtBqnOoxmR8+tNKiGuxKlDpuJxfsqpa2dFcexaziGAE/qoHLiDDreVNMupxGmSoNlyvsA3gw==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/helpers@7.29.7":
    resolution:
      {
        integrity: sha512-1k2lAGRMfHTcwuNYcCNUmaUffmQv8KWMfh2iJUUeRlwlwH4FdNG7mfPI10NPfLHJFThE4Tyr4mv7kTNZOiPuBg==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/parser@7.29.8":
    resolution:
      {
        integrity: sha512-E8lTAYNB1KW+FH+VGJuZM1ioAx2E6oVlvQFRrf5P8ZZmsiJXYAD9vTFV7yyEURNzgh1dFqMZuO6tUwcARbqFCA==,
      }
    engines: { node: ">=6.0.0" }
    hasBin: true

  "@babel/runtime@7.29.7":
    resolution:
      {
        integrity: sha512-Nq8OhGWiZIZGV6hLHoyAKLLcJihP/xFeBMGJoUrxTX2psI8dCifzLhZISFb+VWS3wFMRDmCGw5R+dOySCqPLhw==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/template@7.29.7":
    resolution:
      {
        integrity: sha512-puq+Gf35oI24FeN11LkoUQFqv9uwNeWpxXZi/Ji3rRIoKAzKnxRaZ+Gkj0vKS9ZCiTESfng1N9LyOyXvo+m+Gg==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/traverse@7.29.8":
    resolution:
      {
        integrity: sha512-I5z7H3bf/41ktsNVLtpN0wAa336HkqIHQ5BuPLEhTkt1jVSyZpeNKIzTgEWmlxjdg81R0IgUCcaE+Ok3NvrfZg==,
      }
    engines: { node: ">=6.9.0" }

  "@babel/types@7.29.8":
    resolution:
      {
        integrity: sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg==,
      }
    engines: { node: ">=6.9.0" }

  "@balena/dockerignore@1.0.2":
    resolution:
      {
        integrity: sha512-wMue2Sy4GAVTk6Ic4tJVcnfdau+gx2EnG7S+uAEe+TWJFqE4YoWN4/H8MSLj4eYJKxGg26lZwboEniNiNwZQ6Q==,
      }

  "@bramus/specificity@2.4.2":
    resolution:
      {
        integrity: sha512-ctxtJ/eA+t+6q2++vj5j7FYX3nRu311q1wfYH3xjlLOsczhlhxAg2FWNUXhpGvAw3BWo1xBcvOV6/YLc2r5FJw==,
      }
    hasBin: true

  "@csstools/color-helpers@6.1.1":
    resolution:
      {
        integrity: sha512-gLNsunvwf3mCi5u5o46/Z/JcJMnhbHSaZ69rkgPzNM3J4s8hWwpPUQB6/tt0EDFyCiWzxANlx+2LJwpYj4zS1w==,
      }
    engines: { node: ">=20.19.0" }

  "@csstools/css-calc@3.3.0":
    resolution:
      {
        integrity: sha512-c5ihYsPkdG6JCkU2zTMm4+k6r7RXuGxtWYhu5DHMIiF1FHzrfmHL5so11AoFpUv/tu61xfcmT4AmKoFfMPoqdQ==,
      }
    engines: { node: ">=20.19.0" }
    peerDependencies:
      "@csstools/css-parser-algorithms": ^4.0.0
      "@csstools/css-tokenizer": ^4.0.0

  "@csstools/css-color-parser@4.2.0":
    resolution:
      {
        integrity: sha512-5+5LEmFuY1AjXdYhmgjTJogtQnP1evJ1zrBZGUNZ0thkpwnnmKxcHdAMn/OtFjAb25zA+jKDVYVRl+5G7rjv1A==,
      }
    engines: { node: ">=20.19.0" }
    peerDependencies:
      "@csstools/css-parser-algorithms": ^4.0.0
      "@csstools/css-tokenizer": ^4.0.0

  "@csstools/css-parser-algorithms@4.0.0":
    resolution:
      {
        integrity: sha512-+B87qS7fIG3L5h3qwJ/IFbjoVoOe/bpOdh9hAjXbvx0o8ImEmUsGXN0inFOnk2ChCFgqkkGFQ+TpM5rbhkKe4w==,
      }
    engines: { node: ">=20.19.0" }
    peerDependencies:
      "@csstools/css-tokenizer": ^4.0.0

  "@csstools/css-syntax-patches-for-csstree@1.1.8":
    resolution:
      {
        integrity: sha512-CpMLjAvwQg3BL5S0IeqsZNMH7EQrEWi0kLKOC13ZBF0ZwERiLWlibNPJr8G1kdU3Ms/r2KiNrF81pUh2HwAHdg==,
      }
    peerDependencies:
      css-tree: ^3.2.1
    peerDependenciesMeta:
      css-tree:
        optional: true

  "@csstools/css-tokenizer@4.0.0":
    resolution:
      {
        integrity: sha512-QxULHAm7cNu72w97JUNCBFODFaXpbDg+dP8b/oWFAZ2MTRppA3U00Y2L1HqaS4J6yBqxwa/Y3nMBaxVKbB/NsA==,
      }
    engines: { node: ">=20.19.0" }

  "@electric-sql/pglite-socket@0.1.3":
    resolution:
      {
        integrity: sha512-LAciWM0M1dCL8hlsxu2venbVZcdxema0BtDfpWYVqr+Y468UADw0pFWidhKw1M8sfJ8rdLT71tjMmnirf/IZRQ==,
      }
    hasBin: true
    peerDependencies:
      "@electric-sql/pglite": 0.4.3

  "@electric-sql/pglite-tools@0.3.3":
    resolution:
      {
        integrity: sha512-AlzLJTRJ8+UFgK8CmxIpyIpJ0+YaFw02IiOSdYrqxwPXdSyeIShz8aa9Tq+tYFXdPwcaMp/Fc80mQZ1dkOQ/wg==,
      }
    peerDependencies:
      "@electric-sql/pglite": 0.4.3

  "@electric-sql/pglite@0.4.3":
    resolution:
      {
        integrity: sha512-ichuWTgtd4mOM1G4SpyGJa5trT03lWbMypDV0fUXUCXg5hiHqVAz/bZyV68NqmkLB7WcYmj1RMJVSp8HV/v/ZQ==,
      }

  "@emnapi/core@1.10.0":
    resolution:
      {
        integrity: sha512-yq6OkJ4p82CAfPl0u9mQebQHKPJkY7WrIuk205cTYnYe+k2Z8YBh11FrbRG/H6ihirqcacOgl2BIO8oyMQLeXw==,
      }

  "@emnapi/runtime@1.10.0":
    resolution:
      {
        integrity: sha512-ewvYlk86xUoGI0zQRNq/mC+16R1QeDlKQy21Ki3oSYXNgLb45GV1P6A0M+/s6nyCuNDqe5VpaY84BzXGwVbwFA==,
      }

  "@emnapi/runtime@1.7.1":
    resolution:
      {
        integrity: sha512-PVtJr5CmLwYAU9PZDMITZoR5iAOShYREoR45EyyLrbntV50mdePTgUn4AmOw90Ifcj+x2kRjdzr1HP3RrNiHGA==,
      }

  "@emnapi/wasi-threads@1.2.1":
    resolution:
      {
        integrity: sha512-uTII7OYF+/Mes/MrcIOYp5yOtSMLBWSIoLPpcgwipoiKbli6k322tcoFsxoIIxPDqW01SQGAgko4EzZi2BNv2w==,
      }

  "@epic-web/invariant@1.0.0":
    resolution:
      {
        integrity: sha512-lrTPqgvfFQtR/eY/qkIzp98OGdNJu0m5ji3q/nJI8v3SXkRKEnWiOxMmbvcSoAIzv/cGiuvRy57k4suKQSAdwA==,
      }

  "@esbuild/aix-ppc64@0.28.1":
    resolution:
      {
        integrity: sha512-Svl7tq8k/08+p6CXPpRjQ1fKX+1odH/BQbb48fV6fj3CWHhsoIOoY87w1oHXm0qEpkIK3ZfVgp0hed3XBXzXMQ==,
      }
    engines: { node: ">=18" }
    cpu: [ppc64]
    os: [aix]

  "@esbuild/android-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-34EGEbCIAgosYz6goLcopX6Mo7NyGv9tfwEM2/7Ce2VcVRk568iSvniGWcUXIy7wEDR1wzolcxcriFVrWYcwBg==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [android]

  "@esbuild/android-arm@0.28.1":
    resolution:
      {
        integrity: sha512-0k2F129Xdio1TdJfzJ8sy1Q47vUD2NnwdhiAf7drUN1EBTfPf4hsFCtmMgu/6m8JSzsBrlmVjudMBQqOfG8usQ==,
      }
    engines: { node: ">=18" }
    cpu: [arm]
    os: [android]

  "@esbuild/android-x64@0.28.1":
    resolution:
      {
        integrity: sha512-dbwY7ltSMDWsRatcRpCnES4F+im88OCUgGZjy52shC7GqHRE/cYlxNbB4Z4UpJswpcc4Qxd2oE/ufM0p61IKng==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [android]

  "@esbuild/darwin-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-TZbWkQY7kvTAXbXUT7uVACR5cMHsDiSz9z7ZKAX/RTq/WJEk3QyRr0wZpNhBDX+/0CtdqUIJlOiodQcta6tY3Q==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [darwin]

  "@esbuild/darwin-x64@0.28.1":
    resolution:
      {
        integrity: sha512-zfdzgK9ACBNZLI/CyHTOx81SyNbM6YXn7rxSgX97VjyiPl9W1i4Ka4fgKECEoFCKGpvBj5qArWIGgQjOwkgskQ==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [darwin]

  "@esbuild/freebsd-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-wG2EA8ENdEI0qhkSZMjfqrdY+ziCYCPMmtZjjIwOmXFjmyzEHn+UUxk5of+SYsjtfs3VpnlC7QLzSI5hY/rOAw==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [freebsd]

  "@esbuild/freebsd-x64@0.28.1":
    resolution:
      {
        integrity: sha512-i7dZ9vQgnvSCzi/rYCXNgtF/U+eKZNJBzu3eTQbRgHnM7tNSizLOkRFAl3qzVc/Op/u5YkHHa4pf/3DOYHthLQ==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [freebsd]

  "@esbuild/linux-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-yHs+0uc8+nvEAfAfxrWQKK5peSNzBc4PegcMO0EJ2hT71uA7vB8Ihg2e77R2P7SG5uYjPbHlLLmve4LLLRCf0g==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [linux]

  "@esbuild/linux-arm@0.28.1":
    resolution:
      {
        integrity: sha512-qVXBOHQS+d5Y722GwJzJUtOLlX7km3CraOaGormF1pDtPd2C/l1SHRPgjLunLGe51Sh5YYWKMFDyV4SxgMQYTQ==,
      }
    engines: { node: ">=18" }
    cpu: [arm]
    os: [linux]

  "@esbuild/linux-ia32@0.28.1":
    resolution:
      {
        integrity: sha512-d1z4ZuP0ajrfz/FhGT4vv278rX8KnPPJx8i5+AtK7TYbx9Le9F1hyzurZpkEyjkGa9dUGhQow4C1NmeGvqxN2w==,
      }
    engines: { node: ">=18" }
    cpu: [ia32]
    os: [linux]

  "@esbuild/linux-loong64@0.28.1":
    resolution:
      {
        integrity: sha512-M5sRjUVZrkm1OAPR3dlOYzNmN+loZKGVi1VUQGrwuqLcbR6qeAz+famMhjASeH3YVKvZz+zT1jlh/keC3Rj/lg==,
      }
    engines: { node: ">=18" }
    cpu: [loong64]
    os: [linux]

  "@esbuild/linux-mips64el@0.28.1":
    resolution:
      {
        integrity: sha512-mRObBZeHh2OxcBFPWE/FjylkRgZdYuiTR3vaTozquCGOH14iP9oN4x4Ge81CoIDYQrXmIxpFumJBu5MtZpnQJQ==,
      }
    engines: { node: ">=18" }
    cpu: [mips64el]
    os: [linux]

  "@esbuild/linux-ppc64@0.28.1":
    resolution:
      {
        integrity: sha512-slScBsMAb3GFDcdrCgLwZtPYRoH2H/youv10QiZyRjmsP48fznoveWytSgCI/R0ZcUgpc0ZhIUEx6LHts8yrfQ==,
      }
    engines: { node: ">=18" }
    cpu: [ppc64]
    os: [linux]

  "@esbuild/linux-riscv64@0.28.1":
    resolution:
      {
        integrity: sha512-kw0owk1o0GFETUJyW0jc0G4Yzs0BHZn0JDZ8JRT088vjJYX777BAs1fDGxAC+q831qOs2DTC96mNsG2opdfyyQ==,
      }
    engines: { node: ">=18" }
    cpu: [riscv64]
    os: [linux]

  "@esbuild/linux-s390x@0.28.1":
    resolution:
      {
        integrity: sha512-/lAIjX8aYFRByhh6L5rYtPEDRqa9de/4V/juOXcta5frjvzXO4/sqEtyytse0g3zZFuWu5cDN0MkLz2qRDD2Ag==,
      }
    engines: { node: ">=18" }
    cpu: [s390x]
    os: [linux]

  "@esbuild/linux-x64@0.28.1":
    resolution:
      {
        integrity: sha512-u/anNYF2mmVOEDwLtnQ1wOr3EZ9sTNGLWrsYGYwHWzGA3Si84IOkHXlbWTD1NB+9/1lcnweYKO54uhxZydNzfA==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [linux]

  "@esbuild/netbsd-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-oks0DYbLwWMmaakTsCb+zL4E+aHRVLom9IJZOAthMQEPiQmydXHkziYEsGYRx0uNV/IjEKGAV941JzH02pflqw==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [netbsd]

  "@esbuild/netbsd-x64@0.28.1":
    resolution:
      {
        integrity: sha512-aeL6lAnN89Hz43Mlh1G8ARasbuoYvSITDEx0tHh5b7jJnHcssqgjy9Yx430GDpmCa6OyrKoS0aNRjKundRizGg==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [netbsd]

  "@esbuild/openbsd-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-MEFJe5C3R8pwXdZ5Y21oo6m7ePiS0d9pWucn99O/wvyJZChoIQKrQDxKrGeW8F5+T0okTHesAmDeiHDTIq0V/Q==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [openbsd]

  "@esbuild/openbsd-x64@0.28.1":
    resolution:
      {
        integrity: sha512-i/ZLIOafE0Z8cI/XANJAixoJL/uRAoS2xOA3rb0xN+KK0K177cMAsQYkzHtBrtMXAKuAc7HGgcWiZ/sRC1Nxgw==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [openbsd]

  "@esbuild/openharmony-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-ge+Z7EXFNt2BO1oAMsVpiQ8EwndV9i1xXerAeTIK7AtPs3bKFXQM7nlRxDSIUIMeueR1CNXxqztLzdNeReKBJg==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [openharmony]

  "@esbuild/sunos-x64@0.28.1":
    resolution:
      {
        integrity: sha512-BEjgtECkL3vY+SaSQ6nzVfiALUeFxpawyp8Jmf5PtYhf1Ug40N1h/hxlhts+f1FvSvarEigdxS3BlSMI2PJLcQ==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [sunos]

  "@esbuild/win32-arm64@0.28.1":
    resolution:
      {
        integrity: sha512-lCv9eK/H6ZJWbE7bh2nw54CZ9M2nupBxJcTsdk/QQnWkdSjKGuxmmH8/GWrlT1eMmZfn4dGcCjRte397WqfQXA==,
      }
    engines: { node: ">=18" }
    cpu: [arm64]
    os: [win32]

  "@esbuild/win32-ia32@0.28.1":
    resolution:
      {
        integrity: sha512-zvb/mB2bSCoJOpoCBgYKKpX6YM6mJBlBUVUtVj41DlZJVEB6/0CKlRYxP5wWl1C1ILiCoAU5wZZ4q1P3qeS6Eg==,
      }
    engines: { node: ">=18" }
    cpu: [ia32]
    os: [win32]

  "@esbuild/win32-x64@0.28.1":
    resolution:
      {
        integrity: sha512-bm4Mowrv+GXMlpWX++EcXw/iLyd1o3+bJkC2DkWXYVvgZCqD/bSj9ctZeAMC3cIxgjRVR2Dufaiu4YPxr5gW1A==,
      }
    engines: { node: ">=18" }
    cpu: [x64]
    os: [win32]

  "@eslint-community/eslint-utils@4.10.1":
    resolution:
      {
        integrity: sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==,
      }
    engines: { node: ^12.22.0 || ^14.17.0 || >=16.0.0 }
    peerDependencies:
      eslint: ^6.0.0 || ^7.0.0 || >=8.0.0

  "@eslint-community/eslint-utils@4.9.0":
    resolution:
      {
        integrity: sha512-ayVFHdtZ+hsq1t2Dy24wCmGXGe4q9Gu3smhLYALJrr473ZH27MsnSL+LKUlimp4BWJqMDMLmPpx/Q9R3OAlL4g==,
      }
    engines: { node: ^12.22.0 || ^14.17.0 || >=16.0.0 }
    peerDependencies:
      eslint: ^6.0.0 || ^7.0.0 || >=8.0.0

  "@eslint-community/regexpp@4.12.2":
    resolution:
      {
        integrity: sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==,
      }
    engines: { node: ^12.0.0 || ^14.0.0 || >=16.0.0 }

  "@eslint/config-array@0.21.1":
    resolution:
      {
        integrity: sha512-aw1gNayWpdI/jSYVgzN5pL0cfzU02GT3NBpeT/DXbx1/1x7ZKxFPd9bwrzygx/qiwIQiJ1sw/zD8qY/kRvlGHA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@eslint/config-helpers@0.4.2":
    resolution:
      {
        integrity: sha512-gBrxN88gOIf3R7ja5K9slwNayVcZgK6SOUORm2uBzTeIEfeVaIhOpCtTox3P6R7o2jLFwLFTLnC7kU/RGcYEgw==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@eslint/core@0.17.0":
    resolution:
      {
        integrity: sha512-yL/sLrpmtDaFEiUj1osRP4TI2MDz1AddJL+jZ7KSqvBuliN4xqYY54IfdN8qD8Toa6g1iloph1fxQNkjOxrrpQ==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@eslint/eslintrc@3.3.1":
    resolution:
      {
        integrity: sha512-gtF186CXhIl1p4pJNGZw8Yc6RlshoePRvE0X91oPGb3vZ8pM3qOS9W9NGPat9LziaBV7XrJWGylNQXkGcnM3IQ==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@eslint/js@9.39.1":
    resolution:
      {
        integrity: sha512-S26Stp4zCy88tH94QbBv3XCuzRQiZ9yXofEILmglYTh/Ug/a9/umqvgFtYBAo3Lp0nsI/5/qH1CCrbdK3AP1Tw==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@eslint/object-schema@2.1.7":
    resolution:
      {
        integrity: sha512-VtAOaymWVfZcmZbp6E2mympDIHvyjXs/12LqWYjVw6qjrfF+VK+fyG33kChz3nnK+SU5/NeHOqrTEHS8sXO3OA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@eslint/plugin-kit@0.4.1":
    resolution:
      {
        integrity: sha512-43/qtrDUokr7LJqoF2c3+RInu/t4zfrpYdoSDfYyhg52rwLV6TnOvdG4fXm7IkSB3wErkcmJS9iEhjVtOSEjjA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@exodus/bytes@1.15.1":
    resolution:
      {
        integrity: sha512-S6mL0yNB/Abt9Ei4tq8gDhcczc4S3+vQ4ra7vxnAf+YHC02srtqxKKZghx2Dq6p0e66THKwR6r8N6P95wEty7Q==,
      }
    engines: { node: ^20.19.0 || ^22.12.0 || >=24.0.0 }
    peerDependencies:
      "@noble/hashes": ^1.8.0 || ^2.0.0
    peerDependenciesMeta:
      "@noble/hashes":
        optional: true

  "@grpc/grpc-js@1.14.4":
    resolution:
      {
        integrity: sha512-k9Dj3DV/itK9D06Y8f190Qgop7/Ui+D0njFV3LHMPwPT75DpXLQohE9Wmz0QElrJnzsjB7KPWiKJbOl7IPDArQ==,
      }
    engines: { node: ">=12.10.0" }

  "@grpc/proto-loader@0.7.15":
    resolution:
      {
        integrity: sha512-tMXdRCfYVixjuFK+Hk0Q1s38gV9zDiDJfWL3h1rv4Qc39oILCu1TRTDt7+fGUI8K4G1Fj125Hx/ru3azECWTyQ==,
      }
    engines: { node: ">=6" }
    hasBin: true

  "@grpc/proto-loader@0.8.1":
    resolution:
      {
        integrity: sha512-wtF6h+DY6M3YaDBPAmvuuA6jV8Sif9MjtOI5euKFWRgCDl5PeDpPsHR9u2l6St5ceY8AZgoNDww5+HvEsXFsGg==,
      }
    engines: { node: ">=6" }
    hasBin: true

  "@hookform/resolvers@5.7.1":
    resolution:
      {
        integrity: sha512-8wS/P4UDr5sQDe4nFaV51TVyfDPrWgNIXweqG0Bs9Z5LSuzKLb+RQNPvkN2oHM5SRrJyWrVH/F+LOUcFjUyvwQ==,
      }
    peerDependencies:
      "@sinclair/typebox": ">=0.25.24"
      "@standard-schema/spec": ^1.0.0
      "@typeschema/main": ">=0.13.7"
      "@vinejs/vine": ^2.0.0 || ^3.0.0 || ^4.0.0
      ajv: ^8.12.0
      ajv-errors: ^3.0.0
      ajv-formats: ^2.1.1
      arktype: ^2.0.0
      ata-validator: ^1.2.0
      class-transformer: ">=0.4.0"
      class-validator: ">=0.12.0"
      computed-types: ^1.0.0
      effect: ^3.10.3
      fluentvalidation-ts: ^3.0.0
      fp-ts: ^2.7.0
      io-ts: ^2.0.0
      joi: ^17.0.0
      nope-validator: ">=0.12.0"
      react-hook-form: ^7.55.0
      superstruct: ">=0.12.0"
      typanion: ^3.3.2
      valibot: ">=0.31.0 || ^1.0.0-beta.4 || ^1.0.0-rc"
      vest: ">=3.0.0"
      yup: ^1.0.0
      zod: ^3.25.0 || ^4.0.0
    peerDependenciesMeta:
      "@sinclair/typebox":
        optional: true
      "@standard-schema/spec":
        optional: true
      "@typeschema/main":
        optional: true
      "@vinejs/vine":
        optional: true
      ajv:
        optional: true
      ajv-errors:
        optional: true
      ajv-formats:
        optional: true
      arktype:
        optional: true
      ata-validator:
        optional: true
      class-transformer:
        optional: true
      class-validator:
        optional: true
      computed-types:
        optional: true
      effect:
        optional: true
      fluentvalidation-ts:
        optional: true
      fp-ts:
        optional: true
      io-ts:
        optional: true
      joi:
        optional: true
      nope-validator:
        optional: true
      superstruct:
        optional: true
      typanion:
        optional: true
      valibot:
        optional: true
      vest:
        optional: true
      yup:
        optional: true
      zod:
        optional: true

  "@humanfs/core@0.19.1":
    resolution:
      {
        integrity: sha512-5DyQ4+1JEUzejeK1JGICcideyfUbGixgS9jNgex5nqkW+cY7WZhxBigmieN5Qnw9ZosSNVC9KQKyb+GUaGyKUA==,
      }
    engines: { node: ">=18.18.0" }

  "@humanfs/node@0.16.7":
    resolution:
      {
        integrity: sha512-/zUx+yOsIrG4Y43Eh2peDeKCxlRt/gET6aHfaKpuq267qXdYDFViVHfMaLyygZOnl0kGWxFIgsBy8QFuTLUXEQ==,
      }
    engines: { node: ">=18.18.0" }

  "@humanwhocodes/module-importer@1.0.1":
    resolution:
      {
        integrity: sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==,
      }
    engines: { node: ">=12.22" }

  "@humanwhocodes/retry@0.4.3":
    resolution:
      {
        integrity: sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==,
      }
    engines: { node: ">=18.18" }

  "@img/colour@1.0.0":
    resolution:
      {
        integrity: sha512-A5P/LfWGFSl6nsckYtjw9da+19jB8hkJ6ACTGcDfEJ0aE+l2n2El7dsVM7UVHZQ9s2lmYMWlrS21YLy2IR1LUw==,
      }
    engines: { node: ">=18" }

  "@img/sharp-darwin-arm64@0.34.5":
    resolution:
      {
        integrity: sha512-imtQ3WMJXbMY4fxb/Ndp6HBTNVtWCUI0WdobyheGf5+ad6xX8VIDO8u2xE4qc/fr08CKG/7dDseFtn6M6g/r3w==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [arm64]
    os: [darwin]

  "@img/sharp-darwin-x64@0.34.5":
    resolution:
      {
        integrity: sha512-YNEFAF/4KQ/PeW0N+r+aVVsoIY0/qxxikF2SWdp+NRkmMB7y9LBZAVqQ4yhGCm/H3H270OSykqmQMKLBhBJDEw==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [x64]
    os: [darwin]

  "@img/sharp-libvips-darwin-arm64@1.2.4":
    resolution:
      {
        integrity: sha512-zqjjo7RatFfFoP0MkQ51jfuFZBnVE2pRiaydKJ1G/rHZvnsrHAOcQALIi9sA5co5xenQdTugCvtb1cuf78Vf4g==,
      }
    cpu: [arm64]
    os: [darwin]

  "@img/sharp-libvips-darwin-x64@1.2.4":
    resolution:
      {
        integrity: sha512-1IOd5xfVhlGwX+zXv2N93k0yMONvUlANylbJw1eTah8K/Jtpi15KC+WSiaX/nBmbm2HxRM1gZ0nSdjSsrZbGKg==,
      }
    cpu: [x64]
    os: [darwin]

  "@img/sharp-libvips-linux-arm64@1.2.4":
    resolution:
      {
        integrity: sha512-excjX8DfsIcJ10x1Kzr4RcWe1edC9PquDRRPx3YVCvQv+U5p7Yin2s32ftzikXojb1PIFc/9Mt28/y+iRklkrw==,
      }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-libvips-linux-arm@1.2.4":
    resolution:
      {
        integrity: sha512-bFI7xcKFELdiNCVov8e44Ia4u2byA+l3XtsAj+Q8tfCwO6BQ8iDojYdvoPMqsKDkuoOo+X6HZA0s0q11ANMQ8A==,
      }
    cpu: [arm]
    os: [linux]
    libc: [glibc]

  "@img/sharp-libvips-linux-ppc64@1.2.4":
    resolution:
      {
        integrity: sha512-FMuvGijLDYG6lW+b/UvyilUWu5Ayu+3r2d1S8notiGCIyYU/76eig1UfMmkZ7vwgOrzKzlQbFSuQfgm7GYUPpA==,
      }
    cpu: [ppc64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-libvips-linux-riscv64@1.2.4":
    resolution:
      {
        integrity: sha512-oVDbcR4zUC0ce82teubSm+x6ETixtKZBh/qbREIOcI3cULzDyb18Sr/Wcyx7NRQeQzOiHTNbZFF1UwPS2scyGA==,
      }
    cpu: [riscv64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-libvips-linux-s390x@1.2.4":
    resolution:
      {
        integrity: sha512-qmp9VrzgPgMoGZyPvrQHqk02uyjA0/QrTO26Tqk6l4ZV0MPWIW6LTkqOIov+J1yEu7MbFQaDpwdwJKhbJvuRxQ==,
      }
    cpu: [s390x]
    os: [linux]
    libc: [glibc]

  "@img/sharp-libvips-linux-x64@1.2.4":
    resolution:
      {
        integrity: sha512-tJxiiLsmHc9Ax1bz3oaOYBURTXGIRDODBqhveVHonrHJ9/+k89qbLl0bcJns+e4t4rvaNBxaEZsFtSfAdquPrw==,
      }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-libvips-linuxmusl-arm64@1.2.4":
    resolution:
      {
        integrity: sha512-FVQHuwx1IIuNow9QAbYUzJ+En8KcVm9Lk5+uGUQJHaZmMECZmOlix9HnH7n1TRkXMS0pGxIJokIVB9SuqZGGXw==,
      }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  "@img/sharp-libvips-linuxmusl-x64@1.2.4":
    resolution:
      {
        integrity: sha512-+LpyBk7L44ZIXwz/VYfglaX/okxezESc6UxDSoyo2Ks6Jxc4Y7sGjpgU9s4PMgqgjj1gZCylTieNamqA1MF7Dg==,
      }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  "@img/sharp-linux-arm64@0.34.5":
    resolution:
      {
        integrity: sha512-bKQzaJRY/bkPOXyKx5EVup7qkaojECG6NLYswgktOZjaXecSAeCWiZwwiFf3/Y+O1HrauiE3FVsGxFg8c24rZg==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-linux-arm@0.34.5":
    resolution:
      {
        integrity: sha512-9dLqsvwtg1uuXBGZKsxem9595+ujv0sJ6Vi8wcTANSFpwV/GONat5eCkzQo/1O6zRIkh0m/8+5BjrRr7jDUSZw==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [arm]
    os: [linux]
    libc: [glibc]

  "@img/sharp-linux-ppc64@0.34.5":
    resolution:
      {
        integrity: sha512-7zznwNaqW6YtsfrGGDA6BRkISKAAE1Jo0QdpNYXNMHu2+0dTrPflTLNkpc8l7MUP5M16ZJcUvysVWWrMefZquA==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [ppc64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-linux-riscv64@0.34.5":
    resolution:
      {
        integrity: sha512-51gJuLPTKa7piYPaVs8GmByo7/U7/7TZOq+cnXJIHZKavIRHAP77e3N2HEl3dgiqdD/w0yUfiJnII77PuDDFdw==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [riscv64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-linux-s390x@0.34.5":
    resolution:
      {
        integrity: sha512-nQtCk0PdKfho3eC5MrbQoigJ2gd1CgddUMkabUj+rBevs8tZ2cULOx46E7oyX+04WGfABgIwmMC0VqieTiR4jg==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [s390x]
    os: [linux]
    libc: [glibc]

  "@img/sharp-linux-x64@0.34.5":
    resolution:
      {
        integrity: sha512-MEzd8HPKxVxVenwAa+JRPwEC7QFjoPWuS5NZnBt6B3pu7EG2Ge0id1oLHZpPJdn3OQK+BQDiw9zStiHBTJQQQQ==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  "@img/sharp-linuxmusl-arm64@0.34.5":
    resolution:
      {
        integrity: sha512-fprJR6GtRsMt6Kyfq44IsChVZeGN97gTD331weR1ex1c1rypDEABN6Tm2xa1wE6lYb5DdEnk03NZPqA7Id21yg==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  "@img/sharp-linuxmusl-x64@0.34.5":
    resolution:
      {
        integrity: sha512-Jg8wNT1MUzIvhBFxViqrEhWDGzqymo3sV7z7ZsaWbZNDLXRJZoRGrjulp60YYtV4wfY8VIKcWidjojlLcWrd8Q==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  "@img/sharp-wasm32@0.34.5":
    resolution:
      {
        integrity: sha512-OdWTEiVkY2PHwqkbBI8frFxQQFekHaSSkUIJkwzclWZe64O1X4UlUjqqqLaPbUpMOQk6FBu/HtlGXNblIs0huw==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [wasm32]

  "@img/sharp-win32-arm64@0.34.5":
    resolution:
      {
        integrity: sha512-WQ3AgWCWYSb2yt+IG8mnC6Jdk9Whs7O0gxphblsLvdhSpSTtmu69ZG1Gkb6NuvxsNACwiPV6cNSZNzt0KPsw7g==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [arm64]
    os: [win32]

  "@img/sharp-win32-ia32@0.34.5":
    resolution:
      {
        integrity: sha512-FV9m/7NmeCmSHDD5j4+4pNI8Cp3aW+JvLoXcTUo0IqyjSfAZJ8dIUmijx1qaJsIiU+Hosw6xM5KijAWRJCSgNg==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [ia32]
    os: [win32]

  "@img/sharp-win32-x64@0.34.5":
    resolution:
      {
        integrity: sha512-+29YMsqY2/9eFEiW93eqWnuLcWcufowXewwSNIT6UwZdUUCrM3oFjMWH/Z6/TMmb4hlFenmfAVbpWeup2jryCw==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }
    cpu: [x64]
    os: [win32]

  "@isaacs/cliui@8.0.2":
    resolution:
      {
        integrity: sha512-O8jcjabXaleOG9DQ0+ARXWZBTfnP4WNAqzuiJK7ll44AmxGKv/J2M4TPjxjY3znBCfvBXFzucm1twdyFybFqEA==,
      }
    engines: { node: ">=12" }

  "@jridgewell/gen-mapping@0.3.13":
    resolution:
      {
        integrity: sha512-2kkt/7niJ6MgEPxF0bYdQ6etZaA+fQvDcLKckhy1yIQOzaoKjBBjSj63/aLVjYE3qhRt5dvM+uUyfCg6UKCBbA==,
      }

  "@jridgewell/remapping@2.3.5":
    resolution:
      {
        integrity: sha512-LI9u/+laYG4Ds1TDKSJW2YPrIlcVYOwi2fUC6xB43lueCjgxV4lffOCZCtYFiH6TNOX+tQKXx97T4IKHbhyHEQ==,
      }

  "@jridgewell/resolve-uri@3.1.2":
    resolution:
      {
        integrity: sha512-bRISgCIjP20/tbWSPWMEi54QVPRZExkuD9lJL+UIxUKtwVJA8wW1Trb1jMs1RFXo1CBTNZ/5hpC9QvmKWdopKw==,
      }
    engines: { node: ">=6.0.0" }

  "@jridgewell/sourcemap-codec@1.5.5":
    resolution:
      {
        integrity: sha512-cYQ9310grqxueWbl+WuIUIaiUaDcj7WOq5fVhEljNVgRfOUhY9fy2zTvfoqWsnebh8Sl70VScFbICvJnLKB0Og==,
      }

  "@jridgewell/trace-mapping@0.3.31":
    resolution:
      {
        integrity: sha512-zzNR+SdQSDJzc8joaeP8QQoCQr8NuYx2dIIytl1QeBEZHJ9uW6hebsrYgbz8hJwUQao3TWCMtmfV8Nu1twOLAw==,
      }

  "@js-sdsl/ordered-map@4.4.2":
    resolution:
      {
        integrity: sha512-iUKgm52T8HOE/makSxjqoWhe95ZJA1/G1sYsGev2JDKUSS14KAgg1LHb+Ba+IPow0xflbnSkOsZcO08C7w1gYw==,
      }

  "@kwsites/file-exists@1.1.1":
    resolution:
      {
        integrity: sha512-m9/5YGR18lIwxSFDwfE3oA7bWuq9kdau6ugN4H2rJeyhFQZcG9AgSHkQtSD15a8WvTgfz9aikZMrKPHvbpqFiw==,
      }

  "@napi-rs/wasm-runtime@1.2.2":
    resolution:
      {
        integrity: sha512-JfB4kuJQjaoHuCTseIINHtHWeJnvgEcxjwA5t/Y00ZgaOO1Crz3fjT/p8kT28zA/Caz7oiUMn3d6H2yOVCVwuw==,
      }
    engines: { node: ^20.19.0 || ^22.13.0 || >=23.5.0 }
    peerDependencies:
      "@emnapi/core": ^1.7.1 || ^2.0.0-alpha.3
      "@emnapi/runtime": ^1.7.1 || ^2.0.0-alpha.3

  "@next/env@16.2.12":
    resolution:
      {
        integrity: sha512-d0Z5Bc13Fa4nR8pFAKx2jay2yhJM16vlfHbTzYnUQAxlNb6B6lmn4hjt69lYNt4kRtyYP6gEM49lPRHNbIyneg==,
      }

  "@next/eslint-plugin-next@16.2.12":
    resolution:
      {
        integrity: sha512-uF2z/qAK2q7B5/6CpnFcBRX6jOq5iCO+Uqh1UkJhXljX1JwLarLYhhoJadO6dPb6moTprOKewMXheBcbIoSbug==,
      }

  "@next/swc-darwin-arm64@16.2.12":
    resolution:
      {
        integrity: sha512-0W1R0teHWJrqKX0FH20IzzIWAOuGtBxPGuObrxy1lE8hQvCFj49KE8a3WUg0D7sq6rn6zkM4c7YGUnhudBS6oA==,
      }
    engines: { node: ">= 10" }
    cpu: [arm64]
    os: [darwin]

  "@next/swc-darwin-x64@16.2.12":
    resolution:
      {
        integrity: sha512-Hy5Ls099+aFUmOLmIgPfLqNi6iCwhL3uQCssz5rWk+5Nkc6TUKCE83DY5BbNylfm3+mfwcSFnLRfrZDJhVxdtw==,
      }
    engines: { node: ">= 10" }
    cpu: [x64]
    os: [darwin]

  "@next/swc-linux-arm64-gnu@16.2.12":
    resolution:
      {
        integrity: sha512-+YqU2h1cQkHsGfvjAsrSmst8UIFBibBGm5x3Xgel8NLMiDQtNOM4sM2GOEMvG5YiOBNeN/Ykk8cQC2S0Xrqljg==,
      }
    engines: { node: ">= 10" }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  "@next/swc-linux-arm64-musl@16.2.12":
    resolution:
      {
        integrity: sha512-0qjhiYBaKAqF63LA1ZWAAnKTzFUguAaZiRa5etMLGGPj/B6uEVjtIZldIzFEp3wHlB0koK6aTzqPtSdplTCjoA==,
      }
    engines: { node: ">= 10" }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  "@next/swc-linux-x64-gnu@16.2.12":
    resolution:
      {
        integrity: sha512-7A3q26W+h7gnA15uqBToNuDqBEFZZcqh0mW2mn4AJh/G5pdg2RVE3n4slzLEliASZFG3NmsbEzng/x2Sh09mBg==,
      }
    engines: { node: ">= 10" }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  "@next/swc-linux-x64-musl@16.2.12":
    resolution:
      {
        integrity: sha512-qSjL/uppm+cbh21s72Ss8gkiOhQ4dExWHNGOWy6eZV7STj5WsKehgxT61beSsOj+YYQuTplL376lOCdMQU5T8w==,
      }
    engines: { node: ">= 10" }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  "@next/swc-win32-arm64-msvc@16.2.12":
    resolution:
      {
        integrity: sha512-X6hzsOUJac/e7AWSbn9gQ9nzHld1xWP5iyjHpYWvud8pufB679O1xg4JDyKr8Xd69Jvd+kM2Der6uftiZCmjYA==,
      }
    engines: { node: ">= 10" }
    cpu: [arm64]
    os: [win32]

  "@next/swc-win32-x64-msvc@16.2.12":
    resolution:
      {
        integrity: sha512-F6fakeHuFTLOPt0bslQJdf+xtT+WIP9DVn/m4y1w1mRnVPyh3D/cNvzlRkxM444xfm+IvvYNSOrKiA2CDJ0Uxw==,
      }
    engines: { node: ">= 10" }
    cpu: [x64]
    os: [win32]

  "@noble/hashes@1.8.0":
    resolution:
      {
        integrity: sha512-jCs9ldd7NwzpgXDIf6P3+NrHh9/sD6CQdxHyjQI+h/6rDNo88ypBxxz45UDuZHz9r3tNz7N/VInSVoVdtXEI4A==,
      }
    engines: { node: ^14.21.3 || >=16 }

  "@nodelib/fs.scandir@2.1.5":
    resolution:
      {
        integrity: sha512-vq24Bq3ym5HEQm2NKCr3yXDwjc7vTsEThRDnkp2DK9p1uqLR+DHurm/NOTo0KG7HYHU7eppKZj3MyqYuMBf62g==,
      }
    engines: { node: ">= 8" }

  "@nodelib/fs.stat@2.0.5":
    resolution:
      {
        integrity: sha512-RkhPPp2zrqDAQA/2jNhnztcPAlv64XdhIp7a7454A5ovI7Bukxgt7MX7udwAu3zg1DcpPU0rz3VV1SeaqvY4+A==,
      }
    engines: { node: ">= 8" }

  "@nodelib/fs.walk@1.2.8":
    resolution:
      {
        integrity: sha512-oGB+UxlgWcgQkgwo8GcEGwemoTFt3FIO9ababBmaGwXIoBKZ+GTy0pP185beGg7Llih/NSHSV2XAs1lnznocSg==,
      }
    engines: { node: ">= 8" }

  "@nolyfill/is-core-module@1.0.39":
    resolution:
      {
        integrity: sha512-nn5ozdjYQpUCZlWGuxcJY/KpxkWQs4DcbMCmKojjyrYDEAGy4Ce19NN4v5MduafTwJlbKc99UA8YhSVqq9yPZA==,
      }
    engines: { node: ">=12.4.0" }

  "@oxc-project/types@0.144.0":
    resolution:
      {
        integrity: sha512-nuhZIOLuI6TFQ32I/WnUx+SCPY7SdSKwgnFHydAuoS1+Z4BRcaP+RRJmGzl9lw+0OFF7UmaESf7KQRXaNLHypg==,
      }

  "@paralleldrive/cuid2@2.3.1":
    resolution:
      {
        integrity: sha512-XO7cAxhnTZl0Yggq6jOgjiOHhbgcO4NqFqwSmQpjK3b6TEE6Uj/jfSk6wzYyemh3+I0sHirKSetjQwn5cZktFw==,
      }

  "@phc/format@1.0.0":
    resolution:
      {
        integrity: sha512-m7X9U6BG2+J+R1lSOdCiITLLrxm+cWlNI3HUFA92oLO77ObGNzaKdh8pMLqdZcshtkKuV84olNNXDfMc4FezBQ==,
      }
    engines: { node: ">=10" }

  "@pinojs/redact@0.4.0":
    resolution:
      {
        integrity: sha512-k2ENnmBugE/rzQfEcdWHcCY+/FM3VLzH9cYEsbdsoqrvzAKRhUZeRNhAZvB8OitQJ1TBed3yqWtdjzS6wJKBwg==,
      }

  "@pkgjs/parseargs@0.11.0":
    resolution:
      {
        integrity: sha512-+1VkjdD0QBLPodGrJUeqarH8VAIvQODIbwh9XpP5Syisf7YoQgsJKPNFoqqLQlu+VQ/tVSshMR6loPMn8U+dPg==,
      }
    engines: { node: ">=14" }

  "@prisma/adapter-pg@7.9.1":
    resolution:
      {
        integrity: sha512-Ho2RK1KanQxLNSC0sR5bpiiVep10sWPLXCcxK+KXfI/Q69TMRbiafSvLPv3V9snimX72rMCqGlyJ4sBO4lKTAw==,
      }

  "@prisma/client-runtime-utils@7.9.1":
    resolution:
      {
        integrity: sha512-mVIBGYdO5CFmK0HvjxrtfIyQQcPdb88pSCeVQriVQPVZyDovIWblpHfOgcS8QO187j3QF0ePArH8qPhp0AU2vg==,
      }

  "@prisma/client@7.9.1":
    resolution:
      {
        integrity: sha512-+xgrh2EhJVF79wC0yX5G4PI1Rdcm7Qn/nekNQ+t/O153wtNggruHal+fXHSa0QE+Tp/Cw5wvxeCEhZZ59xGm8Q==,
      }
    engines: { node: ^20.19 || ^22.12 || >=24.0 }
    peerDependencies:
      prisma: "*"
      typescript: ">=5.4.0"
    peerDependenciesMeta:
      prisma:
        optional: true
      typescript:
        optional: true

  "@prisma/config@7.9.1":
    resolution:
      {
        integrity: sha512-4znKhxTmXmuPye9Z6pbIyYb5VZlkZ05qG1L6Dr4g+7oTwc6V50Bs9XirFBDdjWt+H/AabMn9aUnxBcvj8z05aA==,
      }

  "@prisma/debug@7.2.0":
    resolution:
      {
        integrity: sha512-YSGTiSlBAVJPzX4ONZmMotL+ozJwQjRmZweQNIq/ER0tQJKJynNkRB3kyvt37eOfsbMCXk3gnLF6J9OJ4QWftw==,
      }

  "@prisma/debug@7.9.1":
    resolution:
      {
        integrity: sha512-/cpVZ4itxtcgB8GHBvZtcmuEjq+lWsLrRJxFMbwZrT1RIdtuKmUm7PPGo/wzfbYpBrk+9WmmBE8CHJw2rybKDQ==,
      }

  "@prisma/dev@0.24.17":
    resolution:
      {
        integrity: sha512-UvdZzmpFwknnfreh6Jije84ekkYGPYEJhXG1tFzCsCfQyzJifrOo38eZc0qajzvaC6OLUOrN9ML5XfCnEZL9DA==,
      }

  "@prisma/driver-adapter-utils@7.9.1":
    resolution:
      {
        integrity: sha512-vmHehG7nn/heW32DXXpp13DxxAxVVe6n250oEt3dOL2E/4bt3olktKZN0mzSuxMMronyMSkbeW2uCOn3F4g8RQ==,
      }

  "@prisma/engines-version@7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad":
    resolution:
      {
        integrity: sha512-2BsPPFksz3CQUXG6af3rVCtJKg6+JJGJTtfgu2fU8DdXhOfkBjulCq8mwybCd6ge0/jhZq2kOtLAbmUDMyI1nA==,
      }

  "@prisma/engines@7.9.1":
    resolution:
      {
        integrity: sha512-UprXSMNXx2NF5ow4pqaQtE8OuBz6K78B0wc0tn2L28G5r933iWp1DR9Do2qWrsNvvFIP3x6mpEWnQtckMO0Uhg==,
      }

  "@prisma/fetch-engine@7.9.1":
    resolution:
      {
        integrity: sha512-9DwxrNTeT25Orbu9CWh0CZvVlyY1lmscpbaeLZcOnuR7zcuFrt91YSmmOfIm7zJ08YOZ6mVzURKwLoMwEBcK8w==,
      }

  "@prisma/get-platform@7.2.0":
    resolution:
      {
        integrity: sha512-k1V0l0Td1732EHpAfi2eySTezyllok9dXb6UQanajkJQzPUGi3vO2z7jdkz67SypFTdmbnyGYxvEvYZdZsMAVA==,
      }

  "@prisma/get-platform@7.9.1":
    resolution:
      {
        integrity: sha512-PK8R60YZRQvYxBrGG9i7l2/rFyzy+2MuI1dKtmtrCqPH8YpiJx/MfiC7LRzX5786rZDEv7BngcjfIJW4/9ADuw==,
      }

  "@prisma/query-plan-executor@7.2.0":
    resolution:
      {
        integrity: sha512-EOZmNzcV8uJ0mae3DhTsiHgoNCuu1J9mULQpGCh62zN3PxPTd+qI9tJvk5jOst8WHKQNwJWR3b39t0XvfBB0WQ==,
      }

  "@prisma/streams-local@0.1.11":
    resolution:
      {
        integrity: sha512-0TcebL559MByKqTJ+SsrFIEg228iw8UCVRFckzgfRSiJqczhs+MuAgWOF9lnOIV/IVqvu+KMnFTH0eDeTQMpUg==,
      }
    engines: { bun: ">=1.2.0", node: ">=22.0.0" }

  "@prisma/studio-core@0.33.0":
    resolution:
      {
        integrity: sha512-V2fX/nKEymNTrHXwfP26PGjoLStO35Ogu+ex7CFJbLrMYEcZxxZpiSNOs7px23Hk5mzLWvM5RsqG6Ka+rha+wg==,
      }
    engines: { node: ^20.19 || ^22.12 || >=24.0, pnpm: "8" }
    peerDependencies:
      "@types/react": ^18.0.0 || ^19.0.0
      react: ^18.0.0 || ^19.0.0
      react-dom: ^18.0.0 || ^19.0.0

  "@protobufjs/aspromise@1.1.2":
    resolution:
      {
        integrity: sha512-j+gKExEuLmKwvz3OgROXtrJ2UG2x8Ch2YZUxahh+s1F2HZ+wAceUNLkvy6zKCPVRkU++ZWQrdxsUeQXmcg4uoQ==,
      }

  "@protobufjs/base64@1.1.2":
    resolution:
      {
        integrity: sha512-AZkcAA5vnN/v4PDqKyMR5lx7hZttPDgClv83E//FMNhR2TMcLUhfRUBHCmSl0oi9zMgDDqRUJkSxO3wm85+XLg==,
      }

  "@protobufjs/codegen@2.0.5":
    resolution:
      {
        integrity: sha512-zgXFLzW3Ap33e6d0Wlj4MGIm6Ce8O89n/apUaGNB/jx+hw+ruWEp7EwGUshdLKVRCxZW12fp9r40E1mQrf/34g==,
      }

  "@protobufjs/eventemitter@1.1.1":
    resolution:
      {
        integrity: sha512-vW1GmwMZNnL+gMRaovlh9yZX74kc+TTU3FObkkurpMaRtBfLP3ldjS9KQWlwZgraRE0+dheEEoAxdzcJQ8eXZg==,
      }

  "@protobufjs/fetch@1.1.1":
    resolution:
      {
        integrity: sha512-GpptLrs57adMSuHi3VNj0mAF8dwh36LMaYF6XyJ6JMWlVsc+t42tm1HSEDmOs3A8fC9yyeisgLhsTVQokOZ0zw==,
      }

  "@protobufjs/float@1.0.2":
    resolution:
      {
        integrity: sha512-Ddb+kVXlXst9d+R9PfTIxh1EdNkgoRe5tOX6t01f1lYWOvJnSPDBlG241QLzcyPdoNTsblLUdujGSE4RzrTZGQ==,
      }

  "@protobufjs/path@1.1.2":
    resolution:
      {
        integrity: sha512-6JOcJ5Tm08dOHAbdR3GrvP+yUUfkjG5ePsHYczMFLq3ZmMkAD98cDgcT2iA1lJ9NVwFd4tH/iSSoe44YWkltEA==,
      }

  "@protobufjs/pool@1.1.0":
    resolution:
      {
        integrity: sha512-0kELaGSIDBKvcgS4zkjz1PeddatrjYcmMWOlAuAPwAeccUrPHdUqo/J6LiymHHEiJT5NrF1UVwxY14f+fy4WQw==,
      }

  "@protobufjs/utf8@1.1.2":
    resolution:
      {
        integrity: sha512-b1UQwcEZ4yCnMCD8DAL1VlbvBJE9/IX4FTIp7BG1xYpf29SLazLSrqUkj4w7Y5y7cCVP6E5tcqqcI0xemPkHug==,
      }

  "@radix-ui/primitive@1.1.3":
    resolution:
      {
        integrity: sha512-JTF99U/6XIjCBo0wqkU5sK10glYe27MRRsfwoiq5zzOEZLHU3A3KCMa5X/azekYRCJ0HlwI0crAXS/5dEHTzDg==,
      }

  "@radix-ui/react-compose-refs@1.1.2":
    resolution:
      {
        integrity: sha512-z4eqJvfiNnFMHIIvXP3CY57y2WJs5g2v3X0zm9mEJkrkNv4rDxu+sg9Jh8EkXyeqBkB7SOcboo9dMVqhyrACIg==,
      }
    peerDependencies:
      "@types/react": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true

  "@radix-ui/react-primitive@2.1.3":
    resolution:
      {
        integrity: sha512-m9gTwRkhy2lvCPe6QJp4d3G1TYEUHn/FzJUtq9MjH46an1wJU+GdoGC5VLof8RX8Ft/DlpshApkhswDLZzHIcQ==,
      }
    peerDependencies:
      "@types/react": "*"
      "@types/react-dom": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true
      "@types/react-dom":
        optional: true

  "@radix-ui/react-slot@1.2.3":
    resolution:
      {
        integrity: sha512-aeNmHnBxbi2St0au6VBVC7JXFlhLlOnvIIlePNniyUNAClzmtAUEY8/pBiK3iHjufOlwA+c20/8jngo7xcrg8A==,
      }
    peerDependencies:
      "@types/react": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true

  "@radix-ui/react-toggle@1.1.10":
    resolution:
      {
        integrity: sha512-lS1odchhFTeZv3xwHH31YPObmJn8gOg7Lq12inrr0+BH/l3Tsq32VfjqH1oh80ARM3mlkfMic15n0kg4sD1poQ==,
      }
    peerDependencies:
      "@types/react": "*"
      "@types/react-dom": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
      react-dom: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true
      "@types/react-dom":
        optional: true

  "@radix-ui/react-use-controllable-state@1.2.2":
    resolution:
      {
        integrity: sha512-BjasUjixPFdS+NKkypcyyN5Pmg83Olst0+c6vGov0diwTEo6mgdqVR6hxcEgFuh4QrAs7Rc+9KuGJ9TVCj0Zzg==,
      }
    peerDependencies:
      "@types/react": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true

  "@radix-ui/react-use-effect-event@0.0.2":
    resolution:
      {
        integrity: sha512-Qp8WbZOBe+blgpuUT+lw2xheLP8q0oatc9UpmiemEICxGvFLYmHm9QowVZGHtJlGbS6A6yJ3iViad/2cVjnOiA==,
      }
    peerDependencies:
      "@types/react": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true

  "@radix-ui/react-use-layout-effect@1.1.1":
    resolution:
      {
        integrity: sha512-RbJRS4UWQFkzHTTwVymMTUv8EqYhOp8dOOviLj2ugtTiXRaRQS7GLGxZTLL1jWhMeoSCf5zmcZkqTl9IiYfXcQ==,
      }
    peerDependencies:
      "@types/react": "*"
      react: ^16.8 || ^17.0 || ^18.0 || ^19.0 || ^19.0.0-rc
    peerDependenciesMeta:
      "@types/react":
        optional: true

  "@rolldown/binding-android-arm64@1.2.4":
    resolution:
      {
        integrity: sha512-jHC2cnyKz5xU2fhECtFl8OZ83cYNt13GZQD+0uMJ/X3o+ijmd56okHhTUwxVSHPx1IRVIJEZ1/1pPzeLCU6XKA==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm64]
    os: [android]

  "@rolldown/binding-darwin-arm64@1.2.4":
    resolution:
      {
        integrity: sha512-Dc5mPD8F5F/FS8i01syd7FTF6yB2fVthH/TRkjwJkzUK6EpoxHtqvZQP5Zwq80/5z19TWYHIg1KOHboCgVx/aQ==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm64]
    os: [darwin]

  "@rolldown/binding-darwin-x64@1.2.4":
    resolution:
      {
        integrity: sha512-fpDm4oBo6SqLvWUYCmFhdde3U9KH2fRNNMeAnAPAIwxRL345xutL0EtEUcuoxsoazdJGv/MuDBQHlCDrtbvqOg==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [x64]
    os: [darwin]

  "@rolldown/binding-freebsd-x64@1.2.4":
    resolution:
      {
        integrity: sha512-rSJoreDE/HoIzoaib6MTp5jQtCTdMHKIvItAKT/ImS6Y6Ww76oUaeMyp4Vc/fAgd/ehji068IxetHXAnqUwN9A==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [x64]
    os: [freebsd]

  "@rolldown/binding-linux-arm-gnueabihf@1.2.4":
    resolution:
      {
        integrity: sha512-/jm8OGHgn7oGaJu3i/qZI9spUGcJ+y/lk43ttQ/iO1tOd9NissG6o97bighBCiL+BKRngmcDuR6ikfwYdJmVuQ==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm]
    os: [linux]

  "@rolldown/binding-linux-arm64-gnu@1.2.4":
    resolution:
      {
        integrity: sha512-tIP06BeD9EqvECBrPZ+sqdPlYrT+aYaAiu1wYziVx5elRK/ftm33JxVDy2bXGbr6J0CrtirCkR87/X5a2euEng==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  "@rolldown/binding-linux-arm64-musl@1.2.4":
    resolution:
      {
        integrity: sha512-Ql1Q0EQqVThvn9VAVlwNzsUvbSFtCMGjLpRRi4pk5i7NZZ4n5ISiLMjHYtus4VQ2PvkSw24zyaCVsiS+sXPj1w==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  "@rolldown/binding-linux-ppc64-gnu@1.2.4":
    resolution:
      {
        integrity: sha512-GjbjXD4XXfN19D0LZNbmiCBUoDiRACsYHr0yaIbbn8aFsXjHZifcYqu/W5Er5X2X990WjHXFrxarn5chzItorQ==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [ppc64]
    os: [linux]
    libc: [glibc]

  "@rolldown/binding-linux-s390x-gnu@1.2.4":
    resolution:
      {
        integrity: sha512-p5WR0NOwaRmJ/B1b6IjEFLLivwEsf3PrdBIhRbhTCQisbo2SvHHpG4ELB/+FgQNnB88LTOF86upmJmbvZdQ2lw==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [s390x]
    os: [linux]
    libc: [glibc]

  "@rolldown/binding-linux-x64-gnu@1.2.4":
    resolution:
      {
        integrity: sha512-4/GyVjmhR+Tc6HLJvwc1sOhPqAZtySiSMesOZyX6JQ5XBxoTDEMKQzvo07NIK6nTon/SivlZqvhzvuVBNQhObQ==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  "@rolldown/binding-linux-x64-musl@1.2.4":
    resolution:
      {
        integrity: sha512-l9eeLsCNvPpmSXUej0etw/J1eqV0Jj1D5G/xG6YTijmE6dkv6E2QezgWbTfQk63v952DPqrjOCoiqxq7Bw0YUQ==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  "@rolldown/binding-openharmony-arm64@1.2.4":
    resolution:
      {
        integrity: sha512-e0F355MSTMm3+UOqtV3L24gFUp2N5m1f8L/7d56deik6va+AXdrt9F8LbzGpeWGWRbZEDq4m8NVnJDeBtf9DZg==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm64]
    os: [openharmony]

  "@rolldown/binding-win32-arm64-msvc@1.2.4":
    resolution:
      {
        integrity: sha512-AWLi0uBRYh6QlE7OKhiz+phZC0qwtij2QZmhmOdsLdFn64m7oMpooE9ICE3lhm9xMb4SpDo2WbHcxX1iFLFtqw==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [arm64]
    os: [win32]

  "@rolldown/binding-win32-x64-msvc@1.2.4":
    resolution:
      {
        integrity: sha512-UwSDJOg3dqCAejWdxclJjCsh3Qq4vLYMDxmyHqo1btz3stK2VqgwNd3mm5tuIwzSlGIQ/1H9Hr+Zn09mrezNqQ==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    cpu: [x64]
    os: [win32]

  "@rolldown/pluginutils@1.0.1":
    resolution:
      {
        integrity: sha512-2j9bGt5Jh8hj+vPtgzPtl72j0yRxHAyumoo6TNfAjsLB04UtpSvPbPcDcBMxz7n+9CYB0c1GxQFxYRg2jimqGw==,
      }

  "@rtsao/scc@1.1.0":
    resolution:
      {
        integrity: sha512-zt6OdqaDoOnJ1ZYsCYGt9YmWzDXl4vQdKTyJev62gFhRGKdx7mcT54V9KIjg+d2wi9EXsPvAPKe7i7WjfVWB8g==,
      }

  "@stablelib/base64@1.0.1":
    resolution:
      {
        integrity: sha512-1bnPQqSxSuc3Ii6MhBysoWCg58j97aUjuCSZrGSmDxNqtytIi0k8utUenAwTZN4V5mXXYGsVUI9zeBqy+jBOSQ==,
      }

  "@standard-schema/spec@1.1.0":
    resolution:
      {
        integrity: sha512-l2aFy5jALhniG5HgqrD6jXLi/rUWrKvqN/qJx6yoJsgKhblVd+iqqU4RCXavm/jPityDo5TCvKMnpjKnOriy0w==,
      }

  "@standard-schema/utils@0.3.0":
    resolution:
      {
        integrity: sha512-e7Mew686owMaPJVNNLs55PUvgz371nKgwsc4vxE49zsODpJEnxgxRo2y/OKrqueavXgZNMDVj3DdHFlaSAeU8g==,
      }

  "@swc/helpers@0.5.15":
    resolution:
      {
        integrity: sha512-JQ5TuMi45Owi4/BIMAJBoSQoOJu12oOk/gADqlcUL9JEdHB8vyjUSsxqeNXnmXHjYKMi2WcYtezGEEhqUI/E2g==,
      }

  "@tailwindcss/node@4.3.3":
    resolution:
      {
        integrity: sha512-/T8IKEsf9VTU6tLjgC7+sv2mOPtQxzE2jMw7u4Tt40Tx+QSZxpzh95/H6cMKoja9XuW7iMdLJYBB0o9G1CaAgg==,
      }

  "@tailwindcss/oxide-android-arm64@4.3.3":
    resolution:
      {
        integrity: sha512-Y85A2gmPSkl5Ve5qR86GL4HT509cFqQh1aes9p3sSkyTPwt0Pppf3GkwGe4JPACcRYjgJIEhQgM6dBClnr0NYw==,
      }
    engines: { node: ">= 20" }
    cpu: [arm64]
    os: [android]

  "@tailwindcss/oxide-darwin-arm64@4.3.3":
    resolution:
      {
        integrity: sha512-BiaWatpBcERQFDlOjRDpIVXuFK5PJez5SA4JMg6VYZdBYU+qKfV/vqjcIs+IYmtitf1xYQZTwXvU/8y4lfZUGw==,
      }
    engines: { node: ">= 20" }
    cpu: [arm64]
    os: [darwin]

  "@tailwindcss/oxide-darwin-x64@4.3.3":
    resolution:
      {
        integrity: sha512-fAeUqfV5ndhxRwai8cXGzdLvul9utWOmeTkv69unv4ZXixjn61Z+p9lCWdwOwA3TYboG3BwdVuN/RDjhBRl0mw==,
      }
    engines: { node: ">= 20" }
    cpu: [x64]
    os: [darwin]

  "@tailwindcss/oxide-freebsd-x64@4.3.3":
    resolution:
      {
        integrity: sha512-iyf5bV6+wnAlflVeEy7R25dupxTNECZN5QMI0qNT6eT+EgaGdZcKhGkr5SdoaWiLJ3spLqIY9VCeSGrwmtg4kw==,
      }
    engines: { node: ">= 20" }
    cpu: [x64]
    os: [freebsd]

  "@tailwindcss/oxide-linux-arm-gnueabihf@4.3.3":
    resolution:
      {
        integrity: sha512-aAYUprJAJQWWbRrPvtjdroZ56Md+JM8pMiopS6xGEwDfLhqj+2ver2p4nU4Mb3CRqcMmNBjo8KkUgcxhkzVQGQ==,
      }
    engines: { node: ">= 20" }
    cpu: [arm]
    os: [linux]

  "@tailwindcss/oxide-linux-arm64-gnu@4.3.3":
    resolution:
      {
        integrity: sha512-nDxldcEENOxZRzC2uu9jrutZdAAQtb+8WWDCSnWL1zvBk1+FN+x6MtDViPB5AJMfttVCUhehGWus3XBPgatM/w==,
      }
    engines: { node: ">= 20" }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  "@tailwindcss/oxide-linux-arm64-musl@4.3.3":
    resolution:
      {
        integrity: sha512-Md44bD6veX/PC5iyF8cDVnw4HBIANZepRZZ7a8DQOvkfo5WUBwcp6iAuCUz23u+4SUkhJlD3eL7hNdW8ezd/kA==,
      }
    engines: { node: ">= 20" }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  "@tailwindcss/oxide-linux-x64-gnu@4.3.3":
    resolution:
      {
        integrity: sha512-tx7us1muwOKAKWao2v/GaafFeQboE6aj88vC6ziN2NCGcRm8gWUhwjzg+YdVB1e4boAtdtma4L43onunI6NS4w==,
      }
    engines: { node: ">= 20" }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  "@tailwindcss/oxide-linux-x64-musl@4.3.3":
    resolution:
      {
        integrity: sha512-SJxX60smvHgasZoBy11dX6YRjXJFovwWBoedhbQPOBzgFWBHGB+TVPWB9BxzR7TTxU8FQZAI2AyiNCMzFm8Img==,
      }
    engines: { node: ">= 20" }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  "@tailwindcss/oxide-wasm32-wasi@4.3.3":
    resolution:
      {
        integrity: sha512-jx1+rPhY/5Ympkktd656HBWEBLxP7dH06losBLjjf5vgCODXvi9KhtftWcMIwTFIDqBr7cRnQkdLnAG+IOlGvQ==,
      }
    engines: { node: ">=14.0.0" }
    cpu: [wasm32]
    bundledDependencies:
      - "@napi-rs/wasm-runtime"
      - "@emnapi/core"
      - "@emnapi/runtime"
      - "@tybys/wasm-util"
      - "@emnapi/wasi-threads"
      - tslib

  "@tailwindcss/oxide-win32-arm64-msvc@4.3.3":
    resolution:
      {
        integrity: sha512-3rc292Ca2ceK6Ulcc/bAVnTs/3nDtoPhyEKlgPv+yQJQi/JS/AMJlqzxvlDacL1nekbrcf6bTqp/jV4qgnPxNQ==,
      }
    engines: { node: ">= 20" }
    cpu: [arm64]
    os: [win32]

  "@tailwindcss/oxide-win32-x64-msvc@4.3.3":
    resolution:
      {
        integrity: sha512-yJ0pwIVc/nYeGoV02WtsN8KYyLQv7kyI2wDnkezyJlGGjkd4QLwDGAwl47YpPJeuI0M0ObaXGSPjvWDPeTPggw==,
      }
    engines: { node: ">= 20" }
    cpu: [x64]
    os: [win32]

  "@tailwindcss/oxide@4.3.3":
    resolution:
      {
        integrity: sha512-krXjAikiaFSPaK/FkAQT5UTx3VormQaiZ5hBFlJZ9UFQGB/rwg1MZIhHAG9smMQRTdyJxP6Qt5MwMtdyU5FWrA==,
      }
    engines: { node: ">= 20" }

  "@tailwindcss/postcss@4.3.3":
    resolution:
      {
        integrity: sha512-JTSZZGQi1AyKirbLN3azmjVzef92tcX7h+iSqPdaeStyFpGpDlKvvpxeOE8njhbUanbRwr3z8DyzhICWnMtQeg==,
      }

  "@tanstack/query-core@5.101.4":
    resolution:
      {
        integrity: sha512-gNwcvOJcRbLWPOLG/2OBm+zM+Yv+MKsXKEOWC57USuZDEsI71hEErQsiEGx5wX9rzWWkfwM0fVSPoiIFSsxfiw==,
      }

  "@tanstack/react-query@5.101.4":
    resolution:
      {
        integrity: sha512-yRg2pfOCxIs4ZJW3XYYHU/WgtD04FHSnfHlpRT7h7pR77hwkdRG4wxbKe4aq6P0RvXUTBSQpQeadS1SUYUe+KA==,
      }
    peerDependencies:
      react: ^18 || ^19

  "@testcontainers/postgresql@12.1.0":
    resolution:
      {
        integrity: sha512-Pjf2VSVNirEPfz36nidyrVAnZvc2YhajOznY4VgyEsvfTd5qiMNOuPq96drREvxAUtXl5SFLX7vXj7sSq4aTcA==,
      }

  "@testing-library/dom@10.4.1":
    resolution:
      {
        integrity: sha512-o4PXJQidqJl82ckFaXUeoAW+XysPLauYI43Abki5hABd853iMhitooc6znOnczgbTYmEP6U6/y1ZyKAIsvMKGg==,
      }
    engines: { node: ">=18" }

  "@testing-library/jest-dom@6.9.1":
    resolution:
      {
        integrity: sha512-zIcONa+hVtVSSep9UT3jZ5rizo2BsxgyDYU7WFD5eICBE7no3881HGeb/QkGfsJs6JTkY1aQhT7rIPC7e+0nnA==,
      }
    engines: { node: ">=14", npm: ">=6", yarn: ">=1" }

  "@testing-library/react@16.3.2":
    resolution:
      {
        integrity: sha512-XU5/SytQM+ykqMnAnvB2umaJNIOsLF3PVv//1Ew4CTcpz0/BRyy/af40qqrt7SjKpDdT1saBMc42CUok5gaw+g==,
      }
    engines: { node: ">=18" }
    peerDependencies:
      "@testing-library/dom": ^10.0.0
      "@types/react": ^18.0.0 || ^19.0.0
      "@types/react-dom": ^18.0.0 || ^19.0.0
      react: ^18.0.0 || ^19.0.0
      react-dom: ^18.0.0 || ^19.0.0
    peerDependenciesMeta:
      "@types/react":
        optional: true
      "@types/react-dom":
        optional: true

  "@turbo/darwin-64@2.10.8":
    resolution:
      {
        integrity: sha512-po+7rfJfUnFXjWlcoN2RwhErgzCdRtBc1T26vYPcywHlggmCQiQe1uWaE4j+BibI2uY9/2pDoFzMN0rmSaPFOw==,
      }
    cpu: [x64]
    os: [darwin]

  "@turbo/darwin-arm64@2.10.8":
    resolution:
      {
        integrity: sha512-+zB2btDJ00lnPRuqOvpVvgl4x34k/djZQGZTTCfjn7JgNCl8QFY5Njo5+dqkY1g/+9gbbsnAvWm9CmJg9ebcXA==,
      }
    cpu: [arm64]
    os: [darwin]

  "@turbo/linux-64@2.10.8":
    resolution:
      {
        integrity: sha512-K1dxqiVisyN7cViVsfQLs6xscQbYuI8aO2nbUhFURDACgEDfZRdP/b4CCxeosBJpcMfhYyiibWqJorCnvz9kKg==,
      }
    cpu: [x64]
    os: [android, linux]

  "@turbo/linux-arm64@2.10.8":
    resolution:
      {
        integrity: sha512-Gi77ibVnrE1fEmvr+/wBD/yvRqhwp/RQuCp2+//lv1U1wNFFyVg0V7Wj8FG9FXPFAw5QHReo8rxc9+wBSDZjzA==,
      }
    cpu: [arm64]
    os: [android, linux]

  "@turbo/windows-64@2.10.8":
    resolution:
      {
        integrity: sha512-znnLO1haJPYTHoKMKwlAvlkjRiYbbhBzME6wIGaMd+fwir23U6jVd1ecaTWWi1fbnRVqxMfgDBKseQ/hLKb83g==,
      }
    cpu: [x64]
    os: [win32]

  "@turbo/windows-arm64@2.10.8":
    resolution:
      {
        integrity: sha512-VN30vh3b3Czh2WzYHNTfF1FE0YMZ5aHsLO8dBMGHJewA6792wX6iJR8ZxlzFW6WdOu0gEAKIvlYhfyT81Wkm4Q==,
      }
    cpu: [arm64]
    os: [win32]

  "@tybys/wasm-util@0.10.3":
    resolution:
      {
        integrity: sha512-F3fo1MYrRJYL3zER0OUOmkutjr1Vp23m7OsSgp7nq4SP6OqX6C/56XFIPAl5bt3zaBRjmW7SGz3u/6LwFpYcOg==,
      }

  "@types/aria-query@5.0.4":
    resolution:
      {
        integrity: sha512-rfT93uj5s0PRL7EzccGMs3brplhcrghnDoV26NqKhCAS1hVo+WdNsPvE/yb6ilfr5hi2MEk6d5EWJTKdxg8jVw==,
      }

  "@types/body-parser@1.19.6":
    resolution:
      {
        integrity: sha512-HLFeCYgz89uk22N5Qg3dvGvsv46B8GLvKKo1zKG4NybA8U2DiEO3w9lqGg29t/tfLRJpJ6iQxnVw4OnB7MoM9g==,
      }

  "@types/chai@5.2.3":
    resolution:
      {
        integrity: sha512-Mw558oeA9fFbv65/y4mHtXDs9bPnFMZAL/jxdPFUpOHHIXX91mcgEHbS5Lahr+pwZFR8A7GQleRWeI6cGFC2UA==,
      }

  "@types/compression@1.8.1":
    resolution:
      {
        integrity: sha512-kCFuWS0ebDbmxs0AXYn6e2r2nrGAb5KwQhknjSPSPgJcGd8+HVSILlUyFhGqML2gk39HcG7D1ydW9/qpYkN00Q==,
      }

  "@types/connect@3.4.38":
    resolution:
      {
        integrity: sha512-K6uROf1LD88uDQqJCktA4yzL1YYAK6NgfsI0v/mTgyPKWsX1CnJ0XPSDhViejru1GcRkLWb8RlzFYJRqGUbaug==,
      }

  "@types/cookie-parser@1.4.10":
    resolution:
      {
        integrity: sha512-B4xqkqfZ8Wek+rCOeRxsjMS9OgvzebEzzLYw7NHYuvzb7IdxOkI0ZHGgeEBX4PUM7QGVvNSK60T3OvWj3YfBRg==,
      }
    peerDependencies:
      "@types/express": "*"

  "@types/cookiejar@2.1.5":
    resolution:
      {
        integrity: sha512-he+DHOWReW0nghN24E1WUqM0efK4kI9oTqDm6XmK8ZPe2djZ90BSNdGnIyCLzCPw7/pogPlGbzI2wHGGmi4O/Q==,
      }

  "@types/cors@2.8.19":
    resolution:
      {
        integrity: sha512-mFNylyeyqN93lfe/9CSxOGREz8cpzAhH+E93xJ4xWQf62V8sQ/24reV2nyzUWM6H6Xji+GGHpkbLe7pVoUEskg==,
      }

  "@types/d3-array@3.0.3":
    resolution:
      {
        integrity: sha512-Reoy+pKnvsksN0lQUlcH6dOGjRZ/3WRwXR//m+/8lt1BXeI4xyaUZoqULNjyXXRuh0Mj4LNpkCvhUpQlY3X5xQ==,
      }

  "@types/d3-color@3.1.0":
    resolution:
      {
        integrity: sha512-HKuicPHJuvPgCD+np6Se9MQvS6OCbJmOjGvylzMJRlDwUXjKTTXs6Pwgk79O09Vj/ho3u1ofXnhFOaEWWPrlwA==,
      }

  "@types/d3-delaunay@6.0.1":
    resolution:
      {
        integrity: sha512-tLxQ2sfT0p6sxdG75c6f/ekqxjyYR0+LwPrsO1mbC9YDBzPJhs2HbJJRrn8Ez1DBoHRo2yx7YEATI+8V1nGMnQ==,
      }

  "@types/d3-format@3.0.1":
    resolution:
      {
        integrity: sha512-5KY70ifCCzorkLuIkDe0Z9YTf9RR2CjBX1iaJG+rgM/cPP+sO+q9YdQ9WdhQcgPj1EQiJ2/0+yUkkziTG6Lubg==,
      }

  "@types/d3-geo@3.1.0":
    resolution:
      {
        integrity: sha512-856sckF0oP/diXtS4jNsiQw/UuK5fQG8l/a9VVLeSouf1/PPbBE1i1W852zVwKwYCBkFJJB7nCFTbk6UMEXBOQ==,
      }

  "@types/d3-interpolate@3.0.1":
    resolution:
      {
        integrity: sha512-jx5leotSeac3jr0RePOH1KdR9rISG91QIE4Q2PYTu4OymLTZfA3SrnURSLzKH48HmXVUru50b8nje4E79oQSQw==,
      }

  "@types/d3-path@3.1.1":
    resolution:
      {
        integrity: sha512-VMZBYyQvbGmWyWVea0EHs/BwLgxc+MKi1zLDCONksozI4YJMcTt8ZEuIR4Sb1MMTE8MMW49v0IwI5+b7RmfWlg==,
      }

  "@types/d3-scale@4.0.2":
    resolution:
      {
        integrity: sha512-Yk4htunhPAwN0XGlIwArRomOjdoBFXC3+kCxK2Ubg7I9shQlVSJy/pG/Ht5ASN+gdMIalpk8TJ5xV74jFsetLA==,
      }

  "@types/d3-shape@3.1.7":
    resolution:
      {
        integrity: sha512-VLvUQ33C+3J+8p+Daf+nYSOsjB4GXp19/S/aGo60m9h1v6XaxjiT82lKVWJCfzhtuZ3yD7i/TPeC/fuKLLOSmg==,
      }

  "@types/d3-time-format@2.1.0":
    resolution:
      {
        integrity: sha512-/myT3I7EwlukNOX2xVdMzb8FRgNzRMpsZddwst9Ld/VFe6LyJyRp0s32l/V9XoUzk+Gqu56F/oGk6507+8BxrA==,
      }

  "@types/d3-time@3.0.0":
    resolution:
      {
        integrity: sha512-sZLCdHvBUcNby1cB6Fd3ZBrABbjz3v1Vm90nysCQ6Vt7vd6e/h9Lt7SiJUoEX0l4Dzc7P5llKyhqSi1ycSf1Hg==,
      }

  "@types/deep-eql@4.0.2":
    resolution:
      {
        integrity: sha512-c9h9dVVMigMPc4bwTvC5dxqtqJZwQPePsWjPlpSOnojbor6pGqdk541lfA7AqFQr5pB1BRdq0juY9db81BwyFw==,
      }

  "@types/docker-modem@3.0.6":
    resolution:
      {
        integrity: sha512-yKpAGEuKRSS8wwx0joknWxsmLha78wNMe9R2S3UNsVOkZded8UqOrV8KoeDXoXsjndxwyF3eIhyClGbO1SEhEg==,
      }

  "@types/dockerode@4.0.1":
    resolution:
      {
        integrity: sha512-cmUpB+dPN955PxBEuXE3f6lKO1hHiIGYJA46IVF3BJpNsZGvtBDcRnlrHYHtOH/B6vtDOyl2kZ2ShAu3mgc27Q==,
      }

  "@types/estree@1.0.8":
    resolution:
      {
        integrity: sha512-dWHzHa2WqEXI/O1E9OjrocMTKJl2mSrEolh1Iomrv6U+JuNwaHXsXx9bLu5gG7BUWFIN0skIQJQ/L1rIex4X6w==,
      }

  "@types/express-serve-static-core@5.1.3":
    resolution:
      {
        integrity: sha512-dPfW8NFiOF4wOHc7+N/QSxlY9cfSsenewGbAz8C8U/MULPd/YZ27LvJUIlzaXie7e6Ove9YunJGgC9tbHD2cKw==,
      }

  "@types/express@5.0.6":
    resolution:
      {
        integrity: sha512-sKYVuV7Sv9fbPIt/442koC7+IIwK5olP1KWeD88e/idgoJqDm3JV/YUiPwkoKK92ylff2MGxSz1CSjsXelx0YA==,
      }

  "@types/geojson@7946.0.16":
    resolution:
      {
        integrity: sha512-6C8nqWur3j98U6+lXDfTUWIfgvZU+EumvpHKcYjujKH7woYyLj2sUmff0tRhrqM7BohUw7Pz3ZB1jj2gW9Fvmg==,
      }

  "@types/http-errors@2.0.5":
    resolution:
      {
        integrity: sha512-r8Tayk8HJnX0FztbZN7oVqGccWgw98T/0neJphO91KkmOzug1KkofZURD4UaD5uH8AqcFLfdPErnBod0u71/qg==,
      }

  "@types/json-schema@7.0.15":
    resolution:
      {
        integrity: sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==,
      }

  "@types/json5@0.0.29":
    resolution:
      {
        integrity: sha512-dRLjCWHYg4oaA77cxO64oO+7JwCwnIzkZPdrrC71jQmQtlhM556pwKo5bUzqvZndkVbeFLIIi+9TC40JNF5hNQ==,
      }

  "@types/jsonwebtoken@9.0.10":
    resolution:
      {
        integrity: sha512-asx5hIG9Qmf/1oStypjanR7iKTv0gXQ1Ov/jfrX6kS/EO0OFni8orbmGCn0672NHR3kXHwpAwR+B368ZGN/2rA==,
      }

  "@types/lodash@4.17.25":
    resolution:
      {
        integrity: sha512-+K1NIO8I+F9/wNulfVvu23QYd0Pe9/OCqRrim4NoYIf1VoEDL90Ve4ClzpyqBLc7NpGGWRvYNCKZ1BE/Jpf8dQ==,
      }

  "@types/methods@1.1.4":
    resolution:
      {
        integrity: sha512-ymXWVrDiCxTBE3+RIrrP533E70eA+9qu7zdWoHuOmGujkYtzf4HQF96b8nwHLqhuf4ykX61IGRIB38CC6/sImQ==,
      }

  "@types/ms@2.1.0":
    resolution:
      {
        integrity: sha512-GsCCIZDE/p3i96vtEqx+7dBUGXrc7zeSK3wwPHIaRThS+9OhWIXRqzs4d6k1SVU8g91DrNRWxWUGhp5KXQb2VA==,
      }

  "@types/node@18.19.130":
    resolution:
      {
        integrity: sha512-GRaXQx6jGfL8sKfaIDD6OupbIHBr9jv7Jnaml9tB7l4v068PAOXqfcujMMo5PhbIs6ggR1XODELqahT2R8v0fg==,
      }

  "@types/node@24.13.3":
    resolution:
      {
        integrity: sha512-Dh8vAsV36ig5wa9OX4pXvMc9D3Veibfw2wix0CUwYODLD8nkj9UsLjASr49nPg+2eKzxhBV+v7L8pXvT4e639Q==,
      }

  "@types/nodemailer@8.0.1":
    resolution:
      {
        integrity: sha512-PxpaInm8V1JQDd4j0ds5HfvWQk8JupS1C0Picb96QJsrrRDjBH+DlK7L4ZdNSqNULhiZRQHc40nLVShaGxXAMw==,
      }

  "@types/pg@8.20.3":
    resolution:
      {
        integrity: sha512-4Tvg+HO6+oQaAkpT8GTYoSExzpGGZz532GXgbbCElWJQeQdMozBWxEKNBhJJpHFjWXsMxqPbyypvj/89FWNoSQ==,
      }

  "@types/qs@6.15.1":
    resolution:
      {
        integrity: sha512-GZHUBZR9hckSUhrxmp1nG6NwdpM9fCunJwyThLW1X3AyHgd9IlHb6VANpQQqDr2o/qQp6McZ3y/IA2rVzKzSbw==,
      }

  "@types/range-parser@1.2.7":
    resolution:
      {
        integrity: sha512-hKormJbkJqzQGhziax5PItDUTMAM9uE2XXQmM37dyd4hVM+5aVl7oVxMVUiVQn2oCQFN/LKCZdvSM0pFRqbSmQ==,
      }

  "@types/react-dom@19.2.4":
    resolution:
      {
        integrity: sha512-Bsc+QHgp+P/F02XDzNCY9jnZNCUuLki36KT7VKrTXXLdHf+vHMNZnW1rVu5DNW/rCK+fya3DATySbLM4yhtKUw==,
      }
    peerDependencies:
      "@types/react": ^19.2.0

  "@types/react@19.2.18":
    resolution:
      {
        integrity: sha512-AnzbBERsrLKtk2XSfTbYRLjQPdy116Sty4q+T+Bp3IC4l6jNBvreVPAHmpq9qhXQM7CXZPjLVmGMw9sy+hxQ3w==,
      }

  "@types/send@1.2.1":
    resolution:
      {
        integrity: sha512-arsCikDvlU99zl1g69TcAB3mzZPpxgw0UQnaHeC1Nwb015xp8bknZv5rIfri9xTOcMuaVgvabfIRA7PSZVuZIQ==,
      }

  "@types/serve-static@2.2.0":
    resolution:
      {
        integrity: sha512-8mam4H1NHLtu7nmtalF7eyBH14QyOASmcxHhSfEoRyr0nP/YdoesEtU+uSRvMe96TW/HPTtkoKqQLl53N7UXMQ==,
      }

  "@types/ssh2-streams@0.1.13":
    resolution:
      {
        integrity: sha512-faHyY3brO9oLEA0QlcO8N2wT7R0+1sHWZvQ+y3rMLwdY1ZyS1z0W3t65j9PqT4HmQ6ALzNe7RZlNuCNE0wBSWA==,
      }

  "@types/ssh2@0.5.52":
    resolution:
      {
        integrity: sha512-lbLLlXxdCZOSJMCInKH2+9V/77ET2J6NPQHpFI0kda61Dd1KglJs+fPQBchizmzYSOJBgdTajhPqBO1xxLywvg==,
      }

  "@types/ssh2@1.15.5":
    resolution:
      {
        integrity: sha512-N1ASjp/nXH3ovBHddRJpli4ozpk6UdDYIX4RJWFa9L1YKnzdhTlVmiGHm4DZnj/jLbqZpes4aeR30EFGQtvhQQ==,
      }

  "@types/superagent@8.1.11":
    resolution:
      {
        integrity: sha512-KA7srSW/HENDtOw9DOqaFLgWuMqN9WgjEw62lh9dpvRaZDkhdOkazASd7X7i2eMUYLHa1U37ZttnePsH5zTDHw==,
      }

  "@types/supertest@6.0.3":
    resolution:
      {
        integrity: sha512-8WzXq62EXFhJ7QsH3Ocb/iKQ/Ty9ZVWnVzoTKc9tyyFRRF3a74Tk2+TLFgaFFw364Ere+npzHKEJ6ga2LzIL7w==,
      }

  "@typescript-eslint/eslint-plugin@8.50.0":
    resolution:
      {
        integrity: sha512-O7QnmOXYKVtPrfYzMolrCTfkezCJS9+ljLdKW/+DCvRsc3UAz+sbH6Xcsv7p30+0OwUbeWfUDAQE0vpabZ3QLg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      "@typescript-eslint/parser": ^8.50.0
      eslint: ^8.57.0 || ^9.0.0
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/eslint-plugin@8.65.0":
    resolution:
      {
        integrity: sha512-IEgob78X12rHpUmtcwFsXhZdVGJtwTVP8FiCLZkR6GlYVrl2PcuB+KhCE5BlVC/eQpQnu8WXRtkHZuPar+gCRA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      "@typescript-eslint/parser": ^8.65.0
      eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/parser@8.50.0":
    resolution:
      {
        integrity: sha512-6/cmF2piao+f6wSxUsJLZjck7OQsYyRtcOZS02k7XINSNlz93v6emM8WutDQSXnroG2xwYlEVHJI+cPA7CPM3Q==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/parser@8.65.0":
    resolution:
      {
        integrity: sha512-CZ4nMxWwgu1HEEFNkeaCptra9QCtkmKdgf3sWh1rl1trIhmxLilgTV4cwcbQ4wemnT4sWQN8CaKOmdYx+g2gMA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/project-service@8.50.0":
    resolution:
      {
        integrity: sha512-Cg/nQcL1BcoTijEWyx4mkVC56r8dj44bFDvBdygifuS20f3OZCHmFbjF34DPSi07kwlFvqfv/xOLnJ5DquxSGQ==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/project-service@8.65.0":
    resolution:
      {
        integrity: sha512-SxnPhbTsGahizDgbu7oqFH/xVtzIqMd/s+WtnSxNxJZJpLbdT5IPdzg8EZxO3+PoKahXmwJLeNQOpKJb3/bi7Q==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/scope-manager@8.50.0":
    resolution:
      {
        integrity: sha512-xCwfuCZjhIqy7+HKxBLrDVT5q/iq7XBVBXLn57RTIIpelLtEIZHXAF/Upa3+gaCpeV1NNS5Z9A+ID6jn50VD4A==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@typescript-eslint/scope-manager@8.65.0":
    resolution:
      {
        integrity: sha512-Esbl8OSYiVxBokYgWPf7VVWg/BE798wXhimnn9ML9Pt5qoDf8bfQlgjlKXR/k98+AcNzlLKYrpCcrcuZ9DZLgg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@typescript-eslint/tsconfig-utils@8.50.0":
    resolution:
      {
        integrity: sha512-vxd3G/ybKTSlm31MOA96gqvrRGv9RJ7LGtZCn2Vrc5htA0zCDvcMqUkifcjrWNNKXHUU3WCkYOzzVSFBd0wa2w==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/tsconfig-utils@8.65.0":
    resolution:
      {
        integrity: sha512-j6GzGqCiRdA7Qhur2VVmKZAkBLfnHFQfx4TaJGL9RMveZqCo48jSHHO0DTgizEnGhtWnqmbtCUSrqSkdiY/0Hg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/type-utils@8.50.0":
    resolution:
      {
        integrity: sha512-7OciHT2lKCewR0mFoBrvZJ4AXTMe/sYOe87289WAViOocEmDjjv8MvIOT2XESuKj9jp8u3SZYUSh89QA4S1kQw==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/type-utils@8.65.0":
    resolution:
      {
        integrity: sha512-YjaZ7PRI5qY7ax2L3PbvX0rRyGtipAReCWs0mhhDBHjH/vl0g0BonaGXrKdKpMbIIsMIwDgbk/xzkBTyAltS5g==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/types@8.50.0":
    resolution:
      {
        integrity: sha512-iX1mgmGrXdANhhITbpp2QQM2fGehBse9LbTf0sidWK6yg/NE+uhV5dfU1g6EYPlcReYmkE9QLPq/2irKAmtS9w==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@typescript-eslint/types@8.65.0":
    resolution:
      {
        integrity: sha512-JSSwWNy+H0E/01jJEM+hrX6N0OFDzFzeIhHFSAS01tlVaevpG8cFyYRPhS5yjGOvBUx3sqQHVMjCL1CAZZMxBg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@typescript-eslint/typescript-estree@8.50.0":
    resolution:
      {
        integrity: sha512-W7SVAGBR/IX7zm1t70Yujpbk+zdPq/u4soeFSknWFdXIFuWsBGBOUu/Tn/I6KHSKvSh91OiMuaSnYp3mtPt5IQ==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/typescript-estree@8.65.0":
    resolution:
      {
        integrity: sha512-JboAE2swaYt4tb1fHhHTABE2K+OLy09XfcTbhnk4Pw96f9dd2e9iYsJ28gBggHlo5z5x1rkyWvcPoTuNTd4oGg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/utils@8.50.0":
    resolution:
      {
        integrity: sha512-87KgUXET09CRjGCi2Ejxy3PULXna63/bMYv72tCAlDJC3Yqwln0HiFJ3VJMst2+mEtNtZu5oFvX4qJGjKsnAgg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0
      typescript: ">=4.8.4 <6.0.0"

  "@typescript-eslint/utils@8.65.0":
    resolution:
      {
        integrity: sha512-gXiwIHsYreboxeJucHKPvgwl7dXt50mF8s1/c00cP/WoVTyWKFdtfhRWwZiXYFU5H2O8vVoSLNrexFZjYS/SGA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
      typescript: ">=4.8.4 <6.1.0"

  "@typescript-eslint/visitor-keys@8.50.0":
    resolution:
      {
        integrity: sha512-Xzmnb58+Db78gT/CCj/PVCvK+zxbnsw6F+O1oheYszJbBSdEjVhQi3C/Xttzxgi/GLmpvOggRs1RFpiJ8+c34Q==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@typescript-eslint/visitor-keys@8.65.0":
    resolution:
      {
        integrity: sha512-8C71BQkGjiMmXtop7pHVJu1l2NNShFdkCyD6a2ezzs5vU/L3LRtb69EtcteFwz0mYMPzIgOw0n6OV4VBUWZd7A==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  "@unrs/resolver-binding-android-arm-eabi@1.12.2":
    resolution:
      {
        integrity: sha512-g5T90pqg1bo/7mytQx6F4iBNC0Wsh9cu+z9veDbFjc7HjpesJFWD7QMS0NGStXM075+7dJPPVvBbpZlnrdpi/w==,
      }
    cpu: [arm]
    os: [android]

  "@unrs/resolver-binding-android-arm64@1.12.2":
    resolution:
      {
        integrity: sha512-YGCRZv/9GLhwmz6mYDeTsm/92BAyR28l6c2ReweVW5pWgfsitWLY8upvfRlGdoyD8HjeTHSYJWyZGD4KJA/nFQ==,
      }
    cpu: [arm64]
    os: [android]

  "@unrs/resolver-binding-darwin-arm64@1.12.2":
    resolution:
      {
        integrity: sha512-u9DiNT1auQMO20A9SyTuG3wUgQWB9Z7KjAg0uFuCDR1FsAY8A0CG2S6JpHS1xwm/w1G08bjXZDcyOCjv1WAm2w==,
      }
    cpu: [arm64]
    os: [darwin]

  "@unrs/resolver-binding-darwin-x64@1.12.2":
    resolution:
      {
        integrity: sha512-f7rPLi/T1HVKZu/u6t87lroib16n8vrSzcyxI7lg4BGO9UF26KhQL44sd9eOUgrTYhvRXtWOIZT5PejdPyJfUA==,
      }
    cpu: [x64]
    os: [darwin]

  "@unrs/resolver-binding-freebsd-x64@1.12.2":
    resolution:
      {
        integrity: sha512-BpcOjWCJub6nRZUS2zA20pmLvjtqAtGejETaIyRLiZiQf++cbrjltLA5NN/xaXfqeOBOSlMFbemIl5/S5tljmg==,
      }
    cpu: [x64]
    os: [freebsd]

  "@unrs/resolver-binding-linux-arm-gnueabihf@1.12.2":
    resolution:
      {
        integrity: sha512-vZTDvdSISZjJx66OzJqtsOhzifbqRjbmI1Mnu49fQDwog5GtDI4QidRiEAYbZCRj9C8YZEW+3ZjqsyS9GR4k2A==,
      }
    cpu: [arm]
    os: [linux]

  "@unrs/resolver-binding-linux-arm-musleabihf@1.12.2":
    resolution:
      {
        integrity: sha512-BiPI+IrIlwcW4nLLMM21+B1dFPzd55yAVgVGrdgDjNef+ch03GdxrcyaIz8X9SsQirh/kCQ7mviyWlMxdh2D7g==,
      }
    cpu: [arm]
    os: [linux]

  "@unrs/resolver-binding-linux-arm64-gnu@1.12.2":
    resolution:
      {
        integrity: sha512-zJc0H99FEPoFfSrNpa91HYfxzfAJCr502oxNK1cfdC9hlaFI43RT+JFCann9JUgZmLzzntChHyn13Sgn9ljHNg==,
      }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  "@unrs/resolver-binding-linux-arm64-musl@1.12.2":
    resolution:
      {
        integrity: sha512-KQ3Lki6l+Pz1k/eBipN41ES+YUK30beLGb9YqcB1O542cyLCNE6GaxrfcY3T6EezmGGk84wb5XyO9loTM9tkcA==,
      }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  "@unrs/resolver-binding-linux-loong64-gnu@1.12.2":
    resolution:
      {
        integrity: sha512-3SJGEh1DborhG6pyxvhPzCT4bbSIVihsvgJc13P1bHG7KLdNDaF9T3gsTwFc7Jw/5Y5/iWOjkEx7Zy0NvCGX3Q==,
      }
    cpu: [loong64]
    os: [linux]
    libc: [glibc]

  "@unrs/resolver-binding-linux-loong64-musl@1.12.2":
    resolution:
      {
        integrity: sha512-jiuG/Obbel7uw1PwHNFfrkiKhLAF6mnyZ6aWlOAVN9WqKm8v0OFGnciJIHu8+CMvXLQ8AD51LPzAoUfT21D5Ew==,
      }
    cpu: [loong64]
    os: [linux]
    libc: [musl]

  "@unrs/resolver-binding-linux-ppc64-gnu@1.12.2":
    resolution:
      {
        integrity: sha512-q7xRvVpmcfeL+LlZg8Pbbo6QaTZwDU5BaGZbwfhkEsXJn3Was8xYfE0RBH266xZt0rM6B7i8xAYIvjthuUIWHg==,
      }
    cpu: [ppc64]
    os: [linux]
    libc: [glibc]

  "@unrs/resolver-binding-linux-riscv64-gnu@1.12.2":
    resolution:
      {
        integrity: sha512-0CVdx6lcnT3Q9inOH8tsMIOJ6ImndllMjqJHg8RLVdB7Vq4SfkEXl9mCSsVNuNA4MCYycRicCUxPCabVHJRr6A==,
      }
    cpu: [riscv64]
    os: [linux]
    libc: [glibc]

  "@unrs/resolver-binding-linux-riscv64-musl@1.12.2":
    resolution:
      {
        integrity: sha512-iOwlRo9vnp6R6ohHQS11n0NnfdXx/omhkocmIfaPRpQhKZ+3BDMkkdRVh53qjkFkpPddf+FETA28NwGN7l5l+w==,
      }
    cpu: [riscv64]
    os: [linux]
    libc: [musl]

  "@unrs/resolver-binding-linux-s390x-gnu@1.12.2":
    resolution:
      {
        integrity: sha512-HYJtLfXq94q8iZNFT1lknx258wlkkWhZeUXJRqzKBBUJ00CvZ+N33zgbCqimLjsyw5Va6uUxhVa12mI+kaveEw==,
      }
    cpu: [s390x]
    os: [linux]
    libc: [glibc]

  "@unrs/resolver-binding-linux-x64-gnu@1.12.2":
    resolution:
      {
        integrity: sha512-mPsUhunKKDih5O96Y6enDQyHc1SqBPlY1E/SfMWDM3EdJ95Z9CArPeCVwCCqbP45ljvivdEk8Fxn+SIb1rDAJQ==,
      }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  "@unrs/resolver-binding-linux-x64-musl@1.12.2":
    resolution:
      {
        integrity: sha512-azrt6+5ydLd8Vt210AAFis/lZevSfPw93EJRIJG+xPu4WCJ8K0kppCTpMyLPcKT7H15M4Jnt2tMp5bOvCkRC6A==,
      }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  "@unrs/resolver-binding-openharmony-arm64@1.12.2":
    resolution:
      {
        integrity: sha512-YZ9hP4O0X9PQb8eO980qmLNGH4zT3I9+SZTdt0Pr0YyuGQhYKoOZkV02VzrzyOZJ5xIJ3UFIenKkUkGg8GjgWQ==,
      }
    cpu: [arm64]
    os: [openharmony]

  "@unrs/resolver-binding-wasm32-wasi@1.12.2":
    resolution:
      {
        integrity: sha512-tYFDIkMxSflfEc/h92ZWNsZlHSwgimbNHSO3PL2JWQHfCuC2q316jMyYU9TIWZsFK2bQwyK5VAdYgn8ygPj69A==,
      }
    engines: { node: ">=14.0.0" }
    cpu: [wasm32]

  "@unrs/resolver-binding-win32-arm64-msvc@1.12.2":
    resolution:
      {
        integrity: sha512-qzNyg3xL0VPQmCaUh+N5jSitce6k+uCBfMDesWRnlULOZaqUkaJ0ybdT+UqlAWJoQjuqfIU/0Ptx9bteN4D82g==,
      }
    cpu: [arm64]
    os: [win32]

  "@unrs/resolver-binding-win32-ia32-msvc@1.12.2":
    resolution:
      {
        integrity: sha512-WD9sY00OfpHVGfsnHZoA8jVT+esS/Bg8z8jzxp5BnDCjjwsuKsPQrzswwpFy4J1AUJbXPRfkpcX0mXrzeXW79g==,
      }
    cpu: [ia32]
    os: [win32]

  "@unrs/resolver-binding-win32-x64-msvc@1.12.2":
    resolution:
      {
        integrity: sha512-nAB74NfSNKknqQ1RrYj6uz8FcXEomu/MATJZxh/x+BArzN2U3JbOYC0APYzUIGhVY3m5hRxA8VPNdPBoG8txlA==,
      }
    cpu: [x64]
    os: [win32]

  "@visx/curve@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-jRu61Uz274pV1zyioXmboyrLutYbnKsgjj4njSGCnhdXj5GkZvZbg+ThDb6oOzoAnJOBRLz4rzPlWvNJOzuVMg==,
      }

  "@visx/event@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-EQqCMSv/s8NbFjo+hz3FKsvvYfP+2QslsFJ/24/O5l/W+7UC6J6aAvO0ujVwrTwdYbuQ+vhxKi1xdPdKR/qj1g==,
      }

  "@visx/grid@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-rycutGmTHO+znNdPumheWMglm7YfpffvRwUkVy5zy4WoORIuKTMkDxwnOzHG2xMxU3EE/YCd37xFV5AxA30yeg==,
      }
    peerDependencies:
      react: ^16.14.0 || ^17.0.0-0 || ^18.0.0-0 || ^19.0.0-0

  "@visx/group@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-V19l7iQ7jccBv8kao/EByuI6o4xtxzzLV9nqVI1hRvmdzTVsuLpqlwzYCZUXJaTVvUWf8s4D2SQFjGkj/Nw+0w==,
      }
    peerDependencies:
      react: ^16.14.0 || ^17.0.0-0 || ^18.0.0-0 || ^19.0.0-0

  "@visx/point@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-ijTfr/Nx09f03vIj9nyTr3z4Xth4Y75427UaogJh6dnIRLMEFHQOwNu791sbfiNj0a+ZXuaE32h0vKrFe4/8Qg==,
      }

  "@visx/responsive@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-o+1zGywQZY0+yOx3Iw87wc4bbPJRr/HnIukTwfOz4UVyj9pB1OQNVHB7OORO1+LBHJceWpB31co/ZV9KHncKrA==,
      }
    peerDependencies:
      react: ^16.14.0 || ^17.0.0-0 || ^18.0.0-0 || ^19.0.0-0

  "@visx/scale@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-nzjeE87vFSAXGWFiiNfBpNLAf0Q8Qmf6syvKLjqNi4kGZkdhbUll3E/59YsgWXmjM8+llPLWzGsP+JPvo5eq1A==,
      }

  "@visx/shape@4.0.1-alpha.0":
    resolution:
      {
        integrity: sha512-62QeiVNmPlterQGwhkEDcbq7M0MqY0lBsK5QKXtM9ZoPZWkuGV3aykA3+Xu20B2FAvyJq4LqJzBc7Sxr+EAdbA==,
      }
    peerDependencies:
      react: ^16.14.0 || ^17.0.0-0 || ^18.0.0-0 || ^19.0.0-0

  "@visx/vendor@4.0.0-alpha.0":
    resolution:
      {
        integrity: sha512-6I+MuqXBcv9jnlcVowHoHKSdk9gXTWkHLKyqBwRWg7LY6A3Ei8SHfubpqGV5rBUSppxMq2RszPJUS6w+H0YgmQ==,
      }

  "@vitest/expect@4.1.10":
    resolution:
      {
        integrity: sha512-YsCn+qAk1GWjQOWFEsEcL2gNQ0zmVmQu3T03qP6UyjhtmdtwtbuI+DASn/7iQB3HGTXkdBwGddzxPlmiql5vlA==,
      }

  "@vitest/mocker@4.1.10":
    resolution:
      {
        integrity: sha512-v0xaezt+DKEmKfaxg133ldzADrwLGd7Ze1MfQQTYfvs8OqZIwbxyxaYURivwV7sWy5fqn3rH5uOrSp07bp44Ow==,
      }
    peerDependencies:
      msw: ^2.4.9
      vite: ^6.0.0 || ^7.0.0 || ^8.0.0
    peerDependenciesMeta:
      msw:
        optional: true
      vite:
        optional: true

  "@vitest/pretty-format@4.1.10":
    resolution:
      {
        integrity: sha512-W1HsjSH4MXQ9YfmmhLAoIYf1HRfekQCGngeIgcei6MP5QQGWUe0gkopdZQaVCFO+JDJMrAJGwa5pRpNpvy4P8Q==,
      }

  "@vitest/runner@4.1.10":
    resolution:
      {
        integrity: sha512-IKI6kpIH+LmpROplyLwBBaCfMgOZOMsygVa6BARD6ahA04VRuJSa6OaVG7kRvSEMD870Vd91rSSw0eegtWyLGg==,
      }

  "@vitest/snapshot@4.1.10":
    resolution:
      {
        integrity: sha512-xRkfOT1qpTAi/Ti4Y1LtfRc3kEuqxGw59eN2jN9pRWMtS/XDevekhcFSqvQqjUNGksfjMJu3Y+oJ+4Ypn2OaJw==,
      }

  "@vitest/spy@4.1.10":
    resolution:
      {
        integrity: sha512-PLf/Ugvoq5wO/b4rwYCR1h2PSIdXz7wnkQFMiUpLdtM7l6pqVFcQIBEHyT1+l+cj7mNwAfZHzqXqDyjvOuwbDw==,
      }

  "@vitest/utils@4.1.10":
    resolution:
      {
        integrity: sha512-fy9am/HWxbaGt/Sawrp90vt6Y6jQwf1RX77cz3uwoJwJVMli/e1IEwRPnMNJ7vKfPTwo0diXifkpPvwH9v7nGA==,
      }

  abort-controller@3.0.0:
    resolution:
      {
        integrity: sha512-h8lQ8tacZYnR3vNQTgibj+tODHI5/+l06Au2Pcriv/Gmet0eaj4TwWH41sO9wnHDiQsEj19q0drzdWdeAHtweg==,
      }
    engines: { node: ">=6.5" }

  accepts@2.0.0:
    resolution:
      {
        integrity: sha512-5cvg6CtKwfgdmVqY1WIiXKc3Q1bkRqGLi+2W/6ao+6Y7gu/RCwRuAhGEzh5B4KlszSuTLgZYuqFqo5bImjNKng==,
      }
    engines: { node: ">= 0.6" }

  acorn-jsx@5.3.2:
    resolution:
      {
        integrity: sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==,
      }
    peerDependencies:
      acorn: ^6.0.0 || ^7.0.0 || ^8.0.0

  acorn@8.15.0:
    resolution:
      {
        integrity: sha512-NZyJarBfL7nWwIq+FDL6Zp/yHEhePMNnnJ0y3qfieCrmNvYct8uvtiV41UvlSe6apAfk0fY1FbWx+NwfmpvtTg==,
      }
    engines: { node: ">=0.4.0" }
    hasBin: true

  agent-base@6.0.2:
    resolution:
      {
        integrity: sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==,
      }
    engines: { node: ">= 6.0.0" }

  ajv@6.15.0:
    resolution:
      {
        integrity: sha512-fgFx7Hfoq60ytK2c7DhnF8jIvzYgOMxfugjLOSMHjLIPgenqa7S7oaagATUq99mV6IYvN2tRmC0wnTYX6iPbMw==,
      }

  ajv@8.20.0:
    resolution:
      {
        integrity: sha512-Thbli+OlOj+iMPYFBVBfJ3OmCAnaSyNn4M1vz9T6Gka5Jt9ba/HIR56joy65tY6kx/FCF5VXNB819Y7/GUrBGA==,
      }

  ansi-regex@5.0.1:
    resolution:
      {
        integrity: sha512-quJQXlTSUGL2LH9SUXo8VwsY4soanhgo6LNSm84E1LBcE8s3O0wpdiRzyR9z/ZZJMlMWv37qOOb9pdJlMUEKFQ==,
      }
    engines: { node: ">=8" }

  ansi-regex@6.3.0:
    resolution:
      {
        integrity: sha512-WpDfL7NO6j7tH88IDBNVdUJxDh9nmCteAVW9dsep846XdwF4naCBK+/tGLX3KJgcpgMRXCFlTM2hKGoK9FsdrQ==,
      }
    engines: { node: ">=12" }

  ansi-styles@4.3.0:
    resolution:
      {
        integrity: sha512-zbB9rCJAT1rbjiVDb2hqKFHNYLxgtk8NURxZ3IZwD3F6NtxbXZQCnnSi1Lkx+IDohdPlFp222wVALIheZJQSEg==,
      }
    engines: { node: ">=8" }

  ansi-styles@5.2.0:
    resolution:
      {
        integrity: sha512-Cxwpt2SfTzTtXcfOlzGEee8O+c+MmUgGrNiBcXnuWxuFJHe6a5Hz7qwhwe5OgaSYI0IJvkLqWX1ASG+cJOkEiA==,
      }
    engines: { node: ">=10" }

  ansi-styles@6.2.3:
    resolution:
      {
        integrity: sha512-4Dj6M28JB+oAH8kFkTLUo+a2jwOFkuqb3yucU0CANcRRUbxS0cP0nZYCGjcc3BNXwRIsUVmDGgzawme7zvJHvg==,
      }
    engines: { node: ">=12" }

  archiver-utils@5.0.2:
    resolution:
      {
        integrity: sha512-wuLJMmIBQYCsGZgYLTy5FIB2pF6Lfb6cXMSF8Qywwk3t20zWnAi7zLcQFdKQmIB8wyZpY5ER38x08GbwtR2cLA==,
      }
    engines: { node: ">= 14" }

  archiver@7.0.1:
    resolution:
      {
        integrity: sha512-ZcbTaIqJOfCc03QwD468Unz/5Ir8ATtvAHsK+FdXbDIbGfihqh9mrvdcYunQzqn4HrvWWaFyaxJhGZagaJJpPQ==,
      }
    engines: { node: ">= 14" }

  argon2@0.45.1:
    resolution:
      {
        integrity: sha512-skm+/WCjkGqCQxF7FG1LuZXM5yvbFjgbfiCGsud2oLgaDhh6b6dbH0b1EkghbM+xx4Bj8Ape+KKgixoIlWZicQ==,
      }
    engines: { node: ">=16.17.0" }

  argparse@2.0.1:
    resolution:
      {
        integrity: sha512-8+9WqebbFzpX9OR+Wa6O29asIogeRMzcGtAINdpMHHyAg10f05aSFVBbcEqGf/PXw1EjAZ+q2/bEBg3DvurK3Q==,
      }

  aria-query@5.3.0:
    resolution:
      {
        integrity: sha512-b0P0sZPKtyu8HkeRAfCq0IfURZK+SuwMjY1UXGBU27wpAiTwQAIlq56IbIO+ytk/JjS1fMR14ee5WBBfKi5J6A==,
      }

  aria-query@5.3.2:
    resolution:
      {
        integrity: sha512-COROpnaoap1E2F000S62r6A60uHZnmlvomhfyT2DlTcrY1OrBKn2UhH7qn5wTC9zMvD0AY7csdPSNwKP+7WiQw==,
      }
    engines: { node: ">= 0.4" }

  array-buffer-byte-length@1.0.2:
    resolution:
      {
        integrity: sha512-LHE+8BuR7RYGDKvnrmcuSq3tDcKv9OFEXQt/HpbZhY7V6h0zlUXutnAD82GiFx9rdieCMjkvtcsPqBwgUl1Iiw==,
      }
    engines: { node: ">= 0.4" }

  array-includes@3.1.9:
    resolution:
      {
        integrity: sha512-FmeCCAenzH0KH381SPT5FZmiA/TmpndpcaShhfgEN9eCVjnFBqq3l1xrI42y8+PPLI6hypzou4GXw00WHmPBLQ==,
      }
    engines: { node: ">= 0.4" }

  array.prototype.findlast@1.2.5:
    resolution:
      {
        integrity: sha512-CVvd6FHg1Z3POpBLxO6E6zr+rSKEQ9L6rZHAaY7lLfhKsWYUBBOuMs0e9o24oopj6H+geRCX0YJ+TJLBK2eHyQ==,
      }
    engines: { node: ">= 0.4" }

  array.prototype.findlastindex@1.2.6:
    resolution:
      {
        integrity: sha512-F/TKATkzseUExPlfvmwQKGITM3DGTK+vkAsCZoDc5daVygbJBnjEUCbgkAvVFsgfXfX4YIqZ/27G3k3tdXrTxQ==,
      }
    engines: { node: ">= 0.4" }

  array.prototype.flat@1.3.3:
    resolution:
      {
        integrity: sha512-rwG/ja1neyLqCuGZ5YYrznA62D4mZXg0i1cIskIUKSiqF3Cje9/wXAls9B9s1Wa2fomMsIv8czB8jZcPmxCXFg==,
      }
    engines: { node: ">= 0.4" }

  array.prototype.flatmap@1.3.3:
    resolution:
      {
        integrity: sha512-Y7Wt51eKJSyi80hFrJCePGGNo5ktJCslFuboqJsbf57CCPcm5zztluPlc4/aD8sWsKvlwatezpV4U1efk8kpjg==,
      }
    engines: { node: ">= 0.4" }

  array.prototype.tosorted@1.1.4:
    resolution:
      {
        integrity: sha512-p6Fx8B7b7ZhL/gmUsAy0D15WhvDccw3mnGNbZpi3pmeJdxtWsj2jEaI4Y6oo3XiHfzuSgPwKc04MYt6KgvC/wA==,
      }
    engines: { node: ">= 0.4" }

  arraybuffer.prototype.slice@1.0.4:
    resolution:
      {
        integrity: sha512-BNoCY6SXXPQ7gF2opIP4GBE+Xw7U+pHMYKuzjgCN3GwiaIR09UUeKfheyIry77QtrCBlC0KK0q5/TER/tYh3PQ==,
      }
    engines: { node: ">= 0.4" }

  asap@2.0.6:
    resolution:
      {
        integrity: sha512-BSHWgDSAiKs50o2Re8ppvp3seVHXSRM44cdSsT9FfNEUUZLOGWVCsiWaRPWM1Znn+mqZ1OfVZ3z3DWEzSp7hRA==,
      }

  asn1@0.2.6:
    resolution:
      {
        integrity: sha512-ix/FxPn0MDjeyJ7i/yoHGFt/EX6LyNbxSEhPPXODPL+KB0VPk86UYfL0lMdy+KCnv+fmvIzySwaK5COwqVbWTQ==,
      }

  assertion-error@2.0.1:
    resolution:
      {
        integrity: sha512-Izi8RQcffqCeNVgFigKli1ssklIbpHnCYc6AknXGYoB6grJqyeby7jv12JUQgmTAnIDnbck1uxksT4dzN3PWBA==,
      }
    engines: { node: ">=12" }

  ast-types-flow@0.0.8:
    resolution:
      {
        integrity: sha512-OH/2E5Fg20h2aPrbe+QL8JZQFko0YZaF+j4mnQ7BGhfavO7OpSLa8a0y9sBwomHdSbkhTS8TQNayBfnW5DwbvQ==,
      }

  async-function@1.0.0:
    resolution:
      {
        integrity: sha512-hsU18Ae8CDTR6Kgu9DYf0EbCr/a5iGL0rytQDobUcdpYOKokk8LEjVphnXkDkgpi0wYVsqrXuP0bZxJaTqdgoA==,
      }
    engines: { node: ">= 0.4" }

  async-lock@1.4.1:
    resolution:
      {
        integrity: sha512-Az2ZTpuytrtqENulXwO3GGv1Bztugx6TT37NIo7imr/Qo0gsYiGtSdBa2B6fsXhTpVZDNfu1Qn3pk531e3q+nQ==,
      }

  async@3.2.6:
    resolution:
      {
        integrity: sha512-htCUDlxyyCLMgaM3xXg0C0LW2xqfuQ6p05pCEIsXuyQ+a1koYKTuBMzRNwmybfLgvJDMd0r1LTn4+E0Ti6C2AA==,
      }

  asynckit@0.4.0:
    resolution:
      {
        integrity: sha512-Oei9OH4tRh0YqU3GxhX79dM/mwVgvbZJaSNaRk+bshkj0S5cfHcgYakreBjrHwatXKbz+IoIdYLxrKim2MjW0Q==,
      }

  atomic-sleep@1.0.0:
    resolution:
      {
        integrity: sha512-kNOjDqAh7px0XWNI+4QbzoiR/nTkHAWNud2uvnJquD1/x5a7EQZMJT0AczqK0Qn67oY/TTQ1LbUKajZpp3I9tQ==,
      }
    engines: { node: ">=8.0.0" }

  available-typed-arrays@1.0.7:
    resolution:
      {
        integrity: sha512-wvUjBtSGN7+7SjNpq/9M2Tg350UZD3q62IFZLbRAR1bSMlCo1ZaeW+BJ+D090e4hIIZLBcTDWe4Mh4jvUDajzQ==,
      }
    engines: { node: ">= 0.4" }

  aws-ssl-profiles@1.1.2:
    resolution:
      {
        integrity: sha512-NZKeq9AfyQvEeNlN0zSYAaWrmBffJh3IELMZfRpJVWgrpEbtEpnjvzqBPf+mxoI287JohRDoa+/nsfqqiZmF6g==,
      }
    engines: { node: ">= 6.0.0" }

  axe-core@4.12.1:
    resolution:
      {
        integrity: sha512-s7iGf5GaVMxEG0ENN9x+xTr7GFZCb1ZP/1uATUpCEK2X78nDB3RwbtFCo9pGAf9ru+VwoQ464DkaLEeRM08wJA==,
      }
    engines: { node: ">=4" }

  axios@1.19.0:
    resolution:
      {
        integrity: sha512-ht/iuYZXEjFxLH/Hkezgd7m6JKlHHXEUSneaDz8uZe1Gj5QZtCnpyDsckvAiEnT89OEbCLmnte4R4sn7P0EKFw==,
      }

  axobject-query@4.1.0:
    resolution:
      {
        integrity: sha512-qIj0G9wZbMGNLjLmg1PT6v2mE9AH2zlnADJD/2tC6E00hgmhUOfEB6greHPAfLRSufHqROIUTkw6E+M3lH0PTQ==,
      }
    engines: { node: ">= 0.4" }

  b4a@1.8.1:
    resolution:
      {
        integrity: sha512-aiqre1Nr0B/6DgE2N5vwTc+2/oQZ4Wh1t4NznYY4E00y8LCt6NqdRv81so00oo27D8MVKTpUa/MwUUtBLXCoDw==,
      }
    peerDependencies:
      react-native-b4a: "*"
    peerDependenciesMeta:
      react-native-b4a:
        optional: true

  babel-plugin-react-compiler@1.0.0:
    resolution:
      {
        integrity: sha512-Ixm8tFfoKKIPYdCCKYTsqv+Fd4IJ0DQqMyEimo+pxUOMUR9cVPlwTrFt9Avu+3cb6Zp3mAzl+t1MrG2fxxKsxw==,
      }

  balanced-match@1.0.2:
    resolution:
      {
        integrity: sha512-3oSeUO0TMV67hN1AmbXsK4yaqU7tjiHlbxRDZOpH0KW9+CeX4bRAaX0Anxt0tx2MrpRpWwQaPwIlISEJhYU5Pw==,
      }

  balanced-match@4.0.4:
    resolution:
      {
        integrity: sha512-BLrgEcRTwX2o6gGxGOCNyMvGSp35YofuYzw9h1IMTRmKqttAZZVU67bdb9Pr2vUHA8+j3i2tJfjO6C6+4myGTA==,
      }
    engines: { node: 18 || 20 || >=22 }

  bare-events@2.9.1:
    resolution:
      {
        integrity: sha512-Z0oHEHAFDZkffN8Qc39zNZjQlMDkPJRyyyZieU1VH7u8c5S+qHZ2S8ixdKIAxEjfHO7FJxXmJWgteOghVanIsg==,
      }
    peerDependencies:
      bare-abort-controller: "*"
    peerDependenciesMeta:
      bare-abort-controller:
        optional: true

  bare-fs@4.8.0:
    resolution:
      {
        integrity: sha512-fM+MhCvdQhZ7NV6S95a07gPSqjIYKn6mFaXfx266wN3ajZGl/+1AzH+ubkXQ0fFZvOe2nk9VHkzdYkQE5zMV3Q==,
      }
    engines: { bare: ">=1.28.0" }
    peerDependencies:
      bare-buffer: "*"
    peerDependenciesMeta:
      bare-buffer:
        optional: true

  bare-path@3.1.1:
    resolution:
      {
        integrity: sha512-JprUlveX3QjApC1cTpsUOiscADftCGVWkzitbHsRqv84hzYwYHw2mbluddsq5TvI8mH/8Ov1f4BiMAdcB0oYnQ==,
      }

  bare-stream@2.13.3:
    resolution:
      {
        integrity: sha512-Kc+brLqvEqGkjyfiwJmImAOqLZL7OsoLKuavx+hJjgVV3nLTOjloJyPMFxjUPerGGHrNH0fLU06jjykMLWrERQ==,
      }
    peerDependencies:
      bare-abort-controller: "*"
      bare-buffer: "*"
      bare-events: "*"
    peerDependenciesMeta:
      bare-abort-controller:
        optional: true
      bare-buffer:
        optional: true
      bare-events:
        optional: true

  bare-url@2.5.2:
    resolution:
      {
        integrity: sha512-L13PCJzKG8RGvx8V1/DdMi12ERhC3tprr7/8a94BxpmnRsFqxh5XZNdhtMxu5HPkRshYOOWRGY8lDP7ZhpG9Cg==,
      }

  base64-js@1.5.1:
    resolution:
      {
        integrity: sha512-AKpaYlHn8t4SVbOHCy+b5+KKgvR4vrsD8vbvrbiQJps7fKDTkjkDry6ji0rUJjC0kzbNePLwzxq8iypo41qeWA==,
      }

  baseline-browser-mapping@2.10.8:
    resolution:
      {
        integrity: sha512-PCLz/LXGBsNTErbtB6i5u4eLpHeMfi93aUv5duMmj6caNu6IphS4q6UevDnL36sZQv9lrP11dbPKGMaXPwMKfQ==,
      }
    engines: { node: ">=6.0.0" }
    hasBin: true

  baseline-browser-mapping@2.11.10:
    resolution:
      {
        integrity: sha512-35JEvJ5/KKlbCHjMCsONI2w6HE88STjVdHk+C7d8LtcFxUjZR1KeLP9izofn2qs0KUxX5r4z73bwH/rd+JHacw==,
      }
    engines: { node: ">=6.0.0" }
    hasBin: true

  bcrypt-pbkdf@1.0.2:
    resolution:
      {
        integrity: sha512-qeFIXtP4MSoi6NLqO12WfqARWWuCKi2Rn/9hJLEmtB5yTNr9DqFWkJRCf2qShWzPeAMRnOgCrq0sg/KLv5ES9w==,
      }

  better-result@2.10.0:
    resolution:
      {
        integrity: sha512-oQhh0y1qo2/ZKdAAEvHZAqKKiHOFU5k/bW96fE2ScgQOVkJRiHwB+nOS1SgFsYqRlxMDWvefXi9Q3px7QvgNDw==,
      }

  bidi-js@1.0.3:
    resolution:
      {
        integrity: sha512-RKshQI1R3YQ+n9YJz2QQ147P66ELpa1FQEg20Dk8oW9t2KgLbpDLLp9aGZ7y8WHSshDknG0bknqGw5/tyCs5tw==,
      }

  bl@4.1.0:
    resolution:
      {
        integrity: sha512-1W07cM9gS6DcLperZfFSj+bWLtaPGSOHWhPiGzXmvVJbRLdG82sH/Kn8EtW1VqWVA54AKf2h5k5BbnIbwF3h6w==,
      }

  body-parser@2.3.0:
    resolution:
      {
        integrity: sha512-2cGmJupaNgg+QUwVLAucDuWuoMZ6EX9iHDRswZ5lsNYEmwPaRknMPCLZz07yTzVq/83p4o/wzbDZbBrTvGGTIw==,
      }
    engines: { node: ">=18" }

  brace-expansion@1.1.18:
    resolution:
      {
        integrity: sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==,
      }

  brace-expansion@2.1.4:
    resolution:
      {
        integrity: sha512-hGfVzPxthbf3+2yjg/RBs60cB0FhqBS/zvdV/4wn4/BmN0bNMMHPc4V/BbFieqf1TKAGGAHnY4eSjajCl0f2Xg==,
      }

  brace-expansion@5.0.9:
    resolution:
      {
        integrity: sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==,
      }
    engines: { node: 20 || >=22 }

  braces@3.0.3:
    resolution:
      {
        integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==,
      }
    engines: { node: ">=8" }

  browserslist@4.28.7:
    resolution:
      {
        integrity: sha512-JxV13hNrFxqjOc8alRbq9dK1MM79NEXYpma2B2J4wAtpWS5zIEIKqWPGCl7N4o7Uc7B7itylh7SuDujATRyyTw==,
      }
    engines: { node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7 }
    hasBin: true

  buffer-crc32@1.0.0:
    resolution:
      {
        integrity: sha512-Db1SbgBS/fg/392AblrMJk97KggmvYhr4pB5ZIMTWtaivCPMWLkmb7m21cJvpvgK+J3nsU2CmmixNBZx4vFj/w==,
      }
    engines: { node: ">=8.0.0" }

  buffer-equal-constant-time@1.0.1:
    resolution:
      {
        integrity: sha512-zRpUiDwd/xk6ADqPMATG8vc9VPrkck7T07OIx0gnjmJAnHnTVXNQG3vfvWNuiZIkwu9KrKdA1iJKfsfTVxE6NA==,
      }

  buffer@5.7.1:
    resolution:
      {
        integrity: sha512-EHcyIPBQ4BSGlvjB16k5KgAJ27CIsHY/2JBmCRReo48y9rQ3MaUzWX3KVlBa4U7MyX02HdVj0K7C3WaB3ju7FQ==,
      }

  buffer@6.0.3:
    resolution:
      {
        integrity: sha512-FTiCpNxtwiZZHEZbcbTIcZjERVICn9yq/pDFkTl95/AxzD1naBctN7YO68riM/gLSDY7sdrMby8hofADYuuqOA==,
      }

  buildcheck@0.0.7:
    resolution:
      {
        integrity: sha512-lHblz4ahamxpTmnsk+MNTRWsjYKv965MwOrSJyeD588rR3Jcu7swE+0wN5F+PbL5cjgu/9ObkhfzEPuofEMwLA==,
      }
    engines: { node: ">=10.0.0" }

  byline@5.0.0:
    resolution:
      {
        integrity: sha512-s6webAy+R4SR8XVuJWt2V2rGvhnrhxN+9S15GNuTK3wKPOXFF6RNc+8ug2XhH+2s4f+uudG4kUVYmYOQWL2g0Q==,
      }
    engines: { node: ">=0.10.0" }

  bytes@3.1.2:
    resolution:
      {
        integrity: sha512-/Nf7TyzTx6S3yRJObOAV7956r8cr2+Oj8AC5dt8wSP3BQAoeX58NoHyCU8P8zGkNXStjTSi6fzO6F0pBdcYbEg==,
      }
    engines: { node: ">= 0.8" }

  c12@3.3.4:
    resolution:
      {
        integrity: sha512-cM0ApFQSBXuourJejzwv/AuPRvAxordTyParRVcHjjtXirtkzM0uK2L9TTn9s0cXZbG7E55jCivRQzoxYmRAlA==,
      }
    peerDependencies:
      magicast: "*"
    peerDependenciesMeta:
      magicast:
        optional: true

  call-bind-apply-helpers@1.0.2:
    resolution:
      {
        integrity: sha512-Sp1ablJ0ivDkSzjcaJdxEunN5/XvksFJ2sMBFfq6x0ryhQV/2b/KwFe21cMpmHtPOSij8K99/wSfoEuTObmuMQ==,
      }
    engines: { node: ">= 0.4" }

  call-bind@1.0.8:
    resolution:
      {
        integrity: sha512-oKlSFMcMwpUg2ednkhQ454wfWiU/ul3CkJe/PEHcTKuiX6RpbehUiFMXu13HalGZxfUwCQzZG747YXBn1im9ww==,
      }
    engines: { node: ">= 0.4" }

  call-bound@1.0.4:
    resolution:
      {
        integrity: sha512-+ys997U96po4Kx/ABpBCqhA9EuxJaQWDQg7295H4hBphv3IZg0boBKuwYpt4YXp6MZ5AmZQnU/tyMTlRpaSejg==,
      }
    engines: { node: ">= 0.4" }

  callsites@3.1.0:
    resolution:
      {
        integrity: sha512-P8BjAsXvZS+VIDUI11hHCQEv74YT67YUi5JJFNWIqL235sBmjX4+qx9Muvls5ivyNENctx46xQLQ3aTuE7ssaQ==,
      }
    engines: { node: ">=6" }

  caniuse-lite@1.0.30001761:
    resolution:
      {
        integrity: sha512-JF9ptu1vP2coz98+5051jZ4PwQgd2ni8A+gYSN7EA7dPKIMf0pDlSUxhdmVOaV3/fYK5uWBkgSXJaRLr4+3A6g==,
      }

  caniuse-lite@1.0.30001806:
    resolution:
      {
        integrity: sha512-72Cuvd95zbSYPKq6Fhg8eDJRlzgWDf7/mtoZv6Qe/DYNCEBdNxoA3+rZAU2ZhGCpZlns3EssFavaZomckT5Uuw==,
      }

  chai@6.2.2:
    resolution:
      {
        integrity: sha512-NUPRluOfOiTKBKvWPtSD4PhFvWCqOi0BGStNWs57X9js7XGTprSmFoz5F0tWhR4WPjNeR9jXqdC7/UpSJTnlRg==,
      }
    engines: { node: ">=18" }

  chalk@4.1.2:
    resolution:
      {
        integrity: sha512-oKnbhFyRIXpUuez8iBMmyEa4nbj4IOQyuhc/wy9kY7/WVPcwIO9VA668Pu8RkO7+0G76SLROeyw9CpQ061i4mA==,
      }
    engines: { node: ">=10" }

  chokidar@5.0.0:
    resolution:
      {
        integrity: sha512-TQMmc3w+5AxjpL8iIiwebF73dRDF4fBIieAqGn9RGCWaEVwQ6Fb2cGe31Yns0RRIzii5goJ1Y7xbMwo1TxMplw==,
      }
    engines: { node: ">= 20.19.0" }

  chownr@1.1.4:
    resolution:
      {
        integrity: sha512-jJ0bqzaylmJtVnNgzTeSOs8DPavpbYgEr/b0YL8/2GO3xJEhInFmhKMUnEJQjZumK7KXGFhUy89PrsJWlakBVg==,
      }

  classnames@2.5.1:
    resolution:
      {
        integrity: sha512-saHYOzhIQs6wy2sVxTM6bUDsQO4F50V9RQ22qBpEdCW+I+/Wmke2HOl6lS6dTpdxVhb88/I6+Hs+438c3lfUow==,
      }

  client-only@0.0.1:
    resolution:
      {
        integrity: sha512-IV3Ou0jSMzZrd3pZ48nLkT9DA7Ag1pnPzaiQhpW7c3RbcqqzvzzVu+L8gfqMp/8IM2MQtSiqaCxrrcfu8I8rMA==,
      }

  cliui@8.0.1:
    resolution:
      {
        integrity: sha512-BSeNnyus75C4//NQ9gQt1/csTXyo/8Sb+afLAkzAptFuMsod9HFokGNudZpi/oQV73hnVK+sR+5PVRMd+Dr7YQ==,
      }
    engines: { node: ">=12" }

  color-convert@2.0.1:
    resolution:
      {
        integrity: sha512-RRECPsj7iu/xb5oKYcsFHSppFNnsj/52OVTRKb4zP5onXwVF3zVmmToNcOfGC+CRDpfK/U584fMg38ZHCaElKQ==,
      }
    engines: { node: ">=7.0.0" }

  color-name@1.1.4:
    resolution:
      {
        integrity: sha512-dOy+3AuW3a2wNbZHIuMZpTcgjGuLU/uBL/ubcZF9OXbDo8ff4O8yVp5Bf0efS8uEoYo5q4Fx7dY9OgQGXgAsQA==,
      }

  colorette@2.0.20:
    resolution:
      {
        integrity: sha512-IfEDxwoWIjkeXL1eXcDiow4UbKjhLdq6/EuSVR9GMN7KVH3r9gQ83e73hsz1Nd1T3ijd5xv1wcWRYO+D6kCI2w==,
      }

  combined-stream@1.0.8:
    resolution:
      {
        integrity: sha512-FQN4MRfuJeHf7cBbBMJFXhKSDq+2kAArBlmRBvcvFE5BB1HZKXtSFASDhdlz9zOYwxh8lDdnvmMOe/+5cdoEdg==,
      }
    engines: { node: ">= 0.8" }

  comment-parser@1.4.7:
    resolution:
      {
        integrity: sha512-0h+uSNtQGW3D98eQt3jJ8L06Fves8hncB4V/PKdw/Qb8Hnk19VaKuTr55UNRYiSoVa7WwrFls+rh3ux9agmkeQ==,
      }
    engines: { node: ">= 12.0.0" }

  component-emitter@1.3.1:
    resolution:
      {
        integrity: sha512-T0+barUSQRTUQASh8bx02dl+DhF54GtIDY13Y3m9oWTklKbb3Wv974meRpeZ3lp1JpLVECWWNHC4vaG2XHXouQ==,
      }

  compress-commons@6.0.2:
    resolution:
      {
        integrity: sha512-6FqVXeETqWPoGcfzrXb37E50NP0LXT8kAMu5ooZayhWWdgEY4lBEEcbQNXtkuKQsGduxiIcI4gOTsxTmuq/bSg==,
      }
    engines: { node: ">= 14" }

  compressible@2.0.18:
    resolution:
      {
        integrity: sha512-AF3r7P5dWxL8MxyITRMlORQNaOA2IkAFaTr4k7BUumjPtRpGDTZpl0Pb1XCO6JeDCBdp126Cgs9sMxqSjgYyRg==,
      }
    engines: { node: ">= 0.6" }

  compression@1.8.1:
    resolution:
      {
        integrity: sha512-9mAqGPHLakhCLeNyxPkK4xVo746zQ/czLH1Ky+vkitMnWfWZps8r0qXuwhwizagCRttsL4lfG4pIOvaWLpAP0w==,
      }
    engines: { node: ">= 0.8.0" }

  concat-map@0.0.1:
    resolution:
      {
        integrity: sha512-/Srv4dswyQNBfohGpz9o6Yb3Gz3SrUDqBH5rTuhGR7ahtlbYKnVxw2bCFMRljaA7EXHaXZ8wsHdodFvbkhKmqg==,
      }

  confbox@0.2.4:
    resolution:
      {
        integrity: sha512-ysOGlgTFbN2/Y6Cg3Iye8YKulHw+R2fNXHrgSmXISQdMnomY6eNDprVdW9R5xBguEqI954+S6709UyiO7B+6OQ==,
      }

  content-disposition@1.1.0:
    resolution:
      {
        integrity: sha512-5jRCH9Z/+DRP7rkvY83B+yGIGX96OYdJmzngqnw2SBSxqCFPd0w2km3s5iawpGX8krnwSGmF0FW5Nhr0Hfai3g==,
      }
    engines: { node: ">=18" }

  content-type@1.0.5:
    resolution:
      {
        integrity: sha512-nTjqfcBFEipKdXCv4YDQWCfmcLZKm81ldF0pAopTvyrFGVbcR6P/VAAd5G7N+0tTr8QqiU0tFadD6FK4NtJwOA==,
      }
    engines: { node: ">= 0.6" }

  content-type@2.0.0:
    resolution:
      {
        integrity: sha512-j/O/d7GcZCyNl7/hwZAb606rzqkyvaDctLmckbxLzHvFBzTJHuGEdodATcP3yIRoDrLHkIATJuvzbFlp/ki2cQ==,
      }
    engines: { node: ">=18" }

  convert-source-map@2.0.0:
    resolution:
      {
        integrity: sha512-Kvp459HrV2FEJ1CAsi1Ku+MY3kasH19TFykTz2xWmMeq6bk2NU3XXvfJ+Q61m0xktWwt+1HSYf3JZsTms3aRJg==,
      }

  cookie-parser@1.4.7:
    resolution:
      {
        integrity: sha512-nGUvgXnotP3BsjiLX2ypbQnWoGUPIIfHQNZkkC668ntrzGWEZVW70HDEB1qnNGMicPje6EttlIgzo51YSwNQGw==,
      }
    engines: { node: ">= 0.8.0" }

  cookie-signature@1.0.6:
    resolution:
      {
        integrity: sha512-QADzlaHc8icV8I7vbaJXJwod9HWYp8uCqf1xa4OfNu1T7JVxQIrUgOWtHdNDtPiywmFbiS12VjotIXLrKM3orQ==,
      }

  cookie-signature@1.2.2:
    resolution:
      {
        integrity: sha512-D76uU73ulSXrD1UXF4KE2TMxVVwhsnCgfAyTg9k8P6KGZjlXKrOLe4dJQKI3Bxi5wjesZoFXJWElNWBjPZMbhg==,
      }
    engines: { node: ">=6.6.0" }

  cookie@0.7.2:
    resolution:
      {
        integrity: sha512-yki5XnKuf750l50uGTllt6kKILY4nQ1eNIQatoXEByZ5dWgnKqbnqmTrBE5B4N7lrMJKQ2ytWMiTO2o0v6Ew/w==,
      }
    engines: { node: ">= 0.6" }

  cookiejar@2.1.4:
    resolution:
      {
        integrity: sha512-LDx6oHrK+PhzLKJU9j5S7/Y3jM/mUHvD/DeI1WQmJn652iPC5Y4TBzC9l+5OMOXlyTTA+SmVUPm0HQUwpD5Jqw==,
      }

  core-util-is@1.0.3:
    resolution:
      {
        integrity: sha512-ZQBvi1DcpJ4GDqanjucZ2Hj3wEO5pZDS89BWbkcrvdxksJorwUDDZamX9ldFkp9aw2lmBDLgkObEA4DWNJ9FYQ==,
      }

  cors@2.8.6:
    resolution:
      {
        integrity: sha512-tJtZBBHA6vjIAaF6EnIaq6laBBP9aq/Y3ouVJjEfoHbRBcHBAHYcMh/w8LDrk2PvIMMq8gmopa5D4V8RmbrxGw==,
      }
    engines: { node: ">= 0.10" }

  cpu-features@0.0.10:
    resolution:
      {
        integrity: sha512-9IkYqtX3YHPCzoVg1Py+o9057a3i0fp7S530UWokCSaFVTc7CwXPRiOjRjBQQ18ZCNafx78YfnG+HALxtVmOGA==,
      }
    engines: { node: ">=10.0.0" }

  crc-32@1.2.2:
    resolution:
      {
        integrity: sha512-ROmzCKrTnOwybPcJApAA6WBWij23HVfGVNKqqrZpuyZOHqK2CwHSvpGuyt/UNNvaIjEd8X5IFGp4Mh+Ie1IHJQ==,
      }
    engines: { node: ">=0.8" }
    hasBin: true

  crc32-stream@6.0.0:
    resolution:
      {
        integrity: sha512-piICUB6ei4IlTv1+653yq5+KoqfBYmj9bw6LqXoOneTMDXk5nM1qt12mFW1caG3LlJXEKW1Bp0WggEmIfQB34g==,
      }
    engines: { node: ">= 14" }

  cross-env@10.1.0:
    resolution:
      {
        integrity: sha512-GsYosgnACZTADcmEyJctkJIoqAhHjttw7RsFrVoJNXbsWWqaq6Ym+7kZjq6mS45O0jij6vtiReppKQEtqWy6Dw==,
      }
    engines: { node: ">=20" }
    hasBin: true

  cross-spawn@7.0.6:
    resolution:
      {
        integrity: sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==,
      }
    engines: { node: ">= 8" }

  css-tree@3.2.1:
    resolution:
      {
        integrity: sha512-X7sjQzceUhu1u7Y/ylrRZFU2FS6LRiFVp6rKLPg23y3x3c3DOKAwuXGDp+PAGjh6CSnCjYeAul8pcT8bAl+lSA==,
      }
    engines: { node: ^10 || ^12.20.0 || ^14.13.0 || >=15.0.0 }

  css.escape@1.5.1:
    resolution:
      {
        integrity: sha512-YUifsXXuknHlUsmlgyY0PKzgPOr7/FjCePfHNt0jxm83wHZi44VDMQ7/fGNkjY3/jV1MC+1CmZbaHzugyeRtpg==,
      }

  csstype@3.2.3:
    resolution:
      {
        integrity: sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==,
      }

  d3-array@3.2.1:
    resolution:
      {
        integrity: sha512-gUY/qeHq/yNqqoCKNq4vtpFLdoCdvyNpWoC/KNjhGbhDuQpAM9sIQQKkXSNpXa9h5KySs/gzm7R88WkUutgwWQ==,
      }
    engines: { node: ">=12" }

  d3-array@3.2.4:
    resolution:
      {
        integrity: sha512-tdQAmyA18i4J7wprpYq8ClcxZy3SC31QMeByyCFyRt7BVHdREQZ5lpzoe5mFEYZUWe+oq8HBvk9JjpibyEV4Jg==,
      }
    engines: { node: ">=12" }

  d3-color@3.1.0:
    resolution:
      {
        integrity: sha512-zg/chbXyeBtMQ1LbD/WSoW2DpC3I0mpmPdW+ynRTj/x2DAWYrIY7qeZIHidozwV24m4iavr15lNwIwLxRmOxhA==,
      }
    engines: { node: ">=12" }

  d3-delaunay@6.0.2:
    resolution:
      {
        integrity: sha512-IMLNldruDQScrcfT+MWnazhHbDJhcRJyOEBAJfwQnHle1RPh6WDuLvxNArUju2VSMSUuKlY5BGHRJ2cYyoFLQQ==,
      }
    engines: { node: ">=12" }

  d3-format@3.1.0:
    resolution:
      {
        integrity: sha512-YyUI6AEuY/Wpt8KWLgZHsIU86atmikuoOmCfommt0LYHiQSPjvX2AcFc38PX0CBpr2RCyZhjex+NS/LPOv6YqA==,
      }
    engines: { node: ">=12" }

  d3-geo@3.1.0:
    resolution:
      {
        integrity: sha512-JEo5HxXDdDYXCaWdwLRt79y7giK8SbhZJbFWXqbRTolCHFI5jRqteLzCsq51NKbUoX0PjBVSohxrx+NoOUujYA==,
      }
    engines: { node: ">=12" }

  d3-interpolate@3.0.1:
    resolution:
      {
        integrity: sha512-3bYs1rOD33uo8aqJfKP3JWPAibgw8Zm2+L9vBKEHJ2Rg+viTR7o5Mmv5mZcieN+FRYaAOWX5SJATX6k1PWz72g==,
      }
    engines: { node: ">=12" }

  d3-path@3.1.0:
    resolution:
      {
        integrity: sha512-p3KP5HCf/bvjBSSKuXid6Zqijx7wIfNW+J/maPs+iwR35at5JCbLUT0LzF1cnjbCHWhqzQTIN2Jpe8pRebIEFQ==,
      }
    engines: { node: ">=12" }

  d3-scale@4.0.2:
    resolution:
      {
        integrity: sha512-GZW464g1SH7ag3Y7hXjf8RoUuAFIqklOAq3MRl4OaWabTFJY9PN/E1YklhXLh+OQ3fM9yS2nOkCoS+WLZ6kvxQ==,
      }
    engines: { node: ">=12" }

  d3-shape@3.2.0:
    resolution:
      {
        integrity: sha512-SaLBuwGm3MOViRq2ABk3eLoxwZELpH6zhl3FbAoJ7Vm1gofKx6El1Ib5z23NUEhF9AsGl7y+dzLe5Cw2AArGTA==,
      }
    engines: { node: ">=12" }

  d3-time-format@4.1.0:
    resolution:
      {
        integrity: sha512-dJxPBlzC7NugB2PDLwo9Q8JiTR3M3e4/XANkreKSUxF8vvXKqm1Yfq4Q5dl8budlunRVlUUaDUgFt7eA8D6NLg==,
      }
    engines: { node: ">=12" }

  d3-time@3.1.0:
    resolution:
      {
        integrity: sha512-VqKjzBLejbSMT4IgbmVgDjpkYrNWUYJnbCGo874u7MMKIWsILRX+OpX/gTk8MqjpT1A/c6HY2dCA77ZN0lkQ2Q==,
      }
    engines: { node: ">=12" }

  damerau-levenshtein@1.0.8:
    resolution:
      {
        integrity: sha512-sdQSFB7+llfUcQHUQO3+B8ERRj0Oa4w9POWMI/puGtuf7gFywGmkaLCElnudfTiKZV+NvHqL0ifzdrI8Ro7ESA==,
      }

  data-urls@7.0.0:
    resolution:
      {
        integrity: sha512-23XHcCF+coGYevirZceTVD7NdJOqVn+49IHyxgszm+JIiHLoB2TkmPtsYkNWT1pvRSGkc35L6NHs0yHkN2SumA==,
      }
    engines: { node: ^20.19.0 || ^22.12.0 || >=24.0.0 }

  data-view-buffer@1.0.2:
    resolution:
      {
        integrity: sha512-EmKO5V3OLXh1rtK2wgXRansaK1/mtVdTUEiEI0W8RkvgT05kfxaH29PliLnpLP73yYO6142Q72QNa8Wx/A5CqQ==,
      }
    engines: { node: ">= 0.4" }

  data-view-byte-length@1.0.2:
    resolution:
      {
        integrity: sha512-tuhGbE6CfTM9+5ANGf+oQb72Ky/0+s3xKUpHvShfiz2RxMFgFPjsXuRLBVMtvMs15awe45SRb83D6wH4ew6wlQ==,
      }
    engines: { node: ">= 0.4" }

  data-view-byte-offset@1.0.1:
    resolution:
      {
        integrity: sha512-BS8PfmtDGnrgYdOonGZQdLZslWIeCGFP9tpan0hi1Co2Zr2NKADsvGYA8XxuG/4UWgJ6Cjtv+YJnB6MM69QGlQ==,
      }
    engines: { node: ">= 0.4" }

  dateformat@4.6.3:
    resolution:
      {
        integrity: sha512-2P0p0pFGzHS5EMnhdxQi7aJN+iMheud0UhG4dlE1DLAlvL8JHjJJTX/CSm4JXwV0Ka5nGk3zC5mcb5bUQUxxMA==,
      }

  debug@2.6.9:
    resolution:
      {
        integrity: sha512-bC7ElrdJaJnPbAP+1EotYvqZsb3ecl5wi6Bfi6BJTUcNowp6cvspg0jXznRTKDjm/E7AdgFBVeAPVMNcKGsHMA==,
      }
    peerDependencies:
      supports-color: "*"
    peerDependenciesMeta:
      supports-color:
        optional: true

  debug@3.2.7:
    resolution:
      {
        integrity: sha512-CFjzYYAi4ThfiQvizrFQevTTXHtnCqWfe7x1AhgEscTz6ZbLbfoLRLPugTQyBth6f8ZERVUSyWHFD/7Wu4t1XQ==,
      }
    peerDependencies:
      supports-color: "*"
    peerDependenciesMeta:
      supports-color:
        optional: true

  debug@4.4.3:
    resolution:
      {
        integrity: sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==,
      }
    engines: { node: ">=6.0" }
    peerDependencies:
      supports-color: "*"
    peerDependenciesMeta:
      supports-color:
        optional: true

  decimal.js@10.6.0:
    resolution:
      {
        integrity: sha512-YpgQiITW3JXGntzdUmyUR1V812Hn8T1YVXhCu+wO3OpS4eU9l4YdD3qjyiKdV6mvV29zapkMeD390UVEf2lkUg==,
      }

  deep-is@0.1.4:
    resolution:
      {
        integrity: sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==,
      }

  deepmerge-ts@7.1.5:
    resolution:
      {
        integrity: sha512-HOJkrhaYsweh+W+e74Yn7YStZOilkoPb6fycpwNLKzSPtruFs48nYis0zy5yJz1+ktUhHxoRDJ27RQAWLIJVJw==,
      }
    engines: { node: ">=16.0.0" }

  define-data-property@1.1.4:
    resolution:
      {
        integrity: sha512-rBMvIzlpA8v6E+SJZoo++HAYqsLrkg7MSfIinMPFhmkorw7X+dOXVJQs+QT69zGkzMyfDnIMN2Wid1+NbL3T+A==,
      }
    engines: { node: ">= 0.4" }

  define-properties@1.2.1:
    resolution:
      {
        integrity: sha512-8QmQKqEASLd5nx0U1B1okLElbUuuttJ/AnYmRXbbbGDWh6uS208EjD4Xqq/I9wK7u0v6O08XhTWnt5XtEbR6Dg==,
      }
    engines: { node: ">= 0.4" }

  defu@6.1.7:
    resolution:
      {
        integrity: sha512-7z22QmUWiQ/2d0KkdYmANbRUVABpZ9SNYyH5vx6PZ+nE5bcC0l7uFvEfHlyld/HcGBFTL536ClDt3DEcSlEJAQ==,
      }

  delaunator@5.1.0:
    resolution:
      {
        integrity: sha512-AGrQ4QSgssa1NGmWmLPqN5NY2KajF5MqxetNEO+o0n3ZwZZeTmt7bBnvzHWrmkZFxGgr4HdyFgelzgi06otLuQ==,
      }

  delayed-stream@1.0.0:
    resolution:
      {
        integrity: sha512-ZySD7Nf91aLB0RxL4KGrKHBXl7Eds1DAmEdcoVawXnLD7SDhpNgtuII2aAkg7a7QS41jxPSZ17p4VdGnMHk3MQ==,
      }
    engines: { node: ">=0.4.0" }

  denque@2.1.0:
    resolution:
      {
        integrity: sha512-HVQE3AAb/pxF8fQAoiqpvg9i3evqug3hoiwakOyZAwJm+6vZehbkYXZ0l4JxS+I3QxM97v5aaRNhj8v5oBhekw==,
      }
    engines: { node: ">=0.10" }

  depd@2.0.0:
    resolution:
      {
        integrity: sha512-g7nH6P6dyDioJogAAGprGpCtVImJhpPk/roCzdb3fIh61/s/nPsfR6onyMwkCAR/OlC3yBC0lESvUoQEAssIrw==,
      }
    engines: { node: ">= 0.8" }

  dequal@2.0.3:
    resolution:
      {
        integrity: sha512-0je+qPKHEMohvfRTCEo3CrPG6cAzAYgmzKyxRiYSSDkS6eGJdyVJm7WaYA5ECaAD9wLB2T4EEeymA5aFVcYXCA==,
      }
    engines: { node: ">=6" }

  destr@2.0.5:
    resolution:
      {
        integrity: sha512-ugFTXCtDZunbzasqBxrK93Ik/DRYsO6S/fedkWEMKqt04xZ4csmnmwGDBAb07QWNaGMAmnTIemsYZCksjATwsA==,
      }

  detect-libc@2.1.2:
    resolution:
      {
        integrity: sha512-Btj2BOOO83o3WyH59e8MgXsxEQVcarkUOpEYrubB0urwnN10yQ364rsiByU11nZlqWYZm05i/of7io4mzihBtQ==,
      }
    engines: { node: ">=8" }

  dezalgo@1.0.4:
    resolution:
      {
        integrity: sha512-rXSP0bf+5n0Qonsb+SVVfNfIsimO4HEtmnIpPHY8Q1UCzKlQrDMfdobr8nJOOsRgWCyMRqeSBQzmWUMq7zvVig==,
      }

  docker-compose@1.4.2:
    resolution:
      {
        integrity: sha512-rPHigTKGaEHpkUmfd69QgaOp+Os5vGJwG/Ry8lcr8W/382AmI+z/D7qoa9BybKIkqNppaIbs8RYeHSevdQjWww==,
      }
    engines: { node: ">= 6.0.0" }

  docker-modem@5.0.7:
    resolution:
      {
        integrity: sha512-XJgGhoR/CLpqshm4d3L7rzH6t8NgDFUIIpztYlLHIApeJjMZKYJMz2zxPsYxnejq5h3ELYSw/RBsi3t5h7gNTA==,
      }
    engines: { node: ">= 8.0" }

  dockerode@5.0.1:
    resolution:
      {
        integrity: sha512-avsq/xk4YPIrn0CgleX5bjT9Y8IT1p9PxrNQ++RBQ2WEyFfHCTDsT9kmyxz+H/axnjAwg8wJWEIuPGOUuNupiA==,
      }
    engines: { node: ">= 14.17" }

  doctrine@2.1.0:
    resolution:
      {
        integrity: sha512-35mSku4ZXK0vfCuHEDAwt55dg2jNajHZ1odvF+8SSr82EsZY4QmXfuWso8oEd8zRhVObSN18aM0CjSdoBX7zIw==,
      }
    engines: { node: ">=0.10.0" }

  dom-accessibility-api@0.5.16:
    resolution:
      {
        integrity: sha512-X7BJ2yElsnOJ30pZF4uIIDfBEVgF4XEBxL9Bxhy6dnrm5hkzqmsWHGTiHqRiITNhMyFLyAiWndIJP7Z1NTteDg==,
      }

  dom-accessibility-api@0.6.3:
    resolution:
      {
        integrity: sha512-7ZgogeTnjuHbo+ct10G9Ffp0mif17idi0IyWNVA/wcwcm7NPOD/WEHVP3n7n3MhXqxoIYm8d6MuZohYWIZ4T3w==,
      }

  dotenv@17.4.2:
    resolution:
      {
        integrity: sha512-nI4U3TottKAcAD9LLud4Cb7b2QztQMUEfHbvhTH09bqXTxnSie8WnjPALV/WMCrJZ6UV/qHJ6L03OqO3LcdYZw==,
      }
    engines: { node: ">=12" }

  dunder-proto@1.0.1:
    resolution:
      {
        integrity: sha512-KIN/nDJBQRcXw0MLVhZE9iQHmG68qAVIBg9CqmUYjmQIhgij9U5MFvrqkUL5FbtyyzZuOeOt0zdeRe4UY7ct+A==,
      }
    engines: { node: ">= 0.4" }

  eastasianwidth@0.2.0:
    resolution:
      {
        integrity: sha512-I88TYZWc9XiYHRQ4/3c5rjjfgkjhLyW2luGIheGERbNQ6OY7yTybanSpDXZa8y7VUP9YmDcYa+eyq4ca7iLqWA==,
      }

  ecdsa-sig-formatter@1.0.11:
    resolution:
      {
        integrity: sha512-nagl3RYrbNv6kQkeJIpt6NJZy8twLB/2vtz6yN9Z4vRKHN4/QZJIEbqohALSgwKdnksuY3k5Addp5lg8sVoVcQ==,
      }

  ee-first@1.1.1:
    resolution:
      {
        integrity: sha512-WMwm9LhRUo+WUaRN+vRuETqG89IgZphVSNkdFgeb6sS/E4OrDIN7t48CAewSHXc6C8lefD8KKfr5vY61brQlow==,
      }

  effect@3.20.0:
    resolution:
      {
        integrity: sha512-qMLfDJscrNG8p/aw+IkT9W7fgj50Z4wG5bLBy0Txsxz8iUHjDIkOgO3SV0WZfnQbNG2VJYb0b+rDLMrhM4+Krw==,
      }

  electron-to-chromium@1.5.399:
    resolution:
      {
        integrity: sha512-lEcqhErbHjXRvd41rnWLpzbyU/IXfIYo7QwaFWmxGeLiLyY2TBCdHnWY88vB+p3ubnihRypDm66panXl7TylLA==,
      }

  elkjs@0.11.1:
    resolution:
      {
        integrity: sha512-zxxR9k+rx5ktMwT/FwyLdPCrq7xN6e4VGGHH8hA01vVYKjTFik7nHOxBnAYtrgYUB1RpAiLvA1/U2YraWxyKKg==,
      }

  emoji-regex@8.0.0:
    resolution:
      {
        integrity: sha512-MSjYzcWNOA0ewAHpz0MxpYFvwg6yjy1NG3xteoqz644VCo/RPgnr1/GGt+ic3iJTzQ8Eu3TdM14SawnVUmGE6A==,
      }

  emoji-regex@9.2.2:
    resolution:
      {
        integrity: sha512-L18DaJsXSUk2+42pv8mLs5jJT2hqFkFE4j21wOmgbUqsZ2hL72NsUU785g9RXgo3s0ZNgVl42TiHp3ZtOv/Vyg==,
      }

  empathic@2.0.0:
    resolution:
      {
        integrity: sha512-i6UzDscO/XfAcNYD75CfICkmfLedpyPDdozrLMmQc5ORaQcdMoc21OnlEylMIqI7U8eniKrPMxxtj8k0vhmJhA==,
      }
    engines: { node: ">=14" }

  encodeurl@2.0.0:
    resolution:
      {
        integrity: sha512-Q0n9HRi4m6JuGIV1eFlmvJB7ZEVxu93IrMyiMsGC0lrMJMWzRgx6WGquyfQgZVb31vhGgXnfmPNNXmxnOkRBrg==,
      }
    engines: { node: ">= 0.8" }

  end-of-stream@1.4.5:
    resolution:
      {
        integrity: sha512-ooEGc6HP26xXq/N+GCGOT0JKCLDGrq2bQUZrQ7gyrJiZANJ/8YDTxTpQBXGMn+WbIQXNVpyWymm7KYVICQnyOg==,
      }

  enhanced-resolve@5.24.5:
    resolution:
      {
        integrity: sha512-L1l8TNvomm6UVW5B253AGxQagSQr+vGwhMlrrfRS2qmhx46AMpMVJKQYLvWYbysTMY8VoicOvzHzoHMbyzB+4A==,
      }
    engines: { node: ">=10.13.0" }

  entities@8.0.0:
    resolution:
      {
        integrity: sha512-zwfzJecQ/Uej6tusMqwAqU/6KL2XaB2VZ2Jg54Je6ahNBGNH6Ek6g3jjNCF0fG9EWQKGZNddNjU5F1ZQn/sBnA==,
      }
    engines: { node: ">=20.19.0" }

  env-paths@3.0.0:
    resolution:
      {
        integrity: sha512-dtJUTepzMW3Lm/NPxRf3wP4642UWhjL2sQxc+ym2YMj1m/H2zDNQOlezafzkHwn6sMstjHTwG6iQQsctDW/b1A==,
      }
    engines: { node: ^12.20.0 || ^14.13.1 || >=16.0.0 }

  es-abstract@1.24.0:
    resolution:
      {
        integrity: sha512-WSzPgsdLtTcQwm4CROfS5ju2Wa1QQcVeT37jFjYzdFz1r9ahadC8B8/a4qxJxM+09F18iumCdRmlr96ZYkQvEg==,
      }
    engines: { node: ">= 0.4" }

  es-define-property@1.0.1:
    resolution:
      {
        integrity: sha512-e3nRfgfUZ4rNGL232gUgX06QNyyez04KdjFrF+LTRoOXmrOgFKDg4BCdsjW8EnT69eqdYGmRpJwiPVYNrCaW3g==,
      }
    engines: { node: ">= 0.4" }

  es-errors@1.3.0:
    resolution:
      {
        integrity: sha512-Zf5H2Kxt2xjTvbJvP2ZWLEICxA6j+hAmMzIlypy4xcBg1vKVnx89Wy0GbS+kf5cwCVFFzdCFh2XSCFNULS6csw==,
      }
    engines: { node: ">= 0.4" }

  es-iterator-helpers@1.2.1:
    resolution:
      {
        integrity: sha512-uDn+FE1yrDzyC0pCo961B2IHbdM8y/ACZsKD4dG6WqrjV53BADjwa7D+1aom2rsNVfLyDgU/eigvlJGJ08OQ4w==,
      }
    engines: { node: ">= 0.4" }

  es-module-lexer@2.3.2:
    resolution:
      {
        integrity: sha512-poHGpORABojJJucnV9KbOavETW8lBVnphkW77ER5/BQ5Fz7oXSoCNek7IH3vR5nRjdsEz926ibFYX8KtLQmdyw==,
      }

  es-object-atoms@1.1.1:
    resolution:
      {
        integrity: sha512-FGgH2h8zKNim9ljj7dankFPcICIK9Cp5bm+c2gQSYePhpaG5+esrLODihIorn+Pe6FGJzWhXQotPv73jTaldXA==,
      }
    engines: { node: ">= 0.4" }

  es-set-tostringtag@2.1.0:
    resolution:
      {
        integrity: sha512-j6vWzfrGVfyXxge+O0x5sh6cvxAog0a/4Rdd2K36zCMV5eJ+/+tOAngRO8cODMNWbVRdVlmGZQL2YS3yR8bIUA==,
      }
    engines: { node: ">= 0.4" }

  es-shim-unscopables@1.1.0:
    resolution:
      {
        integrity: sha512-d9T8ucsEhh8Bi1woXCf+TIKDIROLG5WCkxg8geBCbvk22kzwC5G2OnXVMO6FUsvQlgUUXQ2itephWDLqDzbeCw==,
      }
    engines: { node: ">= 0.4" }

  es-to-primitive@1.3.0:
    resolution:
      {
        integrity: sha512-w+5mJ3GuFL+NjVtJlvydShqE1eN3h3PbI7/5LAsYJP/2qtuMXjfL2LpHSRqo4b4eSF5K/DH1JXKUAHSB2UW50g==,
      }
    engines: { node: ">= 0.4" }

  esbuild@0.28.1:
    resolution:
      {
        integrity: sha512-HrJrvZv5ayxBzPfwphOoNzkzOIIlifzk0KJrGK2c8R4+LKpMtpYLQeUdjnwjWv/LZlkH2laZk+4w78pi99D4Vw==,
      }
    engines: { node: ">=18" }
    hasBin: true

  escalade@3.2.0:
    resolution:
      {
        integrity: sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==,
      }
    engines: { node: ">=6" }

  escape-html@1.0.3:
    resolution:
      {
        integrity: sha512-NiSupZ4OeuGwr68lGIeym/ksIZMJodUGOSCZ/FSnTxcrekbvqrgdUxlJOMpijaKZVjAJrWrGs/6Jy8OMuyj9ow==,
      }

  escape-string-regexp@4.0.0:
    resolution:
      {
        integrity: sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==,
      }
    engines: { node: ">=10" }

  eslint-config-next@16.2.12:
    resolution:
      {
        integrity: sha512-iaaf4vvKo5h2LBdGt0JuRv7t0Ysqr9FMCiFxbptDg8LqOE//mIKR80DdpOnSVM7qjLH3jT8P0aFiwXxBEGZRXw==,
      }
    peerDependencies:
      eslint: ">=9.0.0"
      typescript: ">=3.3.1"
    peerDependenciesMeta:
      typescript:
        optional: true

  eslint-config-prettier@10.1.8:
    resolution:
      {
        integrity: sha512-82GZUjRS0p/jganf6q1rEO25VSoHH0hKPCTrgillPjdI/3bgBhAE1QzHrHTizjpRvy6pGAvKjDJtk2pF9NDq8w==,
      }
    hasBin: true
    peerDependencies:
      eslint: ">=7.0.0"

  eslint-import-context@0.1.9:
    resolution:
      {
        integrity: sha512-K9Hb+yRaGAGUbwjhFNHvSmmkZs9+zbuoe3kFQ4V1wYjrepUFYM2dZAfNtjbbj3qsPfUfsA68Bx/ICWQMi+C8Eg==,
      }
    engines: { node: ^12.20.0 || ^14.18.0 || >=16.0.0 }
    peerDependencies:
      unrs-resolver: ^1.0.0
    peerDependenciesMeta:
      unrs-resolver:
        optional: true

  eslint-import-resolver-node@0.3.10:
    resolution:
      {
        integrity: sha512-tRrKqFyCaKict5hOd244sL6EQFNycnMQnBe+j8uqGNXYzsImGbGUU4ibtoaBmv5FLwJwcFJNeg1GeVjQfbMrDQ==,
      }

  eslint-import-resolver-typescript@3.10.1:
    resolution:
      {
        integrity: sha512-A1rHYb06zjMGAxdLSkN2fXPBwuSaQ0iO5M/hdyS0Ajj1VBaRp0sPD3dn1FhME3c/JluGFbwSxyCfqdSbtQLAHQ==,
      }
    engines: { node: ^14.18.0 || >=16.0.0 }
    peerDependencies:
      eslint: "*"
      eslint-plugin-import: "*"
      eslint-plugin-import-x: "*"
    peerDependenciesMeta:
      eslint-plugin-import:
        optional: true
      eslint-plugin-import-x:
        optional: true

  eslint-module-utils@2.14.0:
    resolution:
      {
        integrity: sha512-W2WCRZ9Dqntd+2u8jJcVMV2PKulc6RdLgUUoh/yQr3uB6lo/ZOeGx11sv60/8S4QFFKNslAlWhr9u0Ef7ZW6Ig==,
      }
    engines: { node: ">=4" }
    peerDependencies:
      "@typescript-eslint/parser": "*"
      eslint: "*"
      eslint-import-resolver-node: "*"
      eslint-import-resolver-typescript: "*"
      eslint-import-resolver-webpack: "*"
    peerDependenciesMeta:
      "@typescript-eslint/parser":
        optional: true
      eslint:
        optional: true
      eslint-import-resolver-node:
        optional: true
      eslint-import-resolver-typescript:
        optional: true
      eslint-import-resolver-webpack:
        optional: true

  eslint-plugin-import-x@4.17.1:
    resolution:
      {
        integrity: sha512-4cdstYkKCyjumM2Q9NSI03K8D2a9F4Ssz33K2lv2hQa4KmR9jPLwk3uWGtNvclfqBrPGfGuMBwsGMbe6dMRbfg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      "@typescript-eslint/utils": ^8.56.0
      eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
      eslint-import-resolver-node: "*"
    peerDependenciesMeta:
      "@typescript-eslint/utils":
        optional: true
      eslint-import-resolver-node:
        optional: true

  eslint-plugin-import@2.32.0:
    resolution:
      {
        integrity: sha512-whOE1HFo/qJDyX4SnXzP4N6zOWn79WhnCUY/iDR0mPfQZO8wcYE4JClzI2oZrhBnnMUCBCHZhO6VQyoBU95mZA==,
      }
    engines: { node: ">=4" }
    peerDependencies:
      "@typescript-eslint/parser": "*"
      eslint: ^2 || ^3 || ^4 || ^5 || ^6 || ^7.2.0 || ^8 || ^9
    peerDependenciesMeta:
      "@typescript-eslint/parser":
        optional: true

  eslint-plugin-jsx-a11y@6.10.2:
    resolution:
      {
        integrity: sha512-scB3nz4WmG75pV8+3eRUQOHZlNSUhFNq37xnpgRkCCELU3XMvXAxLk1eqWWyE22Ki4Q01Fnsw9BA3cJHDPgn2Q==,
      }
    engines: { node: ">=4.0" }
    peerDependencies:
      eslint: ^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9

  eslint-plugin-react-hooks@7.1.1:
    resolution:
      {
        integrity: sha512-f2I7Gw6JbvCexzIInuSbZpfdQ44D7iqdWX01FKLvrPgqxoE7oMj8clOfto8U6vYiz4yd5oKu39rRSVOe1zRu0g==,
      }
    engines: { node: ">=18" }
    peerDependencies:
      eslint: ^3.0.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0-0 || ^9.0.0 || ^10.0.0

  eslint-plugin-react@7.37.5:
    resolution:
      {
        integrity: sha512-Qteup0SqU15kdocexFNAJMvCJEfa2xUKNV4CC1xsVMrIIqEy3SQ/rqyxCWNzfrd3/ldy6HMlD2e0JDVpDg2qIA==,
      }
    engines: { node: ">=4" }
    peerDependencies:
      eslint: ^3 || ^4 || ^5 || ^6 || ^7 || ^8 || ^9.7

  eslint-plugin-unused-imports@4.4.1:
    resolution:
      {
        integrity: sha512-oZGYUz1X3sRMGUB+0cZyK2VcvRX5lm/vB56PgNNcU+7ficUCKm66oZWKUubXWnOuPjQ8PvmXtCViXBMONPe7tQ==,
      }
    peerDependencies:
      "@typescript-eslint/eslint-plugin": ^8.0.0-0 || ^7.0.0 || ^6.0.0 || ^5.0.0
      eslint: ^10.0.0 || ^9.0.0 || ^8.0.0
    peerDependenciesMeta:
      "@typescript-eslint/eslint-plugin":
        optional: true

  eslint-scope@8.4.0:
    resolution:
      {
        integrity: sha512-sNXOfKCn74rt8RICKMvJS7XKV/Xk9kA7DyJr8mJik3S7Cwgy3qlkkmyS2uQB3jiJg6VNdZd/pDBJu0nvG2NlTg==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  eslint-visitor-keys@3.4.3:
    resolution:
      {
        integrity: sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==,
      }
    engines: { node: ^12.22.0 || ^14.17.0 || >=16.0.0 }

  eslint-visitor-keys@4.2.1:
    resolution:
      {
        integrity: sha512-Uhdk5sfqcee/9H/rCOJikYz67o0a2Tw2hGRPOG2Y1R2dg7brRe1uG0yaNQDHu+TO/uQPF/5eCapvYSmHUjt7JQ==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  eslint-visitor-keys@5.0.1:
    resolution:
      {
        integrity: sha512-tD40eHxA35h0PEIZNeIjkHoDR4YjjJp34biM0mDvplBe//mB+IHCqHDGV7pxF+7MklTvighcCPPZC7ynWyjdTA==,
      }
    engines: { node: ^20.19.0 || ^22.13.0 || >=24 }

  eslint@9.39.1:
    resolution:
      {
        integrity: sha512-BhHmn2yNOFA9H9JmmIVKJmd288g9hrVRDkdoIgRCRuSySRUHH7r/DI6aAXW9T1WwUuY3DFgrcaqB+deURBLR5g==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    hasBin: true
    peerDependencies:
      jiti: "*"
    peerDependenciesMeta:
      jiti:
        optional: true

  espree@10.4.0:
    resolution:
      {
        integrity: sha512-j6PAQ2uUr79PZhBjP5C5fhl8e39FmRnOjsD5lGnWrFU8i2G776tBK7+nP8KuQUTTyAZUwfQqXAgrVH5MbH9CYQ==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }

  esquery@1.6.0:
    resolution:
      {
        integrity: sha512-ca9pw9fomFcKPvFLXhBKUK90ZvGibiGOvRJNbjljY7s7uq/5YO4BOzcYtJqExdx99rF6aAcnRxHmcUHcz6sQsg==,
      }
    engines: { node: ">=0.10" }

  esrecurse@4.3.0:
    resolution:
      {
        integrity: sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==,
      }
    engines: { node: ">=4.0" }

  estraverse@5.3.0:
    resolution:
      {
        integrity: sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==,
      }
    engines: { node: ">=4.0" }

  estree-walker@3.0.3:
    resolution:
      {
        integrity: sha512-7RUKfXgSMMkzt6ZuXmqapOurLGPPfgj6l9uRZ7lRGolvk0y2yocc35LdcxKC5PQZdn2DMqioAQ2NoWcrTKmm6g==,
      }

  esutils@2.0.3:
    resolution:
      {
        integrity: sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==,
      }
    engines: { node: ">=0.10.0" }

  etag@1.8.1:
    resolution:
      {
        integrity: sha512-aIL5Fx7mawVa300al2BnEE4iNvo1qETxLrPI/o05L7z6go7fCw1J6EQmbK4FmJ2AS7kgVF/KEZWufBfdClMcPg==,
      }
    engines: { node: ">= 0.6" }

  event-target-shim@5.0.1:
    resolution:
      {
        integrity: sha512-i/2XbnSz/uxRCU6+NdVJgKWDTM427+MqYbkQzD321DuCQJUqOuJKIA0IM2+W2xtYHdKOmZ4dR6fExsd4SXL+WQ==,
      }
    engines: { node: ">=6" }

  events-universal@1.0.1:
    resolution:
      {
        integrity: sha512-LUd5euvbMLpwOF8m6ivPCbhQeSiYVNb8Vs0fQ8QjXo0JTkEHpz8pxdQf0gStltaPpw0Cca8b39KxvK9cfKRiAw==,
      }

  events@3.3.0:
    resolution:
      {
        integrity: sha512-mQw+2fkQbALzQ7V0MY0IqdnXNOeTtP4r0lN9z7AAawCXgqea7bDii20AYrIBrFd/Hx0M2Ocz6S111CaFkUcb0Q==,
      }
    engines: { node: ">=0.8.x" }

  expect-type@1.4.0:
    resolution:
      {
        integrity: sha512-KfYbmpRm0VbLjEvVa9yGwCi9GI34xvi7A/HXYWQO65CSD2u3MczUJSuwXKFIxlGsgBQizV9q5J9NHj4VG0n+pA==,
      }
    engines: { node: ">=12.0.0" }

  express-rate-limit@8.6.1:
    resolution:
      {
        integrity: sha512-0D493aP61w0TJ2A0wy27riRsO7FMQ7FK+KUHOKCSfPvYo0R55aiC6emCVgFUeShH0fq0ICPVzNcgoS+BsbXQCA==,
      }
    engines: { node: ">= 16" }
    peerDependencies:
      express: ">= 4.11"

  express@5.2.1:
    resolution:
      {
        integrity: sha512-hIS4idWWai69NezIdRt2xFVofaF4j+6INOpJlVOLDO8zXGpUVEVzIYk12UUi2JzjEzWL3IOAxcTubgz9Po0yXw==,
      }
    engines: { node: ">= 18" }

  exsolve@1.1.1:
    resolution:
      {
        integrity: sha512-9U/jZUgjnSGyntRr6y5Muu1MJcwFl6kPu7k8qLF0IMNfLqvw0NZ4nnVDq0RVoZ0RvCyumib4Ez3KYrVfilrw+g==,
      }

  fast-check@3.23.2:
    resolution:
      {
        integrity: sha512-h5+1OzzfCC3Ef7VbtKdcv7zsstUQwUDlYpUTvjeUsJAssPgLn7QzbboPtL5ro04Mq0rPOsMzl7q5hIbRs2wD1A==,
      }
    engines: { node: ">=8.0.0" }

  fast-copy@4.0.4:
    resolution:
      {
        integrity: sha512-eVAiWVNPSEGIzDl5yPuLrx8fNMogScXvD9xp1Kzd41FjRIz2I3sSIcxsFeM5EzFfHAfobdvs8ZySffUopljvIA==,
      }

  fast-decode-uri-component@1.0.1:
    resolution:
      {
        integrity: sha512-WKgKWg5eUxvRZGwW8FvfbaH7AXSh2cL+3j5fMGzUMCxWBJ3dV3a7Wz8y2f/uQ0e3B6WmodD3oS54jTQ9HVTIIg==,
      }

  fast-deep-equal@3.1.3:
    resolution:
      {
        integrity: sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==,
      }

  fast-fifo@1.3.2:
    resolution:
      {
        integrity: sha512-/d9sfos4yxzpwkDkuN7k2SqFKtYNmCTzgfEpz82x34IM9/zc8KGxQoXg1liNC/izpRM/MBdt44Nmx41ZWqk+FQ==,
      }

  fast-glob@3.3.1:
    resolution:
      {
        integrity: sha512-kNFPyjhh5cKjrUltxs+wFx+ZkbRaxxmZ+X0ZU31SOsxCEtP9VPgtq2teZw1DebupL5GmDaNQ6yKMMVcM41iqDg==,
      }
    engines: { node: ">=8.6.0" }

  fast-json-stable-stringify@2.1.0:
    resolution:
      {
        integrity: sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==,
      }

  fast-levenshtein@2.0.6:
    resolution:
      {
        integrity: sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==,
      }

  fast-querystring@1.1.2:
    resolution:
      {
        integrity: sha512-g6KuKWmFXc0fID8WWH0jit4g0AGBoJhCkJMb1RmbsSEUNvQ+ZC8D6CUZ+GtF8nMzSPXnhiePyyqqipzNNEnHjg==,
      }

  fast-safe-stringify@2.1.1:
    resolution:
      {
        integrity: sha512-W+KJc2dmILlPplD/H4K9l9LcAHAfPtP6BY84uVLXQ6Evcz9Lcg33Y2z1IVblT6xdY54PXYVHEv+0Wpq8Io6zkA==,
      }

  fast-sha256@1.3.0:
    resolution:
      {
        integrity: sha512-n11RGP/lrWEFI/bWdygLxhI+pVeo1ZYIVwvvPkW7azl/rOy+F3HYRZ2K5zeE9mmkhQppyv9sQFx0JM9UabnpPQ==,
      }

  fast-uri@3.1.5:
    resolution:
      {
        integrity: sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==,
      }

  fastq@1.19.1:
    resolution:
      {
        integrity: sha512-GwLTyxkCXjXbxqIhTsMI2Nui8huMPtnxg7krajPJAjnEG/iiOS7i+zCtWGZR9G0NBKbXKh6X9m9UIsYX/N6vvQ==,
      }

  fdir@6.5.0:
    resolution:
      {
        integrity: sha512-tIbYtZbucOs0BRGqPJkshJUYdL+SDH7dVM8gjy+ERp3WAUjLEFJE+02kanyHtwjWOnwrKYBiwAmM0p4kLJAnXg==,
      }
    engines: { node: ">=12.0.0" }
    peerDependencies:
      picomatch: 4.0.5
    peerDependenciesMeta:
      picomatch:
        optional: true

  file-entry-cache@8.0.0:
    resolution:
      {
        integrity: sha512-XXTUwCvisa5oacNGRP9SfNtYBNAMi+RPwBFmblZEF7N7swHYQS6/Zfk7SRwx4D5j3CH211YNRco1DEMNVfZCnQ==,
      }
    engines: { node: ">=16.0.0" }

  fill-range@7.1.1:
    resolution:
      {
        integrity: sha512-YsGpe3WHLK8ZYi4tWDg2Jy3ebRz2rXowDxnld4bkQB00cc/1Zw9AWnC0i9ztDJitivtQvaI9KaLyKrc+hBW0yg==,
      }
    engines: { node: ">=8" }

  finalhandler@2.1.1:
    resolution:
      {
        integrity: sha512-S8KoZgRZN+a5rNwqTxlZZePjT/4cnm0ROV70LedRHZ0p8u9fRID0hJUZQpkKLzro8LfmC8sx23bY6tVNxv8pQA==,
      }
    engines: { node: ">= 18.0.0" }

  find-my-way@9.7.0:
    resolution:
      {
        integrity: sha512-f2JHn75x2JlwUwLenZypgczR7YWMb/uO9BvUXtus+JMgkbIkLADd38cI4EiV+OQqrGo1Zlq6V8wnqMJ8e62wUQ==,
      }
    engines: { node: ">=20" }

  find-up@5.0.0:
    resolution:
      {
        integrity: sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==,
      }
    engines: { node: ">=10" }

  flat-cache@4.0.1:
    resolution:
      {
        integrity: sha512-f7ccFPK3SXFHpx15UIGyRJ/FJQctuKZ0zVuN3frBo4HnK3cay9VEW0R6yPYFHC0AgqhukPzKjq22t5DmAyqGyw==,
      }
    engines: { node: ">=16" }

  flatted@3.4.4:
    resolution:
      {
        integrity: sha512-5+ybhBZANEJxaH3X5evAFatUxLfEHSr7n6kYJ+1Qd0mUqr4eu9gIf6GDbWHf8RJijHrjjO8G+la14SlL2SeS1Q==,
      }

  follow-redirects@1.16.0:
    resolution:
      {
        integrity: sha512-y5rN/uOsadFT/JfYwhxRS5R7Qce+g3zG97+JrtFZlC9klX/W5hD7iiLzScI4nZqUS7DNUdhPgw4xI8W2LuXlUw==,
      }
    engines: { node: ">=4.0" }
    peerDependencies:
      debug: "*"
    peerDependenciesMeta:
      debug:
        optional: true

  for-each@0.3.5:
    resolution:
      {
        integrity: sha512-dKx12eRCVIzqCxFGplyFKJMPvLEWgmNtUrpTiJIR5u97zEhRG8ySrtboPHZXx7daLxQVrl643cTzbab2tkQjxg==,
      }
    engines: { node: ">= 0.4" }

  foreground-child@3.3.1:
    resolution:
      {
        integrity: sha512-gIXjKqtFuWEgzFRJA9WCQeSJLZDjgJUOMCMzxtvFq/37KojM1BFGufqsCy0r4qSQmYLsZYMeyRqzIWOMup03sw==,
      }
    engines: { node: ">=14" }

  form-data@4.0.6:
    resolution:
      {
        integrity: sha512-vKatAh4SlVfgbv+YtmhiRjhEMJsYpsG1Y2rMQtR+SVSbytsSD1YGzDIcrAJmdFec88u/+VoGmxnl+80gL1tRCQ==,
      }
    engines: { node: ">= 6" }

  formidable@3.5.4:
    resolution:
      {
        integrity: sha512-YikH+7CUTOtP44ZTnUhR7Ic2UASBPOqmaRkRKxRbywPTe5VxF7RRCck4af9wutiZ/QKM5nME9Bie2fFaPz5Gug==,
      }
    engines: { node: ">=14.0.0" }

  forwarded@0.2.0:
    resolution:
      {
        integrity: sha512-buRG0fpBtRHSTCOASe6hD258tEubFoRLb4ZNA6NxMVHNw2gOcwHo9wyablzMzOA5z9xA9L1KNjk/Nt6MT9aYow==,
      }
    engines: { node: ">= 0.6" }

  fresh@2.0.0:
    resolution:
      {
        integrity: sha512-Rx/WycZ60HOaqLKAi6cHRKKI7zxWbJ31MhntmtwMoaTeF7XFH9hhBp8vITaMidfljRQ6eYWCKkaTK+ykVJHP2A==,
      }
    engines: { node: ">= 0.8" }

  fs-constants@1.0.0:
    resolution:
      {
        integrity: sha512-y6OAwoSIf7FyjMIv94u+b5rdheZEjzR63GTyZJm5qh4Bi+2YgwLCcI/fPFZkL5PSixOt6ZNKm+w+Hfp/Bciwow==,
      }

  fsevents@2.3.3:
    resolution:
      {
        integrity: sha512-5xoDfX+fL7faATnagmWPpbFtwh/R77WmMMqqHGS65C3vvB0YHrgF+B1YmZ3441tMj5n63k0212XNoJwzlhffQw==,
      }
    engines: { node: ^8.16.0 || ^10.6.0 || >=11.0.0 }
    os: [darwin]

  function-bind@1.1.2:
    resolution:
      {
        integrity: sha512-7XHNxH7qX9xG5mIwxkhumTox/MIRNcOgDrxWsMt2pAr23WHp6MrRlN7FBSFpCpr+oVO0F744iUgR82nJMfG2SA==,
      }

  function.prototype.name@1.1.8:
    resolution:
      {
        integrity: sha512-e5iwyodOHhbMr/yNrc7fDYG4qlbIvI5gajyzPnb5TCwyhjApznQh1BMFou9b30SevY43gCJKXycoCBjMbsuW0Q==,
      }
    engines: { node: ">= 0.4" }

  functions-have-names@1.2.3:
    resolution:
      {
        integrity: sha512-xckBUXyTIqT97tq2x2AMb+g163b5JFysYk0x4qxNFwbfQkmNZoiRHb6sPzI9/QV33WeuvVYBUIiD4NzNIyqaRQ==,
      }

  generate-function@2.3.1:
    resolution:
      {
        integrity: sha512-eeB5GfMNeevm/GRYq20ShmsaGcmI81kIX2K9XQx5miC8KdHaC6Jm0qQ8ZNeGOi7wYB8OsdxKs+Y2oVuTFuVwKQ==,
      }

  gensync@1.0.0-beta.2:
    resolution:
      {
        integrity: sha512-3hN7NaskYvMDLQY55gnW3NQ+mesEAepTqlg+VEbj7zzqEMBVNhzcGYYeqFo/TlYz6eQiFcp1HcsCZO+nGgS8zg==,
      }
    engines: { node: ">=6.9.0" }

  get-caller-file@2.0.5:
    resolution:
      {
        integrity: sha512-DyFP3BM/3YHTQOCUL/w0OZHR0lpKeGrxotcHWcqNEdnltqFwXVfhEBQ94eIo34AfQpo0rGki4cyIiftY06h2Fg==,
      }
    engines: { node: 6.* || 8.* || >= 10.* }

  get-intrinsic@1.3.0:
    resolution:
      {
        integrity: sha512-9fSjSaos/fRIVIp+xSJlE6lfwhES7LNtKaCBIamHsjr2na1BiABJPo0mOjjz8GJDURarmCPGqaiVg5mfjb98CQ==,
      }
    engines: { node: ">= 0.4" }

  get-port-please@3.2.0:
    resolution:
      {
        integrity: sha512-I9QVvBw5U/hw3RmWpYKRumUeaDgxTPd401x364rLmWBJcOQ753eov1eTgzDqRG9bqFIfDc7gfzcQEWrUri3o1A==,
      }

  get-port@5.1.1:
    resolution:
      {
        integrity: sha512-g/Q1aTSDOxFpchXC4i8ZWvxA1lnPqx/JHqcpIw0/LX9T8x/GBbi6YnlN5nhaKIFkT8oFsscUKgDJYxfwfS6QsQ==,
      }
    engines: { node: ">=8" }

  get-proto@1.0.1:
    resolution:
      {
        integrity: sha512-sTSfBjoXBp89JvIKIefqw7U2CCebsc74kiY6awiGogKtoSGbgjYE/G/+l9sF3MWFPNc9IcoOC4ODfKHfxFmp0g==,
      }
    engines: { node: ">= 0.4" }

  get-symbol-description@1.1.0:
    resolution:
      {
        integrity: sha512-w9UMqWwJxHNOvoNzSJ2oPF5wvYcvP7jUvYzhp67yEhTi17ZDBBC1z9pTdGuzjD+EFIqLSYRweZjqfiPzQ06Ebg==,
      }
    engines: { node: ">= 0.4" }

  get-tsconfig@4.14.0:
    resolution:
      {
        integrity: sha512-yTb+8DXzDREzgvYmh6s9vHsSVCHeC0G3PI5bEXNBHtmshPnO+S5O7qgLEOn0I5QvMy6kpZN8K1NKGyilLb93wA==,
      }

  giget@3.3.1:
    resolution:
      {
        integrity: sha512-r+mvuDjrjMpsdw46Kmeydb8bdHm7wOKw8wNBtTndkjbPjgAp5oUJUxRE76wZFknxIPokfWvep2qSXK37aXE6zg==,
      }
    hasBin: true

  glob-parent@5.1.2:
    resolution:
      {
        integrity: sha512-AOIgSQCepiJYwP3ARnGx+5VnTu2HBYdzbGP45eLw1vr3zB3vZLeyed1sC9hnbcOc9/SrMyM5RPQrkGz4aS9Zow==,
      }
    engines: { node: ">= 6" }

  glob-parent@6.0.2:
    resolution:
      {
        integrity: sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==,
      }
    engines: { node: ">=10.13.0" }

  glob@10.5.0:
    resolution:
      {
        integrity: sha512-DfXN8DfhJ7NH3Oe7cFmu3NCu1wKbkReJ8TorzSAFbSKrlNaQSKfIzqYqVY8zlbs2NLBbWpRiU52GX2PbaBVNkg==,
      }
    deprecated: Old versions of glob are not supported, and contain widely publicized security vulnerabilities, which have been fixed in the current version. Please update. Support for old versions may be purchased (at exorbitant rates) by contacting i@izs.me
    hasBin: true

  glob@13.0.6:
    resolution:
      {
        integrity: sha512-Wjlyrolmm8uDpm/ogGyXZXb1Z+Ca2B8NbJwqBVg0axK9GbBeoS7yGV6vjXnYdGm6X53iehEuxxbyiKp8QmN4Vw==,
      }
    engines: { node: 18 || 20 || >=22 }

  globals@14.0.0:
    resolution:
      {
        integrity: sha512-oahGvuMGQlPw/ivIYBjVSrWAfWLBeku5tpPE2fOPLi+WHffIWbuh2tCjhyQhTBPMf5E9jDEH4FOmTYgYwbKwtQ==,
      }
    engines: { node: ">=18" }

  globals@16.4.0:
    resolution:
      {
        integrity: sha512-ob/2LcVVaVGCYN+r14cnwnoDPUufjiYgSqRhiFD0Q1iI4Odora5RE8Iv1D24hAz5oMophRGkGz+yuvQmmUMnMw==,
      }
    engines: { node: ">=18" }

  globals@16.5.0:
    resolution:
      {
        integrity: sha512-c/c15i26VrJ4IRt5Z89DnIzCGDn9EcebibhAOjw5ibqEHsE1wLUgkPn9RDmNcUKyU87GeaL633nyJ+pplFR2ZQ==,
      }
    engines: { node: ">=18" }

  globalthis@1.0.4:
    resolution:
      {
        integrity: sha512-DpLKbNU4WylpxJykQujfCcwYWiV/Jhm50Goo0wrVILAv5jOr9d+H+UR3PhSCD2rCCEIg0uc+G+muBTwD54JhDQ==,
      }
    engines: { node: ">= 0.4" }

  gopd@1.2.0:
    resolution:
      {
        integrity: sha512-ZUKRh6/kUFoAiTAtTYPZJ3hw9wNxx+BIBOijnlG9PnrJsCcSjs1wyyD6vJpaYtgnzDrKYRSqf3OO6Rfa93xsRg==,
      }
    engines: { node: ">= 0.4" }

  graceful-fs@4.2.11:
    resolution:
      {
        integrity: sha512-RbJ5/jmFcNNCcDV5o9eTnBLJ/HszWV0P73bc+Ff4nS/rJj+YaS6IGyiOL0VoBYX+l1Wrl3k63h/KrH+nhJ0XvQ==,
      }

  grammex@3.1.13:
    resolution:
      {
        integrity: sha512-LnPnhOBLEJEVKS8WFDVaA397L9Kq55Q9oSITJiVLHVdhAclfUkWzQv74KhvZHKL2Q09Pb1XdsrOsZ4LfTFFTEg==,
      }

  graphmatch@1.1.1:
    resolution:
      {
        integrity: sha512-5ykVn/EXM1hF0XCaWh05VbYvEiOL2lY1kBxZtaYsyvjp7cmWOU1XsAdfQBwClraEofXDT197lFbXOEVMHpvQOg==,
      }

  has-bigints@1.1.0:
    resolution:
      {
        integrity: sha512-R3pbpkcIqv2Pm3dUwgjclDRVmWpTJW2DcMzcIhEXEx1oh/CEMObMm3KLmRJOdvhM7o4uQBnwr8pzRK2sJWIqfg==,
      }
    engines: { node: ">= 0.4" }

  has-flag@4.0.0:
    resolution:
      {
        integrity: sha512-EykJT/Q1KjTWctppgIAgfSO0tKVuZUjhgMr17kqTumMl6Afv3EISleU7qZUzoXDFTAHTDC4NOoG/ZxU3EvlMPQ==,
      }
    engines: { node: ">=8" }

  has-property-descriptors@1.0.2:
    resolution:
      {
        integrity: sha512-55JNKuIW+vq4Ke1BjOTjM2YctQIvCT7GFzHwmfZPGo5wnrgkid0YQtnAleFSqumZm4az3n2BS+erby5ipJdgrg==,
      }

  has-proto@1.2.0:
    resolution:
      {
        integrity: sha512-KIL7eQPfHQRC8+XluaIw7BHUwwqL19bQn4hzNgdr+1wXoU0KKj6rufu47lhY7KbJR2C6T6+PfyN0Ea7wkSS+qQ==,
      }
    engines: { node: ">= 0.4" }

  has-symbols@1.1.0:
    resolution:
      {
        integrity: sha512-1cDNdwJ2Jaohmb3sg4OmKaMBwuC48sYni5HUw2DvsC8LjGTLK9h+eb1X6RyuOHe4hT0ULCW68iomhjUoKUqlPQ==,
      }
    engines: { node: ">= 0.4" }

  has-tostringtag@1.0.2:
    resolution:
      {
        integrity: sha512-NqADB8VjPFLM2V0VvHUewwwsw0ZWBaIdgo+ieHtK3hasLz4qeCRjYcqfB6AQrBggRKppKF8L52/VqdVsO47Dlw==,
      }
    engines: { node: ">= 0.4" }

  hasown@2.0.4:
    resolution:
      {
        integrity: sha512-T2UbfbBEF32wiepXIsMlTW9+dDYC6wMh/t/vYA4tuOMKqWz/n3vr1NFSxQiyP+zk2mXsoMA/i/7qV6LKut1t1A==,
      }
    engines: { node: ">= 0.4" }

  helmet@8.3.0:
    resolution:
      {
        integrity: sha512-Qgpiaws3Sm30Av8Eah6sjMCZZwjlBu+E68rhpCWBshY1lb09HtLwj5GviX0OyQIn+ulUS0iX0AxN5n3tLZzz1w==,
      }
    engines: { node: ">=18.0.0" }

  help-me@5.0.0:
    resolution:
      {
        integrity: sha512-7xgomUX6ADmcYzFik0HzAxh/73YlKR9bmFzf51CZwR+b6YtzU2m0u49hQCqV6SvlqIqsaxovfwdvbnsw3b/zpg==,
      }

  hermes-estree@0.25.1:
    resolution:
      {
        integrity: sha512-0wUoCcLp+5Ev5pDW2OriHC2MJCbwLwuRx+gAqMTOkGKJJiBCLjtrvy4PWUGn6MIVefecRpzoOZ/UV6iGdOr+Cw==,
      }

  hermes-parser@0.25.1:
    resolution:
      {
        integrity: sha512-6pEjquH3rqaI6cYAXYPcz9MS4rY6R4ngRgrgfDshRptUZIc3lw0MCIJIGDj9++mfySOuPTHB4nrSW99BCvOPIA==,
      }

  html-encoding-sniffer@6.0.0:
    resolution:
      {
        integrity: sha512-CV9TW3Y3f8/wT0BRFc1/KAVQ3TUHiXmaAb6VW9vtiMFf7SLoMd1PdAc4W3KFOFETBJUb90KatHqlsZMWV+R9Gg==,
      }
    engines: { node: ^20.19.0 || ^22.12.0 || >=24.0.0 }

  http-errors@2.0.1:
    resolution:
      {
        integrity: sha512-4FbRdAX+bSdmo4AUFuS0WNiPz8NgFt+r8ThgNWmlrjQjt1Q7ZR9+zTlce2859x4KSXrwIsaeTqDoKQmtP8pLmQ==,
      }
    engines: { node: ">= 0.8" }

  https-proxy-agent@5.0.1:
    resolution:
      {
        integrity: sha512-dFcAjpTQFgoLMzC2VwU+C/CbS7uRL0lWmxDITmqm7C+7F0Odmj6s9l6alZc6AELXhrnggM2CeWSXHGOdX2YtwA==,
      }
    engines: { node: ">= 6" }

  iconv-lite@0.7.3:
    resolution:
      {
        integrity: sha512-IKXpvIzjnC9XTAUbVBcMfGS0EPaIXtW6v+zr+RRp+hqULEpo0owZax6wyRwPOJbWbzjYspQwusTsfVr0ifh4uQ==,
      }
    engines: { node: ">=0.10.0" }

  ieee754@1.2.1:
    resolution:
      {
        integrity: sha512-dcyqhDvX1C46lXZcVqCpK+FtMRQVdIMN6/Df5js2zouUsqG7I6sFxitIC+7KYK29KdXOLHdu9zL4sFnoVQnqaA==,
      }

  ignore@5.3.2:
    resolution:
      {
        integrity: sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==,
      }
    engines: { node: ">= 4" }

  ignore@7.0.5:
    resolution:
      {
        integrity: sha512-Hs59xBNfUIunMFgWAbGX5cq6893IbWg4KnrjbYwX3tx0ztorVgTDA6B2sxf8ejHJ4wz8BqGUMYlnzNBer5NvGg==,
      }
    engines: { node: ">= 4" }

  import-fresh@3.3.1:
    resolution:
      {
        integrity: sha512-TR3KfrTZTYLPB6jUjfx6MF9WcWrHL9su5TObK4ZkYgBdWKPOFoSoQIdEuTuR82pmtxH2spWG9h6etwfr1pLBqQ==,
      }
    engines: { node: ">=6" }

  imurmurhash@0.1.4:
    resolution:
      {
        integrity: sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==,
      }
    engines: { node: ">=0.8.19" }

  indent-string@4.0.0:
    resolution:
      {
        integrity: sha512-EdDDZu4A2OyIK7Lr/2zG+w5jmbuk1DVBnEwREQvBzspBJkCEbRa8GxU1lghYcaGJCnRWibjDXlq779X1/y5xwg==,
      }
    engines: { node: ">=8" }

  inherits@2.0.4:
    resolution:
      {
        integrity: sha512-k/vGaX4/Yla3WzyMCvTQOXYeIHvqOKtnqBduzTHpzpQZzAskKMhZ2K+EnBiSM9zGSoIFeMpXKxa4dYeZIQqewQ==,
      }

  internal-slot@1.1.0:
    resolution:
      {
        integrity: sha512-4gd7VpWNQNB4UKKCFFVcp1AVv+FMOgs9NKzjHKusc8jTMhd5eL1NqQqOpE0KzMds804/yHlglp3uxgluOqAPLw==,
      }
    engines: { node: ">= 0.4" }

  internmap@2.0.3:
    resolution:
      {
        integrity: sha512-5Hh7Y1wQbvY5ooGgPbDaL5iYLAPzMTUrjMulskHLH6wnv/A+1q5rgEaiuqEjB+oxGXIVZs1FF+R/KPN3ZSQYYg==,
      }
    engines: { node: ">=12" }

  ip-address@10.4.0:
    resolution:
      {
        integrity: sha512-oSK96Grm3aP6OrS263xVxbNDGVL7rzBtYdpGqlDG8iQdoenDoTs/nkki+DflYbAEE8Xl6o5YxhxlrKvI3nqKXQ==,
      }
    engines: { node: ">= 12" }

  ipaddr.js@1.9.1:
    resolution:
      {
        integrity: sha512-0KI/607xoxSToH7GjN1FfSbLoU0+btTicjsQSWQlh/hZykN8KpmMf7uYwPW3R+akZ6R/w18ZlXSHBYXiYUPO3g==,
      }
    engines: { node: ">= 0.10" }

  is-array-buffer@3.0.5:
    resolution:
      {
        integrity: sha512-DDfANUiiG2wC1qawP66qlTugJeL5HyzMpfr8lLK+jMQirGzNod0B12cFB/9q838Ru27sBwfw78/rdoU7RERz6A==,
      }
    engines: { node: ">= 0.4" }

  is-async-function@2.1.1:
    resolution:
      {
        integrity: sha512-9dgM/cZBnNvjzaMYHVoxxfPj2QXt22Ev7SuuPrs+xav0ukGB0S6d4ydZdEiM48kLx5kDV+QBPrpVnFyefL8kkQ==,
      }
    engines: { node: ">= 0.4" }

  is-bigint@1.1.0:
    resolution:
      {
        integrity: sha512-n4ZT37wG78iz03xPRKJrHTdZbe3IicyucEtdRsV5yglwc3GyUfbAfpSeD0FJ41NbUNSt5wbhqfp1fS+BgnvDFQ==,
      }
    engines: { node: ">= 0.4" }

  is-boolean-object@1.2.2:
    resolution:
      {
        integrity: sha512-wa56o2/ElJMYqjCjGkXri7it5FbebW5usLw/nPmCMs5DeZ7eziSYZhSmPRn0txqeW4LnAmQQU7FgqLpsEFKM4A==,
      }
    engines: { node: ">= 0.4" }

  is-bun-module@2.0.0:
    resolution:
      {
        integrity: sha512-gNCGbnnnnFAUGKeZ9PdbyeGYJqewpmc2aKHUEMO5nQPWU9lOmv7jcmQIv+qHD8fXW6W7qfuCwX4rY9LNRjXrkQ==,
      }

  is-callable@1.2.7:
    resolution:
      {
        integrity: sha512-1BC0BVFhS/p0qtw6enp8e+8OD0UrK0oFLztSjNzhcKA3WDuJxxAPXzPuPtKkjEY9UUoEWlX/8fgKeu2S8i9JTA==,
      }
    engines: { node: ">= 0.4" }

  is-core-module@2.16.2:
    resolution:
      {
        integrity: sha512-evOr8xfXKxE6qSR0hSXL2r3sd7ALj8+7jQEUvPYcm5sgZFdJ+AYzT6yNmJenvIYQBgIGwfwz08sL8zoL7yq2BA==,
      }
    engines: { node: ">= 0.4" }

  is-data-view@1.0.2:
    resolution:
      {
        integrity: sha512-RKtWF8pGmS87i2D6gqQu/l7EYRlVdfzemCJN/P3UOs//x1QE7mfhvzHIApBTRf7axvT6DMGwSwBXYCT0nfB9xw==,
      }
    engines: { node: ">= 0.4" }

  is-date-object@1.1.0:
    resolution:
      {
        integrity: sha512-PwwhEakHVKTdRNVOw+/Gyh0+MzlCl4R6qKvkhuvLtPMggI1WAHt9sOwZxQLSGpUaDnrdyDsomoRgNnCfKNSXXg==,
      }
    engines: { node: ">= 0.4" }

  is-extglob@2.1.1:
    resolution:
      {
        integrity: sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==,
      }
    engines: { node: ">=0.10.0" }

  is-finalizationregistry@1.1.1:
    resolution:
      {
        integrity: sha512-1pC6N8qWJbWoPtEjgcL2xyhQOP491EQjeUo3qTKcmV8YSDDJrOepfG8pcC7h/QgnQHYSv0mJ3Z/ZWxmatVrysg==,
      }
    engines: { node: ">= 0.4" }

  is-fullwidth-code-point@3.0.0:
    resolution:
      {
        integrity: sha512-zymm5+u+sCsSWyD9qNaejV3DFvhCKclKdizYaJUuHA83RLjb7nSuGnddCHGv0hk+KY7BMAlsWeK4Ueg6EV6XQg==,
      }
    engines: { node: ">=8" }

  is-generator-function@1.1.0:
    resolution:
      {
        integrity: sha512-nPUB5km40q9e8UfN/Zc24eLlzdSf9OfKByBw9CIdw4H1giPMeA0OIJvbchsCu4npfI2QcMVBsGEBHKZ7wLTWmQ==,
      }
    engines: { node: ">= 0.4" }

  is-glob@4.0.3:
    resolution:
      {
        integrity: sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==,
      }
    engines: { node: ">=0.10.0" }

  is-map@2.0.3:
    resolution:
      {
        integrity: sha512-1Qed0/Hr2m+YqxnM09CjA2d/i6YZNfF6R2oRAOj36eUdS6qIV/huPJNSEpKbupewFs+ZsJlxsjjPbc0/afW6Lw==,
      }
    engines: { node: ">= 0.4" }

  is-negative-zero@2.0.3:
    resolution:
      {
        integrity: sha512-5KoIu2Ngpyek75jXodFvnafB6DJgr3u8uuK0LEZJjrU19DrMD3EVERaR8sjz8CCGgpZvxPl9SuE1GMVPFHx1mw==,
      }
    engines: { node: ">= 0.4" }

  is-number-object@1.1.1:
    resolution:
      {
        integrity: sha512-lZhclumE1G6VYD8VHe35wFaIif+CTy5SJIi5+3y4psDgWu4wPDoBhF8NxUOinEc7pHgiTsT6MaBb92rKhhD+Xw==,
      }
    engines: { node: ">= 0.4" }

  is-number@7.0.0:
    resolution:
      {
        integrity: sha512-41Cifkg6e8TylSpdtTpeLVMqvSBEVzTttHvERD741+pnZ8ANv0004MRL43QKPDlK9cGvNp6NZWZUBlbGXYxxng==,
      }
    engines: { node: ">=0.12.0" }

  is-potential-custom-element-name@1.0.1:
    resolution:
      {
        integrity: sha512-bCYeRA2rVibKZd+s2625gGnGF/t7DSqDs4dP7CrLA1m7jKWz6pps0LpYLJN8Q64HtmPKJ1hrN3nzPNKFEKOUiQ==,
      }

  is-promise@4.0.0:
    resolution:
      {
        integrity: sha512-hvpoI6korhJMnej285dSg6nu1+e6uxs7zG3BYAm5byqDsgJNWwxzM6z6iZiAgQR4TJ30JmBTOwqZUw3WlyH3AQ==,
      }

  is-property@1.0.2:
    resolution:
      {
        integrity: sha512-Ks/IoX00TtClbGQr4TWXemAnktAQvYB7HzcCxDGqEZU6oCmb2INHuOoKxbtR+HFkmYWBKv/dOZtGRiAjDhj92g==,
      }

  is-regex@1.2.1:
    resolution:
      {
        integrity: sha512-MjYsKHO5O7mCsmRGxWcLWheFqN9DJ/2TmngvjKXihe6efViPqc274+Fx/4fYj/r03+ESvBdTXK0V6tA3rgez1g==,
      }
    engines: { node: ">= 0.4" }

  is-set@2.0.3:
    resolution:
      {
        integrity: sha512-iPAjerrse27/ygGLxw+EBR9agv9Y6uLeYVJMu+QNCoouJ1/1ri0mGrcWpfCqFZuzzx3WjtwxG098X+n4OuRkPg==,
      }
    engines: { node: ">= 0.4" }

  is-shared-array-buffer@1.0.4:
    resolution:
      {
        integrity: sha512-ISWac8drv4ZGfwKl5slpHG9OwPNty4jOWPRIhBpxOoD+hqITiwuipOQ2bNthAzwA3B4fIjO4Nln74N0S9byq8A==,
      }
    engines: { node: ">= 0.4" }

  is-stream@2.0.1:
    resolution:
      {
        integrity: sha512-hFoiJiTl63nn+kstHGBtewWSKnQLpyb155KHheA1l39uvtO9nWIop1p3udqPcUd/xbF1VLMO4n7OI6p7RbngDg==,
      }
    engines: { node: ">=8" }

  is-string@1.1.1:
    resolution:
      {
        integrity: sha512-BtEeSsoaQjlSPBemMQIrY1MY0uM6vnS1g5fmufYOtnxLGUZM2178PKbhsk7Ffv58IX+ZtcvoGwccYsh0PglkAA==,
      }
    engines: { node: ">= 0.4" }

  is-symbol@1.1.1:
    resolution:
      {
        integrity: sha512-9gGx6GTtCQM73BgmHQXfDmLtfjjTUDSyoxTCbp5WtoixAhfgsDirWIcVQ/IHpvI5Vgd5i/J5F7B9cN/WlVbC/w==,
      }
    engines: { node: ">= 0.4" }

  is-typed-array@1.1.15:
    resolution:
      {
        integrity: sha512-p3EcsicXjit7SaskXHs1hA91QxgTw46Fv6EFKKGS5DRFLD8yKnohjF3hxoju94b/OcMZoQukzpPpBE9uLVKzgQ==,
      }
    engines: { node: ">= 0.4" }

  is-weakmap@2.0.2:
    resolution:
      {
        integrity: sha512-K5pXYOm9wqY1RgjpL3YTkF39tni1XajUIkawTLUo9EZEVUFga5gSQJF8nNS7ZwJQ02y+1YCNYcMh+HIf1ZqE+w==,
      }
    engines: { node: ">= 0.4" }

  is-weakref@1.1.1:
    resolution:
      {
        integrity: sha512-6i9mGWSlqzNMEqpCp93KwRS1uUOodk2OJ6b+sq7ZPDSy2WuI5NFIxp/254TytR8ftefexkWn5xNiHUNpPOfSew==,
      }
    engines: { node: ">= 0.4" }

  is-weakset@2.0.4:
    resolution:
      {
        integrity: sha512-mfcwb6IzQyOKTs84CQMrOwW4gQcaTOAWJ0zzJCl2WSPDrWk/OzDaImWFH3djXhb24g4eudZfLRozAvPGw4d9hQ==,
      }
    engines: { node: ">= 0.4" }

  isarray@1.0.0:
    resolution:
      {
        integrity: sha512-VLghIWNM6ELQzo7zwmcg0NmTVyWKYjvIeM83yjp0wRDTmUnrM678fQbcKBo6n2CJEF0szoG//ytg+TKla89ALQ==,
      }

  isarray@2.0.5:
    resolution:
      {
        integrity: sha512-xHjhDr3cNBK0BzdUJSPXZntQUx/mwMS5Rw4A7lPJ90XGAO6ISP/ePDNuo0vhqOZU+UD5JoodwCAAoZQd3FeAKw==,
      }

  isexe@2.0.0:
    resolution:
      {
        integrity: sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==,
      }

  iterator.prototype@1.1.5:
    resolution:
      {
        integrity: sha512-H0dkQoCa3b2VEeKQBOxFph+JAbcrQdE7KC0UkqwpLmv2EC4P41QXP+rqo9wYodACiG5/WM5s9oDApTU8utwj9g==,
      }
    engines: { node: ">= 0.4" }

  jackspeak@3.4.3:
    resolution:
      {
        integrity: sha512-OGlZQpz2yfahA/Rd1Y8Cd9SIEsqvXkLVoSw/cgwhnhFMDbsQFeZYoJJ7bIZBS9BcamUW96asq/npPWugM+RQBw==,
      }

  jiti@2.7.0:
    resolution:
      {
        integrity: sha512-AC/7JofJvZGrrneWNaEnJeOLUx+JlGt7tNa0wZiRPT4MY1wmfKjt2+6O2p2uz2+skll8OZZmJMNqeke7kKbNgQ==,
      }
    hasBin: true

  joycon@3.1.1:
    resolution:
      {
        integrity: sha512-34wB/Y7MW7bzjKRjUKTa46I2Z7eV62Rkhva+KkopW7Qvv/OSWBqvkSY7vusOPrNuZcUG3tApvdVgNB8POj3SPw==,
      }
    engines: { node: ">=10" }

  js-tokens@4.0.0:
    resolution:
      {
        integrity: sha512-RdJUflcE3cUzKiMqQgsCu06FPu9UdIJO0beYbPhHN4k6apgJtifcoCtT9bcxOpYBtpD2kCM6Sbzg4CausW/PKQ==,
      }

  js-yaml@4.3.1:
    resolution:
      {
        integrity: sha512-CY6crGq313MX8GkwvB7tzgp99vjQxY1++5y10/BKN/GUfHqWaOGQMNZkBvqSzsZKWk/ijwHlWzzkLulsGHhjWQ==,
      }
    hasBin: true

  jsdom@30.0.1:
    resolution:
      {
        integrity: sha512-52v7mUVUfNQVYYqE1lcdaymWL0njO7lTLUog6ZvW2U5KsbiLk/GnZlVJ+qx0xfNJZ6Gn+KSpPNE52vurbxZwrA==,
      }
    engines: { node: ^22.22.2 || ^24.15.0 || >=26.0.0 }
    peerDependencies:
      canvas: ^3.2.3
    peerDependenciesMeta:
      canvas:
        optional: true

  jsesc@3.1.0:
    resolution:
      {
        integrity: sha512-/sM3dO2FOzXjKQhJuo0Q173wf2KOo8t4I8vHy6lF9poUp7bKT0/NHE8fPX23PwfhnykfqnC2xRxOnVw5XuGIaA==,
      }
    engines: { node: ">=6" }
    hasBin: true

  json-buffer@3.0.1:
    resolution:
      {
        integrity: sha512-4bV5BfR2mqfQTJm+V5tPPdf+ZpuhiIvTuAB5g8kcrXOZpTT/QwwVRWBywX1ozr6lEuPdbHxwaJlm9G6mI2sfSQ==,
      }

  json-schema-traverse@0.4.1:
    resolution:
      {
        integrity: sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==,
      }

  json-schema-traverse@1.0.0:
    resolution:
      {
        integrity: sha512-NM8/P9n3XjXhIZn1lLhkFaACTOURQXjWhV4BA/RnOv8xvgqtqpAX9IO4mRQxSx1Rlo4tqzeqb0sOlruaOy3dug==,
      }

  json-stable-stringify-without-jsonify@1.0.1:
    resolution:
      {
        integrity: sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==,
      }

  json5@1.0.2:
    resolution:
      {
        integrity: sha512-g1MWMLBiz8FKi1e4w0UyVL3w+iJceWAFBAaBnnGKOpNa5f8TLktkbre1+s6oICydWAm+HRUGTmI+//xv2hvXYA==,
      }
    hasBin: true

  json5@2.2.3:
    resolution:
      {
        integrity: sha512-XmOWe7eyHYH14cLdVPoyg+GOH3rYX++KpzrylJwSW98t3Nk+U8XOl8FWKOgwtzdb8lXGf6zYwDUzeHMWfxasyg==,
      }
    engines: { node: ">=6" }
    hasBin: true

  jsonwebtoken@9.0.3:
    resolution:
      {
        integrity: sha512-MT/xP0CrubFRNLNKvxJ2BYfy53Zkm++5bX9dtuPbqAeQpTVe0MQTFhao8+Cp//EmJp244xt6Drw/GVEGCUj40g==,
      }
    engines: { node: ">=12", npm: ">=6" }

  jsx-ast-utils@3.3.5:
    resolution:
      {
        integrity: sha512-ZZow9HBI5O6EPgSJLUb8n2NKgmVWTwCvHGwFuJlMjvLFqlGG6pjirPhtdsseaLZjSibD8eegzmYpUZwoIlj2cQ==,
      }
    engines: { node: ">=4.0" }

  jwa@2.0.1:
    resolution:
      {
        integrity: sha512-hRF04fqJIP8Abbkq5NKGN0Bbr3JxlQ+qhZufXVr0DvujKy93ZCbXZMHDL4EOtodSbCWxOqR8MS1tXA5hwqCXDg==,
      }

  jws@4.0.1:
    resolution:
      {
        integrity: sha512-EKI/M/yqPncGUUh44xz0PxSidXFr/+r0pA70+gIYhjv+et7yxM+s29Y+VGDkovRofQem0fs7Uvf4+YmAdyRduA==,
      }

  keyv@4.5.4:
    resolution:
      {
        integrity: sha512-oxVHkHR/EJf2CNXnWxRLW6mg7JyCCUcG0DtEGmL2ctUo1PNTin1PUil+r/+4r5MpVgC/fn1kjsx7mjSujKqIpw==,
      }

  language-subtag-registry@0.3.23:
    resolution:
      {
        integrity: sha512-0K65Lea881pHotoGEa5gDlMxt3pctLi2RplBb7Ezh4rRdLEOtgi7n4EwK9lamnUCkKBqaeKRVebTq6BAxSkpXQ==,
      }

  language-tags@1.0.9:
    resolution:
      {
        integrity: sha512-MbjN408fEndfiQXbFQ1vnd+1NoLDsnQW41410oQBXiyXDMYH5z505juWa4KUE1LqxRC7DgOgZDbKLxHIwm27hA==,
      }
    engines: { node: ">=0.10" }

  lazystream@1.0.1:
    resolution:
      {
        integrity: sha512-b94GiNHQNy6JNTrt5w6zNyffMrNkXZb3KTkCZJb2V1xaEGCk093vkZ2jk3tpaeP33/OiXC+WvK9AxUebnf5nbw==,
      }
    engines: { node: ">= 0.6.3" }

  levn@0.4.1:
    resolution:
      {
        integrity: sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==,
      }
    engines: { node: ">= 0.8.0" }

  lightningcss-android-arm64@1.32.0:
    resolution:
      {
        integrity: sha512-YK7/ClTt4kAK0vo6w3X+Pnm0D2cf2vPHbhOXdoNti1Ga0al1P4TBZhwjATvjNwLEBCnKvjJc2jQgHXH0NEwlAg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [android]

  lightningcss-android-arm64@1.33.0:
    resolution:
      {
        integrity: sha512-gEpRTalKdosp4Bb8qWtc2iOgE5SeIHlpS1up9bFq2wAyYhl1UdTObYiHe98zEM9SQvSoqQZ1IQD0JNpg3Ml5pg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [android]

  lightningcss-darwin-arm64@1.32.0:
    resolution:
      {
        integrity: sha512-RzeG9Ju5bag2Bv1/lwlVJvBE3q6TtXskdZLLCyfg5pt+HLz9BqlICO7LZM7VHNTTn/5PRhHFBSjk5lc4cmscPQ==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [darwin]

  lightningcss-darwin-arm64@1.33.0:
    resolution:
      {
        integrity: sha512-Sciaz8eenNTKn9b3t7+xr0ipTp9YxKQY4npwQ3mrRuL0BAVHBLyZxofhaKBAVtzmtRZ/zTyo0/to4B1uWG/Djg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [darwin]

  lightningcss-darwin-x64@1.32.0:
    resolution:
      {
        integrity: sha512-U+QsBp2m/s2wqpUYT/6wnlagdZbtZdndSmut/NJqlCcMLTWp5muCrID+K5UJ6jqD2BFshejCYXniPDbNh73V8w==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [darwin]

  lightningcss-darwin-x64@1.33.0:
    resolution:
      {
        integrity: sha512-Z5UPAxzrjlWNNyGy6i65cJzzvgJ5D3T6wMvs+gWpY9d7qRhANrxqAp6LhxIgZhWEw18RfJTGcRxjuLIBr+m8XQ==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [darwin]

  lightningcss-freebsd-x64@1.32.0:
    resolution:
      {
        integrity: sha512-JCTigedEksZk3tHTTthnMdVfGf61Fky8Ji2E4YjUTEQX14xiy/lTzXnu1vwiZe3bYe0q+SpsSH/CTeDXK6WHig==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [freebsd]

  lightningcss-freebsd-x64@1.33.0:
    resolution:
      {
        integrity: sha512-QQM/Ti/hQajJwCY+RiWuCZ9sdtI/XQk7nDK5vC8kkdwixezOlDgvDx7+RT+QjK6FcFT4MpsuoBnHIo/O3StRRg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [freebsd]

  lightningcss-linux-arm-gnueabihf@1.32.0:
    resolution:
      {
        integrity: sha512-x6rnnpRa2GL0zQOkt6rts3YDPzduLpWvwAF6EMhXFVZXD4tPrBkEFqzGowzCsIWsPjqSK+tyNEODUBXeeVHSkw==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm]
    os: [linux]

  lightningcss-linux-arm-gnueabihf@1.33.0:
    resolution:
      {
        integrity: sha512-N7FVBe6iS24MlM6R/4RBTxGhQheZGs7tiQ9U32UtF75NzP5Q7xWPRqLBCKxlRQRk3rY1jCIPLzx7WzOhuUIRLQ==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm]
    os: [linux]

  lightningcss-linux-arm64-gnu@1.32.0:
    resolution:
      {
        integrity: sha512-0nnMyoyOLRJXfbMOilaSRcLH3Jw5z9HDNGfT/gwCPgaDjnx0i8w7vBzFLFR1f6CMLKF8gVbebmkUN3fa/kQJpQ==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  lightningcss-linux-arm64-gnu@1.33.0:
    resolution:
      {
        integrity: sha512-j2v/itmy4HlNxlc6voKXYgBqNi0Ng2LShg4z7GufpEgs05P+2suBVyi9I6YHq5uoVFx9ETin3eCEhLVyXGQnKg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [linux]
    libc: [glibc]

  lightningcss-linux-arm64-musl@1.32.0:
    resolution:
      {
        integrity: sha512-UpQkoenr4UJEzgVIYpI80lDFvRmPVg6oqboNHfoH4CQIfNA+HOrZ7Mo7KZP02dC6LjghPQJeBsvXhJod/wnIBg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  lightningcss-linux-arm64-musl@1.33.0:
    resolution:
      {
        integrity: sha512-yiO5ROMuYQgXbC60yjZU5CYSFZGKXL0HFATXt9mHJn1+zW55oCtMI9NfcVhYLMFDL7gV7oBPon/EmMMGg2OvtQ==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [linux]
    libc: [musl]

  lightningcss-linux-x64-gnu@1.32.0:
    resolution:
      {
        integrity: sha512-V7Qr52IhZmdKPVr+Vtw8o+WLsQJYCTd8loIfpDaMRWGUZfBOYEJeyJIkqGIDMZPwPx24pUMfwSxxI8phr/MbOA==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  lightningcss-linux-x64-gnu@1.33.0:
    resolution:
      {
        integrity: sha512-ar+Ju7LmcN0Jo4FpL4hpFybwNG9/3A/Br5KW2n2jyODg3MEZXaDYADdemoNS+BDNfMgKvylJLj4S5tyRActuAg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [linux]
    libc: [glibc]

  lightningcss-linux-x64-musl@1.32.0:
    resolution:
      {
        integrity: sha512-bYcLp+Vb0awsiXg/80uCRezCYHNg1/l3mt0gzHnWV9XP1W5sKa5/TCdGWaR/zBM2PeF/HbsQv/j2URNOiVuxWg==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  lightningcss-linux-x64-musl@1.33.0:
    resolution:
      {
        integrity: sha512-RYiYbkokw0trfKqqzfF55lginwEPrD3OJDfTuJzFs1MK6iFnDenaz1fqLLtX4ITG3OktJQXOeTaw1awrBAlZPw==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [linux]
    libc: [musl]

  lightningcss-win32-arm64-msvc@1.32.0:
    resolution:
      {
        integrity: sha512-8SbC8BR40pS6baCM8sbtYDSwEVQd4JlFTOlaD3gWGHfThTcABnNDBda6eTZeqbofalIJhFx0qKzgHJmcPTnGdw==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [win32]

  lightningcss-win32-arm64-msvc@1.33.0:
    resolution:
      {
        integrity: sha512-1K+MPfLSFVpphzpdbfkhlWk6wBrTObBzS2T6db10PNOZgR9GoVsAWzwNyuhUYYbTp23j+4RrncfujZ4uAzXvwA==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [arm64]
    os: [win32]

  lightningcss-win32-x64-msvc@1.32.0:
    resolution:
      {
        integrity: sha512-Amq9B/SoZYdDi1kFrojnoqPLxYhQ4Wo5XiL8EVJrVsB8ARoC1PWW6VGtT0WKCemjy8aC+louJnjS7U18x3b06Q==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [win32]

  lightningcss-win32-x64-msvc@1.33.0:
    resolution:
      {
        integrity: sha512-OlEICDx/Xl0FqSp4bry8zFnCvGpig3Gl4gCquvYwHuqJKEC1+n9NgDniFvqHGmMv1ZkqDJrDqKKSykTDX+ehuA==,
      }
    engines: { node: ">= 12.0.0" }
    cpu: [x64]
    os: [win32]

  lightningcss@1.32.0:
    resolution:
      {
        integrity: sha512-NXYBzinNrblfraPGyrbPoD19C1h9lfI/1mzgWYvXUTe414Gz/X1FD2XBZSZM7rRTrMA8JL3OtAaGifrIKhQ5yQ==,
      }
    engines: { node: ">= 12.0.0" }

  lightningcss@1.33.0:
    resolution:
      {
        integrity: sha512-WkUDrojuJs0xkgGf2udWxa3yGBRxPtxUkB79i6aCZLRgc7PM8fZe9TosfPDcvEpQZbuFASnHYmRLBLUbmLOIIA==,
      }
    engines: { node: ">= 12.0.0" }

  locate-path@6.0.0:
    resolution:
      {
        integrity: sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==,
      }
    engines: { node: ">=10" }

  lodash.camelcase@4.3.0:
    resolution:
      {
        integrity: sha512-TwuEnCnxbc3rAvhf/LbG7tJUDzhqXyFnv3dtzLOPgCG/hODL7WFnsbwktkD7yUV0RrreP/l1PALq/YSg6VvjlA==,
      }

  lodash.includes@4.3.0:
    resolution:
      {
        integrity: sha512-W3Bx6mdkRTGtlJISOvVD/lbqjTlPPUDTMnlXZFnVwi9NKJ6tiAk6LVdlhZMm17VZisqhKcgzpO5Wz91PCt5b0w==,
      }

  lodash.isboolean@3.0.3:
    resolution:
      {
        integrity: sha512-Bz5mupy2SVbPHURB98VAcw+aHh4vRV5IPNhILUCsOzRmsTmSQ17jIuqopAentWoehktxGd9e/hbIXq980/1QJg==,
      }

  lodash.isinteger@4.0.4:
    resolution:
      {
        integrity: sha512-DBwtEWN2caHQ9/imiNeEA5ys1JoRtRfY3d7V9wkqtbycnAmTvRRmbHKDV4a0EYc678/dia0jrte4tjYwVBaZUA==,
      }

  lodash.isnumber@3.0.3:
    resolution:
      {
        integrity: sha512-QYqzpfwO3/CWf3XP+Z+tkQsfaLL/EnUlXWVkIk5FUPc4sBdTehEqZONuyRt2P67PXAk+NXmTBcc97zw9t1FQrw==,
      }

  lodash.isplainobject@4.0.6:
    resolution:
      {
        integrity: sha512-oSXzaWypCMHkPC3NvBEaPHf0KsA5mvPrOPgQWDsbg8n7orZ290M0BmC/jgRZ4vcJ6DTAhjrsSYgdsW/F+MFOBA==,
      }

  lodash.isstring@4.0.1:
    resolution:
      {
        integrity: sha512-0wJxfxH1wgO3GrbuP+dTTk7op+6L41QCXbGINEmD+ny/G/eCqGzxyCsh7159S+mgDDcoarnBw6PC1PS5+wUGgw==,
      }

  lodash.merge@4.6.2:
    resolution:
      {
        integrity: sha512-0KpjqXRVvrYyCsX1swR/XTK0va6VQkQM6MNo7PqW77ByjAhoARA8EfrP1N4+KlKj8YS0ZUCtRT/YUuhyYDujIQ==,
      }

  lodash.once@4.1.1:
    resolution:
      {
        integrity: sha512-Sb487aTOCr9drQVL8pIxOzVhafOjZN9UU54hiN8PU3uAiSV7lx1yYNpbNmex2PK6dSJoNTSJUUswT651yww3Mg==,
      }

  lodash@4.18.1:
    resolution:
      {
        integrity: sha512-dMInicTPVE8d1e5otfwmmjlxkZoUpiVLwyeTdUsi/Caj/gfzzblBcCE5sRHV/AsjuCmxWrte2TNGSYuCeCq+0Q==,
      }

  long@5.3.2:
    resolution:
      {
        integrity: sha512-mNAgZ1GmyNhD7AuqnTG3/VQ26o760+ZYBPKjPvugO8+nLbYfX6TVpJPseBvopbdY+qpZ/lKUnmEc1LeZYS3QAA==,
      }

  loose-envify@1.4.0:
    resolution:
      {
        integrity: sha512-lyuxPGr/Wfhrlem2CL/UcnUc1zcqKAImBDzukY7Y5F/yQiNdko6+fRLevlw1HgMySw7f611UIY408EtxRSoK3Q==,
      }
    hasBin: true

  lru-cache@10.4.3:
    resolution:
      {
        integrity: sha512-JNAzZcXrCt42VGLuYz0zfAzDfAvJWW6AfYlDBQyDV5DClI2m5sAmK+OIO7s59XfsRsWHp02jAJrRadPRGTt6SQ==,
      }

  lru-cache@11.5.2:
    resolution:
      {
        integrity: sha512-4pfM1Ff0x50o0tQwb5ucw/RzNyD0/YJME6IVcStalZuMWxdt3sR3huStTtxz4PUmvZfRguvDejasvQ2kifR11g==,
      }
    engines: { node: 20 || >=22 }

  lru-cache@5.1.1:
    resolution:
      {
        integrity: sha512-KpNARQA3Iwv+jTA0utUVVbrh+Jlrr1Fv0e56GGzAFOXN7dk/FviaDW8LHmK52DlcH4WP2n6gI8vN1aesBFgo9w==,
      }

  lru.min@1.1.4:
    resolution:
      {
        integrity: sha512-DqC6n3QQ77zdFpCMASA1a3Jlb64Hv2N2DciFGkO/4L9+q/IpIAuRlKOvCXabtRW6cQf8usbmM6BE/TOPysCdIA==,
      }
    engines: { bun: ">=1.0.0", deno: ">=1.30.0", node: ">=8.0.0" }

  lz-string@1.5.0:
    resolution:
      {
        integrity: sha512-h5bgJWpxJNswbU7qCrV0tIKQCaS3blPDrqKWx+QxzuzL1zGUzij9XCWLrSLsJPu5t+eWA/ycetzYAO5IOMcWAQ==,
      }
    hasBin: true

  magic-string@0.30.21:
    resolution:
      {
        integrity: sha512-vd2F4YUyEXKGcLHoq+TEyCjxueSeHnFxyyjNp80yg0XV4vUhnDer/lvvlqM/arB5bXQN5K2/3oinyCRyx8T2CQ==,
      }

  math-intrinsics@1.1.0:
    resolution:
      {
        integrity: sha512-/IXtbwEk5HTPyEwyKX6hGkYXxM9nbj64B+ilVJnC/R6B0pH5G4V3b0pVbL7DBj4tkhBAppbQUlf6F6Xl9LHu1g==,
      }
    engines: { node: ">= 0.4" }

  mdn-data@2.27.1:
    resolution:
      {
        integrity: sha512-9Yubnt3e8A0OKwxYSXyhLymGW4sCufcLG6VdiDdUGVkPhpqLxlvP5vl1983gQjJl3tqbrM731mjaZaP68AgosQ==,
      }

  media-typer@1.1.1:
    resolution:
      {
        integrity: sha512-yz3xRaG20c6/BOzvYoDaGtPmGscs7YivItZEEqe6GbwNfHuxu9YNmvnEkMzKldAGY4/80pRcQRZSEnhquk9XuQ==,
      }
    engines: { node: ">= 0.8" }

  merge-descriptors@2.0.0:
    resolution:
      {
        integrity: sha512-Snk314V5ayFLhp3fkUREub6WtjBfPdCPY1Ln8/8munuLuiYhsABgBVWsozAG+MWMbVEvcdcpbi9R7ww22l9Q3g==,
      }
    engines: { node: ">=18" }

  merge2@1.4.1:
    resolution:
      {
        integrity: sha512-8q7VEgMJW4J8tcfVPy8g09NcQwZdbwFEqhe/WZkoIzjn/3TGDwtOCYtXGxA3O8tPzpczCCDgv+P2P5y00ZJOOg==,
      }
    engines: { node: ">= 8" }

  methods@1.1.2:
    resolution:
      {
        integrity: sha512-iclAHeNqNm68zFtnZ0e+1L2yUIdvzNoauKU4WBA3VvH/vPFieF7qfRlwUZU+DA9P9bPXIS90ulxoUoCH23sV2w==,
      }
    engines: { node: ">= 0.6" }

  micromatch@4.0.8:
    resolution:
      {
        integrity: sha512-PXwfBhYu0hBCPw8Dn0E+WDYb7af3dSLVWKi3HGv84IdF4TyFoC0ysxFd0Goxw7nSv4T/PzEJQxsYsEiFCKo2BA==,
      }
    engines: { node: ">=8.6" }

  mime-db@1.52.0:
    resolution:
      {
        integrity: sha512-sPU4uV7dYlvtWJxwwxHD0PuihVNiE7TyAbQ5SWxDCB9mUYvOgroQOwYQQOKPJ8CIbE+1ETVlOoK1UC2nU3gYvg==,
      }
    engines: { node: ">= 0.6" }

  mime-db@1.54.0:
    resolution:
      {
        integrity: sha512-aU5EJuIN2WDemCcAp2vFBfp/m4EAhWJnUNSSw0ixs7/kXbd6Pg64EmwJkNdFhB8aWt1sH2CTXrLxo/iAGV3oPQ==,
      }
    engines: { node: ">= 0.6" }

  mime-types@2.1.35:
    resolution:
      {
        integrity: sha512-ZDY+bPm5zTTF+YpCrAU9nK0UgICYPT0QtT1NZWFv4s++TNkcgVaT0g6+4R2uI4MjQjzysHB1zxuWL50hzaeXiw==,
      }
    engines: { node: ">= 0.6" }

  mime-types@3.0.2:
    resolution:
      {
        integrity: sha512-Lbgzdk0h4juoQ9fCKXW4by0UJqj+nOOrI9MJ1sSj4nI8aI2eo1qmvQEie4VD1glsS250n15LsWsYtCugiStS5A==,
      }
    engines: { node: ">=18" }

  mime@2.6.0:
    resolution:
      {
        integrity: sha512-USPkMeET31rOMiarsBNIHZKLGgvKc/LrjofAnBlOttf5ajRvqiRA8QsenbcooctK6d6Ts6aqZXBA+XbkKthiQg==,
      }
    engines: { node: ">=4.0.0" }
    hasBin: true

  min-indent@1.0.1:
    resolution:
      {
        integrity: sha512-I9jwMn07Sy/IwOj3zVkVik2JTvgpaykDZEigL6Rx6N9LbMywwUSMtxET+7lVoDLLd3O3IXwJwvuuns8UB/HeAg==,
      }
    engines: { node: ">=4" }

  minimatch@10.2.6:
    resolution:
      {
        integrity: sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==,
      }
    engines: { node: 18 || 20 || >=22 }

  minimatch@3.1.5:
    resolution:
      {
        integrity: sha512-VgjWUsnnT6n+NUk6eZq77zeFdpW2LWDzP6zFGrCbHXiYNul5Dzqk2HHQ5uFH2DNW5Xbp8+jVzaeNt94ssEEl4w==,
      }

  minimatch@5.1.9:
    resolution:
      {
        integrity: sha512-7o1wEA2RyMP7Iu7GNba9vc0RWWGACJOCZBJX2GJWip0ikV+wcOsgVuY9uE8CPiyQhkGFSlhuSkZPavN7u1c2Fw==,
      }
    engines: { node: ">=10" }

  minimatch@9.0.9:
    resolution:
      {
        integrity: sha512-OBwBN9AL4dqmETlpS2zasx+vTeWclWzkblfZk7KTA5j3jeOONz/tRCnZomUyvNg83wL5Zv9Ss6HMJXAgL8R2Yg==,
      }
    engines: { node: ">=16 || 14 >=14.17" }

  minimist@1.2.8:
    resolution:
      {
        integrity: sha512-2yyAR8qBkN3YuheJanUpWC5U3bb5osDywNB8RzDVlDwDHbocAJveqqj1u8+SVD7jkWT4yvsHCpWqqWqAxb0zCA==,
      }

  minipass@7.1.3:
    resolution:
      {
        integrity: sha512-tEBHqDnIoM/1rXME1zgka9g6Q2lcoCkxHLuc7ODJ5BxbP5d4c2Z5cGgtXAku59200Cx7diuHTOYfSBD8n6mm8A==,
      }
    engines: { node: ">=16 || 14 >=14.17" }

  mkdirp-classic@0.5.3:
    resolution:
      {
        integrity: sha512-gKLcREMhtuZRwRAfqP3RFW+TK4JqApVBtOIftVgjuABpAtpxhPGaDcfvbhNvD0B8iD1oUr/txX35NjcaY6Ns/A==,
      }

  mkdirp@3.0.1:
    resolution:
      {
        integrity: sha512-+NsyUUAZDmo6YVHzL/stxSu3t9YS1iljliy3BSDrXJ/dkn1KYdmtZODGGjLcc9XLgVVpH4KshHB8XmZgMhaBXg==,
      }
    engines: { node: ">=10" }
    hasBin: true

  ms@2.0.0:
    resolution:
      {
        integrity: sha512-Tpp60P6IUJDTuOq/5Z8cdskzJujfwqfOTkrwIwj7IRISpnkJnT6SyJ4PCPnGMoFjC9ddhal5KVIYtAt97ix05A==,
      }

  ms@2.1.3:
    resolution:
      {
        integrity: sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==,
      }

  mysql2@3.15.3:
    resolution:
      {
        integrity: sha512-FBrGau0IXmuqg4haEZRBfHNWB5mUARw6hNwPDXXGg0XzVJ50mr/9hb267lvpVMnhZ1FON3qNd4Xfcez1rbFwSg==,
      }
    engines: { node: ">= 8.0" }

  named-placeholders@1.1.6:
    resolution:
      {
        integrity: sha512-Tz09sEL2EEuv5fFowm419c1+a/jSMiBjI9gHxVLrVdbUkkNUUfjsVYs9pVZu5oCon/kmRh9TfLEObFtkVxmY0w==,
      }
    engines: { node: ">=8.0.0" }

  nan@2.28.0:
    resolution:
      {
        integrity: sha512-fTsDz99OTq2sVePhGdp4qQhggZFtKr64ZNVyVajRKtMOkJxYekplBh577PiJB12v/D3s2E5cGtOI45LWp6rnLQ==,
      }

  nanoid@3.3.16:
    resolution:
      {
        integrity: sha512-bzlKTyNJ7+LdGIIwy8ijFpIqEQIvafahV7eYykJ8Cvh42EdJeODoJ6gUJXpQJvej1BddH8OqTXZNE/KfbWAu8Q==,
      }
    engines: { node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1 }
    hasBin: true

  napi-postinstall@0.3.4:
    resolution:
      {
        integrity: sha512-PHI5f1O0EP5xJ9gQmFGMS6IZcrVvTjpXjz7Na41gTE7eE2hK11lg04CECCYEEjdc17EV4DO+fkGEtt7TpTaTiQ==,
      }
    engines: { node: ^12.20.0 || ^14.18.0 || >=16.0.0 }
    hasBin: true

  natural-compare@1.4.0:
    resolution:
      {
        integrity: sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==,
      }

  negotiator@0.6.4:
    resolution:
      {
        integrity: sha512-myRT3DiWPHqho5PrJaIRyaMv2kgYf0mUVgBNOYMuCH5Ki1yEiQaf/ZJuQ62nvpc44wL5WDbTX7yGJi1Neevw8w==,
      }
    engines: { node: ">= 0.6" }

  negotiator@1.0.0:
    resolution:
      {
        integrity: sha512-8Ofs/AUQh8MaEcrlq5xOX0CQ9ypTF5dl78mjlMNfOK08fzpgTHQRQPBxcPlEtIw0yRpws+Zo/3r+5WRby7u3Gg==,
      }
    engines: { node: ">= 0.6" }

  next@16.2.12:
    resolution:
      {
        integrity: sha512-iD59eYQWmbFcEbX7v/acG5DRym9iw1DdaPoD0WTA920naWsE25wShzJW4+UvAs8MK9EC2kBfIH6vtto1H1PHGw==,
      }
    engines: { node: ">=20.9.0" }
    hasBin: true
    peerDependencies:
      "@opentelemetry/api": ^1.1.0
      "@playwright/test": ^1.51.1
      babel-plugin-react-compiler: "*"
      react: ^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0
      react-dom: ^18.2.0 || 19.0.0-rc-de68d2f4-20241204 || ^19.0.0
      sass: ^1.3.0
    peerDependenciesMeta:
      "@opentelemetry/api":
        optional: true
      "@playwright/test":
        optional: true
      babel-plugin-react-compiler:
        optional: true
      sass:
        optional: true

  node-addon-api@8.9.2:
    resolution:
      {
        integrity: sha512-VijLXbi3UACN69I0JVXJsX4tjACjNoQDgv2gTF6sx2wWEi8tkSg2eX8p5gSIFi8z2+DL3oHmY6OyKce38SDolg==,
      }
    engines: { node: ^18 || ^20 || >= 21 }

  node-exports-info@1.6.2:
    resolution:
      {
        integrity: sha512-kXs9Go0cah0qHVV2v389IXQLdLCeE1xfFtjOAF+iobu0OIoG1pje8At2vMHyaPMiPMnG/LWP50twML21eMcAag==,
      }
    engines: { node: ">= 0.4" }

  node-gyp-build@4.8.4:
    resolution:
      {
        integrity: sha512-LA4ZjwlnUblHVgq0oBF3Jl/6h/Nvs5fzBLwdEF4nuxnFdsfajde4WfxtJr3CaiH+F6ewcIB/q4jQ4UzPyid+CQ==,
      }
    hasBin: true

  node-releases@2.0.51:
    resolution:
      {
        integrity: sha512-wRNIrw4DmVLKQlbgOMdkMx27Wrpzes2hh5Jtbi2bjPd+4wJstWIqP5A+lscnqbm0xxmT5Bpg8Lec5ItEBwx6BQ==,
      }
    engines: { node: ">=18" }

  nodemailer@9.0.4:
    resolution:
      {
        integrity: sha512-LmJNRVRtfSCULxcZpy0Cpg4WWenlUZ9+zbmTO+S7v9wD6XreYLjXRFtDjtV/4F0HT5p1GyZfA0Ux/myxHb18CQ==,
      }
    engines: { node: ">=6.0.0" }

  normalize-path@3.0.0:
    resolution:
      {
        integrity: sha512-6eZs5Ls3WtCisHWp9S2GUy8dqkpGi4BVSz3GaqiE6ezub0512ESztXUwUB6C6IKbQkY2Pnb/mD4WYojCRwcwLA==,
      }
    engines: { node: ">=0.10.0" }

  object-assign@4.1.1:
    resolution:
      {
        integrity: sha512-rJgTQnkUnH1sFw8yT6VSU3zD3sWmu6sZhIseY8VX+GRu3P6F7Fu+JNDoXfklElbLJSnc3FUQHVe4cU5hj+BcUg==,
      }
    engines: { node: ">=0.10.0" }

  object-inspect@1.13.4:
    resolution:
      {
        integrity: sha512-W67iLl4J2EXEGTbfeHCffrjDfitvLANg0UlX3wFUUSTx92KXRFegMHUVgSqE+wvhAbi4WqjGg9czysTV2Epbew==,
      }
    engines: { node: ">= 0.4" }

  object-keys@1.1.1:
    resolution:
      {
        integrity: sha512-NuAESUOUMrlIXOfHKzD6bpPu3tYt3xvjNdRIQ+FeT0lNb4K8WR70CaDxhuNguS2XG+GjkyMwOzsN5ZktImfhLA==,
      }
    engines: { node: ">= 0.4" }

  object.assign@4.1.7:
    resolution:
      {
        integrity: sha512-nK28WOo+QIjBkDduTINE4JkF/UJJKyf2EJxvJKfblDpyg0Q+pkOHNTL0Qwy6NP6FhE/EnzV73BxxqcJaXY9anw==,
      }
    engines: { node: ">= 0.4" }

  object.entries@1.1.9:
    resolution:
      {
        integrity: sha512-8u/hfXFRBD1O0hPUjioLhoWFHRmt6tKA4/vZPyckBr18l1KE9uHrFaFaUi8MDRTpi4uak2goyPTSNJLXX2k2Hw==,
      }
    engines: { node: ">= 0.4" }

  object.fromentries@2.0.8:
    resolution:
      {
        integrity: sha512-k6E21FzySsSK5a21KRADBd/NGneRegFO5pLHfdQLpRDETUNJueLXs3WCzyQ3tFRDYgbq3KHGXfTbi2bs8WQ6rQ==,
      }
    engines: { node: ">= 0.4" }

  object.groupby@1.0.3:
    resolution:
      {
        integrity: sha512-+Lhy3TQTuzXI5hevh8sBGqbmurHbbIjAi0Z4S63nthVLmLxfbj4T54a4CfZrXIrt9iP4mVAPYMo/v99taj3wjQ==,
      }
    engines: { node: ">= 0.4" }

  object.values@1.2.1:
    resolution:
      {
        integrity: sha512-gXah6aZrcUxjWg2zR2MwouP2eHlCBzdV4pygudehaKXSGW4v2AsRQUK+lwwXhii6KFZcunEnmSUoYp5CXibxtA==,
      }
    engines: { node: ">= 0.4" }

  obug@2.1.4:
    resolution:
      {
        integrity: sha512-4a+OsYv9UktOJKE+l1A4OufDgdRF9PifWj+tJnHURo/P+WOxpG4GzUFL9qCalmWauao6ogiG+QvnCovwPoyAWA==,
      }
    engines: { node: ">=12.20.0" }

  ohash@2.0.11:
    resolution:
      {
        integrity: sha512-RdR9FQrFwNBNXAr4GixM8YaRZRJ5PUWbKYbE5eOsrwAjJW0q2REGcf79oYPsLyskQCZG1PLN+S/K1V00joZAoQ==,
      }

  on-exit-leak-free@2.1.2:
    resolution:
      {
        integrity: sha512-0eJJY6hXLGf1udHwfNftBqH+g73EU4B504nZeKpz1sYRKafAghwxEJunB2O7rDZkL4PGfsMVnTXZ2EjibbqcsA==,
      }
    engines: { node: ">=14.0.0" }

  on-finished@2.4.1:
    resolution:
      {
        integrity: sha512-oVlzkg3ENAhCk2zdv7IJwd/QUD4z2RxRwpkcGY8psCVcCYZNq4wYnVWALHM+brtuJjePWiYF/ClmuDr8Ch5+kg==,
      }
    engines: { node: ">= 0.8" }

  on-headers@1.1.0:
    resolution:
      {
        integrity: sha512-737ZY3yNnXy37FHkQxPzt4UZ2UWPWiCZWLvFZ4fu5cueciegX0zGPnrlY6bwRg4FdQOe9YU8MkmJwGhoMybl8A==,
      }
    engines: { node: ">= 0.8" }

  once@1.4.0:
    resolution:
      {
        integrity: sha512-lNaJgI+2Q5URQBkccEKHTQOPaXdUxnZZElQTZY0MFUAuaEqe1E+Nyvgdz/aIyNi6Z9MzO5dv1H8n58/GELp3+w==,
      }

  optionator@0.9.4:
    resolution:
      {
        integrity: sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==,
      }
    engines: { node: ">= 0.8.0" }

  own-keys@1.0.1:
    resolution:
      {
        integrity: sha512-qFOyK5PjiWZd+QQIh+1jhdb9LpxTF0qs7Pm8o5QHYZ0M3vKqSqzsZaEB6oWlxZ+q2sJBMI/Ktgd2N5ZwQoRHfg==,
      }
    engines: { node: ">= 0.4" }

  p-limit@3.1.0:
    resolution:
      {
        integrity: sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==,
      }
    engines: { node: ">=10" }

  p-locate@5.0.0:
    resolution:
      {
        integrity: sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==,
      }
    engines: { node: ">=10" }

  package-json-from-dist@1.0.1:
    resolution:
      {
        integrity: sha512-UEZIS3/by4OC8vL3P2dTXRETpebLI2NiI5vIrjaD/5UtrkFX/tNbwjTSRAGC/+7CAo2pIcBaRgWmcBBHcsaCIw==,
      }

  parent-module@1.0.1:
    resolution:
      {
        integrity: sha512-GQ2EWRpQV8/o+Aw8YqtfZZPfNRWZYkbidE9k5rpl/hC3vtHHBfGm2Ifi6qWV+coDGkrUKZAxE3Lot5kcsRlh+g==,
      }
    engines: { node: ">=6" }

  parse5@8.0.1:
    resolution:
      {
        integrity: sha512-z1e/HMG90obSGeidlli3hj7cbocou0/wa5HacvI3ASx34PecNjNQeaHNo5WIZpWofN9kgkqV1q5YvXe3F0FoPw==,
      }

  parseurl@1.3.3:
    resolution:
      {
        integrity: sha512-CiyeOxFT/JZyN5m0z9PfXw4SCBJ6Sygz1Dpl0wqjlhDEGGBP1GnsUVEL0p63hoG1fcj3fHynXi9NYO4nWOL+qQ==,
      }
    engines: { node: ">= 0.8" }

  path-exists@4.0.0:
    resolution:
      {
        integrity: sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==,
      }
    engines: { node: ">=8" }

  path-key@3.1.1:
    resolution:
      {
        integrity: sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==,
      }
    engines: { node: ">=8" }

  path-parse@1.0.7:
    resolution:
      {
        integrity: sha512-LDJzPVEEEPR+y48z93A0Ed0yXb8pAByGWo/k5YYdYgpY2/2EsOsksJrq7lOHxryrVOn1ejG6oAp8ahvOIQD8sw==,
      }

  path-scurry@1.11.1:
    resolution:
      {
        integrity: sha512-Xa4Nw17FS9ApQFJ9umLiJS4orGjm7ZzwUrwamcGQuHSzDyth9boKDaycYdDcZDuqYATXw4HFXgaqWTctW/v1HA==,
      }
    engines: { node: ">=16 || 14 >=14.18" }

  path-scurry@2.0.2:
    resolution:
      {
        integrity: sha512-3O/iVVsJAPsOnpwWIeD+d6z/7PmqApyQePUtCndjatj/9I5LylHvt5qluFaBT3I5h3r1ejfR056c+FCv+NnNXg==,
      }
    engines: { node: 18 || 20 || >=22 }

  path-to-regexp@8.4.2:
    resolution:
      {
        integrity: sha512-qRcuIdP69NPm4qbACK+aDogI5CBDMi1jKe0ry5rSQJz8JVLsC7jV8XpiJjGRLLol3N+R5ihGYcrPLTno6pAdBA==,
      }

  pathe@2.0.3:
    resolution:
      {
        integrity: sha512-WUjGcAqP1gQacoQe+OBJsFA7Ld4DyXuUIjZ5cc75cLHvJ7dtNsTugphxIADwspS+AraAUePCKrSVtPLFj/F88w==,
      }

  perfect-debounce@2.1.0:
    resolution:
      {
        integrity: sha512-LjgdTytVFXeUgtHZr9WYViYSM/g8MkcTPYDlPa3cDqMirHjKiSZPYd6DoL7pK8AJQr+uWkQvCjHNdiMqsrJs+g==,
      }

  pg-cloudflare@1.4.0:
    resolution:
      {
        integrity: sha512-Vo7z/6rrQYxpNRylp4Tlob2elzbh+N/MOQbxFVWCxS7oEx6jF53GTJFxK2WWpKuBRkmiin4Mt+xofFDjx09R0A==,
      }

  pg-connection-string@2.14.0:
    resolution:
      {
        integrity: sha512-XwWDGcLRGCXAR8F/AM5bG7Q+A3Wm2s6QeEjlOKZLlH3UYcguiqCWKyWXVag5TLTIjR7oOJUY8kcADaZgWPyLeg==,
      }

  pg-int8@1.0.1:
    resolution:
      {
        integrity: sha512-WCtabS6t3c8SkpDBUlb1kjOs7l66xsGdKpIPZsg4wR+B3+u9UAum2odSsF9tnvxg80h4ZxLWMy4pRjOsFIqQpw==,
      }
    engines: { node: ">=4.0.0" }

  pg-pool@3.14.0:
    resolution:
      {
        integrity: sha512-gKtPkFdQPU3DksooVLi9LsjZxrsBUZIpa+7aVx+LV5pNh0KzP4Zleud2po+ConrxbuXGBJ6Hfer6hdgpIBpBaw==,
      }
    peerDependencies:
      pg: ">=8.0"

  pg-protocol@1.15.0:
    resolution:
      {
        integrity: sha512-cq9sECI5s0+uPUXjbz8ioyPJni6RzsRib0US67i5IoTZKw8fNeYlVE7u8F4dG7vEJJtc5wdD1K189lCCUwqWTQ==,
      }

  pg-types@2.2.0:
    resolution:
      {
        integrity: sha512-qTAAlrEsl8s4OiEQY69wDvcMIdQN6wdz5ojQiOy6YRMuynxenON0O5oCpJI6lshc6scgAY8qvJ2On/p+CXY0GA==,
      }
    engines: { node: ">=4" }

  pg@8.22.0:
    resolution:
      {
        integrity: sha512-8wih1vVIBMxoUM2oB4soJsD9tDnDpLv4OXBJ+EJzFsvycD+lfyIreC2gGHq78f8jbLLt+bvlPTFdFZfJkOuzAA==,
      }
    engines: { node: ">= 16.0.0" }
    peerDependencies:
      pg-native: ">=3.0.1"
    peerDependenciesMeta:
      pg-native:
        optional: true

  pgpass@1.0.5:
    resolution:
      {
        integrity: sha512-FdW9r/jQZhSeohs1Z3sI1yxFQNFvMcnmfuj4WBMUTxOrAyLMaTcE1aAMBiTlbMNaXvBCQuVi0R7hd8udDSP7ug==,
      }

  picocolors@1.1.1:
    resolution:
      {
        integrity: sha512-xceH2snhtb5M9liqDsmEw56le376mTZkEX/jEb/RxNFyegNul7eNslCXP9FDj/Lcu0X8KEyMceP2ntpaHrDEVA==,
      }

  picomatch@2.3.2:
    resolution:
      {
        integrity: sha512-V7+vQEJ06Z+c5tSye8S+nHUfI51xoXIXjHQ99cQtKUkQqqO1kO/KCJUfZXuB47h/YBlDhah2H3hdUGXn8ie0oA==,
      }
    engines: { node: ">=8.6" }

  picomatch@4.0.5:
    resolution:
      {
        integrity: sha512-RvwwcruNjI1ncT5xRakeyS9Lf8lcItv34KD+aif+VH9kduAyfYBipGh12274xtenIPZ119/R9BdTBa8gAwSh0A==,
      }
    engines: { node: ">=12" }

  pino-abstract-transport@3.0.0:
    resolution:
      {
        integrity: sha512-wlfUczU+n7Hy/Ha5j9a/gZNy7We5+cXp8YL+X+PG8S0KXxw7n/JXA3c46Y0zQznIJ83URJiwy7Lh56WLokNuxg==,
      }

  pino-http@11.0.0:
    resolution:
      {
        integrity: sha512-wqg5XIAGRRIWtTk8qPGxkbrfiwEWz1lgedVLvhLALudKXvg1/L2lTFgTGPJ4Z2e3qcRmxoFxDuSdMdMGNM6I1g==,
      }

  pino-pretty@13.1.3:
    resolution:
      {
        integrity: sha512-ttXRkkOz6WWC95KeY9+xxWL6AtImwbyMHrL1mSwqwW9u+vLp/WIElvHvCSDg0xO/Dzrggz1zv3rN5ovTRVowKg==,
      }
    hasBin: true

  pino-std-serializers@7.1.0:
    resolution:
      {
        integrity: sha512-BndPH67/JxGExRgiX1dX0w1FvZck5Wa4aal9198SrRhZjH3GxKQUKIBnYJTdj2HDN3UQAS06HlfcSbQj2OHmaw==,
      }

  pino@10.3.1:
    resolution:
      {
        integrity: sha512-r34yH/GlQpKZbU1BvFFqOjhISRo1MNx1tWYsYvmj6KIRHSPMT2+yHOEb1SG6NMvRoHRF0a07kCOox/9yakl1vg==,
      }
    hasBin: true

  pkg-types@2.3.1:
    resolution:
      {
        integrity: sha512-y+ichcgc2LrADuhLNAx8DFjVfgz91pRxfZdI3UDhxHvcVEZsenLO+7XaU5vOp0u/7V/wZ+plyuQxtrDlZJ+yeg==,
      }

  possible-typed-array-names@1.1.0:
    resolution:
      {
        integrity: sha512-/+5VFTchJDoVj3bhoqi6UeymcD00DAwb1nJwamzPvHEszJ4FpF6SNNbUbOS8yI56qHzdV8eK0qEfOSiodkTdxg==,
      }
    engines: { node: ">= 0.4" }

  postal-mime@2.7.5:
    resolution:
      {
        integrity: sha512-GNEXKvWFQnbgO5NlrGzVa0FmWzBZ24PersAWErttSg1Hjpf0ATxTwS5DOMGaOpTG6bUh5cTr7xi0jAD942wCJA==,
      }

  postcss@8.5.25:
    resolution:
      {
        integrity: sha512-DTPx3RWSSnWyzLxQnlH0rJP+EW5ekl16ZU4/psbIhA0e53kJfdgaN5vKM+xP7yJtXVu+nfdVFmlgFDEKAe4Pyw==,
      }
    engines: { node: ^10 || ^12 || >=14 }

  postgres-array@2.0.0:
    resolution:
      {
        integrity: sha512-VpZrUqU5A69eQyW2c5CA1jtLecCsN2U/bD6VilrFDWq5+5UIEVO7nazS3TEcHf1zuPYO/sqGvUvW62g86RXZuA==,
      }
    engines: { node: ">=4" }

  postgres-array@3.0.4:
    resolution:
      {
        integrity: sha512-nAUSGfSDGOaOAEGwqsRY27GPOea7CNipJPOA7lPbdEpx5Kg3qzdP0AaWC5MlhTWV9s4hFX39nomVZ+C4tnGOJQ==,
      }
    engines: { node: ">=12" }

  postgres-bytea@1.0.1:
    resolution:
      {
        integrity: sha512-5+5HqXnsZPE65IJZSMkZtURARZelel2oXUEO8rH83VS/hxH5vv1uHquPg5wZs8yMAfdv971IU+kcPUczi7NVBQ==,
      }
    engines: { node: ">=0.10.0" }

  postgres-date@1.0.7:
    resolution:
      {
        integrity: sha512-suDmjLVQg78nMK2UZ454hAG+OAW+HQPZ6n++TNDUX+L0+uUlLywnoxJKDou51Zm+zTCjrCl0Nq6J9C5hP9vK/Q==,
      }
    engines: { node: ">=0.10.0" }

  postgres-interval@1.2.0:
    resolution:
      {
        integrity: sha512-9ZhXKM/rw350N1ovuWHbGxnGh/SNJ4cnxHiM0rxE4VN41wsg8P8zWn9hv/buK00RP4WvlOyr/RBDiptyxVbkZQ==,
      }
    engines: { node: ">=0.10.0" }

  postgres@3.4.7:
    resolution:
      {
        integrity: sha512-Jtc2612XINuBjIl/QTWsV5UvE8UHuNblcO3vVADSrKsrc6RqGX6lOW1cEo3CM2v0XG4Nat8nI+YM7/f26VxXLw==,
      }
    engines: { node: ">=12" }

  prelude-ls@1.2.1:
    resolution:
      {
        integrity: sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==,
      }
    engines: { node: ">= 0.8.0" }

  prettier-plugin-tailwindcss@0.8.1:
    resolution:
      {
        integrity: sha512-iaFMYqDsE4ffdDkn5qup0j5f2aCEBFZrdrZnvu9QKTlWx/iGPeQ4HHu7b7fCPMxeo9nwQBiOAh2nSypdFYWJkw==,
      }
    engines: { node: ">=20.19" }
    peerDependencies:
      "@ianvs/prettier-plugin-sort-imports": "*"
      "@prettier/plugin-hermes": "*"
      "@prettier/plugin-oxc": "*"
      "@prettier/plugin-pug": "*"
      "@shopify/prettier-plugin-liquid": "*"
      "@trivago/prettier-plugin-sort-imports": "*"
      "@zackad/prettier-plugin-twig": "*"
      prettier: ^3.0
      prettier-plugin-astro: "*"
      prettier-plugin-css-order: "*"
      prettier-plugin-jsdoc: "*"
      prettier-plugin-marko: "*"
      prettier-plugin-multiline-arrays: "*"
      prettier-plugin-organize-attributes: "*"
      prettier-plugin-organize-imports: "*"
      prettier-plugin-sort-imports: "*"
      prettier-plugin-svelte: "*"
    peerDependenciesMeta:
      "@ianvs/prettier-plugin-sort-imports":
        optional: true
      "@prettier/plugin-hermes":
        optional: true
      "@prettier/plugin-oxc":
        optional: true
      "@prettier/plugin-pug":
        optional: true
      "@shopify/prettier-plugin-liquid":
        optional: true
      "@trivago/prettier-plugin-sort-imports":
        optional: true
      "@zackad/prettier-plugin-twig":
        optional: true
      prettier-plugin-astro:
        optional: true
      prettier-plugin-css-order:
        optional: true
      prettier-plugin-jsdoc:
        optional: true
      prettier-plugin-marko:
        optional: true
      prettier-plugin-multiline-arrays:
        optional: true
      prettier-plugin-organize-attributes:
        optional: true
      prettier-plugin-organize-imports:
        optional: true
      prettier-plugin-sort-imports:
        optional: true
      prettier-plugin-svelte:
        optional: true

  prettier@3.9.6:
    resolution:
      {
        integrity: sha512-OpN0zzVdiaiAhxpuuj5efpIS4sY9j7bY6uR5mnj5yPzGkdkjNKSJeUThPb60Jw29QuAZgA4o+/iB49kFiaBX6g==,
      }
    engines: { node: ">=14" }
    hasBin: true

  pretty-format@27.5.1:
    resolution:
      {
        integrity: sha512-Qb1gy5OrP5+zDf2Bvnzdl3jsTf1qXVMazbvCoKhtKqVs4/YK4ozX4gKQJJVyNe+cajNPn0KoC0MC3FUmaHWEmQ==,
      }
    engines: { node: ^10.13.0 || ^12.13.0 || ^14.15.0 || >=15.0.0 }

  prisma@7.9.1:
    resolution:
      {
        integrity: sha512-aPqePoZIqwlAchbgbFDO/wHqGB+7H1nj9gaM+OsL9h77S5S3TnLd9BgD3LnoeDikULo7cl2HSUrEyQ55Z7DYbg==,
      }
    engines: { node: ^20.19 || ^22.12 || >=24.0 }
    hasBin: true
    peerDependencies:
      better-sqlite3: ">=9.0.0"
      typescript: ">=5.4.0"
    peerDependenciesMeta:
      better-sqlite3:
        optional: true
      typescript:
        optional: true

  process-nextick-args@2.0.1:
    resolution:
      {
        integrity: sha512-3ouUOpQhtgrbOa17J7+uxOTpITYWaGP7/AhoR3+A+/1e9skrzelGi/dXzEYyvbxubEF6Wn2ypscTKiKJFFn1ag==,
      }

  process-warning@5.1.0:
    resolution:
      {
        integrity: sha512-jQSaVHsPgtyw60e1rQ/A+/ArPEj/S8pS/vFnyGa/gYFXrKk/6RuDkoqVDQ5NI5MmS01698ltlAk0NoDBNLujRw==,
      }

  process@0.11.10:
    resolution:
      {
        integrity: sha512-cdGef/drWFoydD1JsMzuFf8100nZl+GT+yacc2bEced5f9Rjk4z+WtFUTBu9PhOi9j/jfmBPu0mMEY4wIdAF8A==,
      }
    engines: { node: ">= 0.6.0" }

  prop-types@15.8.1:
    resolution:
      {
        integrity: sha512-oj87CgZICdulUohogVAR7AjlC0327U4el4L6eAvOqCeudMDVU0NThNaV+b9Df4dXgSP1gXMTnPdhfe/2qDH5cg==,
      }

  proper-lockfile@4.1.2:
    resolution:
      {
        integrity: sha512-TjNPblN4BwAWMXU8s9AEz4JmQxnD1NNL7bNOY/AKUzyamc379FWASUhc/K1pL2noVb+XmZKLL68cjzLsiOAMaA==,
      }

  properties-reader@3.0.1:
    resolution:
      {
        integrity: sha512-WPn+h9RGEExOKdu4bsF4HksG/uzd3cFq3MFtq8PsFeExPse5Ha/VOjQNyHhjboBFwGXGev6muJYTSPAOkROq2g==,
      }
    engines: { node: ">=18" }

  protobufjs@7.6.5:
    resolution:
      {
        integrity: sha512-/FPD0nUc9jH6rfFjji9IBqOz4pcSE3CsT1m7Ep6Mdb0LxSUMj8hgl6GomOvZzpNpAqqGaXA0P3VSrZLFzIhQrw==,
      }
    engines: { node: ">=12.0.0" }

  proxy-addr@2.0.7:
    resolution:
      {
        integrity: sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==,
      }
    engines: { node: ">= 0.10" }

  proxy-from-env@2.1.0:
    resolution:
      {
        integrity: sha512-cJ+oHTW1VAEa8cJslgmUZrc+sjRKgAKl3Zyse6+PV38hZe/V6Z14TbCuXcan9F9ghlz4QrFr2c92TNF82UkYHA==,
      }
    engines: { node: ">=10" }

  pump@3.0.4:
    resolution:
      {
        integrity: sha512-VS7sjc6KR7e1ukRFhQSY5LM2uBWAUPiOPa/A3mkKmiMwSmRFUITt0xuj+/lesgnCv+dPIEYlkzrcyXgquIHMcA==,
      }

  punycode@2.3.1:
    resolution:
      {
        integrity: sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==,
      }
    engines: { node: ">=6" }

  pure-rand@6.1.0:
    resolution:
      {
        integrity: sha512-bVWawvoZoBYpp6yIoQtQXHZjmz35RSVHnUOTefl8Vcjr8snTPY1wnpSPMWekcFwbxI6gtmT7rSYPFvz71ldiOA==,
      }

  qs@6.15.3:
    resolution:
      {
        integrity: sha512-O9gl3zCl5h5blw1KGUzQKhA5oUXSl8rwUIM5o0S3nCXMliSvy5Dzx7/DJcI+SwgICv+IneSZwhBh1oSyEHA71A==,
      }
    engines: { node: ">=0.6" }

  queue-microtask@1.2.3:
    resolution:
      {
        integrity: sha512-NuaNSa6flKT5JaSYQzJok04JzTL1CA6aGhv5rfLW3PgqA+M2ChpZQnAC8h8i4ZFkBS8X5RqkDBHA7r4hej3K9A==,
      }

  quick-format-unescaped@4.0.4:
    resolution:
      {
        integrity: sha512-tYC1Q1hgyRuHgloV/YXs2w15unPVh8qfu/qCTfhTYamaw7fyhumKa2yGpdSo87vY32rIclj+4fWYQXUMs9EHvg==,
      }

  range-parser@1.3.0:
    resolution:
      {
        integrity: sha512-hek2mFQpPuI4E1BBKrSto+BU3e3x4xuarsbiwr3+lf7p44juvFMV0XFWQAP3xUyqXA4RrXLIoaSUGbSt056ZMw==,
      }
    engines: { node: ">= 0.6" }

  raw-body@3.0.2:
    resolution:
      {
        integrity: sha512-K5zQjDllxWkf7Z5xJdV0/B0WTNqx6vxG70zJE4N0kBs4LovmEYWJzQGxC9bS9RAKu3bgM40lrd5zoLJ12MQ5BA==,
      }
    engines: { node: ">= 0.10" }

  rc9@3.0.1:
    resolution:
      {
        integrity: sha512-gMDyleLWVE+i6Sgtc0QbbY6pEKqYs97NGi6isHQPqYlLemPoO8dxQ3uGi0f4NiP98c+jMW6cG1Kx9dDwfvqARQ==,
      }

  react-dom@19.2.8:
    resolution:
      {
        integrity: sha512-rVprimfGBG3DR+Tq0IQG2DT5PxKth1WIGDmj5yPmlzr4YBe7uyE+Du4oVqTDXZSHGGGXRtTJEGSSePyQCMBglQ==,
      }
    peerDependencies:
      react: ^19.2.8

  react-hook-form@7.84.0:
    resolution:
      {
        integrity: sha512-+hWvQP6GLco56mDwrbU4XnHix8t1z90ltZsDIrREl+jnQFQxYLX8oAzqe/Xn8nHpmoXTY5M6oEXrAhbP1qevNQ==,
      }
    engines: { node: ">=18.0.0" }
    peerDependencies:
      react: ^16.8.0 || ^17 || ^18 || ^19

  react-is@16.13.1:
    resolution:
      {
        integrity: sha512-24e6ynE2H+OKt4kqsOvNd8kBpV65zoxbA4BVsEOB3ARVWQki/DHzaUoC5KuON/BiccDaCCTZBuOcfZs70kR8bQ==,
      }

  react-is@17.0.2:
    resolution:
      {
        integrity: sha512-w2GsyukL62IJnlaff/nRegPQR94C/XXamvMWmSHRJ4y7Ts/4ocGRmTHvOs8PSE6pB3dWOrD/nueuU5sduBsQ4w==,
      }

  react@19.2.8:
    resolution:
      {
        integrity: sha512-PWaYA1L/q9u2u7xYQi+Y3L3Yfnie7XyLeaJICV1MGD6LprsBxcAqGjYyr0eY3p+QdsA+x/Irkt4Qif8D63+Sbw==,
      }
    engines: { node: ">=0.10.0" }

  readable-stream@2.3.8:
    resolution:
      {
        integrity: sha512-8p0AUk4XODgIewSi0l8Epjs+EVnWiK7NoDIEGU0HhE7+ZyY8D1IMY7odu5lRrFXGg71L15KG8QrPmum45RTtdA==,
      }

  readable-stream@3.6.2:
    resolution:
      {
        integrity: sha512-9u/sniCrY3D5WdsERHzHE4G2YCXqoG5FTHUiCC4SIbr6XcLZBY05ya9EKjYek9O5xOAwjGq+1JdGBAS7Q9ScoA==,
      }
    engines: { node: ">= 6" }

  readable-stream@4.7.0:
    resolution:
      {
        integrity: sha512-oIGGmcpTLwPga8Bn6/Z75SVaH1z5dUut2ibSyAMVhmUggWpmDn2dapB0n7f8nwaSiRtepAsfJyfXIO5DCVAODg==,
      }
    engines: { node: ^12.22.0 || ^14.17.0 || >=16.0.0 }

  readdir-glob@1.1.3:
    resolution:
      {
        integrity: sha512-v05I2k7xN8zXvPD9N+z/uhXPaj0sUFCe2rcWZIpBsqxfP7xXFQ0tipAd/wjj1YxWyWtUS5IDJpOG82JKt2EAVA==,
      }

  readdirp@5.0.0:
    resolution:
      {
        integrity: sha512-9u/XQ1pvrQtYyMpZe7DXKv2p5CNvyVwzUB6uhLAnQwHMSgKMBR62lc7AHljaeteeHXn11XTAaLLUVZYVZyuRBQ==,
      }
    engines: { node: ">= 20.19.0" }

  real-require@0.2.0:
    resolution:
      {
        integrity: sha512-57frrGM/OCTLqLOAh0mhVA9VBMHd+9U7Zb2THMGdBUoZVOtGbJzjxsYGDJ3A9AYYCP4hn6y1TVbaOfzWtm5GFg==,
      }
    engines: { node: ">= 12.13.0" }

  real-require@1.0.0:
    resolution:
      {
        integrity: sha512-P4nbQYQfePJxRSmY+v/KINxVucm4NF3p3s7pJveMTtom52FR4YGltUQLB8idDXwDDWW+eYrWDFbuzUnjoWHF7g==,
      }

  redent@3.0.0:
    resolution:
      {
        integrity: sha512-6tDA8g98We0zd0GvVeMT9arEOnTw9qM03L9cJXaCjrip1OO764RDBLBfrB4cwzNGDj5OA5ioymC9GkizgWJDUg==,
      }
    engines: { node: ">=8" }

  reflect.getprototypeof@1.0.10:
    resolution:
      {
        integrity: sha512-00o4I+DVrefhv+nX0ulyi3biSHCPDe+yLv5o/p6d/UVlirijB8E16FtfwSAi4g3tcqrQ4lRAqQSoFEZJehYEcw==,
      }
    engines: { node: ">= 0.4" }

  regexp.prototype.flags@1.5.4:
    resolution:
      {
        integrity: sha512-dYqgNSZbDwkaJ2ceRd9ojCGjBq+mOm9LmtXnAnEGyHhN/5R7iDW2TRw3h+o/jCFxus3P2LfWIIiwowAjANm7IA==,
      }
    engines: { node: ">= 0.4" }

  remeda@2.33.4:
    resolution:
      {
        integrity: sha512-ygHswjlc/opg2VrtiYvUOPLjxjtdKvjGz1/plDhkG66hjNjFr1xmfrs2ClNFo/E6TyUFiwYNh53bKV26oBoMGQ==,
      }

  require-directory@2.1.1:
    resolution:
      {
        integrity: sha512-fGxEI7+wsG9xrvdjsrlmL22OMTTiHRwAMroiEeMgq8gzoLC/PQr7RsRDSTLUg/bZAZtF+TVIkHc6/4RIKrui+Q==,
      }
    engines: { node: ">=0.10.0" }

  require-from-string@2.0.2:
    resolution:
      {
        integrity: sha512-Xf0nWe6RseziFMu+Ap9biiUbmplq6S9/p+7w7YXP/JBHhrUDDUhwa+vANyubuqfZWTveU//DYVGsDG7RKL/vEw==,
      }
    engines: { node: ">=0.10.0" }

  resend@6.20.0:
    resolution:
      {
        integrity: sha512-fXDFt7jVMuka6ruS79DzaQFKPyxOAUtoYUGSl3dTUyOnFK9klmUULxADQRzFFtHfHRipYyy62jYcm4cMKqvtjw==,
      }
    engines: { node: ">=20" }
    peerDependencies:
      "@react-email/render": "*"
    peerDependenciesMeta:
      "@react-email/render":
        optional: true

  resolve-from@4.0.0:
    resolution:
      {
        integrity: sha512-pb/MYmXstAkysRFx8piNI1tGFNQIFA3vkE3Gq4EuA1dF6gHp/+vgZqsCGJapvy8N3Q+4o7FwvquPJcnZ7RYy4g==,
      }
    engines: { node: ">=4" }

  resolve-pkg-maps@1.0.0:
    resolution:
      {
        integrity: sha512-seS2Tj26TBVOC2NIc2rOe2y2ZO7efxITtLZcGSOnHHNOQ7CkiUBfw0Iw2ck6xkIhPwLhKNLS8BO+hEpngQlqzw==,
      }

  resolve@2.0.0-next.7:
    resolution:
      {
        integrity: sha512-tqt+NBWwyaMgw3zDsnygx4CByWjQEJHOPMdslYhppaQSJUtL/D4JO9CcBBlhPoI8lz9oJIDXkwXfhF4aWqP8xQ==,
      }
    engines: { node: ">= 0.4" }
    hasBin: true

  ret@0.5.0:
    resolution:
      {
        integrity: sha512-I1XxrZSQ+oErkRR4jYbAyEEu2I0avBvvMM5JN+6EBprOGRCs63ENqZ3vjavq8fBw2+62G5LF5XelKwuJpcvcxw==,
      }
    engines: { node: ">=10" }

  retry@0.12.0:
    resolution:
      {
        integrity: sha512-9LkiTwjUh6rT555DtE9rTX+BKByPfrMzEAtnlEtdEwr3Nkffwiihqe2bWADg+OQRjt9gl6ICdmB/ZFDCGAtSow==,
      }
    engines: { node: ">= 4" }

  reusify@1.1.0:
    resolution:
      {
        integrity: sha512-g6QUff04oZpHs0eG5p83rFLhHeV00ug/Yf9nZM6fLeUrPguBTkTQOdpAWWspMh55TZfVQDPaN3NQJfbVRAxdIw==,
      }
    engines: { iojs: ">=1.0.0", node: ">=0.10.0" }

  rimraf@6.1.3:
    resolution:
      {
        integrity: sha512-LKg+Cr2ZF61fkcaK1UdkH2yEBBKnYjTyWzTJT6KNPcSPaiT7HSdhtMXQuN5wkTX0Xu72KQ1l8S42rlmexS2hSA==,
      }
    engines: { node: 20 || >=22 }
    hasBin: true

  robust-predicates@3.0.3:
    resolution:
      {
        integrity: sha512-NS3levdsRIUOmiJ8FZWCP7LG3QpJyrs/TE0Zpf1yvZu8cAJJ6QMW92H1c7kWpdIHo8RvmLxN/o2JXTKHp74lUA==,
      }

  rolldown@1.2.4:
    resolution:
      {
        integrity: sha512-rSr7irW0K7QRWzjdJXqZowkcRdDtjRduh43rBltnVKd0VFq839l1lJoDvGJb6gl7+4rTTCrPWu+YfujUL8Ug7w==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    hasBin: true

  router@2.2.0:
    resolution:
      {
        integrity: sha512-nLTrUKm2UyiL7rlhapu/Zl45FwNgkZGaCpZbIHajDYgwlJCOzLSk+cIPAnsEqV955GjILJnKbdQC1nVPz+gAYQ==,
      }
    engines: { node: ">= 18" }

  run-parallel@1.2.0:
    resolution:
      {
        integrity: sha512-5l4VyZR86LZ/lDxZTR6jqL8AFE2S0IFLMP26AbjsLVADxHdhB/c0GUsH+y39UfCi3dzz8OlQuPmnaJOMoDHQBA==,
      }

  safe-array-concat@1.1.3:
    resolution:
      {
        integrity: sha512-AURm5f0jYEOydBj7VQlVvDrjeFgthDdEF5H1dP+6mNpoXOMo1quQqJ4wvJDyRZ9+pO3kGWoOdmV08cSv2aJV6Q==,
      }
    engines: { node: ">=0.4" }

  safe-buffer@5.1.2:
    resolution:
      {
        integrity: sha512-Gd2UZBJDkXlY7GbJxfsE8/nvKkUEU1G38c1siN6QP6a9PT9MmHB8GnpscSmMJSoF8LOIrt8ud/wPtojys4G6+g==,
      }

  safe-buffer@5.2.1:
    resolution:
      {
        integrity: sha512-rp3So07KcdmmKbGvgaNxQSJr7bGVSVk5S9Eq1F+ppbRo70+YeaDxkw5Dd8NPN+GD6bjnYm2VuPuCXmpuYvmCXQ==,
      }

  safe-push-apply@1.0.0:
    resolution:
      {
        integrity: sha512-iKE9w/Z7xCzUMIZqdBsp6pEQvwuEebH4vdpjcDWnyzaI6yl6O9FHvVpmGelvEHNsoY6wGblkxR6Zty/h00WiSA==,
      }
    engines: { node: ">= 0.4" }

  safe-regex-test@1.1.0:
    resolution:
      {
        integrity: sha512-x/+Cz4YrimQxQccJf5mKEbIa1NzeCRNI5Ecl/ekmlYaampdNLPalVyIcCZNNH3MvmqBugV5TMYZXv0ljslUlaw==,
      }
    engines: { node: ">= 0.4" }

  safe-regex2@5.1.1:
    resolution:
      {
        integrity: sha512-mOSBvHGDZMuIEZMdOz/aCEYDCv0E7nfcNsIhUF+/P+xC7Hyf3FkvymqgPbg9D1EdSGu+uKbJgy09K/RKKc7kJA==,
      }
    hasBin: true

  safe-stable-stringify@2.5.0:
    resolution:
      {
        integrity: sha512-b3rppTKm9T+PsVCBEOUR46GWI7fdOs00VKZ1+9c1EWDaDMvjQc6tUwuFyIprgGgTcWoVHSKrU8H31ZHA2e0RHA==,
      }
    engines: { node: ">=10" }

  safer-buffer@2.1.2:
    resolution:
      {
        integrity: sha512-YZo3K82SD7Riyi0E1EQPojLz7kpepnSQI9IyPbHHg1XXXevb5dJI7tpyN2ADxGcQbHG7vcyRHk0cbwqcQriUtg==,
      }

  saxes@6.0.0:
    resolution:
      {
        integrity: sha512-xAg7SOnEhrm5zI3puOOKyy1OMcMlIJZYNJY7xLBwSze0UjhPLnWfj2GF2EpT0jmzaJKIWKHLsaSSajf35bcYnA==,
      }
    engines: { node: ">=v12.22.7" }

  scheduler@0.27.0:
    resolution:
      {
        integrity: sha512-eNv+WrVbKu1f3vbYJT/xtiF5syA5HPIMtf9IgY/nKg0sWqzAUEvqY/xm7OcZc/qafLx/iO9FgOmeSAp4v5ti/Q==,
      }

  secure-json-parse@4.1.0:
    resolution:
      {
        integrity: sha512-l4KnYfEyqYJxDwlNVyRfO2E4NTHfMKAWdUuA8J0yve2Dz/E/PdBepY03RvyJpssIpRFwJoCD55wA+mEDs6ByWA==,
      }

  semver@6.3.1:
    resolution:
      {
        integrity: sha512-BR7VvDCVHO+q2xBEWskxS6DJE1qRnb7DxzUrogb71CWoSficBxYsiAGd+Kl0mmq/MprG9yArRkyrQxTO6XjMzA==,
      }
    hasBin: true

  semver@7.7.3:
    resolution:
      {
        integrity: sha512-SdsKMrI9TdgjdweUSR9MweHA4EJ8YxHn8DFaDisvhVlUOe4BF1tLD7GAj0lIqWVl+dPb/rExr0Btby5loQm20Q==,
      }
    engines: { node: ">=10" }
    hasBin: true

  send@1.2.1:
    resolution:
      {
        integrity: sha512-1gnZf7DFcoIcajTjTwjwuDjzuz4PPcY2StKPlsGAQ1+YH20IRVrBaXSWmdjowTJ6u8Rc01PoYOGHXfP1mYcZNQ==,
      }
    engines: { node: ">= 18" }

  seq-queue@0.0.5:
    resolution:
      {
        integrity: sha512-hr3Wtp/GZIc/6DAGPDcV4/9WoZhjrkXsi5B/07QgX8tsdc6ilr7BFM6PM6rbdAX1kFSDYeZGLipIZZKyQP0O5Q==,
      }

  serve-static@2.2.1:
    resolution:
      {
        integrity: sha512-xRXBn0pPqQTVQiC8wyQrKs2MOlX24zQ0POGaj0kultvoOCstBQM5yvOhAVSUwOMjQtTvsPWoNCHfPGwaaQJhTw==,
      }
    engines: { node: ">= 18" }

  set-function-length@1.2.2:
    resolution:
      {
        integrity: sha512-pgRc4hJ4/sNjWCSS9AmnS40x3bNMDTknHgL5UaMBTMyJnU90EgWh1Rz+MC9eFu4BuN/UwZjKQuY/1v3rM7HMfg==,
      }
    engines: { node: ">= 0.4" }

  set-function-name@2.0.2:
    resolution:
      {
        integrity: sha512-7PGFlmtwsEADb0WYyvCMa1t+yke6daIG4Wirafur5kcf+MhUnPms1UeR0CKQdTZD81yESwMHbtn+TR+dMviakQ==,
      }
    engines: { node: ">= 0.4" }

  set-proto@1.0.0:
    resolution:
      {
        integrity: sha512-RJRdvCo6IAnPdsvP/7m6bsQqNnn1FCBX5ZNtFL98MmFF/4xAIJTIg1YbHW5DC2W5SKZanrC6i4HsJqlajw/dZw==,
      }
    engines: { node: ">= 0.4" }

  setprototypeof@1.2.0:
    resolution:
      {
        integrity: sha512-E5LDX7Wrp85Kil5bhZv46j8jOeboKq5JMmYM3gVGdGH8xFpPWXUMsNrlODCrkoxMEeNi/XZIwuRvY4XNwYMJpw==,
      }

  sharp@0.34.5:
    resolution:
      {
        integrity: sha512-Ou9I5Ft9WNcCbXrU9cMgPBcCK8LiwLqcbywW3t4oDV37n1pzpuNLsYiAV8eODnjbtQlSDwZ2cUEeQz4E54Hltg==,
      }
    engines: { node: ^18.17.0 || ^20.3.0 || >=21.0.0 }

  shebang-command@2.0.0:
    resolution:
      {
        integrity: sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==,
      }
    engines: { node: ">=8" }

  shebang-regex@3.0.0:
    resolution:
      {
        integrity: sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==,
      }
    engines: { node: ">=8" }

  side-channel-list@1.0.1:
    resolution:
      {
        integrity: sha512-mjn/0bi/oUURjc5Xl7IaWi/OJJJumuoJFQJfDDyO46+hBWsfaVM65TBHq2eoZBhzl9EchxOijpkbRC8SVBQU0w==,
      }
    engines: { node: ">= 0.4" }

  side-channel-map@1.0.1:
    resolution:
      {
        integrity: sha512-VCjCNfgMsby3tTdo02nbjtM/ewra6jPHmpThenkTYh8pG9ucZ/1P8So4u4FGBek/BjpOVsDCMoLA/iuBKIFXRA==,
      }
    engines: { node: ">= 0.4" }

  side-channel-weakmap@1.0.2:
    resolution:
      {
        integrity: sha512-WPS/HvHQTYnHisLo9McqBHOJk2FkHO/tlpvldyrnem4aeQp4hai3gythswg6p01oSoTl58rcpiFAjF2br2Ak2A==,
      }
    engines: { node: ">= 0.4" }

  side-channel@1.1.1:
    resolution:
      {
        integrity: sha512-6x6dK6zJdpTzF4sQeNYxwtvBzf6Eg4GtlesS94HOvTudUeyK2WXAaIfmDgsyslYrRBeFIlsi54AYsFGUuhmvrQ==,
      }
    engines: { node: ">= 0.4" }

  siginfo@2.0.0:
    resolution:
      {
        integrity: sha512-ybx0WO1/8bSBLEWXZvEd7gMW3Sn3JFlW3TvX1nREbDLRNQNaeNN8WK0meBwPdAaOI7TtRRRJn/Es1zhrrCHu7g==,
      }

  signal-exit@3.0.7:
    resolution:
      {
        integrity: sha512-wnD2ZE+l+SPC/uoS0vXeE9L1+0wuaMqKlfz9AMUo38JsyLSBWSFcHR1Rri62LZc12vLr1gb3jl7iwQhgwpAbGQ==,
      }

  signal-exit@4.1.0:
    resolution:
      {
        integrity: sha512-bzyZ1e88w9O1iNJbKnOlvYTrWPDl46O1bG0D3XInv+9tkPrxrN8jUUTiFlDkkmKWgn1M6CfIA13SuGqOa9Korw==,
      }
    engines: { node: ">=14" }

  sonic-boom@4.2.1:
    resolution:
      {
        integrity: sha512-w6AxtubXa2wTXAUsZMMWERrsIRAdrK0Sc+FUytWvYAhBJLyuI4llrMIC1DtlNSdI99EI86KZum2MMq3EAZlF9Q==,
      }

  source-map-js@1.2.1:
    resolution:
      {
        integrity: sha512-UXWMKhLOwVKb728IUtQPXxfYU+usdybtUrK/8uGE8CQMvrhOpwvzDBwj0QhSL7MQc7vIsISBG8VQ8+IDQxpfQA==,
      }
    engines: { node: ">=0.10.0" }

  split-ca@1.0.1:
    resolution:
      {
        integrity: sha512-Q5thBSxp5t8WPTTJQS59LrGqOZqOsrhDGDVm8azCqIBjSBd7nd9o2PM+mDulQQkh8h//4U6hFZnc/mul8t5pWQ==,
      }

  split2@4.2.0:
    resolution:
      {
        integrity: sha512-UcjcJOWknrNkF6PLX83qcHM6KHgVKNkV62Y8a5uYDVv9ydGQVwAHMKqHdJje1VTWpljG0WYpCDhrCdAOYH4TWg==,
      }
    engines: { node: ">= 10.x" }

  sqlstring@2.3.3:
    resolution:
      {
        integrity: sha512-qC9iz2FlN7DQl3+wjwn3802RTyjCx7sDvfQEXchwa6CWOx07/WVfh91gBmQ9fahw8snwGEWU3xGzOt4tFyHLxg==,
      }
    engines: { node: ">= 0.6" }

  ssh-remote-port-forward@1.0.4:
    resolution:
      {
        integrity: sha512-x0LV1eVDwjf1gmG7TTnfqIzf+3VPRz7vrNIjX6oYLbeCrf/PeVY6hkT68Mg+q02qXxQhrLjB0jfgvhevoCRmLQ==,
      }

  ssh2@1.17.0:
    resolution:
      {
        integrity: sha512-wPldCk3asibAjQ/kziWQQt1Wh3PgDFpC0XpwclzKcdT1vql6KeYxf5LIt4nlFkUeR8WuphYMKqUA56X4rjbfgQ==,
      }
    engines: { node: ">=10.16.0" }

  stable-hash-x@0.2.0:
    resolution:
      {
        integrity: sha512-o3yWv49B/o4QZk5ZcsALc6t0+eCelPc44zZsLtCQnZPDwFpDYSWcDnrv2TtMmMbQ7uKo3J0HTURCqckw23czNQ==,
      }
    engines: { node: ">=12.0.0" }

  stable-hash@0.0.5:
    resolution:
      {
        integrity: sha512-+L3ccpzibovGXFK+Ap/f8LOS0ahMrHTf3xu7mMLSpEGU0EO9ucaysSylKo9eRDFNhWve/y275iPmIZ4z39a9iA==,
      }

  stackback@0.0.2:
    resolution:
      {
        integrity: sha512-1XMJE5fQo1jGH6Y/7ebnwPOBEkIEnT4QF32d5R1+VXdXveM0IBMJt8zfaxX1P3QhVwrYe+576+jkANtSS2mBbw==,
      }

  standardwebhooks@1.0.0:
    resolution:
      {
        integrity: sha512-BbHGOQK9olHPMvQNHWul6MYlrRTAOKn03rOe4A8O3CLWhNf4YHBqq2HJKKC+sfqpxiBY52pNeesD6jIiLDz8jg==,
      }

  statuses@2.0.2:
    resolution:
      {
        integrity: sha512-DvEy55V3DB7uknRo+4iOGT5fP1slR8wQohVdknigZPMpMstaKJQWhwiYBACJE3Ul2pTnATihhBYnRhZQHGBiRw==,
      }
    engines: { node: ">= 0.8" }

  std-env@3.10.0:
    resolution:
      {
        integrity: sha512-5GS12FdOZNliM5mAOxFRg7Ir0pWz8MdpYm6AY6VPkGpbA7ZzmbzNcBJQ0GPvvyWgcY7QAhCgf9Uy89I03faLkg==,
      }

  std-env@4.2.0:
    resolution:
      {
        integrity: sha512-oCUKSupKTHX53EyjDtuZQ64pjLJ6yYCtpmEw0goYxtjG9KpbRe8KAsl2tBUGU9DyMcJ0RwJ8GqJAFzMXcXW1Rw==,
      }

  stop-iteration-iterator@1.1.0:
    resolution:
      {
        integrity: sha512-eLoXW/DHyl62zxY4SCaIgnRhuMr6ri4juEYARS8E6sCEqzKpOiE521Ucofdx+KnDZl5xmvGYaaKCk5FEOxJCoQ==,
      }
    engines: { node: ">= 0.4" }

  streamx@2.28.0:
    resolution:
      {
        integrity: sha512-1Yowhzjf0ivGMrTIkY9hav5TxobO9qIVqUE41fiCGMGgc3CLlf4MY+9AHmZqBWgDTue0fY9zWjYFVyf6Diuobw==,
      }

  string-width@4.2.3:
    resolution:
      {
        integrity: sha512-wKyQRQpjJ0sIp62ErSZdGsjMJWsap5oRNihHhu6G7JVO/9jIB6UyevL+tXuOqrng8j/cxKTWyWUwvSTriiZz/g==,
      }
    engines: { node: ">=8" }

  string-width@5.1.2:
    resolution:
      {
        integrity: sha512-HnLOCR3vjcY8beoNLtcjZ5/nxn2afmME6lhrDrebokqMap+XbeW8n9TXpPDOqdGK5qcI3oT0GKTW6wC7EMiVqA==,
      }
    engines: { node: ">=12" }

  string.prototype.includes@2.0.1:
    resolution:
      {
        integrity: sha512-o7+c9bW6zpAdJHTtujeePODAhkuicdAryFsfVKwA+wGw89wJ4GTY484WTucM9hLtDEOpOvI+aHnzqnC5lHp4Rg==,
      }
    engines: { node: ">= 0.4" }

  string.prototype.matchall@4.0.12:
    resolution:
      {
        integrity: sha512-6CC9uyBL+/48dYizRf7H7VAYCMCNTBeM78x/VTUe9bFEaxBepPJDa1Ow99LqI/1yF7kuy7Q3cQsYMrcjGUcskA==,
      }
    engines: { node: ">= 0.4" }

  string.prototype.repeat@1.0.0:
    resolution:
      {
        integrity: sha512-0u/TldDbKD8bFCQ/4f5+mNRrXwZ8hg2w7ZR8wa16e8z9XpePWl3eGEcUD0OXpEH/VJH/2G3gjUtR3ZOiBe2S/w==,
      }

  string.prototype.trim@1.2.10:
    resolution:
      {
        integrity: sha512-Rs66F0P/1kedk5lyYyH9uBzuiI/kNRmwJAR9quK6VOtIpZ2G+hMZd+HQbbv25MgCA6gEffoMZYxlTod4WcdrKA==,
      }
    engines: { node: ">= 0.4" }

  string.prototype.trimend@1.0.9:
    resolution:
      {
        integrity: sha512-G7Ok5C6E/j4SGfyLCloXTrngQIQU3PWtXGst3yM7Bea9FRURf1S42ZHlZZtsNque2FN2PoUhfZXYLNWwEr4dLQ==,
      }
    engines: { node: ">= 0.4" }

  string.prototype.trimstart@1.0.8:
    resolution:
      {
        integrity: sha512-UXSH262CSZY1tfu3G3Secr6uGLCFVPMhIqHjlgCUtCCcgihYc/xKs9djMTMUOb2j1mVSeU8EU6NWc/iQKU6Gfg==,
      }
    engines: { node: ">= 0.4" }

  string_decoder@1.1.1:
    resolution:
      {
        integrity: sha512-n/ShnvDi6FHbbVfviro+WojiFzv+s8MPMHBczVePfUpDJLwoLT0ht1l4YwBCbi8pJAveEEdnkHyPyTP/mzRfwg==,
      }

  string_decoder@1.3.0:
    resolution:
      {
        integrity: sha512-hkRX8U1WjJFd8LsDJ2yQ/wWWxaopEsABU1XfkM8A+j0+85JAGppt16cr1Whg6KIbb4okU6Mql6BOj+uup/wKeA==,
      }

  strip-ansi@6.0.1:
    resolution:
      {
        integrity: sha512-Y38VPSHcqkFrCpFnQ9vuSXmquuv5oXOKpGeT6aGrr3o3Gc9AlVa6JBfUSOCnbxGGZF+/0ooI7KrPuUSztUdU5A==,
      }
    engines: { node: ">=8" }

  strip-ansi@7.2.0:
    resolution:
      {
        integrity: sha512-yDPMNjp4WyfYBkHnjIRLfca1i6KMyGCtsVgoKe/z1+6vukgaENdgGBZt+ZmKPc4gavvEZ5OgHfHdrazhgNyG7w==,
      }
    engines: { node: ">=12" }

  strip-bom@3.0.0:
    resolution:
      {
        integrity: sha512-vavAMRXOgBVNF6nyEEmL3DBK19iRpDcoIwW+swQ+CbGiu7lju6t+JklA1MHweoWtadgt4ISVUsXLyDq34ddcwA==,
      }
    engines: { node: ">=4" }

  strip-indent@3.0.0:
    resolution:
      {
        integrity: sha512-laJTa3Jb+VQpaC6DseHhF7dXVqHTfJPCRDaEbid/drOhgitgYku/letMUqOXFoWV0zIIUbjpdH2t+tYj4bQMRQ==,
      }
    engines: { node: ">=8" }

  strip-json-comments@3.1.1:
    resolution:
      {
        integrity: sha512-6fPc+R4ihwqP6N/aIv2f1gMH8lOVtWQHoqC4yK6oSDVVocumAsfCqjkXnqiYMhmMwS/mEHLp7Vehlt3ql6lEig==,
      }
    engines: { node: ">=8" }

  strip-json-comments@5.0.3:
    resolution:
      {
        integrity: sha512-1tB5mhVo7U+ETBKNf92xT4hrQa3pm0MZ0PQvuDnWgAAGHDsfp4lPSpiS6psrSiet87wyGPh9ft6wmhOMQ0hDiw==,
      }
    engines: { node: ">=14.16" }

  styled-jsx@5.1.6:
    resolution:
      {
        integrity: sha512-qSVyDTeMotdvQYoHWLNGwRFJHC+i+ZvdBRYosOFgC+Wg1vx4frN2/RG/NA7SYqqvKNLf39P2LSRA2pu6n0XYZA==,
      }
    engines: { node: ">= 12.0.0" }
    peerDependencies:
      "@babel/core": "*"
      babel-plugin-macros: "*"
      react: ">= 16.8.0 || 17.x.x || ^18.0.0-0 || ^19.0.0-0"
    peerDependenciesMeta:
      "@babel/core":
        optional: true
      babel-plugin-macros:
        optional: true

  superagent@10.3.0:
    resolution:
      {
        integrity: sha512-B+4Ik7ROgVKrQsXTV0Jwp2u+PXYLSlqtDAhYnkkD+zn3yg8s/zjA2MeGayPoY/KICrbitwneDHrjSotxKL+0XQ==,
      }
    engines: { node: ">=14.18.0" }

  supertest@7.1.4:
    resolution:
      {
        integrity: sha512-tjLPs7dVyqgItVFirHYqe2T+MfWc2VOBQ8QFKKbWTA3PU7liZR8zoSpAi/C1k1ilm9RsXIKYf197oap9wXGVYg==,
      }
    engines: { node: ">=14.18.0" }

  supports-color@7.2.0:
    resolution:
      {
        integrity: sha512-qpCAvRl9stuOHveKsn7HncJRvv501qIacKzQlO/+Lwxc9+0q2wLyv4Dfvt80/DPn2pqOBsJdDiogXGR9+OvwRw==,
      }
    engines: { node: ">=8" }

  supports-preserve-symlinks-flag@1.0.0:
    resolution:
      {
        integrity: sha512-ot0WnXS9fgdkgIcePe6RHNk1WA8+muPa6cSjeR3V8K27q9BB1rTE3R1p7Hv0z1ZyAc8s6Vvv8DIyWf681MAt0w==,
      }
    engines: { node: ">= 0.4" }

  symbol-tree@3.2.4:
    resolution:
      {
        integrity: sha512-9QNk5KwDF+Bvz+PyObkmSYjI5ksVUYtjW7AU22r2NKcfLJcXp96hkDWU3+XndOsUb+AQ9QhfzfCT2O+CNWT5Tw==,
      }

  tailwindcss@4.3.3:
    resolution:
      {
        integrity: sha512-gOhV3P7ufE62QDGg1zVaTgCR+EtPv92k2nIhVcVKcLmxT1sUBsQGhnZj175j+MqRt4zLF7ic+sCYjfhxMxj7YQ==,
      }

  tapable@2.3.3:
    resolution:
      {
        integrity: sha512-uxc/zpqFg6x7C8vOE7lh6Lbda8eEL9zmVm/PLeTPBRhh1xCgdWaQ+J1CUieGpIfm2HdtsUpRv+HshiasBMcc6A==,
      }
    engines: { node: ">=6" }

  tar-fs@2.1.5:
    resolution:
      {
        integrity: sha512-OboTd8mmMhZDNPV+UjQcK9yKAatXu2aJ+r1w4im1Otd4M4fl2hwvdoXUxIYHFTHWK/3y3FarBP70v3vwmGlOxw==,
      }

  tar-fs@3.1.3:
    resolution:
      {
        integrity: sha512-/hU4AXnIdZu+Gvl1pk0oI5f5HxWsCJRtY2aFaJdk9VvyL48DWU6iU5WAIPG+wIi1YvWA6eTJvIviP/tMAZZNwQ==,
      }

  tar-stream@2.2.0:
    resolution:
      {
        integrity: sha512-ujeqbceABgwMZxEJnk2HDY2DlnUZ+9oEcb1KzTVfYHio0UE6dG71n60d8D2I4qNvleWrrXpmjpt7vZeF1LnMZQ==,
      }
    engines: { node: ">=6" }

  tar-stream@3.2.0:
    resolution:
      {
        integrity: sha512-ojzvCvVaNp6aOTFmG7jaRD0meowIAuPc3cMMhSgKiVWws1GyHbGd/xvnyuRKcKlMpt3qvxx6r0hreCNITP9hIg==,
      }

  teex@1.0.1:
    resolution:
      {
        integrity: sha512-eYE6iEI62Ni1H8oIa7KlDU6uQBtqr4Eajni3wX7rpfXD8ysFx8z0+dri+KWEPWpBsxXfxu58x/0jvTVT1ekOSg==,
      }

  testcontainers@12.1.0:
    resolution:
      {
        integrity: sha512-YjDLqIITuhGLMnM10yhg3oV6lIG5IMpz1R1DPBZoOOks83q7i7IVpeSWRTiyl7roozjiyLmwIoLK/KY8OnZmIA==,
      }
    engines: { node: ">= 22.22" }

  text-decoder@1.2.7:
    resolution:
      {
        integrity: sha512-vlLytXkeP4xvEq2otHeJfSQIRyWxo/oZGEbXrtEEF9Hnmrdly59sUbzZ/QgyWuLYHctCHxFF4tRQZNQ9k60ExQ==,
      }

  thread-stream@4.2.0:
    resolution:
      {
        integrity: sha512-e2zZ96wSChazBsbENf/Pcm/4swHt2cEKQ92rhUjkL9GCKiTDJIaTBenjE/m9DXi0QBmTMDkFDdOomUy20A1tDQ==,
      }
    engines: { node: ">=20" }

  tinybench@2.9.0:
    resolution:
      {
        integrity: sha512-0+DUvqWMValLmha6lr4kD8iAMK1HzV0/aKnCtWb9v9641TnP/MFb7Pc2bxoxQjTXAErryXVgUOfv2YqNllqGeg==,
      }

  tinyexec@1.3.0:
    resolution:
      {
        integrity: sha512-QKAl9m8gWWGHV8jZcPeym6j+XULi6tOf1mT83WYJ4Lk2ytW/uwAWkrP0uFsdoYMdueVJ0qs26wZ+23xeB4ibNQ==,
      }
    engines: { node: ">=18" }

  tinyglobby@0.2.15:
    resolution:
      {
        integrity: sha512-j2Zq4NyQYG5XMST4cbs02Ak8iJUdxRM0XI5QyxXuZOzKOINmWurp3smXu3y5wDcJrptwpSjgXHzIQxR0omXljQ==,
      }
    engines: { node: ">=12.0.0" }

  tinyglobby@0.2.17:
    resolution:
      {
        integrity: sha512-wXR/dYpcqKmfWpEdZjiKJOwCNFndD0DMnrW/cYjVGttEkBfVgcLFHoNrlj47mjOVic9yyNu65alsgF4NQyTa2g==,
      }
    engines: { node: ">=12.0.0" }

  tinyrainbow@3.1.1:
    resolution:
      {
        integrity: sha512-yau8yJdTt989Mm0Bd/236QnzEiPf2xLLTqUZRUJOo/3CB078LSwzei343DgtJVmfJKJE3TMINY1u42SQsP6mXw==,
      }
    engines: { node: ">=14.0.0" }

  tldts-core@7.4.10:
    resolution:
      {
        integrity: sha512-KnQjp53ZekKgm/r3l+u8kJGGzYgrWdP8+Mql7a4vijh2WE0IrZWspQj/TpTxDho/YxO+AnOZnIjQcCD+q6iJsw==,
      }

  tldts@7.4.10:
    resolution:
      {
        integrity: sha512-GgouD1B+sWwvkaEq8vXC15DjQitxbvs12oIXELpconwm+Tg3zfcEv4jgzq3vtKverDXsg3VI8aRgNL2Nra0Iog==,
      }
    hasBin: true

  tmp@0.2.7:
    resolution:
      {
        integrity: sha512-e0votIpp4Uo2AJYSzVHV6xCcawuiez3DzqDAbrTc3YxBkplN6e+dM13ZeIcZnDg/QpSuU2zfZ3rzwY8ukEnaXw==,
      }
    engines: { node: ">=14.14" }

  to-regex-range@5.0.1:
    resolution:
      {
        integrity: sha512-65P7iz6X5yEr1cwcgvQxbbIw7Uk3gOy5dIdtZ4rDveLqhrdJP+Li/Hx6tyK0NEb+2GCyneCMJiGqrADCSNk8sQ==,
      }
    engines: { node: ">=8.0" }

  toidentifier@1.0.1:
    resolution:
      {
        integrity: sha512-o5sSPKEkg/DIQNmH43V0/uerLrpzVedkUh8tGNvaeXpfpuwjKenlSox/2O/BTlZUtEe+JG7s5YhEz608PlAHRA==,
      }
    engines: { node: ">=0.6" }

  tough-cookie@6.0.2:
    resolution:
      {
        integrity: sha512-exgYmnmL/sJpR3upZfXG5PoatXQii55xAiXGXzY+sROLZ/Y+SLcp9PgJNI9Vz37HpQ74WvDcLT8eqm+kV3FzrA==,
      }
    engines: { node: ">=16" }

  tr46@6.0.0:
    resolution:
      {
        integrity: sha512-bLVMLPtstlZ4iMQHpFHTR7GAGj2jxi8Dg0s2h2MafAE4uSWF98FC/3MomU51iQAMf8/qDUbKWf5GxuvvVcXEhw==,
      }
    engines: { node: ">=20" }

  ts-api-utils@2.1.0:
    resolution:
      {
        integrity: sha512-CUgTZL1irw8u29bzrOD/nH85jqyc74D6SshFgujOIA7osm2Rz7dYH77agkx7H4FBNxDq7Cjf+IjaX/8zwFW+ZQ==,
      }
    engines: { node: ">=18.12" }
    peerDependencies:
      typescript: ">=4.8.4"

  ts-api-utils@2.5.0:
    resolution:
      {
        integrity: sha512-OJ/ibxhPlqrMM0UiNHJ/0CKQkoKF243/AEmplt3qpRgkW8VG7IfOS41h7V8TjITqdByHzrjcS/2si+y4lIh8NA==,
      }
    engines: { node: ">=18.12" }
    peerDependencies:
      typescript: ">=4.8.4"

  tsconfig-paths@3.15.0:
    resolution:
      {
        integrity: sha512-2Ac2RgzDe/cn48GvOe3M+o82pEFewD3UPbyoUHHdKasHwJKjds4fLXWf/Ux5kATBKN20oaFGu+jbElp1pos0mg==,
      }

  tslib@2.8.1:
    resolution:
      {
        integrity: sha512-oJFu94HQb+KVduSUQL7wnpmqnfmLsOA/nAh6b6EH0wCEoK0/mPeXU6c3wKDV83MkOuHPRHtSXKKU99IBazS/2w==,
      }

  tsx@4.23.1:
    resolution:
      {
        integrity: sha512-GQHnkIfxyx1wYCOS/wonik5MVRZU9hi1TEZmzGZSCJB1y9YgoZ8H6itNE/u4suE+yLmOzuE4E5S4TZ/ZX2wcWQ==,
      }
    engines: { node: ">=18.0.0" }
    hasBin: true

  turbo@2.10.8:
    resolution:
      {
        integrity: sha512-9+8YX5QOkGXzZxcIykTHgaooRHGMWO+jfdyRK0o+rN0U7hBIig2MrJ8r/aNzIPDPhdA73SGb0O+tIztaModTMg==,
      }
    hasBin: true

  tweetnacl@0.14.5:
    resolution:
      {
        integrity: sha512-KXXFFdAbFXY4geFIwoyNK+f5Z1b7swfXABfL7HXCmoIWMKU3dmS26672A4EeQtDzLKy7SXmfBu51JolvEKwtGA==,
      }

  type-check@0.4.0:
    resolution:
      {
        integrity: sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==,
      }
    engines: { node: ">= 0.8.0" }

  type-is@2.1.0:
    resolution:
      {
        integrity: sha512-faYHw0anBbc/kWF3zFTEnxSFOAGUX9GFbOBthvDdLsIlEoWOFOtS0zgCiQYwIskL9iGXZL3kAXD8OoZ4GmMATA==,
      }
    engines: { node: ">= 18" }

  typed-array-buffer@1.0.3:
    resolution:
      {
        integrity: sha512-nAYYwfY3qnzX30IkA6AQZjVbtK6duGontcQm1WSG1MD94YLqK0515GNApXkoxKOWMusVssAHWLh9SeaoefYFGw==,
      }
    engines: { node: ">= 0.4" }

  typed-array-byte-length@1.0.3:
    resolution:
      {
        integrity: sha512-BaXgOuIxz8n8pIq3e7Atg/7s+DpiYrxn4vdot3w9KbnBhcRQq6o3xemQdIfynqSeXeDrF32x+WvfzmOjPiY9lg==,
      }
    engines: { node: ">= 0.4" }

  typed-array-byte-offset@1.0.4:
    resolution:
      {
        integrity: sha512-bTlAFB/FBYMcuX81gbL4OcpH5PmlFHqlCCpAl8AlEzMz5k53oNDvN8p1PNOWLEmI2x4orp3raOFB51tv9X+MFQ==,
      }
    engines: { node: ">= 0.4" }

  typed-array-length@1.0.7:
    resolution:
      {
        integrity: sha512-3KS2b+kL7fsuk/eJZ7EQdnEmQoaho/r6KUef7hxvltNA5DR8NAUM+8wJMbJyZ4G9/7i3v5zPBIMN5aybAh2/Jg==,
      }
    engines: { node: ">= 0.4" }

  typescript-eslint@8.50.0:
    resolution:
      {
        integrity: sha512-Q1/6yNUmCpH94fbgMUMg2/BSAr/6U7GBk61kZTv1/asghQOWOjTlp9K8mixS5NcJmm2creY+UFfGeW/+OcA64A==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0
      typescript: ">=4.8.4 <6.0.0"

  typescript-eslint@8.65.0:
    resolution:
      {
        integrity: sha512-/ggrHAwyjENDusvyxbuqxAC2dTnZg/Z8F+fgQtYIz+L6n/9HfSlEZcFGV/NsMNa6CkGk0xUjUAFwC0vHOflvIA==,
      }
    engines: { node: ^18.18.0 || ^20.9.0 || >=21.1.0 }
    peerDependencies:
      eslint: ^8.57.0 || ^9.0.0 || ^10.0.0
      typescript: ">=4.8.4 <6.1.0"

  typescript@5.9.3:
    resolution:
      {
        integrity: sha512-jl1vZzPDinLr9eUt3J/t7V6FgNEw9QjvBPdysz9KfQDD41fQrC2Y4vKQdiaUpFT4bXlb1RHhLpp8wtm6M5TgSw==,
      }
    engines: { node: ">=14.17" }
    hasBin: true

  unbox-primitive@1.1.0:
    resolution:
      {
        integrity: sha512-nWJ91DjeOkej/TA8pXQ3myruKpKEYgqvpw9lz4OPHj/NWFNluYrjbz9j01CJ8yKQd2g4jFoOkINCTW2I5LEEyw==,
      }
    engines: { node: ">= 0.4" }

  undici-types@5.26.5:
    resolution:
      {
        integrity: sha512-JlCMO+ehdEIKqlFxk6IfVoAUVmgz7cU7zD/h9XZ0qzeosSHmUJVOzSQvvYSYWXkFXC+IfLKSIffhv0sVZup6pA==,
      }

  undici-types@7.18.2:
    resolution:
      {
        integrity: sha512-AsuCzffGHJybSaRrmr5eHr81mwJU3kjw6M+uprWvCXiNeN9SOGwQ3Jn8jb8m3Z6izVgknn1R0FTCEAP2QrLY/w==,
      }

  undici@8.10.0:
    resolution:
      {
        integrity: sha512-HvltHd7avK13QIw/oLe4qoOLyoVSoafqJ2jYOrtMRBkbYT31eiBQ8O0ehRKZiEZCMEyLFQNIADpgCWC5fALvYQ==,
      }
    engines: { node: ">=22.19.0" }

  unpipe@1.0.0:
    resolution:
      {
        integrity: sha512-pjy2bYhSsufwWlKwPc+l3cN7+wuJlK6uz0YdJEOlQDbl6jo/YlPi4mb8agUkVC8BF7V8NuzeyPNqRksA3hztKQ==,
      }
    engines: { node: ">= 0.8" }

  unrs-resolver@1.12.2:
    resolution:
      {
        integrity: sha512-dmlRxBJJayXjqTwC+JtF1HhJmgf3ftQ3YejFcZrf4+KKtJv0qDsK1pjqaaVjG7wJ5NJ6UVP1OqRMQ71Z4C3rxQ==,
      }

  update-browserslist-db@1.2.3:
    resolution:
      {
        integrity: sha512-Js0m9cx+qOgDxo0eMiFGEueWztz+d4+M3rGlmKPT+T4IS/jP4ylw3Nwpu6cpTTP8R1MAC1kF4VbdLt3ARf209w==,
      }
    hasBin: true
    peerDependencies:
      browserslist: ">= 4.21.0"

  uri-js@4.4.1:
    resolution:
      {
        integrity: sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==,
      }

  util-deprecate@1.0.2:
    resolution:
      {
        integrity: sha512-EPD5q1uXyFxJpCrLnCc1nHnq3gOa6DZBocAIiI2TaSCA7VCJ1UJDMagCzIkXNsUYfD1daK//LTEQ8xiIbrHtcw==,
      }

  valibot@1.4.2:
    resolution:
      {
        integrity: sha512-gjdCvJ6d3RyHAneqxMYMW9QMCwYMb3jpOO0IyHZV1bnRHFBHrX3VkIILt5XYR0WhwHiH7Mty8ovuPZ/O3gamrg==,
      }
    peerDependencies:
      typescript: ">=5"
    peerDependenciesMeta:
      typescript:
        optional: true

  vary@1.1.2:
    resolution:
      {
        integrity: sha512-BNGbWLfd0eUPabhkXUVm0j8uuvREyTh5ovRa/dyow/BqAbZJyC+5fU+IzQOzmAKzYqYRAISoRhdQr3eIZ/PXqg==,
      }
    engines: { node: ">= 0.8" }

  vite@8.2.1:
    resolution:
      {
        integrity: sha512-EU/eS7BH3XROHh2YnBefjM6DBKA6ZeMZEYQbj7NLWg5wHYlhB8B/Mayd5XsgWq+NFYccDOTemRpdETWR6Ka/lw==,
      }
    engines: { node: ^20.19.0 || >=22.12.0 }
    hasBin: true
    peerDependencies:
      "@types/node": ^20.19.0 || >=22.12.0
      "@vitejs/devtools": ^0.4.0
      esbuild: ^0.27.0 || ^0.28.0
      jiti: ">=1.21.0"
      less: ^4.0.0
      sass: ^1.70.0
      sass-embedded: ^1.70.0
      stylus: ">=0.54.8"
      sugarss: ^5.0.0
      terser: ^5.16.0
      tsx: ^4.8.1
      yaml: ^2.4.2
    peerDependenciesMeta:
      "@types/node":
        optional: true
      "@vitejs/devtools":
        optional: true
      esbuild:
        optional: true
      jiti:
        optional: true
      less:
        optional: true
      sass:
        optional: true
      sass-embedded:
        optional: true
      stylus:
        optional: true
      sugarss:
        optional: true
      terser:
        optional: true
      tsx:
        optional: true
      yaml:
        optional: true

  vitest@4.1.10:
    resolution:
      {
        integrity: sha512-R9jUTe5S4Qb0HCd4TNqpC7oGcrMssMRGXLW80ubjWsW9VH5GF8y1Y0SFLY9AbqSk6nt0PnOx4H4WNJYZ13GUPw==,
      }
    engines: { node: ^20.0.0 || ^22.0.0 || >=24.0.0 }
    hasBin: true
    peerDependencies:
      "@edge-runtime/vm": "*"
      "@opentelemetry/api": ^1.9.0
      "@types/node": ^20.0.0 || ^22.0.0 || >=24.0.0
      "@vitest/browser-playwright": 4.1.10
      "@vitest/browser-preview": 4.1.10
      "@vitest/browser-webdriverio": 4.1.10
      "@vitest/coverage-istanbul": 4.1.10
      "@vitest/coverage-v8": 4.1.10
      "@vitest/ui": 4.1.10
      happy-dom: "*"
      jsdom: "*"
      vite: ^6.0.0 || ^7.0.0 || ^8.0.0
    peerDependenciesMeta:
      "@edge-runtime/vm":
        optional: true
      "@opentelemetry/api":
        optional: true
      "@types/node":
        optional: true
      "@vitest/browser-playwright":
        optional: true
      "@vitest/browser-preview":
        optional: true
      "@vitest/browser-webdriverio":
        optional: true
      "@vitest/coverage-istanbul":
        optional: true
      "@vitest/coverage-v8":
        optional: true
      "@vitest/ui":
        optional: true
      happy-dom:
        optional: true
      jsdom:
        optional: true

  w3c-xmlserializer@5.0.0:
    resolution:
      {
        integrity: sha512-o8qghlI8NZHU1lLPrpi2+Uq7abh4GGPpYANlalzWxyWteJOCsr/P+oPBA49TOLu5FTZO4d3F9MnWJfiMo4BkmA==,
      }
    engines: { node: ">=18" }

  webidl-conversions@8.0.1:
    resolution:
      {
        integrity: sha512-BMhLD/Sw+GbJC21C/UgyaZX41nPt8bUTg+jWyDeg7e7YN4xOM05YPSIXceACnXVtqyEw/LMClUQMtMZ+PGGpqQ==,
      }
    engines: { node: ">=20" }

  whatwg-mimetype@5.0.0:
    resolution:
      {
        integrity: sha512-sXcNcHOC51uPGF0P/D4NVtrkjSU2fNsm9iog4ZvZJsL3rjoDAzXZhkm2MWt1y+PUdggKAYVoMAIYcs78wJ51Cw==,
      }
    engines: { node: ">=20" }

  whatwg-url@16.0.1:
    resolution:
      {
        integrity: sha512-1to4zXBxmXHV3IiSSEInrreIlu02vUOvrhxJJH5vcxYTBDAx51cqZiKdyTxlecdKNSjj8EcxGBxNf6Vg+945gw==,
      }
    engines: { node: ^20.19.0 || ^22.12.0 || >=24.0.0 }

  whatwg-url@17.1.0:
    resolution:
      {
        integrity: sha512-3GeworPmc2ZfEEHP7lEbUfBX/L75wdEsi0rLNhXcXxnoN5jyq0SL5gCy06SGW2cyTIZdTvWIDQNQoza++vKeaw==,
      }
    engines: { node: ^22.14.0 || >=24.0.0 }

  which-boxed-primitive@1.1.1:
    resolution:
      {
        integrity: sha512-TbX3mj8n0odCBFVlY8AxkqcHASw3L60jIuF8jFP78az3C2YhmGvqbHBpAjTRH2/xqYunrJ9g1jSyjCjpoWzIAA==,
      }
    engines: { node: ">= 0.4" }

  which-builtin-type@1.2.1:
    resolution:
      {
        integrity: sha512-6iBczoX+kDQ7a3+YJBnh3T+KZRxM/iYNPXicqk66/Qfm1b93iu+yOImkg0zHbj5LNOcNv1TEADiZ0xa34B4q6Q==,
      }
    engines: { node: ">= 0.4" }

  which-collection@1.0.2:
    resolution:
      {
        integrity: sha512-K4jVyjnBdgvc86Y6BkaLZEN933SwYOuBFkdmBu9ZfkcAbdVbpITnDmjvZ/aQjRXQrv5EPkTnD1s39GiiqbngCw==,
      }
    engines: { node: ">= 0.4" }

  which-typed-array@1.1.19:
    resolution:
      {
        integrity: sha512-rEvr90Bck4WZt9HHFC4DJMsjvu7x+r6bImz0/BrbWb7A2djJ8hnZMrWnHo9F8ssv0OMErasDhftrfROTyqSDrw==,
      }
    engines: { node: ">= 0.4" }

  which@2.0.2:
    resolution:
      {
        integrity: sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==,
      }
    engines: { node: ">= 8" }
    hasBin: true

  why-is-node-running@2.3.0:
    resolution:
      {
        integrity: sha512-hUrmaWBdVDcxvYqnyh09zunKzROWjbZTiNy8dBEjkS7ehEDQibXJ7XvlmtbwuTclUiIyN+CyXQD4Vmko8fNm8w==,
      }
    engines: { node: ">=8" }
    hasBin: true

  word-wrap@1.2.5:
    resolution:
      {
        integrity: sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==,
      }
    engines: { node: ">=0.10.0" }

  wrap-ansi@7.0.0:
    resolution:
      {
        integrity: sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==,
      }
    engines: { node: ">=10" }

  wrap-ansi@8.1.0:
    resolution:
      {
        integrity: sha512-si7QWI6zUMq56bESFvagtmzMdGOtoxfR+Sez11Mobfc7tm+VkUckk9bW2UeffTGVUbOksxmSw0AA2gs8g71NCQ==,
      }
    engines: { node: ">=12" }

  wrappy@1.0.2:
    resolution:
      {
        integrity: sha512-l4Sp/DRseor9wL6EvV2+TuQn63dMkPjZ/sp9XkghTEbV9KlPS1xUsZ3u7/IQO4wxtcFB4bgpQPRcR3QCvezPcQ==,
      }

  xml-name-validator@5.0.0:
    resolution:
      {
        integrity: sha512-EvGK8EJ3DhaHfbRlETOWAS5pO9MZITeauHKJyb8wyajUfQUenkIg2MvLDTZ4T/TgIcm3HU0TFBgWWboAZ30UHg==,
      }
    engines: { node: ">=18" }

  xmlchars@2.2.0:
    resolution:
      {
        integrity: sha512-JZnDKK8B0RCDw84FNdDAIpZK+JuJw+s7Lz8nksI7SIuU3UXJJslUthsi+uWBUYOwPFwW7W7PRLRfUKpxjtjFCw==,
      }

  xtend@4.0.2:
    resolution:
      {
        integrity: sha512-LKYU1iAXJXUgAXn9URjiu+MWhyUXHsvfp7mcuYm9dSUKK0/CjtrUwFAxD82/mCWbtLsGjFIad0wIsod4zrTAEQ==,
      }
    engines: { node: ">=0.4" }

  y18n@5.0.8:
    resolution:
      {
        integrity: sha512-0pfFzegeDWJHJIAmTLRP2DwHjdF5s7jo9tuztdQxAhINCdvS+3nGINqPd00AphqJR/0LhANUS6/+7SCb98YOfA==,
      }
    engines: { node: ">=10" }

  yallist@3.1.1:
    resolution:
      {
        integrity: sha512-a4UGQaWPH59mOXUYnAG2ewncQS4i4F43Tv3JoAM+s2VDAmS9NsK8GpDMLrCHPksFT7h3K6TOoUNn2pb7RoXx4g==,
      }

  yaml@2.9.0:
    resolution:
      {
        integrity: sha512-2AvhNX3mb8zd6Zy7INTtSpl1F15HW6Wnqj0srWlkKLcpYl/gMIMJiyuGq2KeI2YFxUPjdlB+3Lc10seMLtL4cA==,
      }
    engines: { node: ">= 14.6" }
    hasBin: true

  yargs-parser@21.1.1:
    resolution:
      {
        integrity: sha512-tVpsJW7DdjecAiFpbIB1e3qxIQsE6NoPc5/eTdrbbIC4h0LVsWhnoa3g+m2HclBIujHzsxZ4VJVA+GUuc2/LBw==,
      }
    engines: { node: ">=12" }

  yargs@17.7.3:
    resolution:
      {
        integrity: sha512-GZtjxm/J/4TSxuL3FNYjCmLktBTnIw/rVmKSIyKeYAZpmJB2ig9VauCC5xsa82GNKVKDAqpOn3KVzNt0zmrU0g==,
      }
    engines: { node: ">=12" }

  yocto-queue@0.1.0:
    resolution:
      {
        integrity: sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==,
      }
    engines: { node: ">=10" }

  zeptomatch@2.1.0:
    resolution:
      {
        integrity: sha512-KiGErG2J0G82LSpniV0CtIzjlJ10E04j02VOudJsPyPwNZgGnRKQy7I1R7GMyg/QswnE4l7ohSGrQbQbjXPPDA==,
      }

  zip-stream@6.0.1:
    resolution:
      {
        integrity: sha512-zK7YHHz4ZXpW89AHXUPbQVGKI7uvkd3hzusTdotCg1UxyaVtg0zFJSTfW/Dq5f7OBBVnq6cZIaC8Ti4hb6dtCA==,
      }
    engines: { node: ">= 14" }

  zod-openapi@6.0.0:
    resolution:
      {
        integrity: sha512-mS4eRJ4DGCPrg6elRbJqc/3nLe4EPVi8KiHRKZ7dcTR5m5orPy8EfoWmceAyGZAq71MAWuyrTTOag7W5N61ZPQ==,
      }
    engines: { node: ">=22.14.0" }
    peerDependencies:
      zod: ^4.0.0

  zod-validation-error@4.0.2:
    resolution:
      {
        integrity: sha512-Q6/nZLe6jxuU80qb/4uJ4t5v2VEZ44lzQjPDhYJNztRQ4wyWc6VF3D3Kb/fAuPetZQnhS3hnajCf9CsWesghLQ==,
      }
    engines: { node: ">=18.0.0" }
    peerDependencies:
      zod: ^3.25.0 || ^4.0.0

  zod@4.4.3:
    resolution:
      {
        integrity: sha512-ytENFjIJFl2UwYglde2jchW2Hwm4GJFLDiSXWdTrJQBIN9Fcyp7n4DhxJEiWNAJMV1/BqWfW/kkg71UDcHJyTQ==,
      }

snapshots:
  "@adobe/css-tools@4.5.0": {}

  "@alloc/quick-lru@5.2.0": {}

  "@asamuzakjp/css-color@6.0.7":
    dependencies:
      "@csstools/css-calc": 3.3.0(@csstools/css-parser-algorithms@4.0.0(@csstools/css-tokenizer@4.0.0))(@csstools/css-tokenizer@4.0.0)
      "@csstools/css-color-parser": 4.2.0(@csstools/css-parser-algorithms@4.0.0(@csstools/css-tokenizer@4.0.0))(@csstools/css-tokenizer@4.0.0)
      "@csstools/css-parser-algorithms": 4.0.0(@csstools/css-tokenizer@4.0.0)
      "@csstools/css-tokenizer": 4.0.0
      lru-cache: 11.5.2

  "@asamuzakjp/dom-selector@8.3.2":
    dependencies:
      bidi-js: 1.0.3
      css-tree: 3.2.1
      is-potential-custom-element-name: 1.0.1
      lru-cache: 11.5.2

  "@babel/code-frame@7.29.7":
    dependencies:
      "@babel/helper-validator-identifier": 7.29.7
      js-tokens: 4.0.0
      picocolors: 1.1.1

  "@babel/compat-data@7.29.7": {}

  "@babel/core@7.29.7(supports-color@7.2.0)":
    dependencies:
      "@babel/code-frame": 7.29.7
      "@babel/generator": 7.29.8
      "@babel/helper-compilation-targets": 7.29.7
      "@babel/helper-module-transforms": 7.29.7(@babel/core@7.29.7(supports-color@7.2.0))(supports-color@7.2.0)
      "@babel/helpers": 7.29.7
      "@babel/parser": 7.29.8
      "@babel/template": 7.29.7
      "@babel/traverse": 7.29.8(supports-color@7.2.0)
      "@babel/types": 7.29.8
      "@jridgewell/remapping": 2.3.5
      convert-source-map: 2.0.0
      debug: 4.4.3(supports-color@7.2.0)
      gensync: 1.0.0-beta.2
      json5: 2.2.3
      semver: 6.3.1
    transitivePeerDependencies:
      - supports-color

  "@babel/generator@7.29.8":
    dependencies:
      "@babel/parser": 7.29.8
      "@babel/types": 7.29.8
      "@jridgewell/gen-mapping": 0.3.13
      "@jridgewell/trace-mapping": 0.3.31
      jsesc: 3.1.0

  "@babel/helper-compilation-targets@7.29.7":
    dependencies:
      "@babel/compat-data": 7.29.7
      "@babel/helper-validator-option": 7.29.7
      browserslist: 4.28.7
      lru-cache: 5.1.1
      semver: 6.3.1

  "@babel/helper-globals@7.29.7": {}

  "@babel/helper-module-imports@7.29.7(supports-color@7.2.0)":
    dependencies:
      "@babel/traverse": 7.29.8(supports-color@7.2.0)
      "@babel/types": 7.29.8
    transitivePeerDependencies:
      - supports-color

  "@babel/helper-module-transforms@7.29.7(@babel/core@7.29.7(supports-color@7.2.0))(supports-color@7.2.0)":
    dependencies:
      "@babel/core": 7.29.7(supports-color@7.2.0)
      "@babel/helper-module-imports": 7.29.7(supports-color@7.2.0)
      "@babel/helper-validator-identifier": 7.29.7
      "@babel/traverse": 7.29.8(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  "@babel/helper-string-parser@7.29.7": {}

  "@babel/helper-validator-identifier@7.29.7": {}

  "@babel/helper-validator-option@7.29.7": {}

  "@babel/helpers@7.29.7":
    dependencies:
      "@babel/template": 7.29.7
      "@babel/types": 7.29.8

  "@babel/parser@7.29.8":
    dependencies:
      "@babel/types": 7.29.8

  "@babel/runtime@7.29.7": {}

  "@babel/template@7.29.7":
    dependencies:
      "@babel/code-frame": 7.29.7
      "@babel/parser": 7.29.8
      "@babel/types": 7.29.8

  "@babel/traverse@7.29.8(supports-color@7.2.0)":
    dependencies:
      "@babel/code-frame": 7.29.7
      "@babel/generator": 7.29.8
      "@babel/helper-globals": 7.29.7
      "@babel/parser": 7.29.8
      "@babel/template": 7.29.7
      "@babel/types": 7.29.8
      debug: 4.4.3(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  "@babel/types@7.29.8":
    dependencies:
      "@babel/helper-string-parser": 7.29.7
      "@babel/helper-validator-identifier": 7.29.7

  "@balena/dockerignore@1.0.2": {}

  "@bramus/specificity@2.4.2":
    dependencies:
      css-tree: 3.2.1

  "@csstools/color-helpers@6.1.1": {}

  "@csstools/css-calc@3.3.0(@csstools/css-parser-algorithms@4.0.0(@csstools/css-tokenizer@4.0.0))(@csstools/css-tokenizer@4.0.0)":
    dependencies:
      "@csstools/css-parser-algorithms": 4.0.0(@csstools/css-tokenizer@4.0.0)
      "@csstools/css-tokenizer": 4.0.0

  "@csstools/css-color-parser@4.2.0(@csstools/css-parser-algorithms@4.0.0(@csstools/css-tokenizer@4.0.0))(@csstools/css-tokenizer@4.0.0)":
    dependencies:
      "@csstools/color-helpers": 6.1.1
      "@csstools/css-calc": 3.3.0(@csstools/css-parser-algorithms@4.0.0(@csstools/css-tokenizer@4.0.0))(@csstools/css-tokenizer@4.0.0)
      "@csstools/css-parser-algorithms": 4.0.0(@csstools/css-tokenizer@4.0.0)
      "@csstools/css-tokenizer": 4.0.0

  "@csstools/css-parser-algorithms@4.0.0(@csstools/css-tokenizer@4.0.0)":
    dependencies:
      "@csstools/css-tokenizer": 4.0.0

  "@csstools/css-syntax-patches-for-csstree@1.1.8(css-tree@3.2.1)":
    optionalDependencies:
      css-tree: 3.2.1

  "@csstools/css-tokenizer@4.0.0": {}

  "@electric-sql/pglite-socket@0.1.3(@electric-sql/pglite@0.4.3)":
    dependencies:
      "@electric-sql/pglite": 0.4.3

  "@electric-sql/pglite-tools@0.3.3(@electric-sql/pglite@0.4.3)":
    dependencies:
      "@electric-sql/pglite": 0.4.3

  "@electric-sql/pglite@0.4.3": {}

  "@emnapi/core@1.10.0":
    dependencies:
      "@emnapi/wasi-threads": 1.2.1
      tslib: 2.8.1
    optional: true

  "@emnapi/runtime@1.10.0":
    dependencies:
      tslib: 2.8.1
    optional: true

  "@emnapi/runtime@1.7.1":
    dependencies:
      tslib: 2.8.1
    optional: true

  "@emnapi/wasi-threads@1.2.1":
    dependencies:
      tslib: 2.8.1
    optional: true

  "@epic-web/invariant@1.0.0": {}

  "@esbuild/aix-ppc64@0.28.1":
    optional: true

  "@esbuild/android-arm64@0.28.1":
    optional: true

  "@esbuild/android-arm@0.28.1":
    optional: true

  "@esbuild/android-x64@0.28.1":
    optional: true

  "@esbuild/darwin-arm64@0.28.1":
    optional: true

  "@esbuild/darwin-x64@0.28.1":
    optional: true

  "@esbuild/freebsd-arm64@0.28.1":
    optional: true

  "@esbuild/freebsd-x64@0.28.1":
    optional: true

  "@esbuild/linux-arm64@0.28.1":
    optional: true

  "@esbuild/linux-arm@0.28.1":
    optional: true

  "@esbuild/linux-ia32@0.28.1":
    optional: true

  "@esbuild/linux-loong64@0.28.1":
    optional: true

  "@esbuild/linux-mips64el@0.28.1":
    optional: true

  "@esbuild/linux-ppc64@0.28.1":
    optional: true

  "@esbuild/linux-riscv64@0.28.1":
    optional: true

  "@esbuild/linux-s390x@0.28.1":
    optional: true

  "@esbuild/linux-x64@0.28.1":
    optional: true

  "@esbuild/netbsd-arm64@0.28.1":
    optional: true

  "@esbuild/netbsd-x64@0.28.1":
    optional: true

  "@esbuild/openbsd-arm64@0.28.1":
    optional: true

  "@esbuild/openbsd-x64@0.28.1":
    optional: true

  "@esbuild/openharmony-arm64@0.28.1":
    optional: true

  "@esbuild/sunos-x64@0.28.1":
    optional: true

  "@esbuild/win32-arm64@0.28.1":
    optional: true

  "@esbuild/win32-ia32@0.28.1":
    optional: true

  "@esbuild/win32-x64@0.28.1":
    optional: true

  "@eslint-community/eslint-utils@4.10.1(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))":
    dependencies:
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      eslint-visitor-keys: 3.4.3

  "@eslint-community/eslint-utils@4.9.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))":
    dependencies:
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      eslint-visitor-keys: 3.4.3

  "@eslint-community/regexpp@4.12.2": {}

  "@eslint/config-array@0.21.1(supports-color@7.2.0)":
    dependencies:
      "@eslint/object-schema": 2.1.7
      debug: 4.4.3(supports-color@7.2.0)
      minimatch: 3.1.5
    transitivePeerDependencies:
      - supports-color

  "@eslint/config-helpers@0.4.2":
    dependencies:
      "@eslint/core": 0.17.0

  "@eslint/core@0.17.0":
    dependencies:
      "@types/json-schema": 7.0.15

  "@eslint/eslintrc@3.3.1(supports-color@7.2.0)":
    dependencies:
      ajv: 6.15.0
      debug: 4.4.3(supports-color@7.2.0)
      espree: 10.4.0
      globals: 14.0.0
      ignore: 5.3.2
      import-fresh: 3.3.1
      js-yaml: 4.3.1
      minimatch: 3.1.5
      strip-json-comments: 3.1.1
    transitivePeerDependencies:
      - supports-color

  "@eslint/js@9.39.1": {}

  "@eslint/object-schema@2.1.7": {}

  "@eslint/plugin-kit@0.4.1":
    dependencies:
      "@eslint/core": 0.17.0
      levn: 0.4.1

  "@exodus/bytes@1.15.1(@noble/hashes@1.8.0)":
    optionalDependencies:
      "@noble/hashes": 1.8.0

  "@grpc/grpc-js@1.14.4":
    dependencies:
      "@grpc/proto-loader": 0.8.1
      "@js-sdsl/ordered-map": 4.4.2

  "@grpc/proto-loader@0.7.15":
    dependencies:
      lodash.camelcase: 4.3.0
      long: 5.3.2
      protobufjs: 7.6.5
      yargs: 17.7.3

  "@grpc/proto-loader@0.8.1":
    dependencies:
      lodash.camelcase: 4.3.0
      long: 5.3.2
      protobufjs: 7.6.5
      yargs: 17.7.3

  "@hookform/resolvers@5.7.1(@standard-schema/spec@1.1.0)(ajv@8.20.0)(effect@3.20.0)(react-hook-form@7.84.0(react@19.2.8))(valibot@1.4.2(typescript@5.9.3))(zod@4.4.3)":
    dependencies:
      "@standard-schema/utils": 0.3.0
      react-hook-form: 7.84.0(react@19.2.8)
    optionalDependencies:
      "@standard-schema/spec": 1.1.0
      ajv: 8.20.0
      effect: 3.20.0
      valibot: 1.4.2(typescript@5.9.3)
      zod: 4.4.3

  "@humanfs/core@0.19.1": {}

  "@humanfs/node@0.16.7":
    dependencies:
      "@humanfs/core": 0.19.1
      "@humanwhocodes/retry": 0.4.3

  "@humanwhocodes/module-importer@1.0.1": {}

  "@humanwhocodes/retry@0.4.3": {}

  "@img/colour@1.0.0":
    optional: true

  "@img/sharp-darwin-arm64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-darwin-arm64": 1.2.4
    optional: true

  "@img/sharp-darwin-x64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-darwin-x64": 1.2.4
    optional: true

  "@img/sharp-libvips-darwin-arm64@1.2.4":
    optional: true

  "@img/sharp-libvips-darwin-x64@1.2.4":
    optional: true

  "@img/sharp-libvips-linux-arm64@1.2.4":
    optional: true

  "@img/sharp-libvips-linux-arm@1.2.4":
    optional: true

  "@img/sharp-libvips-linux-ppc64@1.2.4":
    optional: true

  "@img/sharp-libvips-linux-riscv64@1.2.4":
    optional: true

  "@img/sharp-libvips-linux-s390x@1.2.4":
    optional: true

  "@img/sharp-libvips-linux-x64@1.2.4":
    optional: true

  "@img/sharp-libvips-linuxmusl-arm64@1.2.4":
    optional: true

  "@img/sharp-libvips-linuxmusl-x64@1.2.4":
    optional: true

  "@img/sharp-linux-arm64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linux-arm64": 1.2.4
    optional: true

  "@img/sharp-linux-arm@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linux-arm": 1.2.4
    optional: true

  "@img/sharp-linux-ppc64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linux-ppc64": 1.2.4
    optional: true

  "@img/sharp-linux-riscv64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linux-riscv64": 1.2.4
    optional: true

  "@img/sharp-linux-s390x@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linux-s390x": 1.2.4
    optional: true

  "@img/sharp-linux-x64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linux-x64": 1.2.4
    optional: true

  "@img/sharp-linuxmusl-arm64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linuxmusl-arm64": 1.2.4
    optional: true

  "@img/sharp-linuxmusl-x64@0.34.5":
    optionalDependencies:
      "@img/sharp-libvips-linuxmusl-x64": 1.2.4
    optional: true

  "@img/sharp-wasm32@0.34.5":
    dependencies:
      "@emnapi/runtime": 1.7.1
    optional: true

  "@img/sharp-win32-arm64@0.34.5":
    optional: true

  "@img/sharp-win32-ia32@0.34.5":
    optional: true

  "@img/sharp-win32-x64@0.34.5":
    optional: true

  "@isaacs/cliui@8.0.2":
    dependencies:
      string-width: 5.1.2
      string-width-cjs: string-width@4.2.3
      strip-ansi: 7.2.0
      strip-ansi-cjs: strip-ansi@6.0.1
      wrap-ansi: 8.1.0
      wrap-ansi-cjs: wrap-ansi@7.0.0

  "@jridgewell/gen-mapping@0.3.13":
    dependencies:
      "@jridgewell/sourcemap-codec": 1.5.5
      "@jridgewell/trace-mapping": 0.3.31

  "@jridgewell/remapping@2.3.5":
    dependencies:
      "@jridgewell/gen-mapping": 0.3.13
      "@jridgewell/trace-mapping": 0.3.31

  "@jridgewell/resolve-uri@3.1.2": {}

  "@jridgewell/sourcemap-codec@1.5.5": {}

  "@jridgewell/trace-mapping@0.3.31":
    dependencies:
      "@jridgewell/resolve-uri": 3.1.2
      "@jridgewell/sourcemap-codec": 1.5.5

  "@js-sdsl/ordered-map@4.4.2": {}

  "@kwsites/file-exists@1.1.1(supports-color@7.2.0)":
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  "@napi-rs/wasm-runtime@1.2.2(@emnapi/core@1.10.0)(@emnapi/runtime@1.10.0)":
    dependencies:
      "@emnapi/core": 1.10.0
      "@emnapi/runtime": 1.10.0
      "@tybys/wasm-util": 0.10.3
    optional: true

  "@next/env@16.2.12": {}

  "@next/eslint-plugin-next@16.2.12":
    dependencies:
      fast-glob: 3.3.1

  "@next/swc-darwin-arm64@16.2.12":
    optional: true

  "@next/swc-darwin-x64@16.2.12":
    optional: true

  "@next/swc-linux-arm64-gnu@16.2.12":
    optional: true

  "@next/swc-linux-arm64-musl@16.2.12":
    optional: true

  "@next/swc-linux-x64-gnu@16.2.12":
    optional: true

  "@next/swc-linux-x64-musl@16.2.12":
    optional: true

  "@next/swc-win32-arm64-msvc@16.2.12":
    optional: true

  "@next/swc-win32-x64-msvc@16.2.12":
    optional: true

  "@noble/hashes@1.8.0": {}

  "@nodelib/fs.scandir@2.1.5":
    dependencies:
      "@nodelib/fs.stat": 2.0.5
      run-parallel: 1.2.0

  "@nodelib/fs.stat@2.0.5": {}

  "@nodelib/fs.walk@1.2.8":
    dependencies:
      "@nodelib/fs.scandir": 2.1.5
      fastq: 1.19.1

  "@nolyfill/is-core-module@1.0.39": {}

  "@oxc-project/types@0.144.0": {}

  "@paralleldrive/cuid2@2.3.1":
    dependencies:
      "@noble/hashes": 1.8.0

  "@phc/format@1.0.0": {}

  "@pinojs/redact@0.4.0": {}

  "@pkgjs/parseargs@0.11.0":
    optional: true

  "@prisma/adapter-pg@7.9.1":
    dependencies:
      "@prisma/driver-adapter-utils": 7.9.1
      "@types/pg": 8.20.3
      pg: 8.22.0
      postgres-array: 3.0.4
    transitivePeerDependencies:
      - pg-native

  "@prisma/client-runtime-utils@7.9.1": {}

  "@prisma/client@7.9.1(prisma@7.9.1(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(typescript@5.9.3))(typescript@5.9.3)":
    dependencies:
      "@prisma/client-runtime-utils": 7.9.1
    optionalDependencies:
      prisma: 7.9.1(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(typescript@5.9.3)
      typescript: 5.9.3

  "@prisma/config@7.9.1":
    dependencies:
      c12: 3.3.4
      deepmerge-ts: 7.1.5
      effect: 3.20.0
      empathic: 2.0.0
    transitivePeerDependencies:
      - magicast

  "@prisma/debug@7.2.0": {}

  "@prisma/debug@7.9.1": {}

  "@prisma/dev@0.24.17(typescript@5.9.3)":
    dependencies:
      "@electric-sql/pglite": 0.4.3
      "@electric-sql/pglite-socket": 0.1.3(@electric-sql/pglite@0.4.3)
      "@electric-sql/pglite-tools": 0.3.3(@electric-sql/pglite@0.4.3)
      "@prisma/get-platform": 7.2.0
      "@prisma/query-plan-executor": 7.2.0
      "@prisma/streams-local": 0.1.11
      find-my-way: 9.7.0
      foreground-child: 3.3.1
      get-port-please: 3.2.0
      pathe: 2.0.3
      proper-lockfile: 4.1.2
      remeda: 2.33.4
      std-env: 3.10.0
      valibot: 1.4.2(typescript@5.9.3)
      zeptomatch: 2.1.0
    transitivePeerDependencies:
      - typescript

  "@prisma/driver-adapter-utils@7.9.1":
    dependencies:
      "@prisma/debug": 7.9.1

  "@prisma/engines-version@7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad": {}

  "@prisma/engines@7.9.1":
    dependencies:
      "@prisma/debug": 7.9.1
      "@prisma/engines-version": 7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad
      "@prisma/fetch-engine": 7.9.1
      "@prisma/get-platform": 7.9.1

  "@prisma/fetch-engine@7.9.1":
    dependencies:
      "@prisma/debug": 7.9.1
      "@prisma/engines-version": 7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad
      "@prisma/get-platform": 7.9.1

  "@prisma/get-platform@7.2.0":
    dependencies:
      "@prisma/debug": 7.2.0

  "@prisma/get-platform@7.9.1":
    dependencies:
      "@prisma/debug": 7.9.1

  "@prisma/query-plan-executor@7.2.0": {}

  "@prisma/streams-local@0.1.11":
    dependencies:
      ajv: 8.20.0
      better-result: 2.10.0
      env-paths: 3.0.0
      proper-lockfile: 4.1.2

  "@prisma/studio-core@0.33.0(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)":
    dependencies:
      "@radix-ui/react-toggle": 1.1.10(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
      "@types/react": 19.2.18
      "@visx/curve": 4.0.1-alpha.0
      "@visx/event": 4.0.1-alpha.0
      "@visx/grid": 4.0.1-alpha.0(react@19.2.8)
      "@visx/group": 4.0.1-alpha.0(react@19.2.8)
      "@visx/responsive": 4.0.1-alpha.0(react@19.2.8)
      "@visx/scale": 4.0.1-alpha.0
      "@visx/shape": 4.0.1-alpha.0(react@19.2.8)
      d3-array: 3.2.4
      d3-shape: 3.2.0
      elkjs: 0.11.1
      react: 19.2.8
      react-dom: 19.2.8(react@19.2.8)
    transitivePeerDependencies:
      - "@types/react-dom"

  "@protobufjs/aspromise@1.1.2": {}

  "@protobufjs/base64@1.1.2": {}

  "@protobufjs/codegen@2.0.5": {}

  "@protobufjs/eventemitter@1.1.1": {}

  "@protobufjs/fetch@1.1.1":
    dependencies:
      "@protobufjs/aspromise": 1.1.2

  "@protobufjs/float@1.0.2": {}

  "@protobufjs/path@1.1.2": {}

  "@protobufjs/pool@1.1.0": {}

  "@protobufjs/utf8@1.1.2": {}

  "@radix-ui/primitive@1.1.3": {}

  "@radix-ui/react-compose-refs@1.1.2(@types/react@19.2.18)(react@19.2.8)":
    dependencies:
      react: 19.2.8
    optionalDependencies:
      "@types/react": 19.2.18

  "@radix-ui/react-primitive@2.1.3(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)":
    dependencies:
      "@radix-ui/react-slot": 1.2.3(@types/react@19.2.18)(react@19.2.8)
      react: 19.2.8
      react-dom: 19.2.8(react@19.2.8)
    optionalDependencies:
      "@types/react": 19.2.18
      "@types/react-dom": 19.2.4(@types/react@19.2.18)

  "@radix-ui/react-slot@1.2.3(@types/react@19.2.18)(react@19.2.8)":
    dependencies:
      "@radix-ui/react-compose-refs": 1.1.2(@types/react@19.2.18)(react@19.2.8)
      react: 19.2.8
    optionalDependencies:
      "@types/react": 19.2.18

  "@radix-ui/react-toggle@1.1.10(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)":
    dependencies:
      "@radix-ui/primitive": 1.1.3
      "@radix-ui/react-primitive": 2.1.3(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
      "@radix-ui/react-use-controllable-state": 1.2.2(@types/react@19.2.18)(react@19.2.8)
      react: 19.2.8
      react-dom: 19.2.8(react@19.2.8)
    optionalDependencies:
      "@types/react": 19.2.18
      "@types/react-dom": 19.2.4(@types/react@19.2.18)

  "@radix-ui/react-use-controllable-state@1.2.2(@types/react@19.2.18)(react@19.2.8)":
    dependencies:
      "@radix-ui/react-use-effect-event": 0.0.2(@types/react@19.2.18)(react@19.2.8)
      "@radix-ui/react-use-layout-effect": 1.1.1(@types/react@19.2.18)(react@19.2.8)
      react: 19.2.8
    optionalDependencies:
      "@types/react": 19.2.18

  "@radix-ui/react-use-effect-event@0.0.2(@types/react@19.2.18)(react@19.2.8)":
    dependencies:
      "@radix-ui/react-use-layout-effect": 1.1.1(@types/react@19.2.18)(react@19.2.8)
      react: 19.2.8
    optionalDependencies:
      "@types/react": 19.2.18

  "@radix-ui/react-use-layout-effect@1.1.1(@types/react@19.2.18)(react@19.2.8)":
    dependencies:
      react: 19.2.8
    optionalDependencies:
      "@types/react": 19.2.18

  "@rolldown/binding-android-arm64@1.2.4":
    optional: true

  "@rolldown/binding-darwin-arm64@1.2.4":
    optional: true

  "@rolldown/binding-darwin-x64@1.2.4":
    optional: true

  "@rolldown/binding-freebsd-x64@1.2.4":
    optional: true

  "@rolldown/binding-linux-arm-gnueabihf@1.2.4":
    optional: true

  "@rolldown/binding-linux-arm64-gnu@1.2.4":
    optional: true

  "@rolldown/binding-linux-arm64-musl@1.2.4":
    optional: true

  "@rolldown/binding-linux-ppc64-gnu@1.2.4":
    optional: true

  "@rolldown/binding-linux-s390x-gnu@1.2.4":
    optional: true

  "@rolldown/binding-linux-x64-gnu@1.2.4":
    optional: true

  "@rolldown/binding-linux-x64-musl@1.2.4":
    optional: true

  "@rolldown/binding-openharmony-arm64@1.2.4":
    optional: true

  "@rolldown/binding-win32-arm64-msvc@1.2.4":
    optional: true

  "@rolldown/binding-win32-x64-msvc@1.2.4":
    optional: true

  "@rolldown/pluginutils@1.0.1": {}

  "@rtsao/scc@1.1.0": {}

  "@stablelib/base64@1.0.1": {}

  "@standard-schema/spec@1.1.0": {}

  "@standard-schema/utils@0.3.0": {}

  "@swc/helpers@0.5.15":
    dependencies:
      tslib: 2.8.1

  "@tailwindcss/node@4.3.3":
    dependencies:
      "@jridgewell/remapping": 2.3.5
      enhanced-resolve: 5.24.5
      jiti: 2.7.0
      lightningcss: 1.32.0
      magic-string: 0.30.21
      source-map-js: 1.2.1
      tailwindcss: 4.3.3

  "@tailwindcss/oxide-android-arm64@4.3.3":
    optional: true

  "@tailwindcss/oxide-darwin-arm64@4.3.3":
    optional: true

  "@tailwindcss/oxide-darwin-x64@4.3.3":
    optional: true

  "@tailwindcss/oxide-freebsd-x64@4.3.3":
    optional: true

  "@tailwindcss/oxide-linux-arm-gnueabihf@4.3.3":
    optional: true

  "@tailwindcss/oxide-linux-arm64-gnu@4.3.3":
    optional: true

  "@tailwindcss/oxide-linux-arm64-musl@4.3.3":
    optional: true

  "@tailwindcss/oxide-linux-x64-gnu@4.3.3":
    optional: true

  "@tailwindcss/oxide-linux-x64-musl@4.3.3":
    optional: true

  "@tailwindcss/oxide-wasm32-wasi@4.3.3":
    optional: true

  "@tailwindcss/oxide-win32-arm64-msvc@4.3.3":
    optional: true

  "@tailwindcss/oxide-win32-x64-msvc@4.3.3":
    optional: true

  "@tailwindcss/oxide@4.3.3":
    optionalDependencies:
      "@tailwindcss/oxide-android-arm64": 4.3.3
      "@tailwindcss/oxide-darwin-arm64": 4.3.3
      "@tailwindcss/oxide-darwin-x64": 4.3.3
      "@tailwindcss/oxide-freebsd-x64": 4.3.3
      "@tailwindcss/oxide-linux-arm-gnueabihf": 4.3.3
      "@tailwindcss/oxide-linux-arm64-gnu": 4.3.3
      "@tailwindcss/oxide-linux-arm64-musl": 4.3.3
      "@tailwindcss/oxide-linux-x64-gnu": 4.3.3
      "@tailwindcss/oxide-linux-x64-musl": 4.3.3
      "@tailwindcss/oxide-wasm32-wasi": 4.3.3
      "@tailwindcss/oxide-win32-arm64-msvc": 4.3.3
      "@tailwindcss/oxide-win32-x64-msvc": 4.3.3

  "@tailwindcss/postcss@4.3.3":
    dependencies:
      "@alloc/quick-lru": 5.2.0
      "@tailwindcss/node": 4.3.3
      "@tailwindcss/oxide": 4.3.3
      postcss: 8.5.25
      tailwindcss: 4.3.3

  "@tanstack/query-core@5.101.4": {}

  "@tanstack/react-query@5.101.4(react@19.2.8)":
    dependencies:
      "@tanstack/query-core": 5.101.4
      react: 19.2.8

  "@testcontainers/postgresql@12.1.0(supports-color@7.2.0)":
    dependencies:
      testcontainers: 12.1.0(supports-color@7.2.0)
    transitivePeerDependencies:
      - bare-abort-controller
      - bare-buffer
      - react-native-b4a
      - supports-color

  "@testing-library/dom@10.4.1":
    dependencies:
      "@babel/code-frame": 7.29.7
      "@babel/runtime": 7.29.7
      "@types/aria-query": 5.0.4
      aria-query: 5.3.0
      dom-accessibility-api: 0.5.16
      lz-string: 1.5.0
      picocolors: 1.1.1
      pretty-format: 27.5.1

  "@testing-library/jest-dom@6.9.1":
    dependencies:
      "@adobe/css-tools": 4.5.0
      aria-query: 5.3.2
      css.escape: 1.5.1
      dom-accessibility-api: 0.6.3
      picocolors: 1.1.1
      redent: 3.0.0

  "@testing-library/react@16.3.2(@testing-library/dom@10.4.1)(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)":
    dependencies:
      "@babel/runtime": 7.29.7
      "@testing-library/dom": 10.4.1
      react: 19.2.8
      react-dom: 19.2.8(react@19.2.8)
    optionalDependencies:
      "@types/react": 19.2.18
      "@types/react-dom": 19.2.4(@types/react@19.2.18)

  "@turbo/darwin-64@2.10.8":
    optional: true

  "@turbo/darwin-arm64@2.10.8":
    optional: true

  "@turbo/linux-64@2.10.8":
    optional: true

  "@turbo/linux-arm64@2.10.8":
    optional: true

  "@turbo/windows-64@2.10.8":
    optional: true

  "@turbo/windows-arm64@2.10.8":
    optional: true

  "@tybys/wasm-util@0.10.3":
    dependencies:
      tslib: 2.8.1
    optional: true

  "@types/aria-query@5.0.4": {}

  "@types/body-parser@1.19.6":
    dependencies:
      "@types/connect": 3.4.38
      "@types/node": 24.13.3

  "@types/chai@5.2.3":
    dependencies:
      "@types/deep-eql": 4.0.2
      assertion-error: 2.0.1

  "@types/compression@1.8.1":
    dependencies:
      "@types/express": 5.0.6
      "@types/node": 24.13.3

  "@types/connect@3.4.38":
    dependencies:
      "@types/node": 24.13.3

  "@types/cookie-parser@1.4.10(@types/express@5.0.6)":
    dependencies:
      "@types/express": 5.0.6

  "@types/cookiejar@2.1.5": {}

  "@types/cors@2.8.19":
    dependencies:
      "@types/node": 24.13.3

  "@types/d3-array@3.0.3": {}

  "@types/d3-color@3.1.0": {}

  "@types/d3-delaunay@6.0.1": {}

  "@types/d3-format@3.0.1": {}

  "@types/d3-geo@3.1.0":
    dependencies:
      "@types/geojson": 7946.0.16

  "@types/d3-interpolate@3.0.1":
    dependencies:
      "@types/d3-color": 3.1.0

  "@types/d3-path@3.1.1": {}

  "@types/d3-scale@4.0.2":
    dependencies:
      "@types/d3-time": 3.0.0

  "@types/d3-shape@3.1.7":
    dependencies:
      "@types/d3-path": 3.1.1

  "@types/d3-time-format@2.1.0": {}

  "@types/d3-time@3.0.0": {}

  "@types/deep-eql@4.0.2": {}

  "@types/docker-modem@3.0.6":
    dependencies:
      "@types/node": 24.13.3
      "@types/ssh2": 1.15.5

  "@types/dockerode@4.0.1":
    dependencies:
      "@types/docker-modem": 3.0.6
      "@types/node": 24.13.3
      "@types/ssh2": 1.15.5

  "@types/estree@1.0.8": {}

  "@types/express-serve-static-core@5.1.3":
    dependencies:
      "@types/node": 24.13.3
      "@types/qs": 6.15.1
      "@types/range-parser": 1.2.7
      "@types/send": 1.2.1

  "@types/express@5.0.6":
    dependencies:
      "@types/body-parser": 1.19.6
      "@types/express-serve-static-core": 5.1.3
      "@types/serve-static": 2.2.0

  "@types/geojson@7946.0.16": {}

  "@types/http-errors@2.0.5": {}

  "@types/json-schema@7.0.15": {}

  "@types/json5@0.0.29": {}

  "@types/jsonwebtoken@9.0.10":
    dependencies:
      "@types/ms": 2.1.0
      "@types/node": 24.13.3

  "@types/lodash@4.17.25": {}

  "@types/methods@1.1.4": {}

  "@types/ms@2.1.0": {}

  "@types/node@18.19.130":
    dependencies:
      undici-types: 5.26.5

  "@types/node@24.13.3":
    dependencies:
      undici-types: 7.18.2

  "@types/nodemailer@8.0.1":
    dependencies:
      "@types/node": 24.13.3

  "@types/pg@8.20.3":
    dependencies:
      "@types/node": 24.13.3
      pg-protocol: 1.15.0
      pg-types: 2.2.0

  "@types/qs@6.15.1": {}

  "@types/range-parser@1.2.7": {}

  "@types/react-dom@19.2.4(@types/react@19.2.18)":
    dependencies:
      "@types/react": 19.2.18

  "@types/react@19.2.18":
    dependencies:
      csstype: 3.2.3

  "@types/send@1.2.1":
    dependencies:
      "@types/node": 24.13.3

  "@types/serve-static@2.2.0":
    dependencies:
      "@types/http-errors": 2.0.5
      "@types/node": 24.13.3

  "@types/ssh2-streams@0.1.13":
    dependencies:
      "@types/node": 24.13.3

  "@types/ssh2@0.5.52":
    dependencies:
      "@types/node": 24.13.3
      "@types/ssh2-streams": 0.1.13

  "@types/ssh2@1.15.5":
    dependencies:
      "@types/node": 18.19.130

  "@types/superagent@8.1.11":
    dependencies:
      "@types/cookiejar": 2.1.5
      "@types/methods": 1.1.4
      "@types/node": 24.13.3
      form-data: 4.0.6

  "@types/supertest@6.0.3":
    dependencies:
      "@types/methods": 1.1.4
      "@types/superagent": 8.1.11

  "@typescript-eslint/eslint-plugin@8.50.0(@typescript-eslint/parser@8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@eslint-community/regexpp": 4.12.2
      "@typescript-eslint/parser": 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/scope-manager": 8.50.0
      "@typescript-eslint/type-utils": 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/utils": 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/visitor-keys": 8.50.0
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      ignore: 7.0.5
      natural-compare: 1.4.0
      ts-api-utils: 2.1.0(typescript@5.9.3)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/eslint-plugin@8.65.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@eslint-community/regexpp": 4.12.2
      "@typescript-eslint/parser": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/scope-manager": 8.65.0
      "@typescript-eslint/type-utils": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/utils": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/visitor-keys": 8.65.0
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      ignore: 7.0.5
      natural-compare: 1.4.0
      ts-api-utils: 2.5.0(typescript@5.9.3)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/parser@8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/scope-manager": 8.50.0
      "@typescript-eslint/types": 8.50.0
      "@typescript-eslint/typescript-estree": 8.50.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/visitor-keys": 8.50.0
      debug: 4.4.3(supports-color@7.2.0)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/scope-manager": 8.65.0
      "@typescript-eslint/types": 8.65.0
      "@typescript-eslint/typescript-estree": 8.65.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/visitor-keys": 8.65.0
      debug: 4.4.3(supports-color@7.2.0)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/project-service@8.50.0(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/tsconfig-utils": 8.50.0(typescript@5.9.3)
      "@typescript-eslint/types": 8.50.0
      debug: 4.4.3(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/project-service@8.65.0(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/tsconfig-utils": 8.65.0(typescript@5.9.3)
      "@typescript-eslint/types": 8.65.0
      debug: 4.4.3(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/scope-manager@8.50.0":
    dependencies:
      "@typescript-eslint/types": 8.50.0
      "@typescript-eslint/visitor-keys": 8.50.0

  "@typescript-eslint/scope-manager@8.65.0":
    dependencies:
      "@typescript-eslint/types": 8.65.0
      "@typescript-eslint/visitor-keys": 8.65.0

  "@typescript-eslint/tsconfig-utils@8.50.0(typescript@5.9.3)":
    dependencies:
      typescript: 5.9.3

  "@typescript-eslint/tsconfig-utils@8.65.0(typescript@5.9.3)":
    dependencies:
      typescript: 5.9.3

  "@typescript-eslint/type-utils@8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/types": 8.50.0
      "@typescript-eslint/typescript-estree": 8.50.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/utils": 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      debug: 4.4.3(supports-color@7.2.0)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      ts-api-utils: 2.1.0(typescript@5.9.3)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/type-utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/types": 8.65.0
      "@typescript-eslint/typescript-estree": 8.65.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/utils": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      debug: 4.4.3(supports-color@7.2.0)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      ts-api-utils: 2.5.0(typescript@5.9.3)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/types@8.50.0": {}

  "@typescript-eslint/types@8.65.0": {}

  "@typescript-eslint/typescript-estree@8.50.0(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/project-service": 8.50.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/tsconfig-utils": 8.50.0(typescript@5.9.3)
      "@typescript-eslint/types": 8.50.0
      "@typescript-eslint/visitor-keys": 8.50.0
      debug: 4.4.3(supports-color@7.2.0)
      minimatch: 9.0.9
      semver: 7.7.3
      tinyglobby: 0.2.15
      ts-api-utils: 2.1.0(typescript@5.9.3)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/typescript-estree@8.65.0(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@typescript-eslint/project-service": 8.65.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/tsconfig-utils": 8.65.0(typescript@5.9.3)
      "@typescript-eslint/types": 8.65.0
      "@typescript-eslint/visitor-keys": 8.65.0
      debug: 4.4.3(supports-color@7.2.0)
      minimatch: 10.2.6
      semver: 7.7.3
      tinyglobby: 0.2.17
      ts-api-utils: 2.5.0(typescript@5.9.3)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/utils@8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@eslint-community/eslint-utils": 4.9.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      "@typescript-eslint/scope-manager": 8.50.0
      "@typescript-eslint/types": 8.50.0
      "@typescript-eslint/typescript-estree": 8.50.0(supports-color@7.2.0)(typescript@5.9.3)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)":
    dependencies:
      "@eslint-community/eslint-utils": 4.10.1(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      "@typescript-eslint/scope-manager": 8.65.0
      "@typescript-eslint/types": 8.65.0
      "@typescript-eslint/typescript-estree": 8.65.0(supports-color@7.2.0)(typescript@5.9.3)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  "@typescript-eslint/visitor-keys@8.50.0":
    dependencies:
      "@typescript-eslint/types": 8.50.0
      eslint-visitor-keys: 4.2.1

  "@typescript-eslint/visitor-keys@8.65.0":
    dependencies:
      "@typescript-eslint/types": 8.65.0
      eslint-visitor-keys: 5.0.1

  "@unrs/resolver-binding-android-arm-eabi@1.12.2":
    optional: true

  "@unrs/resolver-binding-android-arm64@1.12.2":
    optional: true

  "@unrs/resolver-binding-darwin-arm64@1.12.2":
    optional: true

  "@unrs/resolver-binding-darwin-x64@1.12.2":
    optional: true

  "@unrs/resolver-binding-freebsd-x64@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-arm-gnueabihf@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-arm-musleabihf@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-arm64-gnu@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-arm64-musl@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-loong64-gnu@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-loong64-musl@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-ppc64-gnu@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-riscv64-gnu@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-riscv64-musl@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-s390x-gnu@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-x64-gnu@1.12.2":
    optional: true

  "@unrs/resolver-binding-linux-x64-musl@1.12.2":
    optional: true

  "@unrs/resolver-binding-openharmony-arm64@1.12.2":
    optional: true

  "@unrs/resolver-binding-wasm32-wasi@1.12.2":
    dependencies:
      "@emnapi/core": 1.10.0
      "@emnapi/runtime": 1.10.0
      "@napi-rs/wasm-runtime": 1.2.2(@emnapi/core@1.10.0)(@emnapi/runtime@1.10.0)
    optional: true

  "@unrs/resolver-binding-win32-arm64-msvc@1.12.2":
    optional: true

  "@unrs/resolver-binding-win32-ia32-msvc@1.12.2":
    optional: true

  "@unrs/resolver-binding-win32-x64-msvc@1.12.2":
    optional: true

  "@visx/curve@4.0.1-alpha.0":
    dependencies:
      "@visx/vendor": 4.0.0-alpha.0

  "@visx/event@4.0.1-alpha.0":
    dependencies:
      "@types/react": 19.2.18
      "@visx/point": 4.0.1-alpha.0

  "@visx/grid@4.0.1-alpha.0(react@19.2.8)":
    dependencies:
      "@types/react": 19.2.18
      "@visx/curve": 4.0.1-alpha.0
      "@visx/group": 4.0.1-alpha.0(react@19.2.8)
      "@visx/point": 4.0.1-alpha.0
      "@visx/scale": 4.0.1-alpha.0
      "@visx/shape": 4.0.1-alpha.0(react@19.2.8)
      classnames: 2.5.1
      react: 19.2.8

  "@visx/group@4.0.1-alpha.0(react@19.2.8)":
    dependencies:
      "@types/react": 19.2.18
      classnames: 2.5.1
      react: 19.2.8

  "@visx/point@4.0.1-alpha.0": {}

  "@visx/responsive@4.0.1-alpha.0(react@19.2.8)":
    dependencies:
      "@types/lodash": 4.17.25
      "@types/react": 19.2.18
      lodash: 4.18.1
      react: 19.2.8

  "@visx/scale@4.0.1-alpha.0":
    dependencies:
      "@visx/vendor": 4.0.0-alpha.0

  "@visx/shape@4.0.1-alpha.0(react@19.2.8)":
    dependencies:
      "@types/lodash": 4.17.25
      "@types/react": 19.2.18
      "@visx/curve": 4.0.1-alpha.0
      "@visx/group": 4.0.1-alpha.0(react@19.2.8)
      "@visx/scale": 4.0.1-alpha.0
      "@visx/vendor": 4.0.0-alpha.0
      classnames: 2.5.1
      lodash: 4.18.1
      react: 19.2.8

  "@visx/vendor@4.0.0-alpha.0":
    dependencies:
      "@types/d3-array": 3.0.3
      "@types/d3-color": 3.1.0
      "@types/d3-delaunay": 6.0.1
      "@types/d3-format": 3.0.1
      "@types/d3-geo": 3.1.0
      "@types/d3-interpolate": 3.0.1
      "@types/d3-path": 3.1.1
      "@types/d3-scale": 4.0.2
      "@types/d3-shape": 3.1.7
      "@types/d3-time": 3.0.0
      "@types/d3-time-format": 2.1.0
      d3-array: 3.2.1
      d3-color: 3.1.0
      d3-delaunay: 6.0.2
      d3-format: 3.1.0
      d3-geo: 3.1.0
      d3-interpolate: 3.0.1
      d3-path: 3.1.0
      d3-scale: 4.0.2
      d3-shape: 3.2.0
      d3-time: 3.1.0
      d3-time-format: 4.1.0
      internmap: 2.0.3

  "@vitest/expect@4.1.10":
    dependencies:
      "@standard-schema/spec": 1.1.0
      "@types/chai": 5.2.3
      "@vitest/spy": 4.1.10
      "@vitest/utils": 4.1.10
      chai: 6.2.2
      tinyrainbow: 3.1.1

  "@vitest/mocker@4.1.10(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0))":
    dependencies:
      "@vitest/spy": 4.1.10
      estree-walker: 3.0.3
      magic-string: 0.30.21
    optionalDependencies:
      vite: 8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0)

  "@vitest/pretty-format@4.1.10":
    dependencies:
      tinyrainbow: 3.1.1

  "@vitest/runner@4.1.10":
    dependencies:
      "@vitest/utils": 4.1.10
      pathe: 2.0.3

  "@vitest/snapshot@4.1.10":
    dependencies:
      "@vitest/pretty-format": 4.1.10
      "@vitest/utils": 4.1.10
      magic-string: 0.30.21
      pathe: 2.0.3

  "@vitest/spy@4.1.10": {}

  "@vitest/utils@4.1.10":
    dependencies:
      "@vitest/pretty-format": 4.1.10
      convert-source-map: 2.0.0
      tinyrainbow: 3.1.1

  abort-controller@3.0.0:
    dependencies:
      event-target-shim: 5.0.1

  accepts@2.0.0:
    dependencies:
      mime-types: 3.0.2
      negotiator: 1.0.0

  acorn-jsx@5.3.2(acorn@8.15.0):
    dependencies:
      acorn: 8.15.0

  acorn@8.15.0: {}

  agent-base@6.0.2(supports-color@7.2.0):
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  ajv@6.15.0:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-json-stable-stringify: 2.1.0
      json-schema-traverse: 0.4.1
      uri-js: 4.4.1

  ajv@8.20.0:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-uri: 3.1.5
      json-schema-traverse: 1.0.0
      require-from-string: 2.0.2

  ansi-regex@5.0.1: {}

  ansi-regex@6.3.0: {}

  ansi-styles@4.3.0:
    dependencies:
      color-convert: 2.0.1

  ansi-styles@5.2.0: {}

  ansi-styles@6.2.3: {}

  archiver-utils@5.0.2:
    dependencies:
      glob: 10.5.0
      graceful-fs: 4.2.11
      is-stream: 2.0.1
      lazystream: 1.0.1
      lodash: 4.18.1
      normalize-path: 3.0.0
      readable-stream: 4.7.0

  archiver@7.0.1:
    dependencies:
      archiver-utils: 5.0.2
      async: 3.2.6
      buffer-crc32: 1.0.0
      readable-stream: 4.7.0
      readdir-glob: 1.1.3
      tar-stream: 3.2.0
      zip-stream: 6.0.1
    transitivePeerDependencies:
      - bare-abort-controller
      - bare-buffer
      - react-native-b4a

  argon2@0.45.1:
    dependencies:
      "@phc/format": 1.0.0
      cross-env: 10.1.0
      node-addon-api: 8.9.2
      node-gyp-build: 4.8.4

  argparse@2.0.1: {}

  aria-query@5.3.0:
    dependencies:
      dequal: 2.0.3

  aria-query@5.3.2: {}

  array-buffer-byte-length@1.0.2:
    dependencies:
      call-bound: 1.0.4
      is-array-buffer: 3.0.5

  array-includes@3.1.9:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-object-atoms: 1.1.1
      get-intrinsic: 1.3.0
      is-string: 1.1.1
      math-intrinsics: 1.1.0

  array.prototype.findlast@1.2.5:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      es-shim-unscopables: 1.1.0

  array.prototype.findlastindex@1.2.6:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      es-shim-unscopables: 1.1.0

  array.prototype.flat@1.3.3:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-shim-unscopables: 1.1.0

  array.prototype.flatmap@1.3.3:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-shim-unscopables: 1.1.0

  array.prototype.tosorted@1.1.4:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      es-shim-unscopables: 1.1.0

  arraybuffer.prototype.slice@1.0.4:
    dependencies:
      array-buffer-byte-length: 1.0.2
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      is-array-buffer: 3.0.5

  asap@2.0.6: {}

  asn1@0.2.6:
    dependencies:
      safer-buffer: 2.1.2

  assertion-error@2.0.1: {}

  ast-types-flow@0.0.8: {}

  async-function@1.0.0: {}

  async-lock@1.4.1: {}

  async@3.2.6: {}

  asynckit@0.4.0: {}

  atomic-sleep@1.0.0: {}

  available-typed-arrays@1.0.7:
    dependencies:
      possible-typed-array-names: 1.1.0

  aws-ssl-profiles@1.1.2: {}

  axe-core@4.12.1: {}

  axios@1.19.0(debug@4.4.3(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      follow-redirects: 1.16.0(debug@4.4.3(supports-color@7.2.0))
      form-data: 4.0.6
      https-proxy-agent: 5.0.1(supports-color@7.2.0)
      proxy-from-env: 2.1.0
    transitivePeerDependencies:
      - debug
      - supports-color

  axobject-query@4.1.0: {}

  b4a@1.8.1: {}

  babel-plugin-react-compiler@1.0.0:
    dependencies:
      "@babel/types": 7.29.8

  balanced-match@1.0.2: {}

  balanced-match@4.0.4: {}

  bare-events@2.9.1: {}

  bare-fs@4.8.0:
    dependencies:
      bare-events: 2.9.1
      bare-path: 3.1.1
      bare-stream: 2.13.3(bare-events@2.9.1)
      bare-url: 2.5.2
      fast-fifo: 1.3.2
    transitivePeerDependencies:
      - bare-abort-controller
      - react-native-b4a

  bare-path@3.1.1: {}

  bare-stream@2.13.3(bare-events@2.9.1):
    dependencies:
      b4a: 1.8.1
      streamx: 2.28.0
      teex: 1.0.1
    optionalDependencies:
      bare-events: 2.9.1
    transitivePeerDependencies:
      - react-native-b4a

  bare-url@2.5.2:
    dependencies:
      bare-path: 3.1.1

  base64-js@1.5.1: {}

  baseline-browser-mapping@2.10.8: {}

  baseline-browser-mapping@2.11.10: {}

  bcrypt-pbkdf@1.0.2:
    dependencies:
      tweetnacl: 0.14.5

  better-result@2.10.0: {}

  bidi-js@1.0.3:
    dependencies:
      require-from-string: 2.0.2

  bl@4.1.0:
    dependencies:
      buffer: 5.7.1
      inherits: 2.0.4
      readable-stream: 3.6.2

  body-parser@2.3.0(supports-color@7.2.0):
    dependencies:
      bytes: 3.1.2
      content-type: 2.0.0
      debug: 4.4.3(supports-color@7.2.0)
      http-errors: 2.0.1
      iconv-lite: 0.7.3
      on-finished: 2.4.1
      qs: 6.15.3
      raw-body: 3.0.2
      type-is: 2.1.0
    transitivePeerDependencies:
      - supports-color

  brace-expansion@1.1.18:
    dependencies:
      balanced-match: 1.0.2
      concat-map: 0.0.1

  brace-expansion@2.1.4:
    dependencies:
      balanced-match: 1.0.2

  brace-expansion@5.0.9:
    dependencies:
      balanced-match: 4.0.4

  braces@3.0.3:
    dependencies:
      fill-range: 7.1.1

  browserslist@4.28.7:
    dependencies:
      baseline-browser-mapping: 2.11.10
      caniuse-lite: 1.0.30001806
      electron-to-chromium: 1.5.399
      node-releases: 2.0.51
      update-browserslist-db: 1.2.3(browserslist@4.28.7)

  buffer-crc32@1.0.0: {}

  buffer-equal-constant-time@1.0.1: {}

  buffer@5.7.1:
    dependencies:
      base64-js: 1.5.1
      ieee754: 1.2.1

  buffer@6.0.3:
    dependencies:
      base64-js: 1.5.1
      ieee754: 1.2.1

  buildcheck@0.0.7:
    optional: true

  byline@5.0.0: {}

  bytes@3.1.2: {}

  c12@3.3.4:
    dependencies:
      chokidar: 5.0.0
      confbox: 0.2.4
      defu: 6.1.7
      dotenv: 17.4.2
      exsolve: 1.1.1
      giget: 3.3.1
      jiti: 2.7.0
      ohash: 2.0.11
      pathe: 2.0.3
      perfect-debounce: 2.1.0
      pkg-types: 2.3.1
      rc9: 3.0.1

  call-bind-apply-helpers@1.0.2:
    dependencies:
      es-errors: 1.3.0
      function-bind: 1.1.2

  call-bind@1.0.8:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      es-define-property: 1.0.1
      get-intrinsic: 1.3.0
      set-function-length: 1.2.2

  call-bound@1.0.4:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      get-intrinsic: 1.3.0

  callsites@3.1.0: {}

  caniuse-lite@1.0.30001761: {}

  caniuse-lite@1.0.30001806: {}

  chai@6.2.2: {}

  chalk@4.1.2:
    dependencies:
      ansi-styles: 4.3.0
      supports-color: 7.2.0

  chokidar@5.0.0:
    dependencies:
      readdirp: 5.0.0

  chownr@1.1.4: {}

  classnames@2.5.1: {}

  client-only@0.0.1: {}

  cliui@8.0.1:
    dependencies:
      string-width: 4.2.3
      strip-ansi: 6.0.1
      wrap-ansi: 7.0.0

  color-convert@2.0.1:
    dependencies:
      color-name: 1.1.4

  color-name@1.1.4: {}

  colorette@2.0.20: {}

  combined-stream@1.0.8:
    dependencies:
      delayed-stream: 1.0.0

  comment-parser@1.4.7: {}

  component-emitter@1.3.1: {}

  compress-commons@6.0.2:
    dependencies:
      crc-32: 1.2.2
      crc32-stream: 6.0.0
      is-stream: 2.0.1
      normalize-path: 3.0.0
      readable-stream: 4.7.0

  compressible@2.0.18:
    dependencies:
      mime-db: 1.54.0

  compression@1.8.1(supports-color@7.2.0):
    dependencies:
      bytes: 3.1.2
      compressible: 2.0.18
      debug: 2.6.9(supports-color@7.2.0)
      negotiator: 0.6.4
      on-headers: 1.1.0
      safe-buffer: 5.2.1
      vary: 1.1.2
    transitivePeerDependencies:
      - supports-color

  concat-map@0.0.1: {}

  confbox@0.2.4: {}

  content-disposition@1.1.0: {}

  content-type@1.0.5: {}

  content-type@2.0.0: {}

  convert-source-map@2.0.0: {}

  cookie-parser@1.4.7:
    dependencies:
      cookie: 0.7.2
      cookie-signature: 1.0.6

  cookie-signature@1.0.6: {}

  cookie-signature@1.2.2: {}

  cookie@0.7.2: {}

  cookiejar@2.1.4: {}

  core-util-is@1.0.3: {}

  cors@2.8.6:
    dependencies:
      object-assign: 4.1.1
      vary: 1.1.2

  cpu-features@0.0.10:
    dependencies:
      buildcheck: 0.0.7
      nan: 2.28.0
    optional: true

  crc-32@1.2.2: {}

  crc32-stream@6.0.0:
    dependencies:
      crc-32: 1.2.2
      readable-stream: 4.7.0

  cross-env@10.1.0:
    dependencies:
      "@epic-web/invariant": 1.0.0
      cross-spawn: 7.0.6

  cross-spawn@7.0.6:
    dependencies:
      path-key: 3.1.1
      shebang-command: 2.0.0
      which: 2.0.2

  css-tree@3.2.1:
    dependencies:
      mdn-data: 2.27.1
      source-map-js: 1.2.1

  css.escape@1.5.1: {}

  csstype@3.2.3: {}

  d3-array@3.2.1:
    dependencies:
      internmap: 2.0.3

  d3-array@3.2.4:
    dependencies:
      internmap: 2.0.3

  d3-color@3.1.0: {}

  d3-delaunay@6.0.2:
    dependencies:
      delaunator: 5.1.0

  d3-format@3.1.0: {}

  d3-geo@3.1.0:
    dependencies:
      d3-array: 3.2.4

  d3-interpolate@3.0.1:
    dependencies:
      d3-color: 3.1.0

  d3-path@3.1.0: {}

  d3-scale@4.0.2:
    dependencies:
      d3-array: 3.2.4
      d3-format: 3.1.0
      d3-interpolate: 3.0.1
      d3-time: 3.1.0
      d3-time-format: 4.1.0

  d3-shape@3.2.0:
    dependencies:
      d3-path: 3.1.0

  d3-time-format@4.1.0:
    dependencies:
      d3-time: 3.1.0

  d3-time@3.1.0:
    dependencies:
      d3-array: 3.2.4

  damerau-levenshtein@1.0.8: {}

  data-urls@7.0.0(@noble/hashes@1.8.0):
    dependencies:
      whatwg-mimetype: 5.0.0
      whatwg-url: 16.0.1(@noble/hashes@1.8.0)
    transitivePeerDependencies:
      - "@noble/hashes"

  data-view-buffer@1.0.2:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      is-data-view: 1.0.2

  data-view-byte-length@1.0.2:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      is-data-view: 1.0.2

  data-view-byte-offset@1.0.1:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      is-data-view: 1.0.2

  dateformat@4.6.3: {}

  debug@2.6.9(supports-color@7.2.0):
    dependencies:
      ms: 2.0.0
    optionalDependencies:
      supports-color: 7.2.0

  debug@3.2.7(supports-color@7.2.0):
    dependencies:
      ms: 2.1.3
    optionalDependencies:
      supports-color: 7.2.0

  debug@4.4.3(supports-color@7.2.0):
    dependencies:
      ms: 2.1.3
    optionalDependencies:
      supports-color: 7.2.0

  decimal.js@10.6.0: {}

  deep-is@0.1.4: {}

  deepmerge-ts@7.1.5: {}

  define-data-property@1.1.4:
    dependencies:
      es-define-property: 1.0.1
      es-errors: 1.3.0
      gopd: 1.2.0

  define-properties@1.2.1:
    dependencies:
      define-data-property: 1.1.4
      has-property-descriptors: 1.0.2
      object-keys: 1.1.1

  defu@6.1.7: {}

  delaunator@5.1.0:
    dependencies:
      robust-predicates: 3.0.3

  delayed-stream@1.0.0: {}

  denque@2.1.0: {}

  depd@2.0.0: {}

  dequal@2.0.3: {}

  destr@2.0.5: {}

  detect-libc@2.1.2: {}

  dezalgo@1.0.4:
    dependencies:
      asap: 2.0.6
      wrappy: 1.0.2

  docker-compose@1.4.2:
    dependencies:
      yaml: 2.9.0

  docker-modem@5.0.7(supports-color@7.2.0):
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
      readable-stream: 3.6.2
      split-ca: 1.0.1
      ssh2: 1.17.0
    transitivePeerDependencies:
      - supports-color

  dockerode@5.0.1(supports-color@7.2.0):
    dependencies:
      "@balena/dockerignore": 1.0.2
      "@grpc/grpc-js": 1.14.4
      "@grpc/proto-loader": 0.7.15
      docker-modem: 5.0.7(supports-color@7.2.0)
      protobufjs: 7.6.5
      tar-fs: 2.1.5
    transitivePeerDependencies:
      - supports-color

  doctrine@2.1.0:
    dependencies:
      esutils: 2.0.3

  dom-accessibility-api@0.5.16: {}

  dom-accessibility-api@0.6.3: {}

  dotenv@17.4.2: {}

  dunder-proto@1.0.1:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      es-errors: 1.3.0
      gopd: 1.2.0

  eastasianwidth@0.2.0: {}

  ecdsa-sig-formatter@1.0.11:
    dependencies:
      safe-buffer: 5.2.1

  ee-first@1.1.1: {}

  effect@3.20.0:
    dependencies:
      "@standard-schema/spec": 1.1.0
      fast-check: 3.23.2

  electron-to-chromium@1.5.399: {}

  elkjs@0.11.1: {}

  emoji-regex@8.0.0: {}

  emoji-regex@9.2.2: {}

  empathic@2.0.0: {}

  encodeurl@2.0.0: {}

  end-of-stream@1.4.5:
    dependencies:
      once: 1.4.0

  enhanced-resolve@5.24.5:
    dependencies:
      graceful-fs: 4.2.11
      tapable: 2.3.3

  entities@8.0.0: {}

  env-paths@3.0.0: {}

  es-abstract@1.24.0:
    dependencies:
      array-buffer-byte-length: 1.0.2
      arraybuffer.prototype.slice: 1.0.4
      available-typed-arrays: 1.0.7
      call-bind: 1.0.8
      call-bound: 1.0.4
      data-view-buffer: 1.0.2
      data-view-byte-length: 1.0.2
      data-view-byte-offset: 1.0.1
      es-define-property: 1.0.1
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      es-set-tostringtag: 2.1.0
      es-to-primitive: 1.3.0
      function.prototype.name: 1.1.8
      get-intrinsic: 1.3.0
      get-proto: 1.0.1
      get-symbol-description: 1.1.0
      globalthis: 1.0.4
      gopd: 1.2.0
      has-property-descriptors: 1.0.2
      has-proto: 1.2.0
      has-symbols: 1.1.0
      hasown: 2.0.4
      internal-slot: 1.1.0
      is-array-buffer: 3.0.5
      is-callable: 1.2.7
      is-data-view: 1.0.2
      is-negative-zero: 2.0.3
      is-regex: 1.2.1
      is-set: 2.0.3
      is-shared-array-buffer: 1.0.4
      is-string: 1.1.1
      is-typed-array: 1.1.15
      is-weakref: 1.1.1
      math-intrinsics: 1.1.0
      object-inspect: 1.13.4
      object-keys: 1.1.1
      object.assign: 4.1.7
      own-keys: 1.0.1
      regexp.prototype.flags: 1.5.4
      safe-array-concat: 1.1.3
      safe-push-apply: 1.0.0
      safe-regex-test: 1.1.0
      set-proto: 1.0.0
      stop-iteration-iterator: 1.1.0
      string.prototype.trim: 1.2.10
      string.prototype.trimend: 1.0.9
      string.prototype.trimstart: 1.0.8
      typed-array-buffer: 1.0.3
      typed-array-byte-length: 1.0.3
      typed-array-byte-offset: 1.0.4
      typed-array-length: 1.0.7
      unbox-primitive: 1.1.0
      which-typed-array: 1.1.19

  es-define-property@1.0.1: {}

  es-errors@1.3.0: {}

  es-iterator-helpers@1.2.1:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      es-set-tostringtag: 2.1.0
      function-bind: 1.1.2
      get-intrinsic: 1.3.0
      globalthis: 1.0.4
      gopd: 1.2.0
      has-property-descriptors: 1.0.2
      has-proto: 1.2.0
      has-symbols: 1.1.0
      internal-slot: 1.1.0
      iterator.prototype: 1.1.5
      safe-array-concat: 1.1.3

  es-module-lexer@2.3.2: {}

  es-object-atoms@1.1.1:
    dependencies:
      es-errors: 1.3.0

  es-set-tostringtag@2.1.0:
    dependencies:
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      has-tostringtag: 1.0.2
      hasown: 2.0.4

  es-shim-unscopables@1.1.0:
    dependencies:
      hasown: 2.0.4

  es-to-primitive@1.3.0:
    dependencies:
      is-callable: 1.2.7
      is-date-object: 1.1.0
      is-symbol: 1.1.1

  esbuild@0.28.1:
    optionalDependencies:
      "@esbuild/aix-ppc64": 0.28.1
      "@esbuild/android-arm": 0.28.1
      "@esbuild/android-arm64": 0.28.1
      "@esbuild/android-x64": 0.28.1
      "@esbuild/darwin-arm64": 0.28.1
      "@esbuild/darwin-x64": 0.28.1
      "@esbuild/freebsd-arm64": 0.28.1
      "@esbuild/freebsd-x64": 0.28.1
      "@esbuild/linux-arm": 0.28.1
      "@esbuild/linux-arm64": 0.28.1
      "@esbuild/linux-ia32": 0.28.1
      "@esbuild/linux-loong64": 0.28.1
      "@esbuild/linux-mips64el": 0.28.1
      "@esbuild/linux-ppc64": 0.28.1
      "@esbuild/linux-riscv64": 0.28.1
      "@esbuild/linux-s390x": 0.28.1
      "@esbuild/linux-x64": 0.28.1
      "@esbuild/netbsd-arm64": 0.28.1
      "@esbuild/netbsd-x64": 0.28.1
      "@esbuild/openbsd-arm64": 0.28.1
      "@esbuild/openbsd-x64": 0.28.1
      "@esbuild/openharmony-arm64": 0.28.1
      "@esbuild/sunos-x64": 0.28.1
      "@esbuild/win32-arm64": 0.28.1
      "@esbuild/win32-ia32": 0.28.1
      "@esbuild/win32-x64": 0.28.1

  escalade@3.2.0: {}

  escape-html@1.0.3: {}

  escape-string-regexp@4.0.0: {}

  eslint-config-next@16.2.12(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-plugin-import-x@4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3):
    dependencies:
      "@next/eslint-plugin-next": 16.2.12
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      eslint-import-resolver-node: 0.3.10(supports-color@7.2.0)
      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import-x@4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(eslint-plugin-import@2.32.0)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
      eslint-plugin-jsx-a11y: 6.10.2(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      eslint-plugin-react: 7.37.5(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      eslint-plugin-react-hooks: 7.1.1(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
      globals: 16.4.0
      typescript-eslint: 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
    optionalDependencies:
      typescript: 5.9.3
    transitivePeerDependencies:
      - "@typescript-eslint/parser"
      - eslint-import-resolver-webpack
      - eslint-plugin-import-x
      - supports-color

  eslint-config-prettier@10.1.8(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0)):
    dependencies:
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)

  eslint-import-context@0.1.9(unrs-resolver@1.12.2):
    dependencies:
      get-tsconfig: 4.14.0
      stable-hash-x: 0.2.0
    optionalDependencies:
      unrs-resolver: 1.12.2

  eslint-import-resolver-node@0.3.10(supports-color@7.2.0):
    dependencies:
      debug: 3.2.7(supports-color@7.2.0)
      is-core-module: 2.16.2
      resolve: 2.0.0-next.7
    transitivePeerDependencies:
      - supports-color

  eslint-import-resolver-typescript@3.10.1(eslint-plugin-import-x@4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(eslint-plugin-import@2.32.0)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      "@nolyfill/is-core-module": 1.0.39
      debug: 4.4.3(supports-color@7.2.0)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      get-tsconfig: 4.14.0
      is-bun-module: 2.0.0
      stable-hash: 0.0.5
      tinyglobby: 0.2.15
      unrs-resolver: 1.12.2
    optionalDependencies:
      eslint-plugin-import: 2.32.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
      eslint-plugin-import-x: 4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  eslint-module-utils@2.14.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint-import-resolver-typescript@3.10.1)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      debug: 3.2.7(supports-color@7.2.0)
    optionalDependencies:
      "@typescript-eslint/parser": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      eslint-import-resolver-node: 0.3.10(supports-color@7.2.0)
      eslint-import-resolver-typescript: 3.10.1(eslint-plugin-import-x@4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0))(eslint-plugin-import@2.32.0)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  eslint-plugin-import-x@4.17.1(@typescript-eslint/utils@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      "@typescript-eslint/types": 8.65.0
      comment-parser: 1.4.7
      debug: 4.4.3(supports-color@7.2.0)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      eslint-import-context: 0.1.9(unrs-resolver@1.12.2)
      is-glob: 4.0.3
      minimatch: 9.0.9
      semver: 7.7.3
      stable-hash-x: 0.2.0
      unrs-resolver: 1.12.2
    optionalDependencies:
      "@typescript-eslint/utils": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      eslint-import-resolver-node: 0.3.10(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  eslint-plugin-import@2.32.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-typescript@3.10.1)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      "@rtsao/scc": 1.1.0
      array-includes: 3.1.9
      array.prototype.findlastindex: 1.2.6
      array.prototype.flat: 1.3.3
      array.prototype.flatmap: 1.3.3
      debug: 3.2.7(supports-color@7.2.0)
      doctrine: 2.1.0
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      eslint-import-resolver-node: 0.3.10(supports-color@7.2.0)
      eslint-module-utils: 2.14.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint-import-resolver-node@0.3.10(supports-color@7.2.0))(eslint-import-resolver-typescript@3.10.1)(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)
      hasown: 2.0.4
      is-core-module: 2.16.2
      is-glob: 4.0.3
      minimatch: 3.1.5
      object.fromentries: 2.0.8
      object.groupby: 1.0.3
      object.values: 1.2.1
      semver: 6.3.1
      string.prototype.trimend: 1.0.9
      tsconfig-paths: 3.15.0
    optionalDependencies:
      "@typescript-eslint/parser": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
    transitivePeerDependencies:
      - eslint-import-resolver-typescript
      - eslint-import-resolver-webpack
      - supports-color

  eslint-plugin-jsx-a11y@6.10.2(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0)):
    dependencies:
      aria-query: 5.3.2
      array-includes: 3.1.9
      array.prototype.flatmap: 1.3.3
      ast-types-flow: 0.0.8
      axe-core: 4.12.1
      axobject-query: 4.1.0
      damerau-levenshtein: 1.0.8
      emoji-regex: 9.2.2
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      hasown: 2.0.4
      jsx-ast-utils: 3.3.5
      language-tags: 1.0.9
      minimatch: 3.1.5
      object.fromentries: 2.0.8
      safe-regex-test: 1.1.0
      string.prototype.includes: 2.0.1

  eslint-plugin-react-hooks@7.1.1(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      "@babel/core": 7.29.7(supports-color@7.2.0)
      "@babel/parser": 7.29.8
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      hermes-parser: 0.25.1
      zod: 4.4.3
      zod-validation-error: 4.0.2(zod@4.4.3)
    transitivePeerDependencies:
      - supports-color

  eslint-plugin-react@7.37.5(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0)):
    dependencies:
      array-includes: 3.1.9
      array.prototype.findlast: 1.2.5
      array.prototype.flatmap: 1.3.3
      array.prototype.tosorted: 1.1.4
      doctrine: 2.1.0
      es-iterator-helpers: 1.2.1
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      estraverse: 5.3.0
      hasown: 2.0.4
      jsx-ast-utils: 3.3.5
      minimatch: 3.1.5
      object.entries: 1.1.9
      object.fromentries: 2.0.8
      object.values: 1.2.1
      prop-types: 15.8.1
      resolve: 2.0.0-next.7
      semver: 6.3.1
      string.prototype.matchall: 4.0.12
      string.prototype.repeat: 1.0.0

  eslint-plugin-unused-imports@4.4.1(@typescript-eslint/eslint-plugin@8.65.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0)):
    dependencies:
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
    optionalDependencies:
      "@typescript-eslint/eslint-plugin": 8.65.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)

  eslint-scope@8.4.0:
    dependencies:
      esrecurse: 4.3.0
      estraverse: 5.3.0

  eslint-visitor-keys@3.4.3: {}

  eslint-visitor-keys@4.2.1: {}

  eslint-visitor-keys@5.0.1: {}

  eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0):
    dependencies:
      "@eslint-community/eslint-utils": 4.9.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))
      "@eslint-community/regexpp": 4.12.2
      "@eslint/config-array": 0.21.1(supports-color@7.2.0)
      "@eslint/config-helpers": 0.4.2
      "@eslint/core": 0.17.0
      "@eslint/eslintrc": 3.3.1(supports-color@7.2.0)
      "@eslint/js": 9.39.1
      "@eslint/plugin-kit": 0.4.1
      "@humanfs/node": 0.16.7
      "@humanwhocodes/module-importer": 1.0.1
      "@humanwhocodes/retry": 0.4.3
      "@types/estree": 1.0.8
      ajv: 6.15.0
      chalk: 4.1.2
      cross-spawn: 7.0.6
      debug: 4.4.3(supports-color@7.2.0)
      escape-string-regexp: 4.0.0
      eslint-scope: 8.4.0
      eslint-visitor-keys: 4.2.1
      espree: 10.4.0
      esquery: 1.6.0
      esutils: 2.0.3
      fast-deep-equal: 3.1.3
      file-entry-cache: 8.0.0
      find-up: 5.0.0
      glob-parent: 6.0.2
      ignore: 5.3.2
      imurmurhash: 0.1.4
      is-glob: 4.0.3
      json-stable-stringify-without-jsonify: 1.0.1
      lodash.merge: 4.6.2
      minimatch: 3.1.5
      natural-compare: 1.4.0
      optionator: 0.9.4
    optionalDependencies:
      jiti: 2.7.0
    transitivePeerDependencies:
      - supports-color

  espree@10.4.0:
    dependencies:
      acorn: 8.15.0
      acorn-jsx: 5.3.2(acorn@8.15.0)
      eslint-visitor-keys: 4.2.1

  esquery@1.6.0:
    dependencies:
      estraverse: 5.3.0

  esrecurse@4.3.0:
    dependencies:
      estraverse: 5.3.0

  estraverse@5.3.0: {}

  estree-walker@3.0.3:
    dependencies:
      "@types/estree": 1.0.8

  esutils@2.0.3: {}

  etag@1.8.1: {}

  event-target-shim@5.0.1: {}

  events-universal@1.0.1:
    dependencies:
      bare-events: 2.9.1
    transitivePeerDependencies:
      - bare-abort-controller

  events@3.3.0: {}

  expect-type@1.4.0: {}

  express-rate-limit@8.6.1(express@5.2.1(supports-color@7.2.0))(supports-color@7.2.0):
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
      express: 5.2.1(supports-color@7.2.0)
      ip-address: 10.4.0
    transitivePeerDependencies:
      - supports-color

  express@5.2.1(supports-color@7.2.0):
    dependencies:
      accepts: 2.0.0
      body-parser: 2.3.0(supports-color@7.2.0)
      content-disposition: 1.1.0
      content-type: 1.0.5
      cookie: 0.7.2
      cookie-signature: 1.2.2
      debug: 4.4.3(supports-color@7.2.0)
      depd: 2.0.0
      encodeurl: 2.0.0
      escape-html: 1.0.3
      etag: 1.8.1
      finalhandler: 2.1.1(supports-color@7.2.0)
      fresh: 2.0.0
      http-errors: 2.0.1
      merge-descriptors: 2.0.0
      mime-types: 3.0.2
      on-finished: 2.4.1
      once: 1.4.0
      parseurl: 1.3.3
      proxy-addr: 2.0.7
      qs: 6.15.3
      range-parser: 1.3.0
      router: 2.2.0(supports-color@7.2.0)
      send: 1.2.1(supports-color@7.2.0)
      serve-static: 2.2.1(supports-color@7.2.0)
      statuses: 2.0.2
      type-is: 2.1.0
      vary: 1.1.2
    transitivePeerDependencies:
      - supports-color

  exsolve@1.1.1: {}

  fast-check@3.23.2:
    dependencies:
      pure-rand: 6.1.0

  fast-copy@4.0.4: {}

  fast-decode-uri-component@1.0.1: {}

  fast-deep-equal@3.1.3: {}

  fast-fifo@1.3.2: {}

  fast-glob@3.3.1:
    dependencies:
      "@nodelib/fs.stat": 2.0.5
      "@nodelib/fs.walk": 1.2.8
      glob-parent: 5.1.2
      merge2: 1.4.1
      micromatch: 4.0.8

  fast-json-stable-stringify@2.1.0: {}

  fast-levenshtein@2.0.6: {}

  fast-querystring@1.1.2:
    dependencies:
      fast-decode-uri-component: 1.0.1

  fast-safe-stringify@2.1.1: {}

  fast-sha256@1.3.0: {}

  fast-uri@3.1.5: {}

  fastq@1.19.1:
    dependencies:
      reusify: 1.1.0

  fdir@6.5.0(picomatch@4.0.5):
    optionalDependencies:
      picomatch: 4.0.5

  file-entry-cache@8.0.0:
    dependencies:
      flat-cache: 4.0.1

  fill-range@7.1.1:
    dependencies:
      to-regex-range: 5.0.1

  finalhandler@2.1.1(supports-color@7.2.0):
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
      encodeurl: 2.0.0
      escape-html: 1.0.3
      on-finished: 2.4.1
      parseurl: 1.3.3
      statuses: 2.0.2
    transitivePeerDependencies:
      - supports-color

  find-my-way@9.7.0:
    dependencies:
      fast-deep-equal: 3.1.3
      fast-querystring: 1.1.2
      safe-regex2: 5.1.1

  find-up@5.0.0:
    dependencies:
      locate-path: 6.0.0
      path-exists: 4.0.0

  flat-cache@4.0.1:
    dependencies:
      flatted: 3.4.4
      keyv: 4.5.4

  flatted@3.4.4: {}

  follow-redirects@1.16.0(debug@4.4.3(supports-color@7.2.0)):
    optionalDependencies:
      debug: 4.4.3(supports-color@7.2.0)

  for-each@0.3.5:
    dependencies:
      is-callable: 1.2.7

  foreground-child@3.3.1:
    dependencies:
      cross-spawn: 7.0.6
      signal-exit: 4.1.0

  form-data@4.0.6:
    dependencies:
      asynckit: 0.4.0
      combined-stream: 1.0.8
      es-set-tostringtag: 2.1.0
      hasown: 2.0.4
      mime-types: 2.1.35

  formidable@3.5.4:
    dependencies:
      "@paralleldrive/cuid2": 2.3.1
      dezalgo: 1.0.4
      once: 1.4.0

  forwarded@0.2.0: {}

  fresh@2.0.0: {}

  fs-constants@1.0.0: {}

  fsevents@2.3.3:
    optional: true

  function-bind@1.1.2: {}

  function.prototype.name@1.1.8:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      functions-have-names: 1.2.3
      hasown: 2.0.4
      is-callable: 1.2.7

  functions-have-names@1.2.3: {}

  generate-function@2.3.1:
    dependencies:
      is-property: 1.0.2

  gensync@1.0.0-beta.2: {}

  get-caller-file@2.0.5: {}

  get-intrinsic@1.3.0:
    dependencies:
      call-bind-apply-helpers: 1.0.2
      es-define-property: 1.0.1
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      function-bind: 1.1.2
      get-proto: 1.0.1
      gopd: 1.2.0
      has-symbols: 1.1.0
      hasown: 2.0.4
      math-intrinsics: 1.1.0

  get-port-please@3.2.0: {}

  get-port@5.1.1: {}

  get-proto@1.0.1:
    dependencies:
      dunder-proto: 1.0.1
      es-object-atoms: 1.1.1

  get-symbol-description@1.1.0:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      get-intrinsic: 1.3.0

  get-tsconfig@4.14.0:
    dependencies:
      resolve-pkg-maps: 1.0.0

  giget@3.3.1: {}

  glob-parent@5.1.2:
    dependencies:
      is-glob: 4.0.3

  glob-parent@6.0.2:
    dependencies:
      is-glob: 4.0.3

  glob@10.5.0:
    dependencies:
      foreground-child: 3.3.1
      jackspeak: 3.4.3
      minimatch: 9.0.9
      minipass: 7.1.3
      package-json-from-dist: 1.0.1
      path-scurry: 1.11.1

  glob@13.0.6:
    dependencies:
      minimatch: 10.2.6
      minipass: 7.1.3
      path-scurry: 2.0.2

  globals@14.0.0: {}

  globals@16.4.0: {}

  globals@16.5.0: {}

  globalthis@1.0.4:
    dependencies:
      define-properties: 1.2.1
      gopd: 1.2.0

  gopd@1.2.0: {}

  graceful-fs@4.2.11: {}

  grammex@3.1.13: {}

  graphmatch@1.1.1: {}

  has-bigints@1.1.0: {}

  has-flag@4.0.0: {}

  has-property-descriptors@1.0.2:
    dependencies:
      es-define-property: 1.0.1

  has-proto@1.2.0:
    dependencies:
      dunder-proto: 1.0.1

  has-symbols@1.1.0: {}

  has-tostringtag@1.0.2:
    dependencies:
      has-symbols: 1.1.0

  hasown@2.0.4:
    dependencies:
      function-bind: 1.1.2

  helmet@8.3.0: {}

  help-me@5.0.0: {}

  hermes-estree@0.25.1: {}

  hermes-parser@0.25.1:
    dependencies:
      hermes-estree: 0.25.1

  html-encoding-sniffer@6.0.0(@noble/hashes@1.8.0):
    dependencies:
      "@exodus/bytes": 1.15.1(@noble/hashes@1.8.0)
    transitivePeerDependencies:
      - "@noble/hashes"

  http-errors@2.0.1:
    dependencies:
      depd: 2.0.0
      inherits: 2.0.4
      setprototypeof: 1.2.0
      statuses: 2.0.2
      toidentifier: 1.0.1

  https-proxy-agent@5.0.1(supports-color@7.2.0):
    dependencies:
      agent-base: 6.0.2(supports-color@7.2.0)
      debug: 4.4.3(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  iconv-lite@0.7.3:
    dependencies:
      safer-buffer: 2.1.2

  ieee754@1.2.1: {}

  ignore@5.3.2: {}

  ignore@7.0.5: {}

  import-fresh@3.3.1:
    dependencies:
      parent-module: 1.0.1
      resolve-from: 4.0.0

  imurmurhash@0.1.4: {}

  indent-string@4.0.0: {}

  inherits@2.0.4: {}

  internal-slot@1.1.0:
    dependencies:
      es-errors: 1.3.0
      hasown: 2.0.4
      side-channel: 1.1.1

  internmap@2.0.3: {}

  ip-address@10.4.0: {}

  ipaddr.js@1.9.1: {}

  is-array-buffer@3.0.5:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      get-intrinsic: 1.3.0

  is-async-function@2.1.1:
    dependencies:
      async-function: 1.0.0
      call-bound: 1.0.4
      get-proto: 1.0.1
      has-tostringtag: 1.0.2
      safe-regex-test: 1.1.0

  is-bigint@1.1.0:
    dependencies:
      has-bigints: 1.1.0

  is-boolean-object@1.2.2:
    dependencies:
      call-bound: 1.0.4
      has-tostringtag: 1.0.2

  is-bun-module@2.0.0:
    dependencies:
      semver: 7.7.3

  is-callable@1.2.7: {}

  is-core-module@2.16.2:
    dependencies:
      hasown: 2.0.4

  is-data-view@1.0.2:
    dependencies:
      call-bound: 1.0.4
      get-intrinsic: 1.3.0
      is-typed-array: 1.1.15

  is-date-object@1.1.0:
    dependencies:
      call-bound: 1.0.4
      has-tostringtag: 1.0.2

  is-extglob@2.1.1: {}

  is-finalizationregistry@1.1.1:
    dependencies:
      call-bound: 1.0.4

  is-fullwidth-code-point@3.0.0: {}

  is-generator-function@1.1.0:
    dependencies:
      call-bound: 1.0.4
      get-proto: 1.0.1
      has-tostringtag: 1.0.2
      safe-regex-test: 1.1.0

  is-glob@4.0.3:
    dependencies:
      is-extglob: 2.1.1

  is-map@2.0.3: {}

  is-negative-zero@2.0.3: {}

  is-number-object@1.1.1:
    dependencies:
      call-bound: 1.0.4
      has-tostringtag: 1.0.2

  is-number@7.0.0: {}

  is-potential-custom-element-name@1.0.1: {}

  is-promise@4.0.0: {}

  is-property@1.0.2: {}

  is-regex@1.2.1:
    dependencies:
      call-bound: 1.0.4
      gopd: 1.2.0
      has-tostringtag: 1.0.2
      hasown: 2.0.4

  is-set@2.0.3: {}

  is-shared-array-buffer@1.0.4:
    dependencies:
      call-bound: 1.0.4

  is-stream@2.0.1: {}

  is-string@1.1.1:
    dependencies:
      call-bound: 1.0.4
      has-tostringtag: 1.0.2

  is-symbol@1.1.1:
    dependencies:
      call-bound: 1.0.4
      has-symbols: 1.1.0
      safe-regex-test: 1.1.0

  is-typed-array@1.1.15:
    dependencies:
      which-typed-array: 1.1.19

  is-weakmap@2.0.2: {}

  is-weakref@1.1.1:
    dependencies:
      call-bound: 1.0.4

  is-weakset@2.0.4:
    dependencies:
      call-bound: 1.0.4
      get-intrinsic: 1.3.0

  isarray@1.0.0: {}

  isarray@2.0.5: {}

  isexe@2.0.0: {}

  iterator.prototype@1.1.5:
    dependencies:
      define-data-property: 1.1.4
      es-object-atoms: 1.1.1
      get-intrinsic: 1.3.0
      get-proto: 1.0.1
      has-symbols: 1.1.0
      set-function-name: 2.0.2

  jackspeak@3.4.3:
    dependencies:
      "@isaacs/cliui": 8.0.2
    optionalDependencies:
      "@pkgjs/parseargs": 0.11.0

  jiti@2.7.0: {}

  joycon@3.1.1: {}

  js-tokens@4.0.0: {}

  js-yaml@4.3.1:
    dependencies:
      argparse: 2.0.1

  jsdom@30.0.1(@noble/hashes@1.8.0):
    dependencies:
      "@asamuzakjp/css-color": 6.0.7
      "@asamuzakjp/dom-selector": 8.3.2
      "@bramus/specificity": 2.4.2
      "@csstools/css-syntax-patches-for-csstree": 1.1.8(css-tree@3.2.1)
      "@exodus/bytes": 1.15.1(@noble/hashes@1.8.0)
      css-tree: 3.2.1
      data-urls: 7.0.0(@noble/hashes@1.8.0)
      decimal.js: 10.6.0
      html-encoding-sniffer: 6.0.0(@noble/hashes@1.8.0)
      is-potential-custom-element-name: 1.0.1
      lru-cache: 11.5.2
      parse5: 8.0.1
      saxes: 6.0.0
      symbol-tree: 3.2.4
      tough-cookie: 6.0.2
      undici: 8.10.0
      w3c-xmlserializer: 5.0.0
      webidl-conversions: 8.0.1
      whatwg-mimetype: 5.0.0
      whatwg-url: 17.1.0(@noble/hashes@1.8.0)
      xml-name-validator: 5.0.0
    transitivePeerDependencies:
      - "@noble/hashes"

  jsesc@3.1.0: {}

  json-buffer@3.0.1: {}

  json-schema-traverse@0.4.1: {}

  json-schema-traverse@1.0.0: {}

  json-stable-stringify-without-jsonify@1.0.1: {}

  json5@1.0.2:
    dependencies:
      minimist: 1.2.8

  json5@2.2.3: {}

  jsonwebtoken@9.0.3:
    dependencies:
      jws: 4.0.1
      lodash.includes: 4.3.0
      lodash.isboolean: 3.0.3
      lodash.isinteger: 4.0.4
      lodash.isnumber: 3.0.3
      lodash.isplainobject: 4.0.6
      lodash.isstring: 4.0.1
      lodash.once: 4.1.1
      ms: 2.1.3
      semver: 7.7.3

  jsx-ast-utils@3.3.5:
    dependencies:
      array-includes: 3.1.9
      array.prototype.flat: 1.3.3
      object.assign: 4.1.7
      object.values: 1.2.1

  jwa@2.0.1:
    dependencies:
      buffer-equal-constant-time: 1.0.1
      ecdsa-sig-formatter: 1.0.11
      safe-buffer: 5.2.1

  jws@4.0.1:
    dependencies:
      jwa: 2.0.1
      safe-buffer: 5.2.1

  keyv@4.5.4:
    dependencies:
      json-buffer: 3.0.1

  language-subtag-registry@0.3.23: {}

  language-tags@1.0.9:
    dependencies:
      language-subtag-registry: 0.3.23

  lazystream@1.0.1:
    dependencies:
      readable-stream: 2.3.8

  levn@0.4.1:
    dependencies:
      prelude-ls: 1.2.1
      type-check: 0.4.0

  lightningcss-android-arm64@1.32.0:
    optional: true

  lightningcss-android-arm64@1.33.0:
    optional: true

  lightningcss-darwin-arm64@1.32.0:
    optional: true

  lightningcss-darwin-arm64@1.33.0:
    optional: true

  lightningcss-darwin-x64@1.32.0:
    optional: true

  lightningcss-darwin-x64@1.33.0:
    optional: true

  lightningcss-freebsd-x64@1.32.0:
    optional: true

  lightningcss-freebsd-x64@1.33.0:
    optional: true

  lightningcss-linux-arm-gnueabihf@1.32.0:
    optional: true

  lightningcss-linux-arm-gnueabihf@1.33.0:
    optional: true

  lightningcss-linux-arm64-gnu@1.32.0:
    optional: true

  lightningcss-linux-arm64-gnu@1.33.0:
    optional: true

  lightningcss-linux-arm64-musl@1.32.0:
    optional: true

  lightningcss-linux-arm64-musl@1.33.0:
    optional: true

  lightningcss-linux-x64-gnu@1.32.0:
    optional: true

  lightningcss-linux-x64-gnu@1.33.0:
    optional: true

  lightningcss-linux-x64-musl@1.32.0:
    optional: true

  lightningcss-linux-x64-musl@1.33.0:
    optional: true

  lightningcss-win32-arm64-msvc@1.32.0:
    optional: true

  lightningcss-win32-arm64-msvc@1.33.0:
    optional: true

  lightningcss-win32-x64-msvc@1.32.0:
    optional: true

  lightningcss-win32-x64-msvc@1.33.0:
    optional: true

  lightningcss@1.32.0:
    dependencies:
      detect-libc: 2.1.2
    optionalDependencies:
      lightningcss-android-arm64: 1.32.0
      lightningcss-darwin-arm64: 1.32.0
      lightningcss-darwin-x64: 1.32.0
      lightningcss-freebsd-x64: 1.32.0
      lightningcss-linux-arm-gnueabihf: 1.32.0
      lightningcss-linux-arm64-gnu: 1.32.0
      lightningcss-linux-arm64-musl: 1.32.0
      lightningcss-linux-x64-gnu: 1.32.0
      lightningcss-linux-x64-musl: 1.32.0
      lightningcss-win32-arm64-msvc: 1.32.0
      lightningcss-win32-x64-msvc: 1.32.0

  lightningcss@1.33.0:
    dependencies:
      detect-libc: 2.1.2
    optionalDependencies:
      lightningcss-android-arm64: 1.33.0
      lightningcss-darwin-arm64: 1.33.0
      lightningcss-darwin-x64: 1.33.0
      lightningcss-freebsd-x64: 1.33.0
      lightningcss-linux-arm-gnueabihf: 1.33.0
      lightningcss-linux-arm64-gnu: 1.33.0
      lightningcss-linux-arm64-musl: 1.33.0
      lightningcss-linux-x64-gnu: 1.33.0
      lightningcss-linux-x64-musl: 1.33.0
      lightningcss-win32-arm64-msvc: 1.33.0
      lightningcss-win32-x64-msvc: 1.33.0

  locate-path@6.0.0:
    dependencies:
      p-locate: 5.0.0

  lodash.camelcase@4.3.0: {}

  lodash.includes@4.3.0: {}

  lodash.isboolean@3.0.3: {}

  lodash.isinteger@4.0.4: {}

  lodash.isnumber@3.0.3: {}

  lodash.isplainobject@4.0.6: {}

  lodash.isstring@4.0.1: {}

  lodash.merge@4.6.2: {}

  lodash.once@4.1.1: {}

  lodash@4.18.1: {}

  long@5.3.2: {}

  loose-envify@1.4.0:
    dependencies:
      js-tokens: 4.0.0

  lru-cache@10.4.3: {}

  lru-cache@11.5.2: {}

  lru-cache@5.1.1:
    dependencies:
      yallist: 3.1.1

  lru.min@1.1.4: {}

  lz-string@1.5.0: {}

  magic-string@0.30.21:
    dependencies:
      "@jridgewell/sourcemap-codec": 1.5.5

  math-intrinsics@1.1.0: {}

  mdn-data@2.27.1: {}

  media-typer@1.1.1: {}

  merge-descriptors@2.0.0: {}

  merge2@1.4.1: {}

  methods@1.1.2: {}

  micromatch@4.0.8:
    dependencies:
      braces: 3.0.3
      picomatch: 2.3.2

  mime-db@1.52.0: {}

  mime-db@1.54.0: {}

  mime-types@2.1.35:
    dependencies:
      mime-db: 1.52.0

  mime-types@3.0.2:
    dependencies:
      mime-db: 1.54.0

  mime@2.6.0: {}

  min-indent@1.0.1: {}

  minimatch@10.2.6:
    dependencies:
      brace-expansion: 5.0.9

  minimatch@3.1.5:
    dependencies:
      brace-expansion: 1.1.18

  minimatch@5.1.9:
    dependencies:
      brace-expansion: 2.1.4

  minimatch@9.0.9:
    dependencies:
      brace-expansion: 2.1.4

  minimist@1.2.8: {}

  minipass@7.1.3: {}

  mkdirp-classic@0.5.3: {}

  mkdirp@3.0.1: {}

  ms@2.0.0: {}

  ms@2.1.3: {}

  mysql2@3.15.3:
    dependencies:
      aws-ssl-profiles: 1.1.2
      denque: 2.1.0
      generate-function: 2.3.1
      iconv-lite: 0.7.3
      long: 5.3.2
      lru.min: 1.1.4
      named-placeholders: 1.1.6
      seq-queue: 0.0.5
      sqlstring: 2.3.3

  named-placeholders@1.1.6:
    dependencies:
      lru.min: 1.1.4

  nan@2.28.0:
    optional: true

  nanoid@3.3.16: {}

  napi-postinstall@0.3.4: {}

  natural-compare@1.4.0: {}

  negotiator@0.6.4: {}

  negotiator@1.0.0: {}

  next@16.2.12(@babel/core@7.29.7(supports-color@7.2.0))(babel-plugin-react-compiler@1.0.0)(react-dom@19.2.8(react@19.2.8))(react@19.2.8):
    dependencies:
      "@next/env": 16.2.12
      "@swc/helpers": 0.5.15
      baseline-browser-mapping: 2.10.8
      caniuse-lite: 1.0.30001761
      postcss: 8.5.25
      react: 19.2.8
      react-dom: 19.2.8(react@19.2.8)
      styled-jsx: 5.1.6(@babel/core@7.29.7(supports-color@7.2.0))(react@19.2.8)
    optionalDependencies:
      "@next/swc-darwin-arm64": 16.2.12
      "@next/swc-darwin-x64": 16.2.12
      "@next/swc-linux-arm64-gnu": 16.2.12
      "@next/swc-linux-arm64-musl": 16.2.12
      "@next/swc-linux-x64-gnu": 16.2.12
      "@next/swc-linux-x64-musl": 16.2.12
      "@next/swc-win32-arm64-msvc": 16.2.12
      "@next/swc-win32-x64-msvc": 16.2.12
      babel-plugin-react-compiler: 1.0.0
      sharp: 0.34.5
    transitivePeerDependencies:
      - "@babel/core"
      - babel-plugin-macros

  node-addon-api@8.9.2: {}

  node-exports-info@1.6.2:
    dependencies:
      array.prototype.flatmap: 1.3.3
      es-errors: 1.3.0
      object.entries: 1.1.9
      semver: 6.3.1

  node-gyp-build@4.8.4: {}

  node-releases@2.0.51: {}

  nodemailer@9.0.4: {}

  normalize-path@3.0.0: {}

  object-assign@4.1.1: {}

  object-inspect@1.13.4: {}

  object-keys@1.1.1: {}

  object.assign@4.1.7:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-object-atoms: 1.1.1
      has-symbols: 1.1.0
      object-keys: 1.1.1

  object.entries@1.1.9:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-object-atoms: 1.1.1

  object.fromentries@2.0.8:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-object-atoms: 1.1.1

  object.groupby@1.0.3:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0

  object.values@1.2.1:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-object-atoms: 1.1.1

  obug@2.1.4: {}

  ohash@2.0.11: {}

  on-exit-leak-free@2.1.2: {}

  on-finished@2.4.1:
    dependencies:
      ee-first: 1.1.1

  on-headers@1.1.0: {}

  once@1.4.0:
    dependencies:
      wrappy: 1.0.2

  optionator@0.9.4:
    dependencies:
      deep-is: 0.1.4
      fast-levenshtein: 2.0.6
      levn: 0.4.1
      prelude-ls: 1.2.1
      type-check: 0.4.0
      word-wrap: 1.2.5

  own-keys@1.0.1:
    dependencies:
      get-intrinsic: 1.3.0
      object-keys: 1.1.1
      safe-push-apply: 1.0.0

  p-limit@3.1.0:
    dependencies:
      yocto-queue: 0.1.0

  p-locate@5.0.0:
    dependencies:
      p-limit: 3.1.0

  package-json-from-dist@1.0.1: {}

  parent-module@1.0.1:
    dependencies:
      callsites: 3.1.0

  parse5@8.0.1:
    dependencies:
      entities: 8.0.0

  parseurl@1.3.3: {}

  path-exists@4.0.0: {}

  path-key@3.1.1: {}

  path-parse@1.0.7: {}

  path-scurry@1.11.1:
    dependencies:
      lru-cache: 10.4.3
      minipass: 7.1.3

  path-scurry@2.0.2:
    dependencies:
      lru-cache: 11.5.2
      minipass: 7.1.3

  path-to-regexp@8.4.2: {}

  pathe@2.0.3: {}

  perfect-debounce@2.1.0: {}

  pg-cloudflare@1.4.0:
    optional: true

  pg-connection-string@2.14.0: {}

  pg-int8@1.0.1: {}

  pg-pool@3.14.0(pg@8.22.0):
    dependencies:
      pg: 8.22.0

  pg-protocol@1.15.0: {}

  pg-types@2.2.0:
    dependencies:
      pg-int8: 1.0.1
      postgres-array: 2.0.0
      postgres-bytea: 1.0.1
      postgres-date: 1.0.7
      postgres-interval: 1.2.0

  pg@8.22.0:
    dependencies:
      pg-connection-string: 2.14.0
      pg-pool: 3.14.0(pg@8.22.0)
      pg-protocol: 1.15.0
      pg-types: 2.2.0
      pgpass: 1.0.5
    optionalDependencies:
      pg-cloudflare: 1.4.0

  pgpass@1.0.5:
    dependencies:
      split2: 4.2.0

  picocolors@1.1.1: {}

  picomatch@2.3.2: {}

  picomatch@4.0.5: {}

  pino-abstract-transport@3.0.0:
    dependencies:
      split2: 4.2.0

  pino-http@11.0.0:
    dependencies:
      get-caller-file: 2.0.5
      pino: 10.3.1
      pino-std-serializers: 7.1.0
      process-warning: 5.1.0

  pino-pretty@13.1.3:
    dependencies:
      colorette: 2.0.20
      dateformat: 4.6.3
      fast-copy: 4.0.4
      fast-safe-stringify: 2.1.1
      help-me: 5.0.0
      joycon: 3.1.1
      minimist: 1.2.8
      on-exit-leak-free: 2.1.2
      pino-abstract-transport: 3.0.0
      pump: 3.0.4
      secure-json-parse: 4.1.0
      sonic-boom: 4.2.1
      strip-json-comments: 5.0.3

  pino-std-serializers@7.1.0: {}

  pino@10.3.1:
    dependencies:
      "@pinojs/redact": 0.4.0
      atomic-sleep: 1.0.0
      on-exit-leak-free: 2.1.2
      pino-abstract-transport: 3.0.0
      pino-std-serializers: 7.1.0
      process-warning: 5.1.0
      quick-format-unescaped: 4.0.4
      real-require: 0.2.0
      safe-stable-stringify: 2.5.0
      sonic-boom: 4.2.1
      thread-stream: 4.2.0

  pkg-types@2.3.1:
    dependencies:
      confbox: 0.2.4
      exsolve: 1.1.1
      pathe: 2.0.3

  possible-typed-array-names@1.1.0: {}

  postal-mime@2.7.5: {}

  postcss@8.5.25:
    dependencies:
      nanoid: 3.3.16
      picocolors: 1.1.1
      source-map-js: 1.2.1

  postgres-array@2.0.0: {}

  postgres-array@3.0.4: {}

  postgres-bytea@1.0.1: {}

  postgres-date@1.0.7: {}

  postgres-interval@1.2.0:
    dependencies:
      xtend: 4.0.2

  postgres@3.4.7: {}

  prelude-ls@1.2.1: {}

  prettier-plugin-tailwindcss@0.8.1(prettier@3.9.6):
    dependencies:
      prettier: 3.9.6

  prettier@3.9.6: {}

  pretty-format@27.5.1:
    dependencies:
      ansi-regex: 5.0.1
      ansi-styles: 5.2.0
      react-is: 17.0.2

  prisma@7.9.1(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)(typescript@5.9.3):
    dependencies:
      "@prisma/config": 7.9.1
      "@prisma/dev": 0.24.17(typescript@5.9.3)
      "@prisma/engines": 7.9.1
      "@prisma/studio-core": 0.33.0(@types/react-dom@19.2.4(@types/react@19.2.18))(@types/react@19.2.18)(react-dom@19.2.8(react@19.2.8))(react@19.2.8)
      mysql2: 3.15.3
      postgres: 3.4.7
    optionalDependencies:
      typescript: 5.9.3
    transitivePeerDependencies:
      - "@types/react"
      - "@types/react-dom"
      - magicast
      - react
      - react-dom

  process-nextick-args@2.0.1: {}

  process-warning@5.1.0: {}

  process@0.11.10: {}

  prop-types@15.8.1:
    dependencies:
      loose-envify: 1.4.0
      object-assign: 4.1.1
      react-is: 16.13.1

  proper-lockfile@4.1.2:
    dependencies:
      graceful-fs: 4.2.11
      retry: 0.12.0
      signal-exit: 3.0.7

  properties-reader@3.0.1(supports-color@7.2.0):
    dependencies:
      "@kwsites/file-exists": 1.1.1(supports-color@7.2.0)
      mkdirp: 3.0.1
    transitivePeerDependencies:
      - supports-color

  protobufjs@7.6.5:
    dependencies:
      "@protobufjs/aspromise": 1.1.2
      "@protobufjs/base64": 1.1.2
      "@protobufjs/codegen": 2.0.5
      "@protobufjs/eventemitter": 1.1.1
      "@protobufjs/fetch": 1.1.1
      "@protobufjs/float": 1.0.2
      "@protobufjs/path": 1.1.2
      "@protobufjs/pool": 1.1.0
      "@protobufjs/utf8": 1.1.2
      "@types/node": 24.13.3
      long: 5.3.2

  proxy-addr@2.0.7:
    dependencies:
      forwarded: 0.2.0
      ipaddr.js: 1.9.1

  proxy-from-env@2.1.0: {}

  pump@3.0.4:
    dependencies:
      end-of-stream: 1.4.5
      once: 1.4.0

  punycode@2.3.1: {}

  pure-rand@6.1.0: {}

  qs@6.15.3:
    dependencies:
      es-define-property: 1.0.1
      side-channel: 1.1.1

  queue-microtask@1.2.3: {}

  quick-format-unescaped@4.0.4: {}

  range-parser@1.3.0: {}

  raw-body@3.0.2:
    dependencies:
      bytes: 3.1.2
      http-errors: 2.0.1
      iconv-lite: 0.7.3
      unpipe: 1.0.0

  rc9@3.0.1:
    dependencies:
      defu: 6.1.7
      destr: 2.0.5

  react-dom@19.2.8(react@19.2.8):
    dependencies:
      react: 19.2.8
      scheduler: 0.27.0

  react-hook-form@7.84.0(react@19.2.8):
    dependencies:
      react: 19.2.8

  react-is@16.13.1: {}

  react-is@17.0.2: {}

  react@19.2.8: {}

  readable-stream@2.3.8:
    dependencies:
      core-util-is: 1.0.3
      inherits: 2.0.4
      isarray: 1.0.0
      process-nextick-args: 2.0.1
      safe-buffer: 5.1.2
      string_decoder: 1.1.1
      util-deprecate: 1.0.2

  readable-stream@3.6.2:
    dependencies:
      inherits: 2.0.4
      string_decoder: 1.3.0
      util-deprecate: 1.0.2

  readable-stream@4.7.0:
    dependencies:
      abort-controller: 3.0.0
      buffer: 6.0.3
      events: 3.3.0
      process: 0.11.10
      string_decoder: 1.3.0

  readdir-glob@1.1.3:
    dependencies:
      minimatch: 5.1.9

  readdirp@5.0.0: {}

  real-require@0.2.0: {}

  real-require@1.0.0: {}

  redent@3.0.0:
    dependencies:
      indent-string: 4.0.0
      strip-indent: 3.0.0

  reflect.getprototypeof@1.0.10:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      get-intrinsic: 1.3.0
      get-proto: 1.0.1
      which-builtin-type: 1.2.1

  regexp.prototype.flags@1.5.4:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-errors: 1.3.0
      get-proto: 1.0.1
      gopd: 1.2.0
      set-function-name: 2.0.2

  remeda@2.33.4: {}

  require-directory@2.1.1: {}

  require-from-string@2.0.2: {}

  resend@6.20.0:
    dependencies:
      postal-mime: 2.7.5
      standardwebhooks: 1.0.0

  resolve-from@4.0.0: {}

  resolve-pkg-maps@1.0.0: {}

  resolve@2.0.0-next.7:
    dependencies:
      es-errors: 1.3.0
      is-core-module: 2.16.2
      node-exports-info: 1.6.2
      object-keys: 1.1.1
      path-parse: 1.0.7
      supports-preserve-symlinks-flag: 1.0.0

  ret@0.5.0: {}

  retry@0.12.0: {}

  reusify@1.1.0: {}

  rimraf@6.1.3:
    dependencies:
      glob: 13.0.6
      package-json-from-dist: 1.0.1

  robust-predicates@3.0.3: {}

  rolldown@1.2.4:
    dependencies:
      "@oxc-project/types": 0.144.0
      "@rolldown/pluginutils": 1.0.1
    optionalDependencies:
      "@rolldown/binding-android-arm64": 1.2.4
      "@rolldown/binding-darwin-arm64": 1.2.4
      "@rolldown/binding-darwin-x64": 1.2.4
      "@rolldown/binding-freebsd-x64": 1.2.4
      "@rolldown/binding-linux-arm-gnueabihf": 1.2.4
      "@rolldown/binding-linux-arm64-gnu": 1.2.4
      "@rolldown/binding-linux-arm64-musl": 1.2.4
      "@rolldown/binding-linux-ppc64-gnu": 1.2.4
      "@rolldown/binding-linux-s390x-gnu": 1.2.4
      "@rolldown/binding-linux-x64-gnu": 1.2.4
      "@rolldown/binding-linux-x64-musl": 1.2.4
      "@rolldown/binding-openharmony-arm64": 1.2.4
      "@rolldown/binding-win32-arm64-msvc": 1.2.4
      "@rolldown/binding-win32-x64-msvc": 1.2.4

  router@2.2.0(supports-color@7.2.0):
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
      depd: 2.0.0
      is-promise: 4.0.0
      parseurl: 1.3.3
      path-to-regexp: 8.4.2
    transitivePeerDependencies:
      - supports-color

  run-parallel@1.2.0:
    dependencies:
      queue-microtask: 1.2.3

  safe-array-concat@1.1.3:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      get-intrinsic: 1.3.0
      has-symbols: 1.1.0
      isarray: 2.0.5

  safe-buffer@5.1.2: {}

  safe-buffer@5.2.1: {}

  safe-push-apply@1.0.0:
    dependencies:
      es-errors: 1.3.0
      isarray: 2.0.5

  safe-regex-test@1.1.0:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      is-regex: 1.2.1

  safe-regex2@5.1.1:
    dependencies:
      ret: 0.5.0

  safe-stable-stringify@2.5.0: {}

  safer-buffer@2.1.2: {}

  saxes@6.0.0:
    dependencies:
      xmlchars: 2.2.0

  scheduler@0.27.0: {}

  secure-json-parse@4.1.0: {}

  semver@6.3.1: {}

  semver@7.7.3: {}

  send@1.2.1(supports-color@7.2.0):
    dependencies:
      debug: 4.4.3(supports-color@7.2.0)
      encodeurl: 2.0.0
      escape-html: 1.0.3
      etag: 1.8.1
      fresh: 2.0.0
      http-errors: 2.0.1
      mime-types: 3.0.2
      ms: 2.1.3
      on-finished: 2.4.1
      range-parser: 1.3.0
      statuses: 2.0.2
    transitivePeerDependencies:
      - supports-color

  seq-queue@0.0.5: {}

  serve-static@2.2.1(supports-color@7.2.0):
    dependencies:
      encodeurl: 2.0.0
      escape-html: 1.0.3
      parseurl: 1.3.3
      send: 1.2.1(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  set-function-length@1.2.2:
    dependencies:
      define-data-property: 1.1.4
      es-errors: 1.3.0
      function-bind: 1.1.2
      get-intrinsic: 1.3.0
      gopd: 1.2.0
      has-property-descriptors: 1.0.2

  set-function-name@2.0.2:
    dependencies:
      define-data-property: 1.1.4
      es-errors: 1.3.0
      functions-have-names: 1.2.3
      has-property-descriptors: 1.0.2

  set-proto@1.0.0:
    dependencies:
      dunder-proto: 1.0.1
      es-errors: 1.3.0
      es-object-atoms: 1.1.1

  setprototypeof@1.2.0: {}

  sharp@0.34.5:
    dependencies:
      "@img/colour": 1.0.0
      detect-libc: 2.1.2
      semver: 7.7.3
    optionalDependencies:
      "@img/sharp-darwin-arm64": 0.34.5
      "@img/sharp-darwin-x64": 0.34.5
      "@img/sharp-libvips-darwin-arm64": 1.2.4
      "@img/sharp-libvips-darwin-x64": 1.2.4
      "@img/sharp-libvips-linux-arm": 1.2.4
      "@img/sharp-libvips-linux-arm64": 1.2.4
      "@img/sharp-libvips-linux-ppc64": 1.2.4
      "@img/sharp-libvips-linux-riscv64": 1.2.4
      "@img/sharp-libvips-linux-s390x": 1.2.4
      "@img/sharp-libvips-linux-x64": 1.2.4
      "@img/sharp-libvips-linuxmusl-arm64": 1.2.4
      "@img/sharp-libvips-linuxmusl-x64": 1.2.4
      "@img/sharp-linux-arm": 0.34.5
      "@img/sharp-linux-arm64": 0.34.5
      "@img/sharp-linux-ppc64": 0.34.5
      "@img/sharp-linux-riscv64": 0.34.5
      "@img/sharp-linux-s390x": 0.34.5
      "@img/sharp-linux-x64": 0.34.5
      "@img/sharp-linuxmusl-arm64": 0.34.5
      "@img/sharp-linuxmusl-x64": 0.34.5
      "@img/sharp-wasm32": 0.34.5
      "@img/sharp-win32-arm64": 0.34.5
      "@img/sharp-win32-ia32": 0.34.5
      "@img/sharp-win32-x64": 0.34.5
    optional: true

  shebang-command@2.0.0:
    dependencies:
      shebang-regex: 3.0.0

  shebang-regex@3.0.0: {}

  side-channel-list@1.0.1:
    dependencies:
      es-errors: 1.3.0
      object-inspect: 1.13.4

  side-channel-map@1.0.1:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      object-inspect: 1.13.4

  side-channel-weakmap@1.0.2:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      get-intrinsic: 1.3.0
      object-inspect: 1.13.4
      side-channel-map: 1.0.1

  side-channel@1.1.1:
    dependencies:
      es-errors: 1.3.0
      object-inspect: 1.13.4
      side-channel-list: 1.0.1
      side-channel-map: 1.0.1
      side-channel-weakmap: 1.0.2

  siginfo@2.0.0: {}

  signal-exit@3.0.7: {}

  signal-exit@4.1.0: {}

  sonic-boom@4.2.1:
    dependencies:
      atomic-sleep: 1.0.0

  source-map-js@1.2.1: {}

  split-ca@1.0.1: {}

  split2@4.2.0: {}

  sqlstring@2.3.3: {}

  ssh-remote-port-forward@1.0.4:
    dependencies:
      "@types/ssh2": 0.5.52
      ssh2: 1.17.0

  ssh2@1.17.0:
    dependencies:
      asn1: 0.2.6
      bcrypt-pbkdf: 1.0.2
    optionalDependencies:
      cpu-features: 0.0.10
      nan: 2.28.0

  stable-hash-x@0.2.0: {}

  stable-hash@0.0.5: {}

  stackback@0.0.2: {}

  standardwebhooks@1.0.0:
    dependencies:
      "@stablelib/base64": 1.0.1
      fast-sha256: 1.3.0

  statuses@2.0.2: {}

  std-env@3.10.0: {}

  std-env@4.2.0: {}

  stop-iteration-iterator@1.1.0:
    dependencies:
      es-errors: 1.3.0
      internal-slot: 1.1.0

  streamx@2.28.0:
    dependencies:
      events-universal: 1.0.1
      fast-fifo: 1.3.2
      text-decoder: 1.2.7
    transitivePeerDependencies:
      - bare-abort-controller
      - react-native-b4a

  string-width@4.2.3:
    dependencies:
      emoji-regex: 8.0.0
      is-fullwidth-code-point: 3.0.0
      strip-ansi: 6.0.1

  string-width@5.1.2:
    dependencies:
      eastasianwidth: 0.2.0
      emoji-regex: 9.2.2
      strip-ansi: 7.2.0

  string.prototype.includes@2.0.1:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-abstract: 1.24.0

  string.prototype.matchall@4.0.12:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-errors: 1.3.0
      es-object-atoms: 1.1.1
      get-intrinsic: 1.3.0
      gopd: 1.2.0
      has-symbols: 1.1.0
      internal-slot: 1.1.0
      regexp.prototype.flags: 1.5.4
      set-function-name: 2.0.2
      side-channel: 1.1.1

  string.prototype.repeat@1.0.0:
    dependencies:
      define-properties: 1.2.1
      es-abstract: 1.24.0

  string.prototype.trim@1.2.10:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-data-property: 1.1.4
      define-properties: 1.2.1
      es-abstract: 1.24.0
      es-object-atoms: 1.1.1
      has-property-descriptors: 1.0.2

  string.prototype.trimend@1.0.9:
    dependencies:
      call-bind: 1.0.8
      call-bound: 1.0.4
      define-properties: 1.2.1
      es-object-atoms: 1.1.1

  string.prototype.trimstart@1.0.8:
    dependencies:
      call-bind: 1.0.8
      define-properties: 1.2.1
      es-object-atoms: 1.1.1

  string_decoder@1.1.1:
    dependencies:
      safe-buffer: 5.1.2

  string_decoder@1.3.0:
    dependencies:
      safe-buffer: 5.2.1

  strip-ansi@6.0.1:
    dependencies:
      ansi-regex: 5.0.1

  strip-ansi@7.2.0:
    dependencies:
      ansi-regex: 6.3.0

  strip-bom@3.0.0: {}

  strip-indent@3.0.0:
    dependencies:
      min-indent: 1.0.1

  strip-json-comments@3.1.1: {}

  strip-json-comments@5.0.3: {}

  styled-jsx@5.1.6(@babel/core@7.29.7(supports-color@7.2.0))(react@19.2.8):
    dependencies:
      client-only: 0.0.1
      react: 19.2.8
    optionalDependencies:
      "@babel/core": 7.29.7(supports-color@7.2.0)

  superagent@10.3.0(supports-color@7.2.0):
    dependencies:
      component-emitter: 1.3.1
      cookiejar: 2.1.4
      debug: 4.4.3(supports-color@7.2.0)
      fast-safe-stringify: 2.1.1
      form-data: 4.0.6
      formidable: 3.5.4
      methods: 1.1.2
      mime: 2.6.0
      qs: 6.15.3
    transitivePeerDependencies:
      - supports-color

  supertest@7.1.4(supports-color@7.2.0):
    dependencies:
      methods: 1.1.2
      superagent: 10.3.0(supports-color@7.2.0)
    transitivePeerDependencies:
      - supports-color

  supports-color@7.2.0:
    dependencies:
      has-flag: 4.0.0

  supports-preserve-symlinks-flag@1.0.0: {}

  symbol-tree@3.2.4: {}

  tailwindcss@4.3.3: {}

  tapable@2.3.3: {}

  tar-fs@2.1.5:
    dependencies:
      chownr: 1.1.4
      mkdirp-classic: 0.5.3
      pump: 3.0.4
      tar-stream: 2.2.0

  tar-fs@3.1.3:
    dependencies:
      pump: 3.0.4
      tar-stream: 3.2.0
    optionalDependencies:
      bare-fs: 4.8.0
      bare-path: 3.1.1
    transitivePeerDependencies:
      - bare-abort-controller
      - bare-buffer
      - react-native-b4a

  tar-stream@2.2.0:
    dependencies:
      bl: 4.1.0
      end-of-stream: 1.4.5
      fs-constants: 1.0.0
      inherits: 2.0.4
      readable-stream: 3.6.2

  tar-stream@3.2.0:
    dependencies:
      b4a: 1.8.1
      bare-fs: 4.8.0
      fast-fifo: 1.3.2
      streamx: 2.28.0
    transitivePeerDependencies:
      - bare-abort-controller
      - bare-buffer
      - react-native-b4a

  teex@1.0.1:
    dependencies:
      streamx: 2.28.0
    transitivePeerDependencies:
      - bare-abort-controller
      - react-native-b4a

  testcontainers@12.1.0(supports-color@7.2.0):
    dependencies:
      "@balena/dockerignore": 1.0.2
      "@types/dockerode": 4.0.1
      archiver: 7.0.1
      async-lock: 1.4.1
      byline: 5.0.0
      debug: 4.4.3(supports-color@7.2.0)
      docker-compose: 1.4.2
      dockerode: 5.0.1(supports-color@7.2.0)
      get-port: 5.1.1
      proper-lockfile: 4.1.2
      properties-reader: 3.0.1(supports-color@7.2.0)
      ssh-remote-port-forward: 1.0.4
      tar-fs: 3.1.3
      tmp: 0.2.7
      undici: 8.10.0
    transitivePeerDependencies:
      - bare-abort-controller
      - bare-buffer
      - react-native-b4a
      - supports-color

  text-decoder@1.2.7:
    dependencies:
      b4a: 1.8.1
    transitivePeerDependencies:
      - react-native-b4a

  thread-stream@4.2.0:
    dependencies:
      real-require: 1.0.0

  tinybench@2.9.0: {}

  tinyexec@1.3.0: {}

  tinyglobby@0.2.15:
    dependencies:
      fdir: 6.5.0(picomatch@4.0.5)
      picomatch: 4.0.5

  tinyglobby@0.2.17:
    dependencies:
      fdir: 6.5.0(picomatch@4.0.5)
      picomatch: 4.0.5

  tinyrainbow@3.1.1: {}

  tldts-core@7.4.10: {}

  tldts@7.4.10:
    dependencies:
      tldts-core: 7.4.10

  tmp@0.2.7: {}

  to-regex-range@5.0.1:
    dependencies:
      is-number: 7.0.0

  toidentifier@1.0.1: {}

  tough-cookie@6.0.2:
    dependencies:
      tldts: 7.4.10

  tr46@6.0.0:
    dependencies:
      punycode: 2.3.1

  ts-api-utils@2.1.0(typescript@5.9.3):
    dependencies:
      typescript: 5.9.3

  ts-api-utils@2.5.0(typescript@5.9.3):
    dependencies:
      typescript: 5.9.3

  tsconfig-paths@3.15.0:
    dependencies:
      "@types/json5": 0.0.29
      json5: 1.0.2
      minimist: 1.2.8
      strip-bom: 3.0.0

  tslib@2.8.1: {}

  tsx@4.23.1:
    dependencies:
      esbuild: 0.28.1
    optionalDependencies:
      fsevents: 2.3.3

  turbo@2.10.8:
    optionalDependencies:
      "@turbo/darwin-64": 2.10.8
      "@turbo/darwin-arm64": 2.10.8
      "@turbo/linux-64": 2.10.8
      "@turbo/linux-arm64": 2.10.8
      "@turbo/windows-64": 2.10.8
      "@turbo/windows-arm64": 2.10.8

  tweetnacl@0.14.5: {}

  type-check@0.4.0:
    dependencies:
      prelude-ls: 1.2.1

  type-is@2.1.0:
    dependencies:
      content-type: 2.0.0
      media-typer: 1.1.1
      mime-types: 3.0.2

  typed-array-buffer@1.0.3:
    dependencies:
      call-bound: 1.0.4
      es-errors: 1.3.0
      is-typed-array: 1.1.15

  typed-array-byte-length@1.0.3:
    dependencies:
      call-bind: 1.0.8
      for-each: 0.3.5
      gopd: 1.2.0
      has-proto: 1.2.0
      is-typed-array: 1.1.15

  typed-array-byte-offset@1.0.4:
    dependencies:
      available-typed-arrays: 1.0.7
      call-bind: 1.0.8
      for-each: 0.3.5
      gopd: 1.2.0
      has-proto: 1.2.0
      is-typed-array: 1.1.15
      reflect.getprototypeof: 1.0.10

  typed-array-length@1.0.7:
    dependencies:
      call-bind: 1.0.8
      for-each: 0.3.5
      gopd: 1.2.0
      is-typed-array: 1.1.15
      possible-typed-array-names: 1.1.0
      reflect.getprototypeof: 1.0.10

  typescript-eslint@8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3):
    dependencies:
      "@typescript-eslint/eslint-plugin": 8.50.0(@typescript-eslint/parser@8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/parser": 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/typescript-estree": 8.50.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/utils": 8.50.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  typescript-eslint@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3):
    dependencies:
      "@typescript-eslint/eslint-plugin": 8.65.0(@typescript-eslint/parser@8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3))(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/parser": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/typescript-estree": 8.65.0(supports-color@7.2.0)(typescript@5.9.3)
      "@typescript-eslint/utils": 8.65.0(eslint@9.39.1(jiti@2.7.0)(supports-color@7.2.0))(supports-color@7.2.0)(typescript@5.9.3)
      eslint: 9.39.1(jiti@2.7.0)(supports-color@7.2.0)
      typescript: 5.9.3
    transitivePeerDependencies:
      - supports-color

  typescript@5.9.3: {}

  unbox-primitive@1.1.0:
    dependencies:
      call-bound: 1.0.4
      has-bigints: 1.1.0
      has-symbols: 1.1.0
      which-boxed-primitive: 1.1.1

  undici-types@5.26.5: {}

  undici-types@7.18.2: {}

  undici@8.10.0: {}

  unpipe@1.0.0: {}

  unrs-resolver@1.12.2:
    dependencies:
      napi-postinstall: 0.3.4
    optionalDependencies:
      "@unrs/resolver-binding-android-arm-eabi": 1.12.2
      "@unrs/resolver-binding-android-arm64": 1.12.2
      "@unrs/resolver-binding-darwin-arm64": 1.12.2
      "@unrs/resolver-binding-darwin-x64": 1.12.2
      "@unrs/resolver-binding-freebsd-x64": 1.12.2
      "@unrs/resolver-binding-linux-arm-gnueabihf": 1.12.2
      "@unrs/resolver-binding-linux-arm-musleabihf": 1.12.2
      "@unrs/resolver-binding-linux-arm64-gnu": 1.12.2
      "@unrs/resolver-binding-linux-arm64-musl": 1.12.2
      "@unrs/resolver-binding-linux-loong64-gnu": 1.12.2
      "@unrs/resolver-binding-linux-loong64-musl": 1.12.2
      "@unrs/resolver-binding-linux-ppc64-gnu": 1.12.2
      "@unrs/resolver-binding-linux-riscv64-gnu": 1.12.2
      "@unrs/resolver-binding-linux-riscv64-musl": 1.12.2
      "@unrs/resolver-binding-linux-s390x-gnu": 1.12.2
      "@unrs/resolver-binding-linux-x64-gnu": 1.12.2
      "@unrs/resolver-binding-linux-x64-musl": 1.12.2
      "@unrs/resolver-binding-openharmony-arm64": 1.12.2
      "@unrs/resolver-binding-wasm32-wasi": 1.12.2
      "@unrs/resolver-binding-win32-arm64-msvc": 1.12.2
      "@unrs/resolver-binding-win32-ia32-msvc": 1.12.2
      "@unrs/resolver-binding-win32-x64-msvc": 1.12.2

  update-browserslist-db@1.2.3(browserslist@4.28.7):
    dependencies:
      browserslist: 4.28.7
      escalade: 3.2.0
      picocolors: 1.1.1

  uri-js@4.4.1:
    dependencies:
      punycode: 2.3.1

  util-deprecate@1.0.2: {}

  valibot@1.4.2(typescript@5.9.3):
    optionalDependencies:
      typescript: 5.9.3

  vary@1.1.2: {}

  vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0):
    dependencies:
      lightningcss: 1.33.0
      picomatch: 4.0.5
      postcss: 8.5.25
      rolldown: 1.2.4
      tinyglobby: 0.2.17
    optionalDependencies:
      "@types/node": 24.13.3
      esbuild: 0.28.1
      fsevents: 2.3.3
      jiti: 2.7.0
      tsx: 4.23.1
      yaml: 2.9.0

  vitest@4.1.10(@types/node@24.13.3)(jsdom@30.0.1(@noble/hashes@1.8.0))(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0)):
    dependencies:
      "@vitest/expect": 4.1.10
      "@vitest/mocker": 4.1.10(vite@8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0))
      "@vitest/pretty-format": 4.1.10
      "@vitest/runner": 4.1.10
      "@vitest/snapshot": 4.1.10
      "@vitest/spy": 4.1.10
      "@vitest/utils": 4.1.10
      es-module-lexer: 2.3.2
      expect-type: 1.4.0
      magic-string: 0.30.21
      obug: 2.1.4
      pathe: 2.0.3
      picomatch: 4.0.5
      std-env: 4.2.0
      tinybench: 2.9.0
      tinyexec: 1.3.0
      tinyglobby: 0.2.15
      tinyrainbow: 3.1.1
      vite: 8.2.1(@types/node@24.13.3)(esbuild@0.28.1)(jiti@2.7.0)(tsx@4.23.1)(yaml@2.9.0)
      why-is-node-running: 2.3.0
    optionalDependencies:
      "@types/node": 24.13.3
      jsdom: 30.0.1(@noble/hashes@1.8.0)
    transitivePeerDependencies:
      - msw

  w3c-xmlserializer@5.0.0:
    dependencies:
      xml-name-validator: 5.0.0

  webidl-conversions@8.0.1: {}

  whatwg-mimetype@5.0.0: {}

  whatwg-url@16.0.1(@noble/hashes@1.8.0):
    dependencies:
      "@exodus/bytes": 1.15.1(@noble/hashes@1.8.0)
      tr46: 6.0.0
      webidl-conversions: 8.0.1
    transitivePeerDependencies:
      - "@noble/hashes"

  whatwg-url@17.1.0(@noble/hashes@1.8.0):
    dependencies:
      "@exodus/bytes": 1.15.1(@noble/hashes@1.8.0)
      tr46: 6.0.0
      webidl-conversions: 8.0.1
    transitivePeerDependencies:
      - "@noble/hashes"

  which-boxed-primitive@1.1.1:
    dependencies:
      is-bigint: 1.1.0
      is-boolean-object: 1.2.2
      is-number-object: 1.1.1
      is-string: 1.1.1
      is-symbol: 1.1.1

  which-builtin-type@1.2.1:
    dependencies:
      call-bound: 1.0.4
      function.prototype.name: 1.1.8
      has-tostringtag: 1.0.2
      is-async-function: 2.1.1
      is-date-object: 1.1.0
      is-finalizationregistry: 1.1.1
      is-generator-function: 1.1.0
      is-regex: 1.2.1
      is-weakref: 1.1.1
      isarray: 2.0.5
      which-boxed-primitive: 1.1.1
      which-collection: 1.0.2
      which-typed-array: 1.1.19

  which-collection@1.0.2:
    dependencies:
      is-map: 2.0.3
      is-set: 2.0.3
      is-weakmap: 2.0.2
      is-weakset: 2.0.4

  which-typed-array@1.1.19:
    dependencies:
      available-typed-arrays: 1.0.7
      call-bind: 1.0.8
      call-bound: 1.0.4
      for-each: 0.3.5
      get-proto: 1.0.1
      gopd: 1.2.0
      has-tostringtag: 1.0.2

  which@2.0.2:
    dependencies:
      isexe: 2.0.0

  why-is-node-running@2.3.0:
    dependencies:
      siginfo: 2.0.0
      stackback: 0.0.2

  word-wrap@1.2.5: {}

  wrap-ansi@7.0.0:
    dependencies:
      ansi-styles: 4.3.0
      string-width: 4.2.3
      strip-ansi: 6.0.1

  wrap-ansi@8.1.0:
    dependencies:
      ansi-styles: 6.2.3
      string-width: 5.1.2
      strip-ansi: 7.2.0

  wrappy@1.0.2: {}

  xml-name-validator@5.0.0: {}

  xmlchars@2.2.0: {}

  xtend@4.0.2: {}

  y18n@5.0.8: {}

  yallist@3.1.1: {}

  yaml@2.9.0: {}

  yargs-parser@21.1.1: {}

  yargs@17.7.3:
    dependencies:
      cliui: 8.0.1
      escalade: 3.2.0
      get-caller-file: 2.0.5
      require-directory: 2.1.1
      string-width: 4.2.3
      y18n: 5.0.8
      yargs-parser: 21.1.1

  yocto-queue@0.1.0: {}

  zeptomatch@2.1.0:
    dependencies:
      grammex: 3.1.13
      graphmatch: 1.1.1

  zip-stream@6.0.1:
    dependencies:
      archiver-utils: 5.0.2
      compress-commons: 6.0.2
      readable-stream: 4.7.0

  zod-openapi@6.0.0(zod@4.4.3):
    dependencies:
      zod: 4.4.3

  zod-validation-error@4.0.2(zod@4.4.3):
    dependencies:
      zod: 4.4.3

  zod@4.4.3: {}
```

### [MODIFIED] `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
overrides:
  "ajv@^6.0.0": "6.15.0"
  "brace-expansion@^1.0.0": "1.1.18"
  "brace-expansion@^2.0.0": "2.1.4"
  "flatted@^3.0.0": "3.4.4"
  "js-yaml@^4.0.0": "4.3.1"
  "minimatch@^3.0.0": "3.1.5"
  "minimatch@^9.0.0": "9.0.9"
  "picomatch@^2.0.0": "2.3.2"
  "picomatch@^4.0.0": "4.0.5"
  "postcss@^8.0.0": "8.5.25"
allowBuilds:
  "@prisma/engines": true
  argon2: true
  cpu-features: false
  esbuild: false
  prisma: true
  protobufjs: false
  sharp: true
  ssh2: false
  unrs-resolver: true
```

### [MODIFIED] `turbo.json`

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "ui": "tui",
  "globalDependencies": [".env", ".env.*", "!.env.example"],
  "globalPassThroughEnv": ["DATABASE_URL", "NEXT_PUBLIC_API_URL"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [
        ".next/**",
        "!.next/cache/**",
        "dist/**",
        "src/generated/prisma/**"
      ]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^lint"],
      "outputs": []
    },
    "check-types": {
      "dependsOn": ["^check-types"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test:integration": {
      "dependsOn": ["^build"],
      "cache": false,
      "outputs": []
    },
    "db:generate": {
      "cache": false,
      "outputs": ["src/generated/prisma/**"]
    }
  }
}
```

### [UNTRACKED] `Caddyfile`

```
{$APP_DOMAIN} {
  encode zstd gzip

  @api path /api/*
  handle @api {
    reverse_proxy api:4000
  }

  handle {
    reverse_proxy web:3000
  }
}
```

### [UNTRACKED] `apps/api/src/app.integration.test.ts`

```typescript
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Supertest intentionally exposes response.body as any; boundary assertions validate every consumed field. */
import pino from "pino";
import request, { type Response as SupertestResponse } from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createDatabaseClient } from "@template/database";

import { createApp } from "./app.js";
import type {
  EmailDelivery,
  EmailSendRequest,
} from "./infrastructure/email/email-delivery.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("The Testcontainers DATABASE_URL was not provided.");
}

const database = createDatabaseClient(databaseUrl);
const delivered: EmailSendRequest[] = [];
let deliveryFailure: Error | undefined;
const delivery: EmailDelivery = {
  provider: "console",
  send: (message) => {
    if (deliveryFailure !== undefined) return Promise.reject(deliveryFailure);
    delivered.push(message);
    return Promise.resolve({
      providerMessageId: `test-${String(delivered.length)}`,
    });
  },
};
const app = createApp({
  database,
  logger: pino({ level: "silent" }),
  emailDelivery: delivery,
});

const registration = {
  fullName: "HTTP Integration User",
  email: "HTTP.User@Example.com",
  phone: null,
  password: "initial-secure-password",
};

const tokenFromLastEmail = (): string => {
  const html = delivered.at(-1)?.html;
  const match = html?.match(/token=([^"&<]+)/u);
  if (match?.[1] === undefined) {
    throw new Error("Expected a token in the captured email.");
  }
  return decodeURIComponent(match[1]);
};

const setCookies = (response: SupertestResponse): string[] => {
  const value: unknown = response.headers["set-cookie"];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : typeof value === "string"
      ? [value]
      : [];
};

const cookiePair = (response: SupertestResponse, name: string): string => {
  const pair = setCookies(response)
    .map((cookie) => cookie.split(";")[0] ?? "")
    .find((cookie) => cookie.startsWith(`${name}=`));
  if (pair === undefined) throw new Error(`Missing ${name} cookie.`);
  return pair;
};

const cookieValue = (pair: string): string =>
  decodeURIComponent(pair.slice(pair.indexOf("=") + 1));

const registerAndVerify = async (): Promise<void> => {
  const registered = await request(app)
    .post("/api/v1/auth/register")
    .send(registration);
  expect(registered.status).toBe(201);
  const verified = await request(app)
    .post("/api/v1/auth/verify-email")
    .query({ token: tokenFromLastEmail() })
    .send({});
  expect(verified.status).toBe(200);
};

type TestAgent = ReturnType<typeof request.agent>;
type AuthenticatedSession = Readonly<{
  response: SupertestResponse;
  accessToken: string;
  csrfToken: string;
}>;

const loginSession = async (
  agent: TestAgent,
  password = registration.password,
  rememberMe = false,
): Promise<AuthenticatedSession> => {
  const response = await agent.post("/api/v1/auth/login").send({
    email: "http.user@example.com",
    password,
    rememberMe,
  });
  expect(response.status).toBe(200);
  return {
    response,
    accessToken: response.body.data.tokens.accessToken as string,
    csrfToken: cookieValue(cookiePair(response, "csrfToken")),
  };
};

describe("real HTTP authentication boundary", () => {
  beforeEach(async () => {
    delivered.length = 0;
    deliveryFailure = undefined;
    await database.refreshToken.deleteMany();
    await database.user.deleteMany();
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("allows credentialed CORS preflight headers and rejects unknown origins", async () => {
    const preflight = await request(app)
      .options("/api/v1/auth/login")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST")
      .set(
        "Access-Control-Request-Headers",
        "authorization, content-type, x-csrf-token",
      );

    expect(preflight.status).toBe(204);
    expect(preflight.headers["access-control-allow-origin"]).toBe(
      "http://localhost:3000",
    );
    expect(preflight.headers["access-control-allow-credentials"]).toBe("true");
    const allowedHeaders = (
      preflight.headers["access-control-allow-headers"] ?? ""
    )
      .toLowerCase()
      .split(",")
      .map((header) => header.trim());
    expect(allowedHeaders).toEqual(
      expect.arrayContaining(["authorization", "content-type", "x-csrf-token"]),
    );

    const rejectedOrigin = await request(app)
      .get("/api/v1/health/live")
      .set("Origin", "https://unapproved.example");
    expect(rejectedOrigin.status).toBe(403);
    expect(
      rejectedOrigin.headers["access-control-allow-origin"],
    ).toBeUndefined();
  });

  it("returns target-prefixed request validation errors", async () => {
    const invalid = await request(app)
      .post("/api/v1/auth/register")
      .send({ ...registration, email: "invalid" });

    expect(invalid.status).toBe(400);
    expect(invalid.body).toMatchObject({
      success: false,
      code: "VALIDATION_ERROR",
      errors: [expect.objectContaining({ field: "body.email" })],
    });
    expect(invalid.body).not.toHaveProperty("data");
    expect(invalid.body.requestId).toBe(invalid.headers["x-request-id"]);
  });

  it("registers, captures verification delivery, and activates the account", async () => {
    const registered = await request(app)
      .post("/api/v1/auth/register")
      .send(registration);

    expect(registered.status).toBe(201);
    expect(registered.body.data.user).toMatchObject({
      email: "http.user@example.com",
      status: "PENDING_VERIFICATION",
    });
    expect(registered.body.data.user).not.toHaveProperty("passwordHash");
    expect(delivered).toHaveLength(1);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: registration.email,
        password: registration.password,
        rememberMe: false,
      })
      .expect(400);

    const verified = await request(app)
      .post("/api/v1/auth/verify-email")
      .query({ token: tokenFromLastEmail() })
      .send({});
    expect(verified.status).toBe(200);
    expect(verified.body.data.user).toMatchObject({ status: "ACTIVE" });
  });

  it("returns a safe 503 and rolls back registration when email delivery is unavailable", async () => {
    const providerDetail = "provider failure containing re_secret_fixture";
    deliveryFailure = new Error(providerDetail);

    const failed = await request(app)
      .post("/api/v1/auth/register")
      .send(registration);

    expect(failed.status).toBe(503);
    expect(failed.body).toMatchObject({
      success: false,
      code: "SERVICE_UNAVAILABLE",
      message: "Registration is temporarily unavailable. Please try again.",
    });
    expect(JSON.stringify(failed.body)).not.toContain(providerDetail);
    await expect(database.user.count()).resolves.toBe(0);
  });

  it("protects current-user reads and profile writes with bearer and CSRF", async () => {
    await registerAndVerify();
    const agent = request.agent(app);
    const session = await loginSession(agent, registration.password, true);

    expect(session.response.body.data.tokens).toEqual({
      accessToken: expect.any(String),
    });
    expect(JSON.stringify(session.response.body)).not.toContain("refreshToken");
    expect(
      setCookies(session.response).find((cookie) =>
        cookie.startsWith("refreshToken="),
      ),
    ).toContain("HttpOnly");
    expect(
      setCookies(session.response).find((cookie) =>
        cookie.startsWith("csrfToken="),
      ),
    ).not.toContain("HttpOnly");

    const me = await agent
      .get("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("http.user@example.com");

    await agent
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .send({ fullName: "Updated User" })
      .expect(403);
    await agent
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("x-csrf-token", "mismatch")
      .send({ fullName: "Updated User" })
      .expect(403);
    const updated = await agent
      .patch("/api/v1/users/me")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("x-csrf-token", session.csrfToken)
      .send({ fullName: "Updated User", phone: "+1 555 0100" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.user.fullName).toBe("Updated User");
  });

  it("rotates refresh tokens once and rejects replay or a missing cookie", async () => {
    await registerAndVerify();
    const agent = request.agent(app);
    const session = await loginSession(agent, registration.password, true);
    const oldRefreshCookie = cookiePair(session.response, "refreshToken");
    const oldCsrfCookie = cookiePair(session.response, "csrfToken");

    const refreshed = await agent
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", session.csrfToken)
      .send({});
    expect(refreshed.status).toBe(200);
    const replay = await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${oldRefreshCookie}; ${oldCsrfCookie}`)
      .set("x-csrf-token", cookieValue(oldCsrfCookie))
      .send({});
    expect(replay.status).toBe(401);

    const missing = await request(app).post("/api/v1/auth/refresh").send({});
    expect(missing.status).toBe(400);
    expect(missing.body.code).toBe("BAD_REQUEST");
  });

  it("logs out only the current refresh session", async () => {
    await registerAndVerify();
    const agentA = request.agent(app);
    const agentB = request.agent(app);
    const sessionA = await loginSession(agentA);
    const sessionB = await loginSession(agentB);
    const refreshCookieA = cookiePair(sessionA.response, "refreshToken");
    const csrfCookieA = cookiePair(sessionA.response, "csrfToken");
    expect(await database.refreshToken.count()).toBe(2);

    const logout = await agentA
      .post("/api/v1/auth/logout")
      .set("Authorization", `Bearer ${sessionA.accessToken}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({});
    expect(logout.status).toBe(200);
    expect(await database.refreshToken.count()).toBe(1);
    await request(app)
      .post("/api/v1/auth/refresh")
      .set("Cookie", `${refreshCookieA}; ${csrfCookieA}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({})
      .expect(401);
    await agentB
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", sessionB.csrfToken)
      .send({})
      .expect(200);
  });

  it("logs out every refresh session", async () => {
    await registerAndVerify();
    const agentA = request.agent(app);
    const agentB = request.agent(app);
    const sessionA = await loginSession(agentA);
    const sessionB = await loginSession(agentB);
    expect(await database.refreshToken.count()).toBe(2);

    const logoutAll = await agentA
      .post("/api/v1/auth/logout-all")
      .set("Authorization", `Bearer ${sessionA.accessToken}`)
      .set("x-csrf-token", sessionA.csrfToken)
      .send({});
    expect(logoutAll.status).toBe(200);
    expect(await database.refreshToken.count()).toBe(0);
    await agentB
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", sessionB.csrfToken)
      .send({})
      .expect(401);
  });

  it("changes a password and revokes every refresh session", async () => {
    await registerAndVerify();
    const agent = request.agent(app);
    const session = await loginSession(agent);

    const changed = await agent
      .patch("/api/v1/auth/change-password")
      .set("Authorization", `Bearer ${session.accessToken}`)
      .set("x-csrf-token", session.csrfToken)
      .send({
        currentPassword: registration.password,
        newPassword: "changed-secure-password",
        passwordConfirmation: "changed-secure-password",
      });
    expect(changed.status).toBe(200);
    expect(await database.refreshToken.count()).toBe(0);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "http.user@example.com",
        password: registration.password,
        rememberMe: false,
      })
      .expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "http.user@example.com",
        password: "changed-secure-password",
        rememberMe: false,
      })
      .expect(200);
  });

  it("keeps recovery neutral, consumes reset once, and revokes sessions", async () => {
    await registerAndVerify();
    const recoverySession = request.agent(app);
    const session = await loginSession(recoverySession);
    const beforeUnknownEmailCount = delivered.length;

    const unknownRecovery = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "unknown@example.com" });
    const knownRecovery = await request(app)
      .post("/api/v1/auth/forgot-password")
      .send({ email: "http.user@example.com" });
    expect(unknownRecovery.body.data).toEqual(knownRecovery.body.data);
    expect(delivered).toHaveLength(beforeUnknownEmailCount + 1);

    const resetToken = tokenFromLastEmail();
    await request(app)
      .get("/api/v1/auth/validate-reset-token")
      .query({ token: resetToken })
      .expect(200);
    await request(app)
      .post("/api/v1/auth/reset-password")
      .query({ token: resetToken })
      .send({
        newPassword: "reset-secure-password",
        passwordConfirmation: "reset-secure-password",
      })
      .expect(200);
    await request(app)
      .get("/api/v1/auth/validate-reset-token")
      .query({ token: resetToken })
      .expect(401);
    await recoverySession
      .post("/api/v1/auth/refresh")
      .set("x-csrf-token", session.csrfToken)
      .send({})
      .expect(401);
    await request(app)
      .post("/api/v1/auth/login")
      .send({
        email: "http.user@example.com",
        password: "reset-secure-password",
        rememberMe: false,
      })
      .expect(200);
  });
});
```

### [UNTRACKED] `apps/api/src/core/config/auth-rate-limit.config.ts`

```typescript
import { getEnvVarAsInteger } from "./env.js";

export type AuthRouteLimit = Readonly<{
  name: string;
  max: number;
  windowMs: number;
}>;

const oneHourMs = 60 * 60 * 1_000;
const fifteenMinutesMs = 15 * 60 * 1_000;

const limit = (
  name: string,
  environmentKey: string,
  fallback: number,
  windowMs: number,
  maximum = 1_000,
): AuthRouteLimit => ({
  name,
  max: getEnvVarAsInteger(environmentKey, fallback, 1, maximum),
  windowMs,
});

export const authRouteLimits = Object.freeze({
  registerSource: limit(
    "REGISTER_SOURCE",
    "AUTH_LIMIT_REGISTER_PER_HOUR",
    5,
    oneHourMs,
  ),
  verifySource: limit(
    "VERIFY_SOURCE",
    "AUTH_LIMIT_VERIFY_PER_15_MIN",
    20,
    fifteenMinutesMs,
  ),
  verifyToken: limit(
    "VERIFY_TOKEN",
    "AUTH_LIMIT_VERIFY_TOKEN_MAX_ATTEMPTS",
    5,
    fifteenMinutesMs,
    10,
  ),
  resendSource: limit(
    "RESEND_SOURCE",
    "AUTH_LIMIT_RESEND_PER_HOUR_SOURCE",
    20,
    oneHourMs,
  ),
  resendAccount: limit(
    "RESEND_ACCOUNT",
    "AUTH_LIMIT_RESEND_PER_HOUR_ACCOUNT",
    5,
    oneHourMs,
  ),
  loginSource: limit(
    "LOGIN_SOURCE",
    "AUTH_LIMIT_LOGIN_PER_15_MIN",
    20,
    fifteenMinutesMs,
  ),
  loginAccountSource: limit(
    "LOGIN_ACCOUNT_SOURCE",
    "AUTH_LIMIT_LOGIN_PER_15_MIN_ACCOUNT",
    5,
    fifteenMinutesMs,
    100,
  ),
  refreshFamilySource: limit(
    "REFRESH_FAMILY_SOURCE",
    "AUTH_LIMIT_REFRESH_PER_15_MIN",
    60,
    fifteenMinutesMs,
  ),
  forgotSource: limit(
    "FORGOT_SOURCE",
    "AUTH_LIMIT_FORGOT_PER_HOUR_SOURCE",
    20,
    oneHourMs,
  ),
  forgotAccount: limit(
    "FORGOT_ACCOUNT",
    "AUTH_LIMIT_FORGOT_PER_HOUR_ACCOUNT",
    5,
    oneHourMs,
  ),
  resetSource: limit(
    "RESET_SOURCE",
    "AUTH_LIMIT_RESET_PER_15_MIN",
    20,
    fifteenMinutesMs,
  ),
  resetToken: limit(
    "RESET_TOKEN",
    "AUTH_LIMIT_RESET_TOKEN_MAX_ATTEMPTS",
    5,
    fifteenMinutesMs,
    10,
  ),
  passwordChangeUser: limit(
    "PASSWORD_CHANGE_USER",
    "AUTH_LIMIT_PASSWORD_CHANGE_PER_15_MIN",
    5,
    fifteenMinutesMs,
  ),
  logoutSession: limit(
    "LOGOUT_SESSION",
    "AUTH_LIMIT_LOGOUT_PER_15_MIN",
    30,
    fifteenMinutesMs,
  ),
  logoutAllUser: limit(
    "LOGOUT_ALL_USER",
    "AUTH_LIMIT_LOGOUT_ALL_PER_15_MIN",
    5,
    fifteenMinutesMs,
  ),
});
```

### [UNTRACKED] `apps/api/src/core/config/auth.config.ts`

```typescript
import { getEnvVarAsInteger, getEnvVariable } from "./env.js";

const nodeEnv = getEnvVariable("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

const readSecret = (key: string, fallback?: string): string => {
  const value = getEnvVariable(key, fallback);
  if (value.length < 32) {
    throw new Error(
      `Environment variable ${key} must contain at least 32 characters.`,
    );
  }
  return value;
};

const accessSecret = readSecret("AUTH_JWT_SECRET");
export const authConfig = Object.freeze({
  nodeEnv,
  isProduction,
  issuer: getEnvVariable("AUTH_JWT_ISSUER", "full-stack-boilerplate"),
  audience: getEnvVariable("AUTH_JWT_AUDIENCE", "full-stack-boilerplate-web"),
  clockToleranceSeconds: getEnvVarAsInteger(
    "AUTH_JWT_CLOCK_TOLERANCE_SECONDS",
    5,
    0,
    60,
  ),
  accessTokenTtlSeconds: getEnvVarAsInteger(
    "AUTH_ACCESS_TOKEN_TTL_SECONDS",
    15 * 60,
    60,
    86_400,
  ),
  refreshFamilyTtlSeconds: getEnvVarAsInteger(
    "AUTH_REFRESH_FAMILY_TTL_SECONDS",
    24 * 60 * 60,
    3_600,
    60 * 60 * 24 * 90,
  ),
  refreshRememberedTtlSeconds: getEnvVarAsInteger(
    "AUTH_REFRESH_REMEMBERED_TTL_SECONDS",
    30 * 24 * 60 * 60,
    3_600,
    60 * 60 * 24 * 180,
  ),
  verifyTokenTtlSeconds: getEnvVarAsInteger(
    "AUTH_VERIFY_TOKEN_TTL_SECONDS",
    24 * 60 * 60,
    60,
    60 * 60 * 24 * 7,
  ),
  resetTokenTtlSeconds: getEnvVarAsInteger(
    "AUTH_RESET_TOKEN_TTL_SECONDS",
    30 * 60,
    60,
    3_600,
  ),
  verifyResendCooldownSeconds: getEnvVarAsInteger(
    "AUTH_VERIFY_RESEND_COOLDOWN_SECONDS",
    60,
    1,
    3_600,
  ),
  argon2: Object.freeze({
    memoryKib: getEnvVarAsInteger(
      "AUTH_ARGON2_MEMORY_KIB",
      19_456,
      1_944,
      1_048_576,
    ),
    timeCost: getEnvVarAsInteger("AUTH_ARGON2_TIME_COST", 2, 1, 10),
    parallelism: getEnvVarAsInteger("AUTH_ARGON2_PARALLELISM", 1, 1, 16),
  }),
});

export const jwtConfig = Object.freeze({
  accessSecret,
  refreshSecret: readSecret("AUTH_REFRESH_JWT_SECRET", accessSecret),
  verificationSecret: readSecret("AUTH_VERIFICATION_JWT_SECRET", accessSecret),
  resetSecret: readSecret("AUTH_RESET_JWT_SECRET", accessSecret),
});
```

### [UNTRACKED] `apps/api/src/core/config/cookie.config.ts`

```typescript
import { appConfig } from "./app.config.js";
import { authConfig } from "./auth.config.js";
import { getEnvVariable } from "./env.js";

type SameSitePolicy = "lax" | "none";
const rawSameSite = getEnvVariable("AUTH_COOKIE_SAME_SITE", "lax");

if (rawSameSite !== "lax" && rawSameSite !== "none") {
  throw new Error("AUTH_COOKIE_SAME_SITE must be 'lax' or 'none'.");
}
if (appConfig.isProduction && rawSameSite === "none") {
  throw new Error(
    "AUTH_COOKIE_SAME_SITE=none requires an explicit deployment-specific exception.",
  );
}

export const cookieConfig = Object.freeze({
  refreshPath: `${appConfig.apiPrefix}/auth`,
  csrfPath: "/",
  refreshName: "refreshToken",
  csrfName: "csrfToken",
  refreshMaxAgeSeconds: authConfig.refreshRememberedTtlSeconds,
  sameSite: rawSameSite satisfies SameSitePolicy,
  secure: appConfig.isProduction,
});

export type CookieConfig = typeof cookieConfig;
```

### [UNTRACKED] `apps/api/src/core/config/csrf.config.ts`

```typescript
import { cookieConfig } from "./cookie.config.js";

export const csrfConfig = Object.freeze({
  headerName: "x-csrf-token",
  cookieName: cookieConfig.csrfName,
});
```

### [UNTRACKED] `apps/api/src/core/config/email.config.ts`

```typescript
import {
  getEnvVarAsBoolean,
  getEnvVarAsInteger,
  getEnvVariable,
} from "./env.js";
import { appConfig } from "./app.config.js";

export type EmailProvider = "console" | "resend" | "smtp";
export type SmtpTlsMinVersion = "TLSv1" | "TLSv1.2" | "TLSv1.3";

const emailAddressPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const parseEmailProvider = (value: string): EmailProvider => {
  if (value === "console" || value === "resend" || value === "smtp") {
    return value;
  }
  throw new Error("EMAIL_PROVIDER must be console, resend, or smtp.");
};

export const parseSmtpTlsMinVersion = (value: string): SmtpTlsMinVersion => {
  if (value === "TLSv1" || value === "TLSv1.2" || value === "TLSv1.3") {
    return value;
  }
  throw new Error("SMTP_TLS_MIN_VERSION must be TLSv1, TLSv1.2, or TLSv1.3.");
};

const webUrl = new URL(getEnvVariable("WEB_APP_URL", "http://localhost:3000"));
if (webUrl.protocol !== "http:" && webUrl.protocol !== "https:") {
  throw new Error("WEB_APP_URL must use http or https.");
}
if (appConfig.isProduction && webUrl.protocol !== "https:") {
  throw new Error("WEB_APP_URL must use https in production.");
}

const provider = parseEmailProvider(
  getEnvVariable(
    "EMAIL_PROVIDER",
    appConfig.isProduction ? "resend" : "console",
  ),
);
const fromAddress = getEnvVariable("MAIL_FROM_ADDRESS", "no-reply@example.com");
const resendApiKey = getEnvVariable("RESEND_API_KEY", "");
const smtpHost = getEnvVariable("SMTP_HOST", "");
const smtpUser = getEnvVariable("SMTP_USER", "");
const smtpPassword = getEnvVariable("SMTP_PASSWORD", "");

if (!emailAddressPattern.test(fromAddress)) {
  throw new Error("MAIL_FROM_ADDRESS must be a valid email address.");
}
if (appConfig.isProduction && provider === "console") {
  throw new Error("EMAIL_PROVIDER=console is not allowed in production.");
}
if (
  provider === "resend" &&
  (resendApiKey.length < 10 ||
    /^(?:change[-_ ]?me|placeholder|your[-_ ]|re_(?:test|example))/iu.test(
      resendApiKey,
    ))
) {
  throw new Error(
    "RESEND_API_KEY must be a non-placeholder key when Resend is selected.",
  );
}
if (
  appConfig.isProduction &&
  provider === "smtp" &&
  (smtpHost === "" || smtpUser === "" || smtpPassword === "")
) {
  throw new Error(
    "SMTP_HOST, SMTP_USER, and SMTP_PASSWORD are required for production SMTP.",
  );
}

export const emailConfig = Object.freeze({
  provider,
  publicWebUrl: webUrl.toString().replace(/\/+$/, ""),
  resendApiKey,
  fromName: getEnvVariable("MAIL_FROM_NAME", "Full-Stack Boilerplate"),
  fromAddress,
  replyTo: getEnvVariable("MAIL_REPLY_TO", ""),
  smtpHost: smtpHost || "localhost",
  smtpPort: getEnvVarAsInteger("SMTP_PORT", 587, 1, 65_535),
  smtpSecure: getEnvVarAsBoolean("SMTP_SECURE", false),
  smtpUser,
  smtpPassword,
  allowSelfSignedTls: getEnvVarAsBoolean("SMTP_ALLOW_SELF_SIGNED_TLS", false),
  connectionTimeoutMs: getEnvVarAsInteger(
    "SMTP_CONNECTION_TIMEOUT_MS",
    10_000,
    1_000,
    120_000,
  ),
  greetingTimeoutMs: getEnvVarAsInteger(
    "SMTP_GREETING_TIMEOUT_MS",
    10_000,
    1_000,
    120_000,
  ),
  socketTimeoutMs: getEnvVarAsInteger(
    "SMTP_SOCKET_TIMEOUT_MS",
    15_000,
    1_000,
    120_000,
  ),
  tlsMinVersion: parseSmtpTlsMinVersion(
    getEnvVariable("SMTP_TLS_MIN_VERSION", "TLSv1.2"),
  ),
});
```

### [UNTRACKED] `apps/api/src/core/config/mailer.config.ts`

```typescript
import nodemailer, { type Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

import { emailConfig } from "./email.config.js";

export type SmtpTransporter = Transporter<SMTPTransport.SentMessageInfo>;

let transporter: SmtpTransporter | undefined;

export const getSmtpTransporter = (): SmtpTransporter => {
  transporter ??= nodemailer.createTransport({
    host: emailConfig.smtpHost,
    port: emailConfig.smtpPort,
    secure: emailConfig.smtpSecure,
    ...(emailConfig.smtpUser !== "" && emailConfig.smtpPassword !== ""
      ? {
          auth: {
            user: emailConfig.smtpUser,
            pass: emailConfig.smtpPassword,
          },
        }
      : {}),
    tls: {
      rejectUnauthorized: !emailConfig.allowSelfSignedTls,
      minVersion: emailConfig.tlsMinVersion,
    },
    connectionTimeout: emailConfig.connectionTimeoutMs,
    greetingTimeout: emailConfig.greetingTimeoutMs,
    socketTimeout: emailConfig.socketTimeoutMs,
  });

  return transporter;
};
```

### [UNTRACKED] `apps/api/src/core/config/resend.config.ts`

```typescript
import {
  Resend,
  type CreateEmailOptions,
  type CreateEmailRequestOptions,
  type CreateEmailResponse,
} from "resend";

import { emailConfig } from "./email.config.js";

export interface ResendEmailClient {
  send(
    payload: CreateEmailOptions,
    options?: CreateEmailRequestOptions,
  ): Promise<CreateEmailResponse>;
}

let client: ResendEmailClient | undefined;

export const getResendEmailClient = (): ResendEmailClient => {
  if (client !== undefined) return client;

  const resend = new Resend(emailConfig.resendApiKey);
  client = {
    send: (payload, options) => resend.emails.send(payload, options),
  };
  return client;
};
```

### [UNTRACKED] `apps/api/src/core/date-only.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  isDateOnlyString,
  parseDateOnly,
  serializeDateOnly,
  serializeNullableDateOnly,
} from "./date-only.js";

describe("date-only values", () => {
  it("validates real YYYY-MM-DD calendar dates", () => {
    expect(isDateOnlyString("2024-02-29")).toBe(true);
    expect(isDateOnlyString("2026-02-29")).toBe(false);
    expect(isDateOnlyString("2026-2-09")).toBe(false);
  });
  it("round-trips in UTC without timezone shifts", () => {
    const date = parseDateOnly("2026-08-18");
    expect(serializeDateOnly(date)).toBe("2026-08-18");
    expect(serializeNullableDateOnly(date)).toBe("2026-08-18");
    expect(serializeNullableDateOnly(null)).toBeNull();
  });
  it("rejects impossible dates and invalid Date values", () => {
    expect(() => parseDateOnly("2026-02-30")).toThrow();
    expect(() => serializeDateOnly(new Date(Number.NaN))).toThrow();
  });
});
```

### [UNTRACKED] `apps/api/src/core/date-only.ts`

```typescript
import { BadRequestException } from "./errors/bad-request.error.js";

export type DateOnlyString = `${number}-${number}-${number}`;
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u;

export const isDateOnlyString = (value: string): value is DateOnlyString => {
  const match = DATE_ONLY_PATTERN.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const parseDateOnly = (value: string): Date => {
  if (!isDateOnlyString(value)) {
    throw new BadRequestException(
      "Date must be a real YYYY-MM-DD calendar date.",
    );
  }
  const match = DATE_ONLY_PATTERN.exec(value);
  if (match === null) {
    throw new BadRequestException("Date must use YYYY-MM-DD format.");
  }
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );
};

export const serializeDateOnly = (value: Date): DateOnlyString => {
  const serialized = [
    value.getUTCFullYear().toString().padStart(4, "0"),
    (value.getUTCMonth() + 1).toString().padStart(2, "0"),
    value.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
  if (!isDateOnlyString(serialized)) {
    throw new BadRequestException("Unable to serialize an invalid date.");
  }
  return serialized;
};

export const serializeNullableDateOnly = (
  value: Date | null,
): DateOnlyString | null => (value === null ? null : serializeDateOnly(value));
```

### [UNTRACKED] `apps/api/src/core/pagination/index.ts`

```typescript
export {
  paginationQueryFields,
  parsePaginationQuery,
} from "./pagination.dto.js";
export {
  buildPaginationMeta,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  MAX_LIMIT,
  parsePagination,
  PaginationValidationError,
} from "./pagination.js";
export type {
  PaginationInput,
  PaginationQuery,
  PaginationValue,
} from "./pagination.js";
```

### [UNTRACKED] `apps/api/src/core/pagination/pagination.dto.ts`

```typescript
import { z } from "zod";

import { parsePagination, type PaginationQuery } from "./pagination.js";

const paginationValueSchema = z.union([z.string(), z.number()]).optional();

export const paginationQueryFields = {
  page: paginationValueSchema,
  limit: paginationValueSchema,
} as const;

export type PaginationQueryInput = z.infer<typeof paginationValueSchema>;
export interface PaginationQueryFields {
  readonly page?: PaginationQueryInput;
  readonly limit?: PaginationQueryInput;
}

export const parsePaginationQuery = (
  input: PaginationQueryFields,
): PaginationQuery =>
  parsePagination({
    page: Object.hasOwn(input, "page")
      ? { kind: "value", value: input.page }
      : { kind: "missing" },
    limit: Object.hasOwn(input, "limit")
      ? { kind: "value", value: input.limit }
      : { kind: "missing" },
  });
```

### [UNTRACKED] `apps/api/src/core/pagination/pagination.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { parsePaginationQuery } from "./pagination.dto.js";
import { buildPaginationMeta, parsePagination } from "./pagination.js";

describe("pagination", () => {
  it("uses defaults and parses decimal digit values", () => {
    expect(parsePaginationQuery({})).toEqual({
      page: 1,
      limit: 25,
      skip: 0,
      take: 25,
    });
    expect(parsePaginationQuery({ page: "2", limit: "10" })).toEqual({
      page: 2,
      limit: 10,
      skip: 10,
      take: 10,
    });
  });

  it.each(["1e2", "0x10", "1.5", "-1", "abc"])(
    "rejects alternate numeric syntax %s",
    (page) => {
      expect(() => parsePaginationQuery({ page })).toThrow();
    },
  );

  it("rejects zero, excessive limits, and unsafe integers", () => {
    expect(() => parsePaginationQuery({ page: "0" })).toThrow();
    expect(() => parsePaginationQuery({ limit: "101" })).toThrow();
    expect(() =>
      parsePagination({
        page: { kind: "value", value: Number.MAX_SAFE_INTEGER },
        limit: { kind: "value", value: 100 },
      }),
    ).toThrow(/safe integer/iu);
  });

  it("calculates validated metadata", () => {
    expect(buildPaginationMeta({ page: 2, limit: 25, total: 63 })).toEqual({
      page: 2,
      limit: 25,
      total: 63,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });
});
```

### [UNTRACKED] `apps/api/src/core/pagination/pagination.ts`

```typescript
import type { PaginationMeta } from "@template/contracts";

import { BadRequestException } from "../errors/bad-request.error.js";

export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;

export type PaginationValue =
  Readonly<{ kind: "missing" }> | Readonly<{ kind: "value"; value: unknown }>;

export interface PaginationInput {
  readonly page: PaginationValue;
  readonly limit: PaginationValue;
}

export interface PaginationQuery {
  readonly page: number;
  readonly limit: number;
  readonly skip: number;
  readonly take: number;
}

type ParsedValue =
  Readonly<{ kind: "default" }> | Readonly<{ kind: "parsed"; value: number }>;

export class PaginationValidationError extends BadRequestException {
  constructor(message: string) {
    super(message);
    this.name = "PaginationValidationError";
  }
}

const parseDecimalDigits = (
  input: PaginationValue,
  field: string,
): ParsedValue => {
  if (input.kind === "missing") return { kind: "default" };
  if (typeof input.value === "number") {
    if (!Number.isSafeInteger(input.value) || input.value < 0) {
      throw new PaginationValidationError(
        `${field} must be a non-negative safe integer`,
      );
    }
    return { kind: "parsed", value: input.value };
  }
  if (typeof input.value !== "string" || input.value.trim().length === 0) {
    return { kind: "default" };
  }
  const value = input.value.trim();
  if (!/^\d+$/u.test(value)) {
    throw new PaginationValidationError(
      `${field} must contain decimal digits only`,
    );
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    throw new PaginationValidationError(
      `${field} must fit in a safe integer range`,
    );
  }
  return { kind: "parsed", value: parsed };
};

const resolve = (value: ParsedValue, fallback: number): number =>
  value.kind === "parsed" ? value.value : fallback;

export const parsePagination = (input: PaginationInput): PaginationQuery => {
  const page = resolve(parseDecimalDigits(input.page, "page"), DEFAULT_PAGE);
  const limit = resolve(
    parseDecimalDigits(input.limit, "limit"),
    DEFAULT_LIMIT,
  );
  if (page < 1) {
    throw new PaginationValidationError("page must be 1 or greater");
  }
  if (limit < 1) {
    throw new PaginationValidationError("limit must be 1 or greater");
  }
  if (limit > MAX_LIMIT) {
    throw new PaginationValidationError(
      `limit must not exceed ${String(MAX_LIMIT)}`,
    );
  }
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    throw new PaginationValidationError(
      "page * limit must fit in a safe integer range",
    );
  }
  return { page, limit, skip, take: limit };
};

export const buildPaginationMeta = ({
  page,
  limit,
  total: rawTotal,
}: Readonly<{
  page: number;
  limit: number;
  total: number;
}>): PaginationMeta => {
  const total = Math.max(0, Math.floor(rawTotal));
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
```

### [UNTRACKED] `apps/api/src/core/serialization/decimal.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  assertNoPrismaDecimal,
  isPrismaDecimal,
  serializeDecimalsDeep,
  serializeDecimalToString,
} from "./decimal.js";

class FakeDecimal {
  constructor(private readonly raw: string) {}
  toString(): string {
    return this.raw;
  }
}
class OtherClass {
  readonly value = 1;
}

describe("generic Decimal serialization", () => {
  it("serializes canonically without money rounding", () => {
    expect(serializeDecimalToString(new FakeDecimal("1.00500"))).toBe("1.005");
    expect(serializeDecimalToString("-0.000")).toBe("0");
  });
  it("walks arrays and plain objects while preserving nullish/primitives/Date", () => {
    const date = new Date("2026-08-18T00:00:00.000Z");
    expect(
      serializeDecimalsDeep({
        amount: new FakeDecimal("10.500"),
        nested: [null, undefined, 1, "x", date],
      }),
    ).toEqual({
      amount: "10.5",
      nested: [null, undefined, 1, "x", date],
    });
  });
  it("does not turn unrelated class instances into empty objects", () => {
    const instance = new OtherClass();
    expect(serializeDecimalsDeep(instance)).toBe(instance);
  });
  it("detects and rejects leaked Decimal values", () => {
    expect(isPrismaDecimal(new FakeDecimal("1.2"))).toBe(true);
    expect(isPrismaDecimal("1.2")).toBe(false);
    expect(() => {
      assertNoPrismaDecimal({ values: [new FakeDecimal("1.2")] });
    }).toThrow(/values\[0\]/u);
    expect(() => {
      assertNoPrismaDecimal({ value: null });
    }).not.toThrow();
  });
});
```

### [UNTRACKED] `apps/api/src/core/serialization/decimal.ts`

```typescript
export class DecimalSerializationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DecimalSerializationError";
  }
}

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/u;

const isObject = (value: unknown): value is object =>
  value !== null && typeof value === "object";

const readDecimalString = (value: unknown): string | null => {
  if (!isObject(value) || value instanceof Date || Array.isArray(value)) {
    return null;
  }
  const stringify: unknown = Reflect.get(value, "toString") as unknown;
  if (typeof stringify !== "function") return null;
  try {
    const result: unknown = Reflect.apply(
      stringify as (this: object) => unknown,
      value,
      [],
    );
    return typeof result === "string" && DECIMAL_PATTERN.test(result)
      ? result
      : null;
  } catch {
    return null;
  }
};

const canonicalDecimal = (raw: string): string => {
  if (!DECIMAL_PATTERN.test(raw)) {
    throw new DecimalSerializationError("Invalid Decimal string.");
  }
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer = "0", fraction] = unsigned.split(".");
  const trimmedFraction = fraction?.replace(/0+$/u, "") ?? "";
  const zero = /^0+$/u.test(integer) && trimmedFraction.length === 0;
  return `${negative && !zero ? "-" : ""}${integer}${
    trimmedFraction.length === 0 ? "" : `.${trimmedFraction}`
  }`;
};

export const isPrismaDecimal = (value: unknown): boolean =>
  readDecimalString(value) !== null;

export const serializeDecimalToString = (value: unknown): string => {
  const raw =
    typeof value === "string" && DECIMAL_PATTERN.test(value)
      ? value
      : readDecimalString(value);
  if (raw === null) {
    throw new DecimalSerializationError(
      "Cannot serialize a non-Decimal value.",
    );
  }
  return canonicalDecimal(raw);
};

const isPlainObject = (value: object): value is Record<string, unknown> => {
  const prototype = Object.getPrototypeOf(value) as unknown;
  return prototype === Object.prototype || prototype === null;
};

export const serializeDecimalsDeep = (value: unknown): unknown => {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeDecimalsDeep);
  if (isPrismaDecimal(value)) return serializeDecimalToString(value);
  if (value instanceof Date) return value;
  if (isObject(value) && isPlainObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        serializeDecimalsDeep(item),
      ]),
    );
  }
  return value;
};

export const assertNoPrismaDecimal = (value: unknown, path = "value"): void => {
  if (value === null || value === undefined) return;
  if (isPrismaDecimal(value)) {
    throw new DecimalSerializationError(
      `Prisma Decimal leaked into response at ${path}.`,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      assertNoPrismaDecimal(item, `${path}[${String(index)}]`);
    });
    return;
  }
  if (isObject(value) && isPlainObject(value)) {
    for (const [key, item] of Object.entries(value)) {
      assertNoPrismaDecimal(item, `${path}.${key}`);
    }
  }
};
```

### [UNTRACKED] `apps/api/src/core/serialization/index.ts`

```typescript
export {
  assertNoPrismaDecimal,
  DecimalSerializationError,
  isPrismaDecimal,
  serializeDecimalsDeep,
  serializeDecimalToString,
} from "./decimal.js";
```

### [UNTRACKED] `apps/api/src/infrastructure/database/index.ts`

```typescript
export { mapPrismaError } from "./prisma-error.mapper.js";
```

### [UNTRACKED] `apps/api/src/infrastructure/database/prisma-error.mapper.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { AppError } from "../../core/errors/app.error.js";
import {
  isAllowlistedPrismaCode,
  mapPrismaError,
} from "./prisma-error.mapper.js";

const prismaError = (values: Record<string, unknown>): unknown => ({
  name: "PrismaClientKnownRequestError",
  ...values,
});

describe("mapPrismaError", () => {
  it("passes AppError through", () => {
    const error = new AppError("custom", 418, "CUSTOM", true);
    expect(mapPrismaError(error)).toBe(error);
  });

  it.each([
    ["P2002", 409],
    ["P2003", 409],
    ["P2014", 409],
    ["P2025", 404],
    ["P2034", 409],
    ["P1001", 503],
    ["P1017", 503],
  ])("maps %s to %s", (code, statusCode) => {
    expect(mapPrismaError(prismaError({ code })).statusCode).toBe(statusCode);
  });

  it.each([
    "ck_users_email_normalized",
    "ck_users_status_timestamps_consistent",
  ])("maps approved check %s to 400", (constraint) => {
    expect(
      mapPrismaError(
        prismaError({ code: "P2004", meta: { database_error: constraint } }),
      ).statusCode,
    ).toBe(400);
  });

  it("rejects unapproved check names and never leaks provider details", () => {
    const mapped = mapPrismaError(
      prismaError({
        code: "P2004",
        message: "postgresql://secret@database/internal",
        meta: {
          constraint: "ck_business_specific",
          sql: "SELECT provider_secret",
        },
      }),
    );
    expect(mapped.statusCode).toBe(500);
    expect(mapped.message).not.toMatch(/secret|SELECT|postgresql/iu);
  });

  it("maps unknown and non-object failures to a safe 500", () => {
    expect(mapPrismaError(prismaError({ code: "P9999" })).statusCode).toBe(500);
    expect(mapPrismaError("raw database error").statusCode).toBe(500);
  });
});

describe("isAllowlistedPrismaCode", () => {
  it("accepts mapped codes and rejects unknown values", () => {
    expect(isAllowlistedPrismaCode("P2002")).toBe(true);
    expect(isAllowlistedPrismaCode("P2004")).toBe(true);
    expect(isAllowlistedPrismaCode("P9999")).toBe(false);
    expect(isAllowlistedPrismaCode({ code: "P2002" })).toBe(false);
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/database/prisma-error.mapper.ts`

```typescript
import { AppError } from "../../core/errors/app.error.js";
import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ConflictException } from "../../core/errors/conflict.error.js";
import { InternalServerError } from "../../core/errors/internal-server.error.js";
import { NotFoundException } from "../../core/errors/not-found.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";

const connectivityCodes = new Set([
  "P1000",
  "P1001",
  "P1002",
  "P1003",
  "P1008",
  "P1009",
  "P1010",
  "P1011",
  "P1012",
  "P1013",
  "P1014",
  "P1015",
  "P1016",
  "P1017",
]);

const approvedCheckConstraints = new Set([
  "ck_users_email_normalized",
  "ck_users_status_timestamps_consistent",
]);

const mappedCodes = new Set([
  "P2002",
  "P2003",
  "P2004",
  "P2009",
  "P2014",
  "P2025",
  "P2034",
  ...connectivityCodes,
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const isAllowlistedPrismaCode = (value: unknown): value is string =>
  typeof value === "string" && mappedCodes.has(value);

const containsApprovedConstraint = (value: unknown): boolean => {
  if (typeof value === "string") {
    return [...approvedCheckConstraints].some((name) => value.includes(name));
  }
  if (Array.isArray(value)) return value.some(containsApprovedConstraint);
  if (!isRecord(value)) return false;
  return Object.values(value).some(containsApprovedConstraint);
};

export const mapPrismaError = (error: unknown): AppError => {
  if (error instanceof AppError) return error;
  if (!isRecord(error)) return new InternalServerError();

  const code = error["code"];
  if (code === "P2002") {
    return new ConflictException(
      "A unique constraint prevents this operation.",
    );
  }
  if (code === "P2003" || code === "P2014") {
    return new ConflictException("A related record prevents this operation.");
  }
  if (code === "P2025") {
    return new NotFoundException("The requested record was not found.");
  }
  if (code === "P2034") {
    return new ConflictException(
      "A conflicting transaction is in progress. Retry the request.",
    );
  }
  if (
    (code === "P2004" || code === "P2009") &&
    containsApprovedConstraint(error["meta"])
  ) {
    return new BadRequestException(
      "A database constraint rejected the submitted value.",
    );
  }
  if (typeof code === "string" && connectivityCodes.has(code)) {
    return new ServiceUnavailableException(
      "The database is not currently available.",
    );
  }

  const message = error["message"];
  if (
    typeof message === "string" &&
    ["Can't reach database server", "ECONNREFUSED", "ENOTFOUND"].some(
      (fragment) => message.includes(fragment),
    )
  ) {
    return new ServiceUnavailableException(
      "The database is not currently available.",
    );
  }

  return new InternalServerError();
};
```

### [UNTRACKED] `apps/api/src/infrastructure/email/email-delivery.test.ts`

```typescript
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { ResendEmailClient } from "../../core/config/resend.config.js";
import { logger } from "../logger/logger.js";
import {
  ConsoleEmailDelivery,
  createEmailDelivery,
  createFileConsolePreview,
  EmailDeliveryError,
  ResendEmailDelivery,
  SmtpEmailDelivery,
  type SmtpEmailTransport,
} from "./email-delivery.js";

const request = {
  from: "Template <no-reply@example.com>",
  to: "user@example.com",
  subject: "Local preview",
  html: "<p>Preview body</p>",
  localPreviewUrl:
    "http://localhost:3000/auth/verify-email?token=local-verification-token",
};

const noWait = (): Promise<void> => Promise.resolve();

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ConsoleEmailDelivery", () => {
  it("captures a local preview without constructing a network client", async () => {
    const preview = vi.fn();
    const delivery = new ConsoleEmailDelivery(preview);
    const result = await delivery.send(request);
    expect(result.providerMessageId).toMatch(/^console\//u);
    expect(preview).toHaveBeenCalledOnce();
    expect(preview).toHaveBeenCalledWith(request);
  });

  it("is selected through injectable delivery dependencies", async () => {
    const preview = vi.fn();
    const resendClient = vi.fn();
    const smtpTransporter = vi.fn();
    const delivery = createEmailDelivery("console", {
      consolePreview: preview,
      getResendClient: resendClient,
      getSmtpTransporter: smtpTransporter,
    });
    await delivery.send(request);
    expect(preview).toHaveBeenCalledOnce();
    expect(resendClient).not.toHaveBeenCalled();
    expect(smtpTransporter).not.toHaveBeenCalled();
  });

  it("saves an owner-restricted local action-link preview outside logs", async () => {
    const previewDirectory = await mkdtemp(
      join(tmpdir(), "template-email-preview-"),
    );
    const infoLog = vi
      .spyOn(logger, "info")
      .mockImplementation(() => undefined);
    try {
      const delivery = new ConsoleEmailDelivery(
        createFileConsolePreview(previewDirectory),
      );
      await delivery.send(request);

      const files = await readdir(previewDirectory);
      expect(files).toHaveLength(1);
      const contents = await readFile(
        join(previewDirectory, files[0] ?? "missing"),
        "utf8",
      );
      expect(contents).toContain(request.localPreviewUrl);
      expect(JSON.stringify(infoLog.mock.calls)).not.toContain(
        "local-verification-token",
      );
    } finally {
      await rm(previewDirectory, { recursive: true, force: true });
    }
  });

  it("normalizes local preview failures without exposing their messages", async () => {
    const rawMessage = "preview failure containing local-verification-token";
    const errorLog = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const delivery = new ConsoleEmailDelivery(() => {
      throw new Error(rawMessage);
    });

    await expect(delivery.send(request)).rejects.toEqual(
      expect.objectContaining({
        name: "EmailDeliveryError",
        message: "console email delivery failed after 1 attempt(s).",
      }),
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
  });
});

describe("provider failure logging", () => {
  it("omits raw Resend error messages", async () => {
    const rawMessage = "provider detail containing re_secret_fixture";
    const errorLog = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const send = vi.fn<ResendEmailClient["send"]>().mockResolvedValue({
      data: null,
      error: {
        name: "validation_error",
        statusCode: 422,
        message: rawMessage,
      },
      headers: null,
    });
    const delivery = new ResendEmailDelivery(
      () => ({ send }),
      noWait,
      () => "template-email/test",
    );

    await expect(delivery.send(request)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
    expect(errorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        errorName: "validation_error",
        errorStatusCode: 422,
      }),
      "Email send attempt failed.",
    );
  });

  it("omits raw SMTP exception messages", async () => {
    const rawMessage = "SMTP rejected password fixture-secret";
    const errorLog = vi
      .spyOn(logger, "error")
      .mockImplementation(() => undefined);
    const sendMail = vi
      .fn<SmtpEmailTransport["sendMail"]>()
      .mockRejectedValue(new Error(rawMessage));
    const delivery = new SmtpEmailDelivery(() => ({ sendMail }), noWait);

    await expect(delivery.send(request)).rejects.toBeInstanceOf(
      EmailDeliveryError,
    );
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(rawMessage);
    expect(errorLog).toHaveBeenCalledTimes(3);
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/email/email-delivery.ts`

```typescript
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ErrorResponse } from "resend";

import {
  emailConfig,
  getSmtpTransporter,
  type EmailProvider,
} from "../../core/config/index.js";
import {
  getResendEmailClient,
  type ResendEmailClient,
} from "../../core/config/resend.config.js";
import { logger } from "../logger/logger.js";

const maximumAttempts = 3;

export type EmailSendRequest = Readonly<{
  from: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  localPreviewUrl?: string;
}>;

export type EmailSendResult = Readonly<{
  providerMessageId: string | null;
}>;

export interface EmailDelivery {
  readonly provider: EmailProvider;
  send(request: EmailSendRequest): Promise<EmailSendResult>;
}

export interface SmtpEmailTransport {
  sendMail(
    options: EmailSendRequest,
  ): Promise<Readonly<{ messageId?: string }>>;
}

type RetryWait = (delayMs: number) => Promise<void>;

const wait: RetryWait = async (delayMs) => {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, delayMs);
  });
};

const isTransientResendError = (error: ErrorResponse): boolean =>
  error.name === "rate_limit_exceeded" ||
  error.name === "concurrent_idempotent_requests" ||
  error.name === "application_error" ||
  error.name === "internal_server_error" ||
  (error.statusCode !== null && error.statusCode >= 500);

const safeError = (
  error: unknown,
): Readonly<{ name: string; statusCode: number | null }> => {
  if (error instanceof Error) {
    return { name: error.name, statusCode: null };
  }
  if (error !== null && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      name:
        typeof record["name"] === "string" ? record["name"] : "UnknownError",
      statusCode:
        typeof record["statusCode"] === "number" ? record["statusCode"] : null,
    };
  }
  return { name: "UnknownError", statusCode: null };
};

const logFailure = (
  provider: EmailProvider,
  attempt: number,
  error: unknown,
): void => {
  const details = safeError(error);
  logger.error(
    {
      provider,
      attempt,
      outcome: "email_send_failed",
      errorName: details.name,
      errorStatusCode: details.statusCode,
    },
    "Email send attempt failed.",
  );
};

export class EmailDeliveryError extends Error {
  constructor(provider: EmailProvider, attempts: number) {
    super(
      `${provider} email delivery failed after ${String(attempts)} attempt(s).`,
    );
    this.name = "EmailDeliveryError";
  }
}

export type ConsoleEmailPreview = (
  request: EmailSendRequest,
) => void | Promise<void>;

export const createFileConsolePreview =
  (
    previewDirectory = join(process.cwd(), ".local-emails"),
  ): ConsoleEmailPreview =>
  async (request) => {
    const previewPath = join(previewDirectory, `${randomUUID()}.txt`);
    await mkdir(previewDirectory, { recursive: true, mode: 0o700 });
    await writeFile(
      previewPath,
      [
        `Subject: ${request.subject}`,
        `Action URL: ${request.localPreviewUrl ?? "Not available"}`,
        "",
      ].join("\n"),
      { encoding: "utf8", flag: "wx", mode: 0o600 },
    );
    logger.info(
      {
        provider: "console",
        outcome: "email_preview_available",
        recipientDomain: request.to.split("@")[1] ?? null,
        subject: request.subject,
        previewPath,
      },
      "Email captured by the local console provider.",
    );
  };

export class ConsoleEmailDelivery implements EmailDelivery {
  readonly provider = "console" as const;

  constructor(
    private readonly preview: ConsoleEmailPreview = createFileConsolePreview(),
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    try {
      await this.preview(request);
    } catch (error) {
      logFailure(this.provider, 1, error);
      throw new EmailDeliveryError(this.provider, 1);
    }
    return { providerMessageId: `console/${randomUUID()}` };
  }
}

export class ResendEmailDelivery implements EmailDelivery {
  readonly provider = "resend" as const;

  constructor(
    private readonly getClient: () => ResendEmailClient = getResendEmailClient,
    private readonly retryWait: RetryWait = wait,
    private readonly idempotencyKeyFactory: () => string = () =>
      `template-email/${randomUUID()}`,
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    const idempotencyKey = this.idempotencyKeyFactory();

    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        const response = await this.getClient().send(
          {
            from: request.from,
            to: request.to,
            subject: request.subject,
            html: request.html,
            ...(request.replyTo === undefined
              ? {}
              : { replyTo: request.replyTo }),
          },
          { idempotencyKey },
        );

        if (response.error === null) {
          return { providerMessageId: response.data.id };
        }

        logFailure(this.provider, attempt, response.error);
        if (
          !isTransientResendError(response.error) ||
          attempt === maximumAttempts
        ) {
          throw new EmailDeliveryError(this.provider, attempt);
        }
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        logFailure(this.provider, attempt, error);
        if (!(error instanceof TypeError) || attempt === maximumAttempts) {
          throw new EmailDeliveryError(this.provider, attempt);
        }
      }

      await this.retryWait(attempt * 1_000);
    }

    throw new EmailDeliveryError(this.provider, maximumAttempts);
  }
}

export class SmtpEmailDelivery implements EmailDelivery {
  readonly provider = "smtp" as const;

  constructor(
    private readonly getTransporter: () => SmtpEmailTransport = getSmtpTransporter,
    private readonly retryWait: RetryWait = wait,
  ) {}

  async send(request: EmailSendRequest): Promise<EmailSendResult> {
    for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
      try {
        const result = await this.getTransporter().sendMail({
          from: request.from,
          to: request.to,
          subject: request.subject,
          html: request.html,
          ...(request.replyTo === undefined
            ? {}
            : { replyTo: request.replyTo }),
        });
        return { providerMessageId: result.messageId ?? null };
      } catch (error) {
        logFailure(this.provider, attempt, error);
        if (attempt === maximumAttempts) {
          throw new EmailDeliveryError(this.provider, attempt);
        }
        await this.retryWait(attempt * 1_000);
      }
    }

    throw new EmailDeliveryError(this.provider, maximumAttempts);
  }
}

export type EmailDeliveryDependencies = Readonly<{
  consolePreview?: ConsoleEmailPreview;
  getResendClient?: () => ResendEmailClient;
  getSmtpTransporter?: () => SmtpEmailTransport;
}>;

export const createEmailDelivery = (
  provider: EmailProvider = emailConfig.provider,
  dependencies: EmailDeliveryDependencies = {},
): EmailDelivery =>
  provider === "console"
    ? new ConsoleEmailDelivery(dependencies.consolePreview)
    : provider === "resend"
      ? new ResendEmailDelivery(dependencies.getResendClient)
      : new SmtpEmailDelivery(dependencies.getSmtpTransporter);
```

### [UNTRACKED] `apps/api/src/infrastructure/email/email.service.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";

import type { EmailDelivery } from "./email-delivery.js";
import { EmailService } from "./email.service.js";

const createService = () => {
  const send = vi.fn<EmailDelivery["send"]>();
  send.mockResolvedValue({ providerMessageId: "provider-message-id" });
  const delivery = { provider: "console", send } satisfies EmailDelivery;
  return {
    send,
    service: new EmailService(
      delivery,
      "no-reply@example.com",
      "Template",
      "",
      "http://localhost:3000",
    ),
  };
};

describe("EmailService local previews", () => {
  it("passes the exact verification action URL to delivery", async () => {
    const { send, service } = createService();

    await service.sendVerificationEmail(
      "Template User",
      "user@example.com",
      "verification-token",
    );

    expect(send.mock.calls[0]?.[0].localPreviewUrl).toBe(
      "http://localhost:3000/auth/verify-email?token=verification-token",
    );
  });

  it("passes the exact reset action URL to delivery", async () => {
    const { send, service } = createService();

    await service.sendPasswordResetEmail(
      "Template User",
      "user@example.com",
      "reset-token",
    );

    expect(send.mock.calls[0]?.[0].localPreviewUrl).toBe(
      "http://localhost:3000/auth/reset-password?token=reset-token",
    );
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/email/email.service.ts`

```typescript
import { emailConfig } from "../../core/config/email.config.js";
import { logger } from "../logger/logger.js";
import type { EmailDelivery } from "./email-delivery.js";
import { resetPasswordTemplate } from "./templates/reset-password.template.js";
import { verifyEmailTemplate } from "./templates/verify-email.template.js";

export class EmailService {
  constructor(
    private readonly delivery: EmailDelivery,
    private readonly fromAddress = emailConfig.fromAddress,
    private readonly fromName = emailConfig.fromName,
    private readonly replyTo = emailConfig.replyTo,
    private readonly publicWebUrl = emailConfig.publicWebUrl,
  ) {}

  async sendVerificationEmail(
    name: string,
    email: string,
    token: string,
  ): Promise<void> {
    const actionUrl = this.buildPublicUrl("/auth/verify-email", token);
    await this.send({
      to: email,
      subject: "Verify your email",
      html: verifyEmailTemplate(name, actionUrl),
      localPreviewUrl: actionUrl,
    });
  }

  async sendPasswordResetEmail(
    name: string,
    email: string,
    token: string,
  ): Promise<void> {
    const actionUrl = this.buildPublicUrl("/auth/reset-password", token);
    await this.send({
      to: email,
      subject: "Reset your password",
      html: resetPasswordTemplate(name, actionUrl),
      localPreviewUrl: actionUrl,
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    html: string;
    localPreviewUrl: string;
  }): Promise<void> {
    const result = await this.delivery.send({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: input.to,
      subject: input.subject,
      html: input.html,
      localPreviewUrl: input.localPreviewUrl,
      ...(this.replyTo === "" ? {} : { replyTo: this.replyTo }),
    });
    logger.info(
      {
        provider: this.delivery.provider,
        outcome: "email_sent",
        providerMessageId: result.providerMessageId,
        recipientDomain: input.to.split("@")[1] ?? null,
      },
      "Email sent.",
    );
  }

  private buildPublicUrl(path: string, token: string): string {
    const url = new URL(`${this.publicWebUrl}${path}`);
    url.searchParams.set("token", token);
    return url.toString();
  }
}
```

### [UNTRACKED] `apps/api/src/infrastructure/email/index.ts`

```typescript
export {
  ConsoleEmailDelivery,
  createFileConsolePreview,
  createEmailDelivery,
  EmailDeliveryError,
  ResendEmailDelivery,
  SmtpEmailDelivery,
} from "./email-delivery.js";
export type {
  ConsoleEmailPreview,
  EmailDelivery,
  EmailSendRequest,
  EmailSendResult,
} from "./email-delivery.js";
export { EmailService } from "./email.service.js";
```

### [UNTRACKED] `apps/api/src/infrastructure/email/templates/base-layout.template.ts`

```typescript
import { escapeHtml } from "./html-escape.js";

export const baseLayoutTemplate = (input: {
  title: string;
  previewText: string;
  bodyHtml: string;
}): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#eef3f1;color:#15211f;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(input.previewText)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px;background:#eef3f1;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;overflow:hidden;border:1px solid #cfdbd7;border-radius:18px;background:#ffffff;">
          <tr><td style="padding:24px 30px;border-bottom:1px solid #e2e9e7;font-size:18px;font-weight:700;">Full-Stack Boilerplate</td></tr>
          <tr><td style="padding:32px 30px;">${input.bodyHtml}</td></tr>
          <tr><td style="padding:20px 30px;border-top:1px solid #e2e9e7;color:#64726e;font-size:12px;line-height:1.6;">This automated message was sent by your application.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
```

### [UNTRACKED] `apps/api/src/infrastructure/email/templates/html-escape.ts`

```typescript
const escapedCharacters: Readonly<Record<string, string>> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) => escapedCharacters[character] ?? character,
  );
```

### [UNTRACKED] `apps/api/src/infrastructure/email/templates/reset-password.template.ts`

```typescript
import { baseLayoutTemplate } from "./base-layout.template.js";
import { escapeHtml } from "./html-escape.js";

export const resetPasswordTemplate = (name: string, url: string): string =>
  baseLayoutTemplate({
    title: "Reset your password",
    previewText: "Use this link to choose a new password.",
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:24px;">Reset your password</h1>
      <p style="margin:0 0 24px;color:#465753;line-height:1.7;">Hello ${escapeHtml(name)}, use the secure link below to choose a new password.</p>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:10px;background:#176b61;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:700;">Choose a new password</a></p>
      <p style="margin:0;color:#64726e;font-size:13px;line-height:1.6;">If you did not request a reset, no action is required.</p>`,
  });
```

### [UNTRACKED] `apps/api/src/infrastructure/email/templates/verify-email.template.ts`

```typescript
import { baseLayoutTemplate } from "./base-layout.template.js";
import { escapeHtml } from "./html-escape.js";

export const verifyEmailTemplate = (name: string, url: string): string =>
  baseLayoutTemplate({
    title: "Verify your email",
    previewText: "Confirm your email address to activate your account.",
    bodyHtml: `<h1 style="margin:0 0 16px;font-size:24px;">Verify your email</h1>
      <p style="margin:0 0 24px;color:#465753;line-height:1.7;">Hello ${escapeHtml(name)}, confirm this address to activate your account.</p>
      <p style="margin:0 0 24px;"><a href="${escapeHtml(url)}" style="display:inline-block;border-radius:10px;background:#176b61;color:#ffffff;padding:13px 20px;text-decoration:none;font-weight:700;">Verify email</a></p>
      <p style="margin:0;color:#64726e;font-size:13px;line-height:1.6;">If you did not create this account, you can ignore this email.</p>`,
  });
```

### [UNTRACKED] `apps/api/src/infrastructure/logger/logger.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { LOGGER_REDACT_PATHS } from "./logger.js";

describe("logger redaction", () => {
  it("explicitly redacts the double-submit CSRF request header", () => {
    expect(LOGGER_REDACT_PATHS).toContain("req.headers['x-csrf-token']");
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/logger/request-sanitizer.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  sanitizeRequestForLog,
  sanitizeRequestQuery,
  sanitizeRequestUrl,
} from "./request-sanitizer.js";

describe("request log sanitization", () => {
  it.each([
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "code",
    "secret",
    "password",
  ])("redacts the %s URL query value", (key) => {
    const result = sanitizeRequestUrl(
      `/auth/reset-password?${key}=secret-value&locale=en`,
    );
    expect(result).toBe(`/auth/reset-password?${key}=[REDACTED]&locale=en`);
    expect(result).not.toContain("secret-value");
  });

  it("preserves non-sensitive parameters and fragments", () => {
    expect(sanitizeRequestUrl("/items?page=2&limit=25#section")).toBe(
      "/items?page=2&limit=25#section",
    );
  });

  it("redacts credential keys case-insensitively in query objects", () => {
    expect(
      sanitizeRequestQuery({ Token: "secret", page: "2", tags: ["a"] }),
    ).toEqual({ Token: "[REDACTED]", page: "2", tags: ["a"] });
  });

  it("sanitizes url, originalUrl, and query without retaining raw request", () => {
    const result = sanitizeRequestForLog({
      url: "/verify?token=one",
      originalUrl: "/api/v1/verify?token=two",
      query: { token: "three", keep: "yes" },
      raw: { url: "/verify?token=four" },
    });
    expect(JSON.stringify(result)).not.toMatch(/one|two|three|four/u);
    expect(result["query"]).toEqual({ token: "[REDACTED]", keep: "yes" });
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/logger/request-sanitizer.ts`

```typescript
const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
]);

const safelyDecode = (value: string): string => {
  try {
    return decodeURIComponent(value.replace(/\+/gu, " "));
  } catch {
    return value;
  }
};

export const sanitizeRequestUrl = (value: string): string => {
  const queryStart = value.indexOf("?");
  if (queryStart === -1) return value;
  const fragmentStart = value.indexOf("#", queryStart);
  const path = value.slice(0, queryStart);
  const query =
    fragmentStart === -1
      ? value.slice(queryStart + 1)
      : value.slice(queryStart + 1, fragmentStart);
  const fragment = fragmentStart === -1 ? "" : value.slice(fragmentStart);
  const sanitized = query
    .split("&")
    .map((part) => {
      const equals = part.indexOf("=");
      const rawKey = equals === -1 ? part : part.slice(0, equals);
      return CREDENTIAL_QUERY_KEYS.has(safelyDecode(rawKey).toLowerCase())
        ? `${rawKey}=[REDACTED]`
        : part;
    })
    .join("&");
  return `${path}?${sanitized}${fragment}`;
};

export const sanitizeRequestQuery = (
  value: unknown,
): Record<string, unknown> | undefined => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      CREDENTIAL_QUERY_KEYS.has(key.toLowerCase()) ? "[REDACTED]" : item,
    ]),
  );
};

export const sanitizeRequestForLog = (
  value: Record<string, unknown>,
): Record<string, unknown> => ({
  ...value,
  ...(typeof value["url"] === "string"
    ? { url: sanitizeRequestUrl(value["url"]) }
    : {}),
  ...(typeof value["originalUrl"] === "string"
    ? { originalUrl: sanitizeRequestUrl(value["originalUrl"]) }
    : {}),
  ...(sanitizeRequestQuery(value["query"]) === undefined
    ? {}
    : { query: sanitizeRequestQuery(value["query"]) }),
  raw: undefined,
});
```

### [UNTRACKED] `apps/api/src/infrastructure/openapi/index.ts`

```typescript
export { buildOpenApiDocument } from "./openapi.js";
export { openApiRoutes } from "./openapi.routes.js";
```

### [UNTRACKED] `apps/api/src/infrastructure/openapi/openapi.routes.ts`

```typescript
import { Router } from "express";

import { buildOpenApiDocument } from "./openapi.js";

export const openApiRoutes = (): Router => {
  const router = Router();
  router.get("/openapi.json", (_request, response) => {
    response.json(buildOpenApiDocument());
  });
  return router;
};
```

### [UNTRACKED] `apps/api/src/infrastructure/openapi/openapi.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { buildOpenApiDocument } from "./openapi.js";

const expectedPaths = [
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/login",
  "/auth/refresh",
  "/auth/logout",
  "/auth/logout-all",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
  "/auth/change-password",
  "/users/me",
  "/health/live",
  "/health/ready",
  "/openapi.json",
] as const;

describe("OpenAPI document", () => {
  it("documents every public route and authentication scheme", () => {
    const document = buildOpenApiDocument();
    expect(Object.keys(document.paths ?? {}).sort()).toEqual(
      [...expectedPaths].sort(),
    );
    expect(document.components?.securitySchemes).toMatchObject({
      BearerAuth: { type: "http", scheme: "bearer" },
      RefreshCookie: { type: "apiKey", in: "cookie" },
      CsrfHeader: { type: "apiKey", in: "header" },
    });
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/openapi/openapi.ts`

```typescript
import { z } from "zod";
import { createDocument } from "zod-openapi";

import {
  accountResponseSchemas,
  errorEnvelopeSchema,
  successEnvelopeSchema,
} from "@template/contracts";

import { appConfig } from "../../core/config/app.config.js";
import {
  changePasswordBodyDtoSchema,
  emailRequestBodyDtoSchema,
  loginBodyDtoSchema,
  registerBodyDtoSchema,
  resetPasswordBodyDtoSchema,
} from "../../modules/auth/dto/index.js";
import { updateProfileBodyDtoSchema } from "../../modules/users/dto/update-profile.dto.js";

const tokenParameter = z
  .string()
  .min(1)
  .meta({
    param: {
      name: "token",
      in: "query",
    },
  });

const jsonBody = (schema: z.ZodType) => ({
  required: true,
  content: { "application/json": { schema } },
});

const successEnvelope = (data: z.ZodType): z.ZodType =>
  successEnvelopeSchema.safeExtend({ data });

const successResponse = (description: string, data: z.ZodType) => ({
  description,
  content: { "application/json": { schema: successEnvelope(data) } },
});

const errorResponse = (description: string) => ({
  description,
  content: { "application/json": { schema: errorEnvelopeSchema } },
});

const commonErrors = {
  "400": errorResponse("Invalid request"),
  "401": errorResponse("Authentication failed"),
  "403": errorResponse("Request forbidden"),
  "429": errorResponse("Rate limit exceeded"),
  "500": errorResponse("Unexpected server error"),
};

const emptyObjectSchema = z.object({}).strict();
const messageSchema = z.object({ message: z.string() }).strict();
const validResetTokenSchema = z.object({ valid: z.literal(true) }).strict();
const healthSchema = z
  .object({
    status: z.enum(["ok", "degraded"]),
    database: z.enum(["ok", "error", "not_checked"]),
    uptime: z.string(),
    timestamp: z.iso.datetime({ offset: true }),
  })
  .strict();

export const buildOpenApiDocument = () =>
  createDocument({
    openapi: "3.1.0",
    info: {
      title: `${appConfig.name} OpenAPI`,
      version: "1.0.0",
      description:
        "Authentication-ready REST API with access tokens, rotating refresh cookies, CSRF protection, and current-user profile management.",
    },
    servers: [{ url: appConfig.apiPrefix, description: "Configured API" }],
    components: {
      securitySchemes: {
        BearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        RefreshCookie: {
          type: "apiKey",
          in: "cookie",
          name: "refreshToken",
        },
        CsrfHeader: {
          type: "apiKey",
          in: "header",
          name: "x-csrf-token",
        },
      },
      schemas: {
        SafeUser: accountResponseSchemas.safeUser,
        AuthUserData: accountResponseSchemas.authUserData,
        AuthSessionData: accountResponseSchemas.authSessionData,
        ErrorEnvelope: errorEnvelopeSchema,
      },
    },
    paths: {
      "/auth/register": {
        post: {
          summary: "Register with email and password",
          requestBody: jsonBody(registerBodyDtoSchema),
          responses: {
            "201": successResponse(
              "Account created; verification email queued for delivery",
              accountResponseSchemas.authUserData,
            ),
            "409": errorResponse("Email already registered"),
            ...commonErrors,
          },
        },
      },
      "/auth/verify-email": {
        post: {
          summary: "Verify an email address",
          parameters: [tokenParameter],
          responses: {
            "200": successResponse(
              "Email verified",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/resend-verification": {
        post: {
          summary: "Request another verification link",
          description:
            "Always returns a neutral response to prevent account enumeration.",
          requestBody: jsonBody(emailRequestBodyDtoSchema),
          responses: {
            "200": successResponse("Request processed", messageSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/login": {
        post: {
          summary: "Create an authenticated session",
          requestBody: jsonBody(loginBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Signed in; refresh and CSRF cookies set",
              accountResponseSchemas.authSessionData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/refresh": {
        post: {
          summary: "Rotate the refresh token and issue a new access token",
          security: [{ RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse(
              "Session refreshed",
              accountResponseSchemas.authSessionData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/logout": {
        post: {
          summary: "Revoke the current refresh token",
          security: [{ BearerAuth: [], RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse("Signed out", emptyObjectSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/logout-all": {
        post: {
          summary: "Revoke every refresh token for the current user",
          security: [{ BearerAuth: [], RefreshCookie: [], CsrfHeader: [] }],
          responses: {
            "200": successResponse(
              "Signed out from all devices",
              emptyObjectSchema,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/forgot-password": {
        post: {
          summary: "Request a password reset",
          description:
            "Always returns a neutral response to prevent account enumeration.",
          requestBody: jsonBody(emailRequestBodyDtoSchema),
          responses: {
            "200": successResponse("Request processed", messageSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/reset-password": {
        post: {
          summary: "Reset a password with a one-time token",
          parameters: [tokenParameter],
          requestBody: jsonBody(resetPasswordBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Password reset and existing sessions revoked",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/auth/validate-reset-token": {
        get: {
          summary: "Validate a password-reset link",
          parameters: [tokenParameter],
          responses: {
            "200": successResponse("Reset link valid", validResetTokenSchema),
            ...commonErrors,
          },
        },
      },
      "/auth/change-password": {
        patch: {
          summary: "Change the authenticated user's password",
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(changePasswordBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Password changed and existing sessions revoked",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/users/me": {
        get: {
          summary: "Read the current user",
          security: [{ BearerAuth: [] }],
          responses: {
            "200": successResponse(
              "Current user",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
        patch: {
          summary: "Update the current user's profile",
          security: [{ BearerAuth: [], CsrfHeader: [] }],
          requestBody: jsonBody(updateProfileBodyDtoSchema),
          responses: {
            "200": successResponse(
              "Profile updated",
              accountResponseSchemas.authUserData,
            ),
            ...commonErrors,
          },
        },
      },
      "/health/live": {
        get: {
          summary: "Liveness check",
          responses: { "200": successResponse("Service alive", healthSchema) },
        },
      },
      "/health/ready": {
        get: {
          summary: "Readiness check",
          responses: {
            "200": successResponse("Service ready", healthSchema),
            "503": errorResponse("Database unavailable"),
          },
        },
      },
      "/openapi.json": {
        get: {
          summary: "OpenAPI 3.1 document",
          responses: { "200": { description: "OpenAPI document" } },
        },
      },
    },
  });
```

### [UNTRACKED] `apps/api/src/infrastructure/security/index.ts`

```typescript
export {
  generateResetToken,
  generateTokenPair,
  generateVerificationToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
} from "./jwt.service.js";
export { compareHash, generateHash } from "./password-hasher.js";
export { sha256 } from "./token-hasher.js";
```

### [UNTRACKED] `apps/api/src/infrastructure/security/jwt.service.test.ts`

```typescript
import { randomUUID } from "node:crypto";

import { UserRole } from "@template/database";
import { describe, expect, it } from "vitest";

import {
  generateResetToken,
  generateTokenPair,
  generateVerificationToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
} from "./jwt.service.js";

describe("purpose-bound JWT utilities", () => {
  it("round-trips access and refresh claims without accepting the wrong purpose", () => {
    const userId = randomUUID();
    const tokenId = randomUUID();
    const pair = generateTokenPair({
      userId,
      tokenId,
      email: "person@example.com",
      role: UserRole.USER,
      rememberMe: false,
      absoluteExpiresAt: new Date(Date.now() + 3_600_000),
    });

    const access = verifyAccessToken(pair.accessToken);
    const refresh = verifyRefreshToken(pair.refreshToken);
    expect(access.valid && access.payload.userId).toBe(userId);
    expect(refresh.valid && refresh.payload.tokenId).toBe(tokenId);
    expect(verifyRefreshToken(pair.accessToken).valid).toBe(false);
    expect(verifyAccessToken(pair.refreshToken).valid).toBe(false);
  });

  it("keeps verification and reset tokens non-interchangeable", () => {
    const verification = generateVerificationToken("person@example.com");
    const reset = generateResetToken("person@example.com");

    expect(verifyVerificationToken(verification).valid).toBe(true);
    expect(verifyResetToken(reset).valid).toBe(true);
    expect(verifyResetToken(verification).valid).toBe(false);
    expect(verifyVerificationToken(reset).valid).toBe(false);
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/security/jwt.service.ts`

```typescript
import { randomUUID } from "node:crypto";

import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

import { UserRole } from "@template/database";

import { authConfig, jwtConfig } from "../../core/config/auth.config.js";
import type {
  AccessTokenPayload,
  RefreshTokenPayload,
  TemporaryTokenPayload,
  TokenPair,
  VerifiedToken,
} from "../../modules/auth/types/auth.types.js";

const { JsonWebTokenError, TokenExpiredError } = jwt;

// Token claims are validated explicitly after signature verification.

const signOptions = (expiresIn: number): SignOptions => ({
  algorithm: "HS256",
  expiresIn,
  issuer: authConfig.issuer,
  audience: authConfig.audience,
});

const verifyPayload = (
  token: string,
  secret: string,
  label: string,
): VerifiedToken<JwtPayload> => {
  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: authConfig.issuer,
      audience: authConfig.audience,
      clockTolerance: authConfig.clockToleranceSeconds,
    });
    if (typeof decoded === "string") {
      return { valid: false, error: `Invalid ${label.toLowerCase()} token` };
    }
    return { valid: true, payload: decoded };
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return { valid: false, error: `${label} token has expired` };
    }
    if (error instanceof JsonWebTokenError) {
      return { valid: false, error: `Invalid ${label.toLowerCase()} token` };
    }
    return { valid: false, error: "Token verification failed" };
  }
};

const readString = (payload: JwtPayload, key: string): string | undefined => {
  const value: unknown = payload[key];
  return typeof value === "string" ? value : undefined;
};

const isUserRole = (value: unknown): value is UserRole =>
  value === UserRole.USER || value === UserRole.ADMIN;

export const generateTokenPair = (input: {
  userId: string;
  tokenId: string;
  role: UserRole;
  email: string;
  rememberMe: boolean;
  absoluteExpiresAt: Date;
}): TokenPair => {
  const accessToken = jwt.sign(
    {
      sub: input.userId,
      jti: input.tokenId,
      userId: input.userId,
      tokenId: input.tokenId,
      role: input.role,
      email: input.email,
      type: "ACCESS",
    },
    jwtConfig.accessSecret,
    signOptions(authConfig.accessTokenTtlSeconds),
  );
  const refreshExpiresAt = Math.floor(
    input.absoluteExpiresAt.getTime() / 1_000,
  );
  const refreshToken = jwt.sign(
    {
      sub: input.userId,
      jti: input.tokenId,
      userId: input.userId,
      tokenId: input.tokenId,
      rememberMe: input.rememberMe,
      expiresAt: refreshExpiresAt,
      type: "REFRESH",
    },
    jwtConfig.refreshSecret,
    signOptions(Math.max(1, refreshExpiresAt - Math.floor(Date.now() / 1_000))),
  );
  return { accessToken, refreshToken };
};

const generateTemporaryToken = (
  email: string,
  type: TemporaryTokenPayload["type"],
  secret: string,
  expiresIn: number,
): string =>
  jwt.sign(
    { sub: email, jti: randomUUID(), email, type },
    secret,
    signOptions(expiresIn),
  );

export const generateVerificationToken = (email: string): string =>
  generateTemporaryToken(
    email,
    "VERIFICATION",
    jwtConfig.verificationSecret,
    authConfig.verifyTokenTtlSeconds,
  );

export const generateResetToken = (email: string): string =>
  generateTemporaryToken(
    email,
    "PASSWORD_RESET",
    jwtConfig.resetSecret,
    authConfig.resetTokenTtlSeconds,
  );

export const verifyAccessToken = (
  token: string,
): VerifiedToken<AccessTokenPayload> => {
  const result = verifyPayload(token, jwtConfig.accessSecret, "Access");
  if (!result.valid) return result;
  const userId = readString(result.payload, "userId");
  const tokenId = readString(result.payload, "tokenId");
  const email = readString(result.payload, "email");
  const type = readString(result.payload, "type");
  const role: unknown = result.payload["role"];
  if (
    userId === undefined ||
    tokenId === undefined ||
    email === undefined ||
    type !== "ACCESS" ||
    result.payload.sub !== userId ||
    result.payload.jti !== tokenId ||
    !isUserRole(role)
  ) {
    return { valid: false, error: "Invalid access token claims" };
  }
  return {
    valid: true,
    payload: {
      sub: userId,
      jti: tokenId,
      userId,
      tokenId,
      email,
      role,
      type: "ACCESS",
    },
  };
};

export const verifyRefreshToken = (
  token: string,
): VerifiedToken<RefreshTokenPayload> => {
  const result = verifyPayload(token, jwtConfig.refreshSecret, "Refresh");
  if (!result.valid) return result;
  const userId = readString(result.payload, "userId");
  const tokenId = readString(result.payload, "tokenId");
  const type = readString(result.payload, "type");
  const rememberMe: unknown = result.payload["rememberMe"];
  const expiresAt: unknown = result.payload["expiresAt"];
  if (
    userId === undefined ||
    tokenId === undefined ||
    type !== "REFRESH" ||
    result.payload.sub !== userId ||
    result.payload.jti !== tokenId ||
    typeof rememberMe !== "boolean" ||
    typeof expiresAt !== "number" ||
    !Number.isInteger(expiresAt) ||
    expiresAt <= 0
  ) {
    return { valid: false, error: "Invalid refresh token claims" };
  }
  return {
    valid: true,
    payload: {
      sub: userId,
      jti: tokenId,
      userId,
      tokenId,
      rememberMe,
      expiresAt,
      type: "REFRESH",
    },
  };
};

const verifyTemporaryToken = (
  token: string,
  expectedType: TemporaryTokenPayload["type"],
  secret: string,
  label: string,
): VerifiedToken<TemporaryTokenPayload> => {
  const result = verifyPayload(token, secret, label);
  if (!result.valid) return result;
  const email = readString(result.payload, "email");
  const type = readString(result.payload, "type");
  if (
    email === undefined ||
    type !== expectedType ||
    result.payload.sub !== email ||
    typeof result.payload.jti !== "string"
  ) {
    return {
      valid: false,
      error: `Invalid ${label.toLowerCase()} token claims`,
    };
  }
  return {
    valid: true,
    payload: {
      sub: email,
      jti: result.payload.jti,
      email,
      type: expectedType,
    },
  };
};

export const verifyVerificationToken = (
  token: string,
): VerifiedToken<TemporaryTokenPayload> =>
  verifyTemporaryToken(
    token,
    "VERIFICATION",
    jwtConfig.verificationSecret,
    "Verification",
  );

export const verifyResetToken = (
  token: string,
): VerifiedToken<TemporaryTokenPayload> =>
  verifyTemporaryToken(token, "PASSWORD_RESET", jwtConfig.resetSecret, "Reset");
```

### [UNTRACKED] `apps/api/src/infrastructure/security/password-hasher.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { compareHash, generateHash } from "./password-hasher.js";

describe("hash utilities", () => {
  it("uses a salted Argon2id hash and verifies only the original value", async () => {
    const first = await generateHash("a-strong-test-password");
    const second = await generateHash("a-strong-test-password");

    expect(first).toMatch(/^\$argon2id\$/u);
    expect(second).not.toBe(first);
    await expect(compareHash("a-strong-test-password", first)).resolves.toBe(
      true,
    );
    await expect(compareHash("wrong-password", first)).resolves.toBe(false);
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/security/password-hasher.ts`

```typescript
import argon2 from "argon2";

import { authConfig } from "../../core/config/auth.config.js";

export const generateHash = async (value: string): Promise<string> =>
  argon2.hash(value, {
    type: argon2.argon2id,
    memoryCost: authConfig.argon2.memoryKib,
    timeCost: authConfig.argon2.timeCost,
    parallelism: authConfig.argon2.parallelism,
  });

export const compareHash = async (
  plainText: string,
  hash: string,
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plainText);
  } catch {
    return false;
  }
};
```

### [UNTRACKED] `apps/api/src/infrastructure/security/token-hasher.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { sha256 } from "./token-hasher.js";

describe("token hasher", () => {
  it("creates a stable lowercase SHA-256 fingerprint", () => {
    expect(sha256("token")).toBe(
      "3c469e9d6c5875d37a43f353d4f88e61fcf812c66eee3457465a40b0da4153e0",
    );
  });
});
```

### [UNTRACKED] `apps/api/src/infrastructure/security/token-hasher.ts`

```typescript
import { createHash } from "node:crypto";

export const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");
```

### [UNTRACKED] `apps/api/src/middlewares/auth.middleware.ts`

```typescript
import type { NextFunction, Request, Response } from "express";

import { UserStatus, type DatabaseClient } from "@template/database";

import { UnauthorizedException } from "../core/errors/unauthorized.error.js";
import { mapSafeUser } from "../modules/users/users.mapper.js";
import { verifyAccessToken } from "../infrastructure/security/jwt.service.js";

type UserLookupClient = Pick<DatabaseClient, "user">;

export const createAuthenticationMiddleware =
  (database: UserLookupClient) =>
  async (
    request: Request,
    _response: Response,
    next: NextFunction,
  ): Promise<void> => {
    const [scheme, token] = request.headers.authorization?.split(" ") ?? [];
    if (scheme !== "Bearer" || token === undefined || token.length === 0) {
      throw new UnauthorizedException(
        "Authentication required. Provide a valid bearer token.",
      );
    }

    const verified = verifyAccessToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException(verified.error);
    }

    const user = await database.user.findUnique({
      where: { id: verified.payload.userId },
    });
    if (
      user === null ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt === null
    ) {
      throw new UnauthorizedException(
        "The account is unavailable. Sign in again.",
      );
    }

    request.user = mapSafeUser(user);
    next();
  };
```

### [UNTRACKED] `apps/api/src/middlewares/authorization.middleware.test.ts`

```typescript
import { UserRole } from "@template/database";
import { describe, expect, it, vi } from "vitest";

import { ForbiddenException } from "../core/errors/forbidden.error.js";
import { UnauthorizedException } from "../core/errors/unauthorized.error.js";
import { authorizeRoles } from "./authorization.middleware.js";

const response = {} as never;

describe("authorizeRoles", () => {
  it("rejects a missing authenticated user", () => {
    const middleware = authorizeRoles(UserRole.ADMIN);
    expect(() => {
      middleware({} as never, response, vi.fn());
    }).toThrow(UnauthorizedException);
  });

  it("rejects a user outside the allowlist", () => {
    const middleware = authorizeRoles(UserRole.ADMIN);
    expect(() => {
      middleware({ user: { role: UserRole.USER } } as never, response, vi.fn());
    }).toThrow(ForbiddenException);
  });

  it("continues for an allowed generic role", () => {
    const next = vi.fn();
    authorizeRoles(UserRole.ADMIN)(
      { user: { role: UserRole.ADMIN } } as never,
      response,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });
});
```

### [UNTRACKED] `apps/api/src/middlewares/authorization.middleware.ts`

```typescript
import type { NextFunction, Request, Response } from "express";

import type { UserRole } from "@template/database";

import { ForbiddenException } from "../core/errors/forbidden.error.js";
import { UnauthorizedException } from "../core/errors/unauthorized.error.js";

export const authorizeRoles = (...roles: readonly UserRole[]) => {
  const allowed = new Set(roles);
  return (request: Request, _response: Response, next: NextFunction): void => {
    if (request.user === undefined) {
      throw new UnauthorizedException("Authentication is required.");
    }
    if (!allowed.has(request.user.role)) {
      throw new ForbiddenException(
        "This action is not allowed for the current user.",
      );
    }
    next();
  };
};
```

### [UNTRACKED] `apps/api/src/middlewares/csrf.middleware.test.ts`

```typescript
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { ForbiddenException } from "../core/errors/forbidden.error.js";
import {
  createCsrfMiddlewareWhenCookiePresent,
  csrfMiddleware,
} from "./csrf.middleware.js";

const request = (
  method: string,
  cookieToken?: string,
  headerToken?: string,
): Request =>
  ({
    method,
    cookies: cookieToken === undefined ? {} : { csrfToken: cookieToken },
    get: vi.fn(() => headerToken),
  }) as unknown as Request;

describe("CSRF middleware", () => {
  const response = {} as Response;

  it("allows safe methods and matching double-submit tokens", () => {
    const next = vi.fn() as NextFunction;
    csrfMiddleware(request("GET"), response, next);
    csrfMiddleware(
      request("PATCH", "same-token", "same-token"),
      response,
      next,
    );
    expect(next).toHaveBeenCalledTimes(2);
  });

  it("rejects missing, unequal, and unequal-length tokens", () => {
    const next = vi.fn() as NextFunction;
    expect(() => {
      csrfMiddleware(request("POST"), response, next);
    }).toThrow(ForbiddenException);
    expect(() => {
      csrfMiddleware(request("POST", "cookie", "header"), response, next);
    }).toThrow(ForbiddenException);
    expect(() => {
      csrfMiddleware(request("POST", "short", "much-longer"), response, next);
    }).toThrow(ForbiddenException);
  });

  it("requires CSRF on refresh only when the protected cookie exists", () => {
    const middleware = createCsrfMiddlewareWhenCookiePresent("refreshToken");
    const next = vi.fn() as NextFunction;
    middleware(request("POST"), response, next);
    expect(next).toHaveBeenCalledOnce();

    const protectedRequest = request("POST", "csrf", "csrf");
    protectedRequest.cookies = {
      refreshToken: "refresh",
      csrfToken: "csrf",
    };
    middleware(protectedRequest, response, next);
    expect(next).toHaveBeenCalledTimes(2);
  });
});
```

### [UNTRACKED] `apps/api/src/middlewares/csrf.middleware.ts`

```typescript
import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { csrfConfig } from "../core/config/csrf.config.js";
import { ForbiddenException } from "../core/errors/forbidden.error.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const tokensMatch = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
};

export const csrfMiddleware = (
  request: Request,
  _response: Response,
  next: NextFunction,
): void => {
  if (!unsafeMethods.has(request.method)) {
    next();
    return;
  }

  const cookies = request.cookies as Record<string, string> | undefined;
  const cookieToken = cookies?.[csrfConfig.cookieName];
  const headerToken = request.get(csrfConfig.headerName);
  if (
    cookieToken === undefined ||
    headerToken === undefined ||
    !tokensMatch(cookieToken, headerToken)
  ) {
    throw new ForbiddenException("CSRF validation failed.");
  }
  next();
};

export const createCsrfMiddlewareWhenCookiePresent =
  (protectedCookieName: string) =>
  (request: Request, response: Response, next: NextFunction): void => {
    const cookies = request.cookies as Record<string, string> | undefined;
    const protectedCookie = cookies?.[protectedCookieName];
    if (protectedCookie === undefined || protectedCookie.length === 0) {
      next();
      return;
    }
    csrfMiddleware(request, response, next);
  };
```

### [UNTRACKED] `apps/api/src/middlewares/error-handler.middleware.test.ts`

```typescript
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { errorHandlerMiddleware } from "./error-handler.middleware.js";

describe("errorHandlerMiddleware", () => {
  it("classifies Zod errors outside request validation as internal bugs", () => {
    const parsed = z.object({ count: z.number() }).safeParse({ count: "bug" });
    if (parsed.success) throw new Error("Expected the fixture to fail.");
    const requestLog = { error: vi.fn(), warn: vi.fn() };
    const request = {
      log: requestLog,
      path: "/internal-schema-bug",
      requestId: "request-id",
    } as unknown as Request;
    const json = vi.fn();
    const status = vi.fn();
    const response = {
      status,
      json,
    } as unknown as Response;
    status.mockReturnValue(response);

    errorHandlerMiddleware(parsed.error, request, response, vi.fn());

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        statusCode: 500,
        code: "INTERNAL_SERVER_ERROR",
      }),
    );
    expect(requestLog.error).toHaveBeenCalledOnce();
    expect(requestLog.warn).not.toHaveBeenCalled();
  });
});
```

### [UNTRACKED] `apps/api/src/middlewares/validation.middleware.test.ts`

```typescript
import type { NextFunction, Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ValidationException } from "../core/errors/validation.error.js";
import { validationMiddleware } from "./validation.middleware.js";

const response = {} as Response;

describe("validationMiddleware", () => {
  it("aggregates target-prefixed body, params, and query errors", async () => {
    const request = {
      body: { email: "invalid" },
      params: { userId: "not-a-uuid" },
      query: { page: "zero" },
    } as unknown as Request;
    const nextMock = vi.fn();
    const next = nextMock as NextFunction;
    const middleware = validationMiddleware({
      body: z.object({ email: z.email() }),
      params: z.object({ userId: z.uuid() }),
      query: z.object({ page: z.coerce.number().int().positive() }),
    });

    let thrown: unknown;
    try {
      await middleware(request, response, next);
    } catch (error: unknown) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(ValidationException);
    expect(thrown).toMatchObject({
      code: "VALIDATION_ERROR",
      errors: [
        expect.objectContaining({ field: "body.email" }),
        expect.objectContaining({ field: "params.userId" }),
        expect.objectContaining({ field: "query.page" }),
      ],
    });
    expect(nextMock).not.toHaveBeenCalled();
  });

  it("stores parsed values and replaces normalized body and params", async () => {
    const request = {
      body: { email: "  USER@Example.com " },
      params: { userId: "  user-1 " },
      query: { page: "2" },
    } as unknown as Request;
    const nextMock = vi.fn();
    const next = nextMock as NextFunction;
    const middleware = validationMiddleware({
      body: z.object({
        email: z.string().transform((value) => value.trim().toLowerCase()),
      }),
      params: z.object({
        userId: z.string().transform((value) => value.trim()),
      }),
      query: z.object({ page: z.coerce.number().int().positive() }),
    });

    await middleware(request, response, next);

    expect(request.body).toEqual({ email: "user@example.com" });
    expect(request.params).toEqual({ userId: "user-1" });
    expect(request.validated).toEqual({
      body: { email: "user@example.com" },
      params: { userId: "user-1" },
      query: { page: 2 },
    });
    expect(nextMock).toHaveBeenCalledOnce();
  });
});
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.constants.ts`

```typescript
import { authConfig } from "../../core/config/auth.config.js";
import { cookieConfig } from "../../core/config/cookie.config.js";

export const AUTH_CONSTANTS = Object.freeze({
  refreshTokenCookieName: cookieConfig.refreshName,
  csrfTokenCookieName: cookieConfig.csrfName,
  messages: Object.freeze({
    register: "Account created. Check your email to verify it.",
    verify: "Email verified successfully.",
    resend: "Verification request processed.",
    login: "Signed in successfully.",
    refresh: "Session refreshed successfully.",
    logout: "Signed out successfully.",
    logoutAll: "Signed out from all devices successfully.",
    forgot: "Password reset request processed.",
    reset: "Password reset successfully.",
    validateReset: "Reset link is valid.",
    changePassword: "Password changed successfully.",
  }),
});

export const RESEND_NEUTRAL_RESPONSE = Object.freeze({
  message:
    "If the account exists and is eligible, a verification link will be sent.",
});

export const FORGOT_PASSWORD_NEUTRAL_RESPONSE = Object.freeze({
  message:
    "If the account exists and is eligible, a password reset link will be sent.",
});

export const VERIFICATION_TOKEN_TTL_MS =
  authConfig.verifyTokenTtlSeconds * 1_000;
export const RESET_TOKEN_TTL_MS = authConfig.resetTokenTtlSeconds * 1_000;
export const RESEND_COOLDOWN_MS =
  authConfig.verifyResendCooldownSeconds * 1_000;
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.controller.test.ts`

```typescript
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { cookieConfig } from "../../core/config/cookie.config.js";
import { AuthController } from "./auth.controller.js";
import type { AuthService } from "./auth.service.js";

const user = {
  id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
  fullName: "Template User",
  email: "user@example.com",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: "2026-08-18T00:00:00.000Z",
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
} as const;

const responseMock = () => {
  const response = {
    cookie: vi.fn(),
    clearCookie: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

const loginRequest = {
  path: "/auth/login",
  requestId: "request-id",
  validated: {
    body: {
      email: "user@example.com",
      password: "a-secure-test-password",
      rememberMe: false,
    },
  },
} as unknown as Request;

describe("AuthController cookie options", () => {
  it.each([false, true])(
    "sets exact refresh and CSRF options for rememberMe=%s",
    async (rememberMe) => {
      const authService = {
        login: vi.fn().mockResolvedValue({
          user,
          tokens: { accessToken: "access", refreshToken: "refresh" },
          rememberMe,
        }),
      } as unknown as AuthService;
      const controller = new AuthController(authService);
      const response = responseMock();
      await controller.login(
        {
          ...loginRequest,
          validated: {
            body: {
              ...(loginRequest.validated?.body as object),
              rememberMe,
            },
          },
        } as Request,
        response as unknown as Response,
      );

      const lifetime = rememberMe
        ? { maxAge: cookieConfig.refreshMaxAgeSeconds * 1_000 }
        : {};
      expect(response.cookie).toHaveBeenNthCalledWith(
        1,
        "refreshToken",
        "refresh",
        {
          httpOnly: true,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
          path: cookieConfig.refreshPath,
          ...lifetime,
        },
      );
      expect(response.cookie).toHaveBeenNthCalledWith(
        2,
        "csrfToken",
        expect.any(String),
        {
          httpOnly: false,
          secure: cookieConfig.secure,
          sameSite: cookieConfig.sameSite,
          path: "/",
          ...lifetime,
        },
      );
      expect(response.cookie.mock.calls[1]?.[1]).toMatch(/^[a-f0-9]{64}$/u);
    },
  );

  it("clears both cookies with matching security and path attributes", async () => {
    const authService = {
      logout: vi.fn().mockResolvedValue(undefined),
    } as unknown as AuthService;
    const controller = new AuthController(authService);
    const response = responseMock();
    await controller.logout(
      {
        path: "/auth/logout",
        requestId: "request-id",
        user,
        cookies: { refreshToken: "refresh" },
      } as unknown as Request,
      response as unknown as Response,
    );
    expect(response.clearCookie).toHaveBeenNthCalledWith(1, "refreshToken", {
      path: cookieConfig.refreshPath,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
    expect(response.clearCookie).toHaveBeenNthCalledWith(2, "csrfToken", {
      path: "/",
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
  });
});
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.controller.ts`

```typescript
import { randomBytes } from "node:crypto";

import type { Request, Response } from "express";

import { cookieConfig } from "../../core/config/cookie.config.js";
import { ResponseHelper } from "../../core/responses/api-response.js";
import { AUTH_CONSTANTS } from "./auth.constants.js";
import type { AuthService } from "./auth.service.js";
import type {
  ChangePasswordBodyDto,
  EmailRequestBodyDto,
  LoginBodyDto,
  RegisterBodyDto,
  ResetPasswordBodyDto,
  TokenQueryDto,
} from "./dto/index.js";
import type {
  AuthResponseWithTokens,
  CookieAttributes,
} from "./types/auth.types.js";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  register = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.register(
      request.validated?.body as RegisterBodyDto,
    );
    return ResponseHelper.created(
      response,
      result,
      AUTH_CONSTANTS.messages.register,
      request.path,
      request.requestId,
    );
  };

  verifyEmail = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const query = request.validated?.query as TokenQueryDto;
    const result = await this.authService.verifyEmail(query.token);
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.verify,
      request.path,
      request.requestId,
    );
  };

  resendVerification = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.resendVerification(
      request.validated?.body as EmailRequestBodyDto,
    );
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.resend,
      request.path,
      request.requestId,
    );
  };

  login = async (request: Request, response: Response): Promise<Response> => {
    const result = await this.authService.login(
      request.validated?.body as LoginBodyDto,
    );
    return this.sendSession(
      request,
      response,
      result,
      AUTH_CONSTANTS.messages.login,
    );
  };

  refresh = async (request: Request, response: Response): Promise<Response> => {
    const result = await this.authService.refresh(
      this.extractRefreshToken(request),
    );
    return this.sendSession(
      request,
      response,
      result,
      AUTH_CONSTANTS.messages.refresh,
    );
  };

  logout = async (request: Request, response: Response): Promise<Response> => {
    await this.authService.logout(
      request.user?.id ?? "",
      this.extractRefreshToken(request),
    );
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      {},
      AUTH_CONSTANTS.messages.logout,
      request.path,
      request.requestId,
    );
  };

  logoutAll = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    await this.authService.logoutAll(request.user?.id ?? "");
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      {},
      AUTH_CONSTANTS.messages.logoutAll,
      request.path,
      request.requestId,
    );
  };

  forgotPassword = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.forgotPassword(
      request.validated?.body as EmailRequestBodyDto,
    );
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.forgot,
      request.path,
      request.requestId,
    );
  };

  resetPassword = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.resetPassword(
      request.validated?.body as ResetPasswordBodyDto,
      (request.validated?.query as TokenQueryDto).token,
    );
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.reset,
      request.path,
      request.requestId,
    );
  };

  validateResetToken = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.validateResetToken(
      (request.validated?.query as TokenQueryDto).token,
    );
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.validateReset,
      request.path,
      request.requestId,
    );
  };

  changePassword = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const result = await this.authService.changePassword(
      request.user?.id ?? "",
      request.validated?.body as ChangePasswordBodyDto,
    );
    this.clearSessionCookies(response);
    return ResponseHelper.ok(
      response,
      result,
      AUTH_CONSTANTS.messages.changePassword,
      request.path,
      request.requestId,
    );
  };

  private sendSession(
    request: Request,
    response: Response,
    result: AuthResponseWithTokens,
    message: string,
  ): Response {
    this.setSessionCookies(
      response,
      result.tokens.refreshToken,
      result.rememberMe,
    );
    return ResponseHelper.ok(
      response,
      {
        user: result.user,
        tokens: { accessToken: result.tokens.accessToken },
      },
      message,
      request.path,
      request.requestId,
    );
  }

  private setSessionCookies(
    response: Response,
    refreshToken: string,
    rememberMe: boolean,
  ): void {
    response.cookie(
      AUTH_CONSTANTS.refreshTokenCookieName,
      refreshToken,
      this.refreshCookieOptions(rememberMe),
    );
    response.cookie(
      AUTH_CONSTANTS.csrfTokenCookieName,
      randomBytes(32).toString("hex"),
      this.csrfCookieOptions(rememberMe),
    );
  }

  private clearSessionCookies(response: Response): void {
    response.clearCookie(AUTH_CONSTANTS.refreshTokenCookieName, {
      path: cookieConfig.refreshPath,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
    response.clearCookie(AUTH_CONSTANTS.csrfTokenCookieName, {
      path: cookieConfig.csrfPath,
      sameSite: cookieConfig.sameSite,
      secure: cookieConfig.secure,
    });
  }

  private extractRefreshToken(request: Request): string {
    const cookies = request.cookies as Record<string, string> | undefined;
    return cookies?.[AUTH_CONSTANTS.refreshTokenCookieName] ?? "";
  }

  private refreshCookieOptions(rememberMe: boolean): CookieAttributes {
    return {
      httpOnly: true,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.refreshPath,
      ...(rememberMe
        ? { maxAge: cookieConfig.refreshMaxAgeSeconds * 1_000 }
        : {}),
    };
  }

  private csrfCookieOptions(rememberMe: boolean): CookieAttributes {
    return {
      httpOnly: false,
      secure: cookieConfig.secure,
      sameSite: cookieConfig.sameSite,
      path: cookieConfig.csrfPath,
      ...(rememberMe
        ? { maxAge: cookieConfig.refreshMaxAgeSeconds * 1_000 }
        : {}),
    };
  }
}
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.rate-limiters.ts`

```typescript
import type { Request } from "express";
import { ipKeyGenerator } from "express-rate-limit";

import { authRouteLimits } from "../../core/config/auth-rate-limit.config.js";
import {
  createKeyedAuthRateLimiter,
  createSourceRateLimiter,
} from "../../middlewares/rate-limit.middleware.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { AUTH_CONSTANTS } from "./auth.constants.js";

const validatedString = (
  request: Request,
  target: "body" | "query",
  field: string,
): string => {
  const value = request.validated?.[target];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return "";
  }
  const fieldValue = (value as Record<string, unknown>)[field];
  return typeof fieldValue === "string" ? fieldValue : "";
};

const sourceKey = (request: Request): string =>
  ipKeyGenerator(request.ip ?? "unknown");
const emailKey = (request: Request): string =>
  sha256(validatedString(request, "body", "email").trim().toLowerCase());
const tokenKey = (request: Request): string =>
  sha256(validatedString(request, "query", "token"));
const refreshToken = (request: Request): string => {
  const cookies = request.cookies as Record<string, string> | undefined;
  return cookies?.[AUTH_CONSTANTS.refreshTokenCookieName] ?? "";
};
const refreshKey = (request: Request): string => {
  const token = refreshToken(request);
  return token.length === 0
    ? sourceKey(request)
    : sha256(`${sourceKey(request)}:${sha256(token)}`);
};
const loginKey = (request: Request): string =>
  sha256(
    `${sourceKey(request)}:${validatedString(request, "body", "email").trim().toLowerCase()}`,
  );
const userKey = (request: Request): string => sha256(request.user?.id ?? "");
const logoutKey = (request: Request): string =>
  sha256(`${request.user?.id ?? ""}:${sha256(refreshToken(request))}`);

export const authRateLimiters = Object.freeze({
  registerSource: createSourceRateLimiter(authRouteLimits.registerSource),
  verifySource: createSourceRateLimiter(authRouteLimits.verifySource),
  verifyToken: createKeyedAuthRateLimiter(
    authRouteLimits.verifyToken,
    tokenKey,
  ),
  resendSource: createSourceRateLimiter(authRouteLimits.resendSource),
  resendAccount: createKeyedAuthRateLimiter(
    authRouteLimits.resendAccount,
    emailKey,
  ),
  loginSource: createSourceRateLimiter(authRouteLimits.loginSource),
  loginAccountSource: createKeyedAuthRateLimiter(
    authRouteLimits.loginAccountSource,
    loginKey,
  ),
  refreshFamilySource: createKeyedAuthRateLimiter(
    authRouteLimits.refreshFamilySource,
    refreshKey,
  ),
  forgotSource: createSourceRateLimiter(authRouteLimits.forgotSource),
  forgotAccount: createKeyedAuthRateLimiter(
    authRouteLimits.forgotAccount,
    emailKey,
  ),
  resetSource: createSourceRateLimiter(authRouteLimits.resetSource),
  resetToken: createKeyedAuthRateLimiter(authRouteLimits.resetToken, tokenKey),
  passwordChangeUser: createKeyedAuthRateLimiter(
    authRouteLimits.passwordChangeUser,
    userKey,
  ),
  logoutSession: createKeyedAuthRateLimiter(
    authRouteLimits.logoutSession,
    logoutKey,
  ),
  logoutAllUser: createKeyedAuthRateLimiter(
    authRouteLimits.logoutAllUser,
    userKey,
  ),
});
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.routes.ts`

```typescript
import { Router, type RequestHandler } from "express";

import {
  createCsrfMiddlewareWhenCookiePresent,
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { AUTH_CONSTANTS } from "./auth.constants.js";
import type { AuthController } from "./auth.controller.js";
import { authRateLimiters } from "./auth.rate-limiters.js";
import {
  changePasswordBodyDtoSchema,
  emailRequestBodyDtoSchema,
  loginBodyDtoSchema,
  registerBodyDtoSchema,
  resetPasswordBodyDtoSchema,
  tokenQueryDtoSchema,
} from "./dto/index.js";

export const authRoutes = (
  controller: AuthController,
  authenticationMiddleware: RequestHandler,
): Router => {
  const router = Router();
  const refreshCsrf = createCsrfMiddlewareWhenCookiePresent(
    AUTH_CONSTANTS.refreshTokenCookieName,
  );

  router.post(
    "/register",
    authRateLimiters.registerSource,
    validationMiddleware({ body: registerBodyDtoSchema }),
    controller.register,
  );
  router.post(
    "/verify-email",
    authRateLimiters.verifySource,
    validationMiddleware({ query: tokenQueryDtoSchema }),
    authRateLimiters.verifyToken,
    controller.verifyEmail,
  );
  router.post(
    "/resend-verification",
    authRateLimiters.resendSource,
    validationMiddleware({ body: emailRequestBodyDtoSchema }),
    authRateLimiters.resendAccount,
    controller.resendVerification,
  );
  router.post(
    "/login",
    authRateLimiters.loginSource,
    validationMiddleware({ body: loginBodyDtoSchema }),
    authRateLimiters.loginAccountSource,
    controller.login,
  );
  router.post(
    "/refresh",
    authRateLimiters.refreshFamilySource,
    refreshCsrf,
    controller.refresh,
  );
  router.post(
    "/logout",
    authenticationMiddleware,
    authRateLimiters.logoutSession,
    csrfMiddleware,
    controller.logout,
  );
  router.post(
    "/logout-all",
    authenticationMiddleware,
    authRateLimiters.logoutAllUser,
    csrfMiddleware,
    controller.logoutAll,
  );
  router.post(
    "/forgot-password",
    authRateLimiters.forgotSource,
    validationMiddleware({ body: emailRequestBodyDtoSchema }),
    authRateLimiters.forgotAccount,
    controller.forgotPassword,
  );
  router.post(
    "/reset-password",
    authRateLimiters.resetSource,
    validationMiddleware({
      body: resetPasswordBodyDtoSchema,
      query: tokenQueryDtoSchema,
    }),
    authRateLimiters.resetToken,
    controller.resetPassword,
  );
  router.get(
    "/validate-reset-token",
    authRateLimiters.resetSource,
    validationMiddleware({ query: tokenQueryDtoSchema }),
    authRateLimiters.resetToken,
    controller.validateResetToken,
  );
  router.patch(
    "/change-password",
    authenticationMiddleware,
    authRateLimiters.passwordChangeUser,
    csrfMiddleware,
    validationMiddleware({ body: changePasswordBodyDtoSchema }),
    controller.changePassword,
  );

  return router;
};
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.service.integration.test.ts`

```typescript
import { createDatabaseClient } from "@template/database";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { EmailDelivery } from "../../infrastructure/email/email-delivery.js";
import { EmailService } from "../../infrastructure/email/email.service.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import { AuthService } from "./auth.service.js";

const databaseUrl = process.env["DATABASE_URL"];
if (databaseUrl === undefined) {
  throw new Error("The Testcontainers DATABASE_URL was not provided.");
}

const database = createDatabaseClient(databaseUrl);
const deliveredHtml: string[] = [];
const delivery: EmailDelivery = {
  provider: "smtp",
  send: (message) => {
    deliveredHtml.push(message.html);
    return Promise.resolve({ providerMessageId: "test-message" });
  },
};
const emailService = new EmailService(
  delivery,
  "no-reply@example.com",
  "Template",
  "",
  "http://localhost:3000",
);
const service = new AuthService(database, emailService);

const tokenFromLastEmail = (): string => {
  const html = deliveredHtml.at(-1);
  const match = html?.match(/token=([^"&<]+)/u);
  if (match?.[1] === undefined) {
    throw new Error("Expected a token in the captured email.");
  }
  return decodeURIComponent(match[1]);
};

describe("AuthService with PostgreSQL", () => {
  beforeEach(async () => {
    deliveredHtml.length = 0;
    await database.refreshToken.deleteMany();
    await database.user.deleteMany();
  });

  afterAll(async () => {
    await database.$disconnect();
  });

  it("registers, verifies, logs in, and atomically rotates one-time refresh tokens", async () => {
    const registered = await service.register({
      fullName: "Template User",
      email: "USER@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    expect(registered.user).not.toHaveProperty("passwordHash");
    expect(registered.user.status).toBe("PENDING_VERIFICATION");

    const verificationToken = tokenFromLastEmail();
    const storedPending = await database.user.findUniqueOrThrow({
      where: { email: "user@example.com" },
    });
    expect(storedPending.verificationTokenHash).toBe(sha256(verificationToken));
    expect(storedPending.verificationTokenHash).not.toBe(verificationToken);

    const verified = await service.verifyEmail(verificationToken);
    expect(verified.user.status).toBe("ACTIVE");
    expect(verified.user.emailVerifiedAt).not.toBeNull();

    const login = await service.login({
      email: "user@example.com",
      password: "initial-secure-password",
      rememberMe: false,
    });
    const beforeRotation = await database.refreshToken.findMany();
    expect(beforeRotation).toHaveLength(1);
    expect(beforeRotation[0]?.tokenHash).toBe(
      sha256(login.tokens.refreshToken),
    );
    expect(beforeRotation[0]?.tokenHash).not.toBe(login.tokens.refreshToken);

    const rotated = await service.refresh(login.tokens.refreshToken);
    const afterRotation = await database.refreshToken.findMany();
    expect(afterRotation).toHaveLength(1);
    expect(afterRotation[0]?.tokenHash).toBe(
      sha256(rotated.tokens.refreshToken),
    );
    await expect(
      service.refresh(login.tokens.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("removes a pending user after delivery failure so registration can be retried", async () => {
    const send = vi
      .fn<EmailDelivery["send"]>()
      .mockRejectedValueOnce(new Error("delivery unavailable"))
      .mockResolvedValueOnce({ providerMessageId: "retry-message" });
    const retryService = new AuthService(
      database,
      new EmailService(
        { provider: "smtp", send },
        "no-reply@example.com",
        "Template",
        "",
        "http://localhost:3000",
      ),
    );
    const registration = {
      fullName: "Retry User",
      email: "retry@example.com",
      phone: null,
      password: "initial-secure-password",
    };

    await expect(retryService.register(registration)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(
      database.user.findUnique({ where: { email: registration.email } }),
    ).resolves.toBeNull();
    await expect(retryService.register(registration)).resolves.toMatchObject({
      user: { email: registration.email, status: "PENDING_VERIFICATION" },
    });
  });

  it("uses neutral recovery, consumes reset tokens once, and revokes sessions", async () => {
    await service.register({
      fullName: "Template User",
      email: "user@example.com",
      phone: null,
      password: "initial-secure-password",
    });
    await service.verifyEmail(tokenFromLastEmail());
    const login = await service.login({
      email: "user@example.com",
      password: "initial-secure-password",
      rememberMe: true,
    });

    const unknown = await service.forgotPassword({
      email: "unknown@example.com",
    });
    const known = await service.forgotPassword({ email: "user@example.com" });
    expect(unknown).toEqual(known);
    const resetToken = tokenFromLastEmail();
    await expect(service.validateResetToken(resetToken)).resolves.toEqual({
      valid: true,
    });
    await service.resetPassword(
      {
        newPassword: "replacement-secure-password",
        passwordConfirmation: "replacement-secure-password",
      },
      resetToken,
    );

    await expect(service.validateResetToken(resetToken)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      service.refresh(login.tokens.refreshToken),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({
        email: "user@example.com",
        password: "initial-secure-password",
        rememberMe: false,
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({
        email: "user@example.com",
        password: "replacement-secure-password",
        rememberMe: false,
      }),
    ).resolves.toMatchObject({ user: { status: "ACTIVE" } });
  });
});
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.service.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";

import type { DatabaseClient } from "@template/database";

import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import type { EmailService } from "../../infrastructure/email/email.service.js";
import { AuthService } from "./auth.service.js";

describe("AuthService registration delivery", () => {
  it("rejects registration when verification email delivery fails", async () => {
    const deleteMany = vi
      .fn<(input: unknown) => Promise<{ count: number }>>()
      .mockResolvedValue({ count: 1 });
    const database = {
      user: {
        create: vi.fn().mockResolvedValue({
          id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
          email: "user@example.com",
          passwordHash: "not-returned",
          fullName: "Template User",
          phone: null,
          role: "USER",
          status: "PENDING_VERIFICATION",
          emailVerifiedAt: null,
          verificationTokenHash: "hash",
          verificationTokenExpiresAt: new Date(),
          resetTokenHash: null,
          resetTokenExpiresAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        deleteMany,
      },
    } as unknown as DatabaseClient;
    const deliveryError = new Error("delivery unavailable");
    const emailService = {
      sendVerificationEmail: vi.fn().mockRejectedValue(deliveryError),
    } as unknown as EmailService;
    const service = new AuthService(database, emailService);

    const registration = service.register({
      fullName: "Template User",
      email: "user@example.com",
      phone: null,
      password: "a-secure-test-password",
    });
    await expect(registration).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(registration).rejects.toMatchObject({
      statusCode: 503,
      code: "SERVICE_UNAVAILABLE",
      message: "Registration is temporarily unavailable. Please try again.",
    });
    await expect(registration).rejects.not.toBe(deliveryError);
    expect(deleteMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
        status: "PENDING_VERIFICATION",
        emailVerifiedAt: null,
      },
    });
    const cleanup = deleteMany.mock.calls[0]?.[0] as
      { where?: { verificationTokenHash?: unknown } } | undefined;
    expect(typeof cleanup?.where?.verificationTokenHash).toBe("string");
  });
});
```

### [UNTRACKED] `apps/api/src/modules/auth/auth.service.ts`

```typescript
import { randomUUID } from "node:crypto";

import type {
  EmailRequestBodyDto,
  LoginBodyDto,
  RegisterBodyDto,
  ResetPasswordBodyDto,
  ChangePasswordBodyDto,
} from "./dto/index.js";
import {
  Prisma,
  UserStatus,
  type DatabaseClient,
  type User,
} from "@template/database";

import { authConfig } from "../../core/config/auth.config.js";
import { BadRequestException } from "../../core/errors/bad-request.error.js";
import { ConflictException } from "../../core/errors/conflict.error.js";
import { ForbiddenException } from "../../core/errors/forbidden.error.js";
import { ServiceUnavailableException } from "../../core/errors/service-unavailable.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import type { EmailService } from "../../infrastructure/email/index.js";
import { logger } from "../../infrastructure/logger/logger.js";
import {
  compareHash,
  generateHash,
  sha256,
} from "../../infrastructure/security/index.js";
import {
  generateResetToken,
  generateTokenPair,
  generateVerificationToken,
  verifyRefreshToken,
  verifyResetToken,
  verifyVerificationToken,
} from "../../infrastructure/security/index.js";
import { mapSafeUser, SAFE_USER_SELECT } from "../users/users.mapper.js";
import {
  FORGOT_PASSWORD_NEUTRAL_RESPONSE,
  RESET_TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
  RESEND_NEUTRAL_RESPONSE,
  VERIFICATION_TOKEN_TTL_MS,
} from "./auth.constants.js";
import type {
  AuthResponseWithTokens,
  AuthResponseWithoutTokens,
  TokenPair,
} from "./types/auth.types.js";

export class AuthService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly emailService: EmailService,
  ) {}

  async register(data: RegisterBodyDto): Promise<AuthResponseWithoutTokens> {
    const email = data.email.trim().toLowerCase();
    const verificationToken = generateVerificationToken(email);
    const verificationTokenHash = sha256(verificationToken);
    const passwordHash = await generateHash(data.password);
    let user: User;

    try {
      user = await this.database.user.create({
        data: {
          email,
          fullName: data.fullName.trim(),
          phone: data.phone,
          passwordHash,
          status: UserStatus.PENDING_VERIFICATION,
          verificationTokenHash,
          verificationTokenExpiresAt: new Date(
            Date.now() + VERIFICATION_TOKEN_TTL_MS,
          ),
        },
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Email is already in use.");
      }
      throw error;
    }

    try {
      await this.emailService.sendVerificationEmail(
        user.fullName,
        user.email,
        verificationToken,
      );
    } catch {
      await this.removeUndeliverablePendingUser(user.id, verificationTokenHash);
      throw new ServiceUnavailableException(
        "Registration is temporarily unavailable. Please try again.",
      );
    }

    return { user: mapSafeUser(user) };
  }

  async resendVerification(
    data: EmailRequestBodyDto,
  ): Promise<typeof RESEND_NEUTRAL_RESPONSE> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
      select: {
        id: true,
        fullName: true,
        email: true,
        status: true,
        emailVerifiedAt: true,
        verificationTokenHash: true,
        verificationTokenExpiresAt: true,
      },
    });

    if (
      user === null ||
      user.status !== UserStatus.PENDING_VERIFICATION ||
      user.emailVerifiedAt !== null ||
      user.verificationTokenHash === null ||
      user.verificationTokenExpiresAt === null
    ) {
      return RESEND_NEUTRAL_RESPONSE;
    }

    const issuedAt =
      user.verificationTokenExpiresAt.getTime() - VERIFICATION_TOKEN_TTL_MS;
    if (Date.now() - issuedAt < RESEND_COOLDOWN_MS) {
      return RESEND_NEUTRAL_RESPONSE;
    }

    const token = generateVerificationToken(user.email);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    const replaced = await this.database.user.updateMany({
      where: {
        id: user.id,
        verificationTokenHash: user.verificationTokenHash,
        verificationTokenExpiresAt: user.verificationTokenExpiresAt,
      },
      data: {
        verificationTokenHash: sha256(token),
        verificationTokenExpiresAt: expiresAt,
      },
    });

    if (replaced.count === 1) {
      void this.emailService
        .sendVerificationEmail(user.fullName, user.email, token)
        .catch((_error: unknown) => {
          logger.error(
            { userId: user.id, outcome: "verification_resend_failed" },
            "Failed to resend verification email.",
          );
        });
    }

    return RESEND_NEUTRAL_RESPONSE;
  }

  async verifyEmail(token: string): Promise<AuthResponseWithoutTokens> {
    const verified = verifyVerificationToken(token);
    if (!verified.valid) {
      throw new BadRequestException("Invalid or expired verification token.");
    }

    const now = new Date();
    const user = await this.database.user.findFirst({
      where: {
        email: verified.payload.email.trim().toLowerCase(),
        verificationTokenHash: sha256(token),
        verificationTokenExpiresAt: { gt: now },
      },
    });
    if (user === null) {
      throw new BadRequestException("Invalid or expired verification token.");
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("Account is suspended.");
    }

    const updated = await this.database.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: now,
        status: UserStatus.ACTIVE,
        verificationTokenHash: null,
        verificationTokenExpiresAt: null,
      },
    });
    return { user: mapSafeUser(updated) };
  }

  async login(data: LoginBodyDto): Promise<AuthResponseWithTokens> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (user === null) throw new UnauthorizedException("Invalid credentials.");

    const passwordMatches = await compareHash(data.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid credentials.");
    }
    this.validateActiveUser(user);

    const generated = this.buildTokenPair(user, data.rememberMe);
    await this.database.refreshToken.create({ data: generated.record });
    return {
      user: mapSafeUser(user),
      tokens: generated.tokens,
      rememberMe: data.rememberMe,
    };
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    if (refreshToken.length === 0) return;
    await this.database.refreshToken.deleteMany({
      where: { userId, tokenHash: sha256(refreshToken) },
    });
  }

  async logoutAll(userId: string): Promise<void> {
    await this.database.refreshToken.deleteMany({ where: { userId } });
  }

  async refresh(refreshToken: string): Promise<AuthResponseWithTokens> {
    if (refreshToken.length === 0) {
      throw new BadRequestException("Refresh token is required.");
    }

    const verified = verifyRefreshToken(refreshToken);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid refresh token.");
    }

    const oldTokenHash = sha256(refreshToken);
    const now = new Date();
    const oldToken = await this.database.refreshToken.findFirst({
      where: {
        id: verified.payload.tokenId,
        userId: verified.payload.userId,
        tokenHash: oldTokenHash,
        expiresAt: { gt: now },
      },
      include: { user: true },
    });
    if (oldToken === null) {
      throw new UnauthorizedException("Invalid or expired refresh token.");
    }
    this.validateActiveUser(oldToken.user);

    const absoluteExpiry = new Date(verified.payload.expiresAt * 1_000);
    if (absoluteExpiry <= now) {
      throw new UnauthorizedException("Refresh token has expired.");
    }
    const replacement = this.buildTokenPairWithExpiry(
      oldToken.user,
      verified.payload.rememberMe,
      absoluteExpiry,
    );

    await this.database.$transaction(async (transaction) => {
      const deleted = await transaction.refreshToken.deleteMany({
        where: {
          id: oldToken.id,
          userId: oldToken.userId,
          tokenHash: oldTokenHash,
        },
      });
      if (deleted.count !== 1) {
        throw new UnauthorizedException("Refresh token has already been used.");
      }
      await transaction.refreshToken.create({ data: replacement.record });
    });

    return {
      user: mapSafeUser(oldToken.user),
      tokens: replacement.tokens,
      rememberMe: verified.payload.rememberMe,
    };
  }

  async forgotPassword(
    data: EmailRequestBodyDto,
  ): Promise<typeof FORGOT_PASSWORD_NEUTRAL_RESPONSE> {
    const user = await this.database.user.findUnique({
      where: { email: data.email.trim().toLowerCase() },
    });
    if (
      user === null ||
      user.status !== UserStatus.ACTIVE ||
      user.emailVerifiedAt === null
    ) {
      return FORGOT_PASSWORD_NEUTRAL_RESPONSE;
    }

    const token = generateResetToken(user.email);
    await this.database.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: sha256(token),
        resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
      },
    });
    void this.emailService
      .sendPasswordResetEmail(user.fullName, user.email, token)
      .catch((_error: unknown) => {
        logger.error(
          { userId: user.id, outcome: "password_reset_email_failed" },
          "Failed to send password reset email.",
        );
      });
    return FORGOT_PASSWORD_NEUTRAL_RESPONSE;
  }

  async resetPassword(
    data: ResetPasswordBodyDto,
    token: string,
  ): Promise<AuthResponseWithoutTokens> {
    const verified = verifyResetToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }

    const tokenHash = sha256(token);
    const now = new Date();
    const user = await this.database.user.findFirst({
      where: {
        email: verified.payload.email.trim().toLowerCase(),
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: { gt: now },
      },
    });
    if (user === null) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    this.validateActiveUser(user);
    await this.assertNewPasswordDiffers(data.newPassword, user.passwordHash);
    const passwordHash = await generateHash(data.newPassword);

    const updated = await this.database.$transaction(async (transaction) => {
      const consumed = await transaction.user.updateMany({
        where: {
          id: user.id,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: { not: null },
          resetTokenHash: tokenHash,
          resetTokenExpiresAt: { gt: now },
        },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException("Invalid or expired reset token.");
      }
      await transaction.refreshToken.deleteMany({
        where: { userId: user.id },
      });
      const safeUser = await transaction.user.findUnique({
        where: { id: user.id },
        select: SAFE_USER_SELECT,
      });
      if (safeUser === null) {
        throw new UnauthorizedException("Invalid or expired reset token.");
      }
      return safeUser;
    });
    return { user: mapSafeUser(updated) };
  }

  async validateResetToken(token: string): Promise<{ valid: true }> {
    const user = await this.findUserByResetToken(token);
    this.validateActiveUser(user);
    return { valid: true };
  }

  async changePassword(
    userId: string,
    data: ChangePasswordBodyDto,
  ): Promise<AuthResponseWithoutTokens> {
    const user = await this.database.user.findUnique({ where: { id: userId } });
    if (user === null) throw new UnauthorizedException("User not found.");
    this.validateActiveUser(user);

    if (!(await compareHash(data.currentPassword, user.passwordHash))) {
      throw new BadRequestException("Current password is not correct.");
    }
    await this.assertNewPasswordDiffers(data.newPassword, user.passwordHash);
    const updated = await this.updatePasswordAndRevokeTokens(
      user.id,
      data.newPassword,
    );
    return { user: mapSafeUser(updated) };
  }

  private async findUserByResetToken(token: string): Promise<User> {
    const verified = verifyResetToken(token);
    if (!verified.valid) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    const user = await this.database.user.findFirst({
      where: {
        email: verified.payload.email.trim().toLowerCase(),
        resetTokenHash: sha256(token),
        resetTokenExpiresAt: { gt: new Date() },
      },
    });
    if (user === null) {
      throw new UnauthorizedException("Invalid or expired reset token.");
    }
    return user;
  }

  private async assertNewPasswordDiffers(
    newPassword: string,
    passwordHash: string,
  ): Promise<void> {
    if (await compareHash(newPassword, passwordHash)) {
      throw new BadRequestException(
        "New password must differ from current password.",
      );
    }
  }

  private async updatePasswordAndRevokeTokens(
    userId: string,
    newPassword: string,
  ): Promise<User> {
    const passwordHash = await generateHash(newPassword);
    return this.database.$transaction(async (transaction) => {
      const updated = await transaction.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          resetTokenHash: null,
          resetTokenExpiresAt: null,
        },
      });
      await transaction.refreshToken.deleteMany({ where: { userId } });
      return updated;
    });
  }

  private buildTokenPair(
    user: User,
    rememberMe: boolean,
  ): {
    tokens: TokenPair;
    record: Prisma.RefreshTokenUncheckedCreateInput;
  } {
    const ttlSeconds = rememberMe
      ? authConfig.refreshRememberedTtlSeconds
      : authConfig.refreshFamilyTtlSeconds;
    return this.buildTokenPairWithExpiry(
      user,
      rememberMe,
      new Date(Date.now() + ttlSeconds * 1_000),
    );
  }

  private buildTokenPairWithExpiry(
    user: User,
    rememberMe: boolean,
    expiresAt: Date,
  ): {
    tokens: TokenPair;
    record: Prisma.RefreshTokenUncheckedCreateInput;
  } {
    const tokenId = randomUUID();
    const tokens = generateTokenPair({
      userId: user.id,
      tokenId,
      role: user.role,
      email: user.email,
      rememberMe,
      absoluteExpiresAt: expiresAt,
    });
    return {
      tokens,
      record: {
        id: tokenId,
        userId: user.id,
        tokenHash: sha256(tokens.refreshToken),
        expiresAt,
      },
    };
  }

  private validateActiveUser(
    user: Pick<User, "status" | "emailVerifiedAt">,
  ): void {
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("Account is suspended.");
    }
    if (user.status !== UserStatus.ACTIVE || user.emailVerifiedAt === null) {
      throw new BadRequestException("Verify your email before signing in.");
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    );
  }

  private async removeUndeliverablePendingUser(
    userId: string,
    verificationTokenHash: string,
  ): Promise<void> {
    try {
      const deleted = await this.database.user.deleteMany({
        where: {
          id: userId,
          status: UserStatus.PENDING_VERIFICATION,
          emailVerifiedAt: null,
          verificationTokenHash,
        },
      });
      if (deleted.count !== 1) {
        logger.error(
          { userId, outcome: "registration_delivery_rollback_missed" },
          "Pending registration could not be removed after email delivery failure.",
        );
      }
    } catch {
      logger.error(
        { userId, outcome: "registration_delivery_rollback_failed" },
        "Pending registration cleanup failed after email delivery failure.",
      );
    }
  }
}
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/change-password.dto.ts`

```typescript
import { changePasswordBodySchema } from "@template/contracts";
import type { z } from "zod";

export const changePasswordBodyDtoSchema = changePasswordBodySchema;
export type ChangePasswordBodyDto = z.infer<typeof changePasswordBodyDtoSchema>;
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/email-request.dto.ts`

```typescript
import { emailRequestBodySchema } from "@template/contracts";
import type { z } from "zod";

export const emailRequestBodyDtoSchema = emailRequestBodySchema;
export type EmailRequestBodyDto = z.infer<typeof emailRequestBodyDtoSchema>;
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/index.ts`

```typescript
export {
  changePasswordBodyDtoSchema,
  type ChangePasswordBodyDto,
} from "./change-password.dto.js";
export {
  emailRequestBodyDtoSchema,
  type EmailRequestBodyDto,
} from "./email-request.dto.js";
export { loginBodyDtoSchema, type LoginBodyDto } from "./login.dto.js";
export { registerBodyDtoSchema, type RegisterBodyDto } from "./register.dto.js";
export {
  resetPasswordBodyDtoSchema,
  type ResetPasswordBodyDto,
} from "./reset-password.dto.js";
export { tokenQueryDtoSchema, type TokenQueryDto } from "./token-query.dto.js";
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/login.dto.ts`

```typescript
import { loginBodySchema } from "@template/contracts";
import type { z } from "zod";

export const loginBodyDtoSchema = loginBodySchema;
export type LoginBodyDto = z.infer<typeof loginBodyDtoSchema>;
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/register.dto.ts`

```typescript
import { registerBodySchema } from "@template/contracts";
import type { z } from "zod";

export const registerBodyDtoSchema = registerBodySchema;
export type RegisterBodyDto = z.infer<typeof registerBodyDtoSchema>;
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/reset-password.dto.ts`

```typescript
import { resetPasswordBodySchema } from "@template/contracts";
import type { z } from "zod";

export const resetPasswordBodyDtoSchema = resetPasswordBodySchema;
export type ResetPasswordBodyDto = z.infer<typeof resetPasswordBodyDtoSchema>;
```

### [UNTRACKED] `apps/api/src/modules/auth/dto/token-query.dto.ts`

```typescript
import { tokenQuerySchema } from "@template/contracts";
import type { z } from "zod";

export const tokenQueryDtoSchema = tokenQuerySchema;
export type TokenQueryDto = z.infer<typeof tokenQueryDtoSchema>;
```

### [UNTRACKED] `apps/api/src/modules/auth/index.ts`

```typescript
export { AuthController } from "./auth.controller.js";
export { authRoutes } from "./auth.routes.js";
export { AuthService } from "./auth.service.js";
```

### [UNTRACKED] `apps/api/src/modules/auth/types/auth.types.ts`

```typescript
import type { SafeUser } from "@template/contracts";
import type { UserRole } from "@template/database";

export type CookieAttributes = Readonly<{
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "none";
  path: string;
  maxAge?: number;
}>;

export interface AccessTokenPayload {
  sub: string;
  jti: string;
  userId: string;
  tokenId: string;
  email: string;
  role: UserRole;
  type: "ACCESS";
}

export interface RefreshTokenPayload {
  sub: string;
  jti: string;
  userId: string;
  tokenId: string;
  rememberMe: boolean;
  expiresAt: number;
  type: "REFRESH";
}

export interface TemporaryTokenPayload {
  sub: string;
  jti: string;
  email: string;
  type: "VERIFICATION" | "PASSWORD_RESET";
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export type VerifiedToken<T> =
  | Readonly<{ valid: true; payload: T }>
  | Readonly<{ valid: false; error: string }>;

export interface AuthResponseWithTokens {
  user: SafeUser;
  tokens: TokenPair;
  rememberMe: boolean;
}

export interface AuthResponseWithoutTokens {
  user: SafeUser;
}
```

### [UNTRACKED] `apps/api/src/modules/users/dto/update-profile.dto.ts`

```typescript
import { updateProfileBodySchema } from "@template/contracts";
import type { UpdateProfileBody } from "@template/contracts";

export const updateProfileBodyDtoSchema = updateProfileBodySchema;
export type UpdateProfileBodyDto = UpdateProfileBody;
```

### [UNTRACKED] `apps/api/src/modules/users/index.ts`

```typescript
export { UsersController } from "./users.controller.js";
export { usersRoutes } from "./users.routes.js";
export { UsersService } from "./users.service.js";
export { mapSafeUser, SAFE_USER_SELECT } from "./users.mapper.js";
```

### [UNTRACKED] `apps/api/src/modules/users/users.controller.ts`

```typescript
import type { Request, Response } from "express";

import { ResponseHelper } from "../../core/responses/api-response.js";
import type { UpdateProfileBodyDto } from "./dto/update-profile.dto.js";
import type { UsersService } from "./users.service.js";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  getMe = async (request: Request, response: Response): Promise<Response> => {
    const user = await this.usersService.getCurrentUser(request.user?.id ?? "");
    return ResponseHelper.ok(
      response,
      { user },
      "Current user loaded.",
      request.path,
      request.requestId,
    );
  };

  updateMe = async (
    request: Request,
    response: Response,
  ): Promise<Response> => {
    const body = request.validated?.body as UpdateProfileBodyDto;
    const user = await this.usersService.updateCurrentUser(
      request.user?.id ?? "",
      body,
    );
    return ResponseHelper.ok(
      response,
      { user },
      "Profile updated.",
      request.path,
      request.requestId,
    );
  };
}
```

### [UNTRACKED] `apps/api/src/modules/users/users.mapper.ts`

```typescript
import type { SafeUser } from "@template/contracts";
import type { Prisma, User } from "@template/database";

export const SAFE_USER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.UserSelect;

export type SafeUserRecord = Prisma.UserGetPayload<{
  select: typeof SAFE_USER_SELECT;
}>;

export const mapSafeUser = (user: SafeUserRecord | User): SafeUser => ({
  id: user.id,
  fullName: user.fullName,
  email: user.email,
  phone: user.phone,
  role: user.role,
  status: user.status,
  emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
});
```

### [UNTRACKED] `apps/api/src/modules/users/users.routes.ts`

```typescript
import { Router, type RequestHandler } from "express";

import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { updateProfileBodyDtoSchema } from "./dto/update-profile.dto.js";
import type { UsersController } from "./users.controller.js";

export const usersRoutes = (
  controller: UsersController,
  authenticationMiddleware: RequestHandler,
): Router => {
  const router = Router();

  router.get("/me", authenticationMiddleware, controller.getMe);
  router.patch(
    "/me",
    authenticationMiddleware,
    csrfMiddleware,
    validationMiddleware({ body: updateProfileBodyDtoSchema }),
    controller.updateMe,
  );
  return router;
};
```

### [UNTRACKED] `apps/api/src/modules/users/users.service.ts`

```typescript
import type { SafeUser } from "@template/contracts";
import { UserStatus, type DatabaseClient } from "@template/database";

import { ForbiddenException } from "../../core/errors/forbidden.error.js";
import { UnauthorizedException } from "../../core/errors/unauthorized.error.js";
import type { UpdateProfileBodyDto } from "./dto/update-profile.dto.js";
import { mapSafeUser, SAFE_USER_SELECT } from "./users.mapper.js";

export class UsersService {
  constructor(private readonly database: DatabaseClient) {}

  async getCurrentUser(userId: string): Promise<SafeUser> {
    return mapSafeUser(await this.findActiveUser(userId));
  }

  async updateCurrentUser(
    userId: string,
    data: UpdateProfileBodyDto,
  ): Promise<SafeUser> {
    const user = await this.findActiveUser(userId);
    const updates: { fullName?: string; phone?: string | null } = {};

    if (data.fullName !== undefined) updates.fullName = data.fullName.trim();
    if (data.phone !== undefined) updates.phone = data.phone;

    if (
      (updates.fullName === undefined || updates.fullName === user.fullName) &&
      (updates.phone === undefined || updates.phone === user.phone)
    ) {
      return mapSafeUser(user);
    }

    const updated = await this.database.user.update({
      where: { id: userId },
      data: updates,
      select: SAFE_USER_SELECT,
    });
    return mapSafeUser(updated);
  }

  private async findActiveUser(userId: string) {
    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (user === null) throw new UnauthorizedException("User not found.");
    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenException("Account is suspended.");
    }
    if (user.status !== UserStatus.ACTIVE || user.emailVerifiedAt === null) {
      throw new ForbiddenException("Account is not active and verified.");
    }
    return user;
  }
}
```

### [UNTRACKED] `apps/api/tests/integration/global-setup.ts`

```typescript
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

const execFileAsync = promisify(execFile);

const deployMigrations = async (databaseUrl: string): Promise<void> => {
  const pnpmScript = process.env["npm_execpath"];
  if (pnpmScript === undefined) {
    throw new Error(
      "npm_execpath is required to deploy integration migrations.",
    );
  }
  await execFileAsync(
    process.execPath,
    [pnpmScript, "exec", "prisma", "migrate", "deploy"],
    {
      cwd: resolve(process.cwd(), "../../packages/database"),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 180_000,
      windowsHide: true,
    },
  );
};

export default async function setup(): Promise<() => Promise<void>> {
  delete process.env["DATABASE_URL"];
  const container = await new PostgreSqlContainer("postgres:18.4")
    .withDatabase("template_api_integration")
    .withUsername("template_test")
    .withPassword("test-only-password")
    .withStartupTimeout(120_000)
    .start();
  const databaseUrl = container.getConnectionUri();
  process.env["DATABASE_URL"] = databaseUrl;

  try {
    await deployMigrations(databaseUrl);
  } catch (error) {
    await container.stop();
    throw error;
  }

  return async () => {
    delete process.env["DATABASE_URL"];
    await container.stop();
  };
}
```

### [UNTRACKED] `apps/api/tests/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

### [UNTRACKED] `apps/api/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["src/**/*.integration.test.ts", "**/node_modules/**"],
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

### [UNTRACKED] `apps/api/vitest.integration.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    globalSetup: ["./tests/integration/global-setup.ts"],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
  },
});
```

### [UNTRACKED] `apps/api/vitest.setup.ts`

```typescript
process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgresql://template_test:template_test@127.0.0.1:5432/template_test";
process.env["AUTH_JWT_SECRET"] =
  "test-only-access-secret-000000000000000000000000";
process.env["AUTH_REFRESH_JWT_SECRET"] =
  "test-only-refresh-secret-00000000000000000000000";
process.env["AUTH_VERIFICATION_JWT_SECRET"] =
  "test-only-verify-secret-000000000000000000000000";
process.env["AUTH_RESET_JWT_SECRET"] =
  "test-only-reset-secret-0000000000000000000000000";
process.env["AUTH_ARGON2_MEMORY_KIB"] = "1944";
process.env["AUTH_ARGON2_TIME_COST"] = "1";
process.env["AUTH_ARGON2_PARALLELISM"] = "1";
process.env["LOG_LEVEL"] = "silent";
process.env["EMAIL_PROVIDER"] = "console";
process.env["WEB_APP_URL"] = "http://localhost:3000";
process.env["MAIL_FROM_ADDRESS"] = "no-reply@example.com";
process.env["AUTH_LIMIT_LOGIN_PER_15_MIN"] = "100";
process.env["AUTH_LIMIT_LOGIN_PER_15_MIN_ACCOUNT"] = "100";
process.env["AUTH_LIMIT_REGISTER_PER_HOUR"] = "100";
process.env["AUTH_LIMIT_VERIFY_PER_15_MIN"] = "100";
process.env["AUTH_LIMIT_FORGOT_PER_HOUR_SOURCE"] = "100";
process.env["AUTH_LIMIT_RESET_PER_15_MIN"] = "100";
```

### [UNTRACKED] `apps/web/src/app/(workspace)/dashboard/page.tsx`

```tsx
import { DashboardOverview } from "@/features/workspace/components/dashboard-overview";

export default function DashboardPage() {
  return <DashboardOverview />;
}
```

### [UNTRACKED] `apps/web/src/app/(workspace)/layout.tsx`

```tsx
import type { ReactNode } from "react";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <WorkspaceShell>{children}</WorkspaceShell>
    </ProtectedRoute>
  );
}
```

### [UNTRACKED] `apps/web/src/app/(workspace)/settings/page.tsx`

```tsx
import { AccountSettings } from "@/features/account/components/account-settings";

export default function SettingsPage() {
  return <AccountSettings />;
}
```

### [UNTRACKED] `apps/web/src/app/auth/forgot-password/page.tsx`

```tsx
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      eyebrow="Account recovery"
      title="Reset, without revealing."
      summary="Recovery responses stay intentionally neutral so account membership is never disclosed."
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
```

### [UNTRACKED] `apps/web/src/app/auth/layout.tsx`

```tsx
import type { ReactNode } from "react";

import { GuestOnlyRoute } from "@/components/auth/guest-only-route";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return <GuestOnlyRoute>{children}</GuestOnlyRoute>;
}
```

### [UNTRACKED] `apps/web/src/app/auth/login/page.tsx`

```tsx
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SessionLoader } from "@/components/auth/session-loader";
import { LoginForm } from "@/features/auth/components/login-form";

export default function LoginPage() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Resume your session."
      summary="Sign in with a verified account. The browser keeps your access token only in memory."
    >
      <Suspense fallback={<SessionLoader />}>
        <LoginForm />
      </Suspense>
    </AuthShell>
  );
}
```

### [UNTRACKED] `apps/web/src/app/auth/register/page.tsx`

```tsx
import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/features/auth/components/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      eyebrow="New account"
      title="Create your identity."
      summary="Start with a verified email and a strong password. Product-specific onboarding comes next."
    >
      <RegisterForm />
    </AuthShell>
  );
}
```

### [UNTRACKED] `apps/web/src/app/auth/reset-password/page.tsx`

```tsx
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SessionLoader } from "@/components/auth/session-loader";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Password reset"
      title="Replace the credential."
      summary="A successful reset consumes the link and revokes every existing refresh session."
    >
      <Suspense fallback={<SessionLoader />}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
```

### [UNTRACKED] `apps/web/src/app/auth/verify-email/page.tsx`

```tsx
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { SessionLoader } from "@/components/auth/session-loader";
import { VerifyEmailPanel } from "@/features/auth/components/verify-email-panel";

export default function VerifyEmailPage() {
  return (
    <AuthShell
      eyebrow="Email verification"
      title="Confirm the first link."
      summary="Verification tokens are short-lived, purpose-bound, and accepted only once."
    >
      <Suspense fallback={<SessionLoader />}>
        <VerifyEmailPanel />
      </Suspense>
    </AuthShell>
  );
}
```

### [UNTRACKED] `apps/web/src/app/providers.tsx`

```tsx
"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { createQueryClient } from "@/shared/query/query-client";

export function AppProviders({ children }: Readonly<{ children: ReactNode }>) {
  const [queryClient] = useState(() => createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
```

### [UNTRACKED] `apps/web/src/components/auth/auth-shell.tsx`

```tsx
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
```

### [UNTRACKED] `apps/web/src/components/auth/guest-only-route.tsx`

```tsx
"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/features/auth/hooks/auth.hooks";
import { getApiError } from "@/services/api/api-client";

import { SessionLoader } from "./session-loader";

type SessionSnapshot = Readonly<{
  isPending: boolean;
  isFetched: boolean;
  isError: boolean;
}>;

export type GuestOnlyRouteState =
  | { readonly kind: "pending" }
  | { readonly kind: "error" }
  | { readonly kind: "redirecting"; readonly target: string }
  | { readonly kind: "authorized" };

export const resolveGuestOnlyRouteState = (
  session: SessionSnapshot,
  account: ReturnType<typeof useSession>["data"] | null,
): GuestOnlyRouteState => {
  if (session.isPending || !session.isFetched) return { kind: "pending" };
  if (session.isError) return { kind: "error" };
  if (account === null || account === undefined) return { kind: "authorized" };
  if (
    account.user.status !== "ACTIVE" ||
    account.user.emailVerifiedAt === null
  ) {
    return { kind: "authorized" };
  }
  return { kind: "redirecting", target: "/dashboard" };
};

export function GuestOnlyRoute({
  children,
}: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const session = useSession();
  const state = resolveGuestOnlyRouteState(session, session.data ?? null);
  const redirectTarget = state.kind === "redirecting" ? state.target : null;

  useEffect(() => {
    if (redirectTarget !== null) router.replace(redirectTarget as Route);
  }, [redirectTarget, router]);

  if (state.kind === "error") {
    const error = getApiError(session.error);
    return (
      <div className="route-state">
        <p className="form-notice form-notice--error" role="alert">
          {error.message}
        </p>
        {error.requestId.length === 0 ? null : (
          <small>Request ID: {error.requestId}</small>
        )}
        <button
          className="button"
          type="button"
          onClick={() => {
            void session.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return state.kind === "authorized" ? children : <SessionLoader />;
}
```

### [UNTRACKED] `apps/web/src/components/auth/protected-route.tsx`

```tsx
"use client";

import type { UserRole } from "@template/contracts";
import type { Route } from "next";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useSession } from "@/features/auth/hooks/auth.hooks";
import { sanitizeReturnPath } from "@/features/auth/utils/safe-return-path";
import { getApiError } from "@/services/api/api-client";

import { SessionLoader } from "./session-loader";

type SessionSnapshot = Readonly<{
  isPending: boolean;
  isFetched: boolean;
  isError: boolean;
}>;

export type ProtectedRouteState =
  | { readonly kind: "pending" }
  | { readonly kind: "error" }
  | { readonly kind: "redirecting"; readonly target: string }
  | { readonly kind: "authorized" };

export const resolveProtectedRouteState = (
  session: SessionSnapshot,
  account: ReturnType<typeof useSession>["data"] | null,
  returnTo: string,
  allowedRoles: readonly UserRole[] | undefined,
): ProtectedRouteState => {
  if (session.isPending || !session.isFetched) return { kind: "pending" };
  if (session.isError) return { kind: "error" };
  if (account === null || account === undefined) {
    const safe = sanitizeReturnPath(returnTo);
    return {
      kind: "redirecting",
      target:
        safe === null
          ? "/auth/login"
          : `/auth/login?returnTo=${encodeURIComponent(safe)}`,
    };
  }
  if (
    account.user.status !== "ACTIVE" ||
    account.user.emailVerifiedAt === null
  ) {
    return { kind: "redirecting", target: "/auth/verify-email" };
  }
  if (allowedRoles !== undefined && !allowedRoles.includes(account.user.role)) {
    return { kind: "redirecting", target: "/dashboard" };
  }
  return { kind: "authorized" };
};

export function ProtectedRoute({
  allowedRoles,
  children,
}: Readonly<{
  allowedRoles?: readonly UserRole[];
  children: ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const state = resolveProtectedRouteState(
    session,
    session.data ?? null,
    pathname,
    allowedRoles,
  );
  const redirectTarget = state.kind === "redirecting" ? state.target : null;

  useEffect(() => {
    if (redirectTarget !== null) router.replace(redirectTarget as Route);
  }, [redirectTarget, router]);

  if (state.kind === "error") {
    const error = getApiError(session.error);
    return (
      <div className="route-state">
        <p className="form-notice form-notice--error" role="alert">
          {error.message}
        </p>
        {error.requestId.length === 0 ? null : (
          <small>Request ID: {error.requestId}</small>
        )}
        <button
          className="button"
          type="button"
          onClick={() => {
            void session.refetch();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return state.kind === "authorized" ? children : <SessionLoader />;
}
```

### [UNTRACKED] `apps/web/src/components/auth/route-state.test.ts`

```typescript
import type { AuthUserData, SafeUser } from "@template/contracts";
import { describe, expect, it } from "vitest";

import { resolveGuestOnlyRouteState } from "./guest-only-route";
import { resolveProtectedRouteState } from "./protected-route";

const user = (overrides: Partial<SafeUser> = {}): AuthUserData => ({
  user: {
    id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
    fullName: "Template User",
    email: "user@example.com",
    phone: null,
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: "2026-08-18T00:00:00.000Z",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
    ...overrides,
  },
});

const settled = { isPending: false, isFetched: true, isError: false };

describe("pure route states", () => {
  it("keeps pending and unexpected failures distinct", () => {
    expect(
      resolveProtectedRouteState(
        { ...settled, isPending: true },
        null,
        "/dashboard",
        undefined,
      ).kind,
    ).toBe("pending");
    expect(
      resolveGuestOnlyRouteState({ ...settled, isError: true }, null).kind,
    ).toBe("error");
  });

  it("redirects anonymous users with only a safe return path", () => {
    expect(
      resolveProtectedRouteState(
        settled,
        null,
        "/settings?section=profile",
        undefined,
      ),
    ).toEqual({
      kind: "redirecting",
      target: "/auth/login?returnTo=%2Fsettings%3Fsection%3Dprofile",
    });
    expect(
      resolveProtectedRouteState(
        settled,
        null,
        "/settings?token=secret",
        undefined,
      ),
    ).toEqual({ kind: "redirecting", target: "/auth/login" });
  });

  it("requires active verified accounts and the requested generic role", () => {
    expect(
      resolveProtectedRouteState(
        settled,
        user({ status: "SUSPENDED" }),
        "/dashboard",
        undefined,
      ),
    ).toEqual({ kind: "redirecting", target: "/auth/verify-email" });
    expect(
      resolveProtectedRouteState(settled, user(), "/dashboard", ["ADMIN"]),
    ).toEqual({ kind: "redirecting", target: "/dashboard" });
    expect(
      resolveProtectedRouteState(
        settled,
        user({ role: "ADMIN" }),
        "/dashboard",
        ["ADMIN"],
      ).kind,
    ).toBe("authorized");
  });

  it("allows guests and redirects a valid authenticated account", () => {
    expect(resolveGuestOnlyRouteState(settled, null).kind).toBe("authorized");
    expect(resolveGuestOnlyRouteState(settled, user())).toEqual({
      kind: "redirecting",
      target: "/dashboard",
    });
  });
});
```

### [UNTRACKED] `apps/web/src/components/auth/routes.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AuthUserData } from "@template/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GuestOnlyRoute } from "./guest-only-route";
import { ProtectedRoute } from "./protected-route";

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  replace: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/settings",
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useSession: mocks.useSession,
}));

vi.mock("@/services/api/api-client", () => ({
  getApiError: () => ({
    message: "Session lookup failed.",
    statusCode: 503,
    code: "SERVICE_UNAVAILABLE",
    requestId: "request-test",
    fieldErrors: {},
  }),
}));

const account: AuthUserData = {
  user: {
    id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
    fullName: "Template User",
    email: "user@example.com",
    phone: null,
    role: "USER",
    status: "ACTIVE",
    emailVerifiedAt: "2026-08-18T00:00:00.000Z",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  },
};

const session = (
  overrides: Record<string, unknown> = {},
): Record<string, unknown> => ({
  data: null,
  error: null,
  isPending: false,
  isFetched: true,
  isError: false,
  refetch: mocks.refetch,
  ...overrides,
});

describe("GuestOnlyRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the session loader while pending", () => {
    mocks.useSession.mockReturnValue(
      session({ isPending: true, isFetched: false }),
    );
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    expect(screen.getByText("Restoring your workspace.")).toBeInTheDocument();
  });

  it("shows unexpected errors with a retry action", () => {
    mocks.useSession.mockReturnValue(
      session({ isError: true, error: new Error("offline") }),
    );
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session lookup failed.",
    );
    expect(screen.getByText("Request ID: request-test")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("renders anonymous-only content for an anonymous session", () => {
    mocks.useSession.mockReturnValue(session());
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    expect(screen.getByText("Guest content")).toBeInTheDocument();
  });

  it("redirects an authenticated account", async () => {
    mocks.useSession.mockReturnValue(session({ data: account }));
    render(<GuestOnlyRoute>Guest content</GuestOnlyRoute>);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.queryByText("Guest content")).not.toBeInTheDocument();
  });
});

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the session loader while pending", () => {
    mocks.useSession.mockReturnValue(
      session({ isPending: true, isFetched: false }),
    );
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    expect(screen.getByText("Restoring your workspace.")).toBeInTheDocument();
  });

  it("shows unexpected errors with a retry action", () => {
    mocks.useSession.mockReturnValue(
      session({ isError: true, error: new Error("offline") }),
    );
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Session lookup failed.",
    );
    expect(mocks.refetch).toHaveBeenCalledOnce();
  });

  it("redirects anonymous users with a safe return path", async () => {
    mocks.useSession.mockReturnValue(session());
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith(
        "/auth/login?returnTo=%2Fsettings",
      );
    });
    expect(screen.queryByText("Private content")).not.toBeInTheDocument();
  });

  it("renders protected content for an active verified account", () => {
    mocks.useSession.mockReturnValue(session({ data: account }));
    render(<ProtectedRoute>Private content</ProtectedRoute>);
    expect(screen.getByText("Private content")).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
```

### [UNTRACKED] `apps/web/src/components/auth/session-loader.tsx`

```tsx
export function SessionLoader() {
  return (
    <main className="session-loader" aria-live="polite" aria-busy="true">
      <div className="session-loader__pulse" aria-hidden="true" />
      <p className="eyebrow">Session handshake</p>
      <h1>Restoring your workspace.</h1>
    </main>
  );
}
```

### [UNTRACKED] `apps/web/src/components/brand/brand-mark.tsx`

```tsx
import Link from "next/link";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand-mark" href="/" aria-label="Relay home">
      <span className="brand-mark__glyph" aria-hidden="true">
        R/
      </span>
      {compact ? null : (
        <span>
          <strong>Relay</strong>
          <small>full-stack starter</small>
        </span>
      )}
    </Link>
  );
}
```

### [UNTRACKED] `apps/web/src/components/brand/protocol-trace.tsx`

```tsx
const steps = [
  ["01", "Browser", "access token / memory"],
  ["02", "Express API", "CSRF + purpose claims"],
  ["03", "PostgreSQL", "hashed refresh family"],
] as const;

export function ProtocolTrace() {
  return (
    <ol className="protocol-trace">
      {steps.map(([number, title, detail], index) => (
        <li key={number}>
          <span className="protocol-trace__node" aria-hidden="true">
            {number}
          </span>
          <div>
            <strong>{title}</strong>
            <small>{detail}</small>
          </div>
          {index < steps.length - 1 ? (
            <span className="protocol-trace__pulse" aria-hidden="true" />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
```

### [UNTRACKED] `apps/web/src/components/forms/form-field.tsx`

```tsx
import type { InputHTMLAttributes } from "react";

export function FormField({
  error,
  hint,
  label,
  id,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
  id: string;
}) {
  const describedBy = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <label className="form-field" htmlFor={id}>
      <span>{label}</span>
      <input
        {...inputProps}
        id={id}
        aria-invalid={error === undefined ? undefined : true}
        aria-describedby={describedBy.length === 0 ? undefined : describedBy}
      />
      {hint === undefined ? null : <small id={`${id}-hint`}>{hint}</small>}
      {error === undefined ? null : (
        <small className="form-field__error" id={`${id}-error`} role="alert">
          {error}
        </small>
      )}
    </label>
  );
}
```

### [UNTRACKED] `apps/web/src/components/workspace/workspace-shell.test.tsx`

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkspaceShell } from "./workspace-shell";

const mocks = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/components/auth/session-loader", () => ({
  SessionLoader: () => <div>Loading session</div>,
}));
vi.mock("@/components/brand/brand-mark", () => ({
  BrandMark: () => <div>Template</div>,
}));
vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useLogout: () => ({ isPending: mocks.isPending, mutate: mocks.mutate }),
  useSession: () => ({
    data: {
      user: { fullName: "Template User", role: "USER" },
    },
  }),
}));

describe("WorkspaceShell session control", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPending = false;
  });

  it("settles current logout failures without a rejected UI promise", () => {
    render(
      <WorkspaceShell>
        <main>Workspace</main>
      </WorkspaceShell>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const options = mocks.mutate.mock.calls[0]?.[1] as
      { onSettled?: () => void } | undefined;
    expect(() => options?.onSettled?.()).not.toThrow();
    expect(mocks.replace).toHaveBeenCalledWith("/auth/login");
  });

  it("derives the disabled loading state from the mutation", () => {
    mocks.isPending = true;
    render(
      <WorkspaceShell>
        <main>Workspace</main>
      </WorkspaceShell>,
    );

    expect(screen.getByRole("button", { name: "Ending…" })).toBeDisabled();
  });
});
```

### [UNTRACKED] `apps/web/src/components/workspace/workspace-shell.tsx`

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

import { SessionLoader } from "@/components/auth/session-loader";
import { BrandMark } from "@/components/brand/brand-mark";
import { useLogout, useSession } from "@/features/auth/hooks/auth.hooks";

const navItems = [
  ["/dashboard", "Overview"],
  ["/settings", "Account"],
] as const;

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const logout = useLogout();
  const user = session.data?.user ?? null;

  if (user === null) return <SessionLoader />;

  const signOut = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        router.replace("/auth/login");
      },
    });
  };

  return (
    <div className="workspace">
      <header className="workspace__header">
        <BrandMark />
        <nav aria-label="Workspace navigation">
          {navItems.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="workspace__identity">
          <span>{user.fullName.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{user.fullName}</strong>
            <small>{user.role}</small>
          </div>
          <button type="button" onClick={signOut} disabled={logout.isPending}>
            {logout.isPending ? "Ending…" : "Sign out"}
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
```

### [UNTRACKED] `apps/web/src/features/account/components/account-settings.tsx`

```tsx
import { ProfileForm } from "@/features/users/components/profile-form";

import { PasswordForm } from "./password-form";
import { SessionControls } from "./session-controls";

export function AccountSettings() {
  return (
    <main className="workspace-main">
      <header className="workspace-title">
        <div>
          <p className="eyebrow">Account controls</p>
          <h1>Identity, kept explicit.</h1>
        </div>
        <p className="workspace-title__summary">
          Update safe profile fields or rotate your credential. Sensitive
          mutations require both authentication and CSRF proof.
        </p>
      </header>
      <div className="settings-stack">
        <ProfileForm />
        <PasswordForm />
        <SessionControls />
      </div>
    </main>
  );
}
```

### [UNTRACKED] `apps/web/src/features/account/components/password-form.tsx`

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  changePasswordBodySchema,
  PASSWORD_MIN_LENGTH,
  type ChangePasswordBody,
} from "@template/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useChangePassword } from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type PasswordInput = z.input<typeof changePasswordBodySchema>;

export function PasswordForm() {
  const changePassword = useChangePassword();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<PasswordInput, unknown, ChangePasswordBody>({
    resolver: zodResolver(changePasswordBodySchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      passwordConfirmation: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await changePassword.mutateAsync(values);
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <div className="settings-form__heading">
        <div>
          <p className="eyebrow">Credential</p>
          <h2>Change password</h2>
        </div>
        <p>A successful change signs out every active device.</p>
      </div>
      <div className="settings-form__fields">
        <FormField
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          error={errors.currentPassword?.message}
          {...register("currentPassword")}
        />
        <FormField
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          hint={`At least ${String(PASSWORD_MIN_LENGTH)} characters.`}
          error={errors.newPassword?.message}
          {...register("newPassword")}
        />
        <FormField
          id="passwordConfirmation"
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          error={errors.passwordConfirmation?.message}
          {...register("passwordConfirmation")}
        />
      </div>
      {message === null ? null : (
        <p className="form-notice form-notice--error" role="alert">
          {message}
        </p>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Changing…" : "Change password"}
      </button>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/account/components/session-controls.test.tsx`

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionControls } from "./session-controls";

const mocks = vi.hoisted(() => ({
  isPending: false,
  mutate: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));
vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useLogoutAll: () => ({ isPending: mocks.isPending, mutate: mocks.mutate }),
}));

describe("SessionControls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isPending = false;
  });

  it("settles logout-all failures without a rejected UI promise", () => {
    render(<SessionControls />);

    fireEvent.click(
      screen.getByRole("button", { name: "Sign out all devices" }),
    );
    const options = mocks.mutate.mock.calls[0]?.[1] as
      { onSettled?: () => void } | undefined;
    expect(() => options?.onSettled?.()).not.toThrow();
    expect(mocks.replace).toHaveBeenCalledWith("/auth/login");
  });

  it("derives the disabled loading state from the mutation", () => {
    mocks.isPending = true;
    render(<SessionControls />);

    expect(screen.getByRole("button", { name: "Revoking…" })).toBeDisabled();
  });
});
```

### [UNTRACKED] `apps/web/src/features/account/components/session-controls.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";

import { useLogoutAll } from "@/features/auth/hooks/auth.hooks";

export function SessionControls() {
  const router = useRouter();
  const logoutAll = useLogoutAll();

  const endEverySession = () => {
    logoutAll.mutate(undefined, {
      onSettled: () => {
        router.replace("/auth/login");
      },
    });
  };

  return (
    <section className="danger-panel">
      <div>
        <p className="eyebrow">Session control</p>
        <h2>Sign out every device</h2>
        <p>Revoke the entire refresh-token family for this account.</p>
      </div>
      <button
        className="button button--danger"
        type="button"
        onClick={endEverySession}
        disabled={logoutAll.isPending}
      >
        {logoutAll.isPending ? "Revoking…" : "Sign out all devices"}
      </button>
    </section>
  );
}
```

### [UNTRACKED] `apps/web/src/features/auth/api/auth.api.ts`

```typescript
import type {
  AuthSessionData,
  AuthUserData,
  ChangePasswordBody,
  EmailRequestBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "@template/contracts";

import {
  apiClient,
  setAccessToken,
  type ApiResponse,
} from "@/services/api/api-client";

type NeutralMessage = Readonly<{ message: string }>;

const acceptToken = (
  response: ApiResponse<AuthSessionData>,
): ApiResponse<AuthSessionData> => {
  setAccessToken(response.data.tokens.accessToken);
  return response;
};

export const authApi = {
  async register(body: RegisterBody): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.post<ApiResponse<AuthUserData>>(
      "/auth/register",
      body,
    );
    return response.data;
  },
  async verifyEmail(token: string): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.post<ApiResponse<AuthUserData>>(
      "/auth/verify-email",
      {},
      { params: { token } },
    );
    return response.data;
  },
  async resendVerification(
    body: EmailRequestBody,
  ): Promise<ApiResponse<NeutralMessage>> {
    const response = await apiClient.post<ApiResponse<NeutralMessage>>(
      "/auth/resend-verification",
      body,
    );
    return response.data;
  },
  async login(body: LoginBody): Promise<ApiResponse<AuthSessionData>> {
    const response = await apiClient.post<ApiResponse<AuthSessionData>>(
      "/auth/login",
      body,
    );
    return acceptToken(response.data);
  },
  async refresh(): Promise<ApiResponse<AuthSessionData>> {
    const response = await apiClient.post<ApiResponse<AuthSessionData>>(
      "/auth/refresh",
      {},
    );
    return acceptToken(response.data);
  },
  async logout(): Promise<ApiResponse<Record<string, never>>> {
    const response = await apiClient.post<ApiResponse<Record<string, never>>>(
      "/auth/logout",
      {},
    );
    return response.data;
  },
  async logoutAll(): Promise<ApiResponse<Record<string, never>>> {
    const response = await apiClient.post<ApiResponse<Record<string, never>>>(
      "/auth/logout-all",
      {},
    );
    return response.data;
  },
  async forgotPassword(
    body: EmailRequestBody,
  ): Promise<ApiResponse<NeutralMessage>> {
    const response = await apiClient.post<ApiResponse<NeutralMessage>>(
      "/auth/forgot-password",
      body,
    );
    return response.data;
  },
  async validateResetToken(
    token: string,
  ): Promise<ApiResponse<{ valid: true }>> {
    const response = await apiClient.get<ApiResponse<{ valid: true }>>(
      "/auth/validate-reset-token",
      { params: { token } },
    );
    return response.data;
  },
  async resetPassword(
    token: string,
    body: ResetPasswordBody,
  ): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.post<ApiResponse<AuthUserData>>(
      "/auth/reset-password",
      body,
      { params: { token } },
    );
    return response.data;
  },
  async changePassword(
    body: ChangePasswordBody,
  ): Promise<ApiResponse<AuthUserData>> {
    const response = await apiClient.patch<ApiResponse<AuthUserData>>(
      "/auth/change-password",
      body,
    );
    return response.data;
  },
};
```

### [UNTRACKED] `apps/web/src/features/auth/components/forgot-password-form.tsx`

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  emailRequestBodySchema,
  type EmailRequestBody,
} from "@template/contracts";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useForgotPassword } from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type EmailInput = z.input<typeof emailRequestBodySchema>;

export function ForgotPasswordForm() {
  const forgotPassword = useForgotPassword();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<EmailInput, unknown, EmailRequestBody>({
    resolver: zodResolver(emailRequestBodySchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await forgotPassword.mutateAsync(values);
      setMessage(result.data.message);
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormField
        id="email"
        label="Account email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      {message === null ? null : (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send recovery link"}
      </button>
      <p className="auth-form__footer">
        <Link href="/auth/login">Back to sign in</Link>
      </p>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/auth/components/login-form.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginForm } from "./login-form";

const mocks = vi.hoisted(() => ({
  getApiError: vi.fn(),
  mutateAsync: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  useLogin: () => ({ mutateAsync: mocks.mutateAsync }),
}));

vi.mock("@/services/api/api-client", () => ({
  getApiError: mocks.getApiError,
}));

describe("LoginForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies safe server field errors to the corresponding input", async () => {
    mocks.mutateAsync.mockRejectedValue(new Error("rejected"));
    mocks.getApiError.mockReturnValue({
      message: "Review the fields.",
      statusCode: 422,
      code: "VALIDATION_ERROR",
      requestId: "request-test",
      fieldErrors: { email: ["Email not recognized."] },
    });

    render(<LoginForm />);
    fireEvent.change(screen.getByLabelText("Work email"), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "CorrectHorseBatteryStaple!1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Sign in securely" }));

    await waitFor(() => {
      expect(screen.getByText("Email not recognized.")).toBeInTheDocument();
    });
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });
});
```

### [UNTRACKED] `apps/web/src/features/auth/components/login-form.tsx`

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { loginBodySchema, type LoginBody } from "@template/contracts";
import Link from "next/link";
import type { Route } from "next";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useLogin } from "@/features/auth/hooks/auth.hooks";
import { resolvePostLoginPath } from "@/features/auth/utils/safe-return-path";
import { applyApiFormError } from "@/shared/forms/form";

type LoginInput = z.input<typeof loginBodySchema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<LoginInput, unknown, LoginBody>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: "", password: "", rememberMe: false },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      router.replace(
        resolvePostLoginPath(searchParams.get("returnTo")) as Route,
      );
    } catch (error) {
      setFormError(applyApiFormError(error, { getValues, setError }));
    }
  });

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormField
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <div className="form-row">
        <label className="check-field">
          <input type="checkbox" {...register("rememberMe")} />
          <span>Keep me signed in</span>
        </label>
        <Link href="/auth/forgot-password">Forgot password?</Link>
      </div>
      {formError === null ? null : (
        <p className="form-notice form-notice--error" role="alert">
          {formError}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Establishing session…" : "Sign in securely"}
      </button>
      <p className="auth-form__footer">
        New to Relay? <Link href="/auth/register">Create an account</Link>
      </p>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/auth/components/register-form.tsx`

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  PASSWORD_MIN_LENGTH,
  registerBodySchema,
  type RegisterBody,
} from "@template/contracts";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useRegister } from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type RegisterInput = z.input<typeof registerBodySchema>;

export function RegisterForm() {
  const registerAccount = useRegister();
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<RegisterInput, unknown, RegisterBody>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { fullName: "", email: "", phone: null, password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await registerAccount.mutateAsync(values);
      setSubmittedEmail(result.data.user.email);
    } catch (error) {
      setFormError(applyApiFormError(error, { getValues, setError }));
    }
  });

  if (submittedEmail !== null) {
    return (
      <div className="success-panel" aria-live="polite">
        <span className="success-panel__mark" aria-hidden="true">
          ✓
        </span>
        <h2>Check your inbox.</h2>
        <p>
          We sent a verification link to <strong>{submittedEmail}</strong>.
          Verify your address before signing in.
        </p>
        <Link className="button button--full" href="/auth/login">
          Return to sign in
        </Link>
      </div>
    );
  }

  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormField
        id="fullName"
        label="Full name"
        autoComplete="name"
        error={errors.fullName?.message}
        {...register("fullName")}
      />
      <FormField
        id="email"
        label="Work email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      <FormField
        id="phone"
        label="Phone (optional)"
        type="tel"
        autoComplete="tel"
        error={errors.phone?.message}
        {...register("phone")}
      />
      <FormField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        hint={`Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`}
        error={errors.password?.message}
        {...register("password")}
      />
      {formError === null ? null : (
        <p className="form-notice form-notice--error" role="alert">
          {formError}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Creating account…" : "Create account"}
      </button>
      <p className="auth-form__footer">
        Already registered? <Link href="/auth/login">Sign in</Link>
      </p>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/auth/components/reset-password-form.tsx`

```tsx
"use client";

import {
  PASSWORD_MIN_LENGTH,
  resetPasswordBodySchema,
  type ResetPasswordBody,
} from "@template/contracts";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import {
  useResetPassword,
  useValidateResetToken,
} from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError, useZodForm } from "@/shared/forms/form";

type ResetInput = z.input<typeof resetPasswordBodySchema>;

export function ResetPasswordForm() {
  const token = useSearchParams().get("token");
  const tokenQuery = useValidateResetToken(token ?? "");
  const resetPassword = useResetPassword();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useZodForm<ResetInput, ResetPasswordBody>(
    resetPasswordBodySchema,
    { defaultValues: { newPassword: "", passwordConfirmation: "" } },
  );
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = form;

  const onSubmit = handleSubmit(async (body) => {
    if (token === null) return;
    setFormError(null);
    try {
      await resetPassword.mutateAsync({ token, body });
    } catch (error) {
      setFormError(applyApiFormError(error, form));
    }
  });

  if (token === null || tokenQuery.isError) {
    return (
      <div className="success-panel">
        <h2>Link unavailable.</h2>
        <p>This recovery link is missing, expired, or was already used.</p>
        <Link className="button button--full" href="/auth/forgot-password">
          Request another link
        </Link>
      </div>
    );
  }
  if (tokenQuery.isPending) {
    return (
      <p className="form-notice" aria-live="polite">
        Checking this recovery link...
      </p>
    );
  }
  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <FormField
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint={`Use at least ${String(PASSWORD_MIN_LENGTH)} characters.`}
        error={errors.newPassword?.message}
        {...register("newPassword")}
      />
      <FormField
        id="passwordConfirmation"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        error={errors.passwordConfirmation?.message}
        {...register("passwordConfirmation")}
      />
      {formError === null ? null : (
        <p className="form-notice form-notice--error" role="alert">
          {formError}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Updating..." : "Set new password"}
      </button>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/auth/components/verify-email-panel.tsx`

```tsx
"use client";

import {
  emailRequestBodySchema,
  type EmailRequestBody,
} from "@template/contracts";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import {
  useResendVerification,
  useVerifyEmail,
} from "@/features/auth/hooks/auth.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type VerifyState = "working" | "verified" | "invalid";
type EmailInput = z.input<typeof emailRequestBodySchema>;

export function VerifyEmailPanel() {
  const verifyEmail = useVerifyEmail();
  const resendVerification = useResendVerification();
  const token = useSearchParams().get("token");
  const attemptedToken = useRef<string | null>(null);
  const [state, setState] = useState<VerifyState>("working");
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<EmailInput, unknown, EmailRequestBody>({
    resolver: zodResolver(emailRequestBodySchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (token === null || attemptedToken.current === token) return;
    attemptedToken.current = token;
    void verifyEmail
      .mutateAsync(token)
      .then(() => {
        setState("verified");
      })
      .catch(() => {
        setState("invalid");
      });
  }, [token, verifyEmail]);

  const resend = handleSubmit(async (values) => {
    try {
      const result = await resendVerification.mutateAsync(values);
      setMessage(result.data.message);
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  const visibleState = token === null ? "invalid" : state;

  if (visibleState === "working") {
    return (
      <p className="form-notice" aria-live="polite">
        Verifying your one-time link…
      </p>
    );
  }
  if (visibleState === "verified") {
    return (
      <div className="success-panel">
        <span className="success-panel__mark" aria-hidden="true">
          ✓
        </span>
        <h2>Email verified.</h2>
        <p>Your account is active and ready for a new session.</p>
        <Link className="button button--full" href="/auth/login">
          Continue to sign in
        </Link>
      </div>
    );
  }
  return (
    <form
      className="auth-form"
      onSubmit={(event) => {
        void resend(event);
      }}
      noValidate
    >
      <p className="form-notice form-notice--error">
        This verification link is missing, invalid, or expired.
      </p>
      <FormField
        id="email"
        label="Account email"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register("email")}
      />
      {message === null ? null : (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}
      <button
        className="button button--full"
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? "Sending…" : "Send a fresh link"}
      </button>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/auth/constants/auth.constants.ts`

```typescript
export const AUTH_PATHS = Object.freeze({
  login: "/auth/login",
  register: "/auth/register",
  verifyEmail: "/auth/verify-email",
  forgotPassword: "/auth/forgot-password",
  resetPassword: "/auth/reset-password",
  dashboard: "/dashboard",
  settings: "/settings",
});

export const DEFAULT_RETURN_PATH = AUTH_PATHS.dashboard;
```

### [UNTRACKED] `apps/web/src/features/auth/hooks/auth.hooks.test.tsx`

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  AUTH_SESSION_QUERY_KEY,
  loadSession,
  useChangePassword,
  useLogin,
  useLogout,
  useResetPassword,
} from "./auth.hooks";

const mocks = vi.hoisted(() => ({
  clearAccessToken: vi.fn(),
  changePassword: vi.fn(),
  getAccessToken: vi.fn(),
  getApiError: vi.fn(),
  getMe: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  refresh: vi.fn(),
  replaceWithLogin: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/services/api/api-client", () => ({
  clearAccessToken: mocks.clearAccessToken,
  getAccessToken: mocks.getAccessToken,
  getApiError: mocks.getApiError,
}));
vi.mock("@/features/users/api/users.api", () => ({
  usersApi: { getMe: mocks.getMe },
}));
vi.mock("../api/auth.api", () => ({
  authApi: {
    changePassword: mocks.changePassword,
    login: mocks.login,
    logout: mocks.logout,
    refresh: mocks.refresh,
    resetPassword: mocks.resetPassword,
  },
}));
vi.mock("../utils/session-navigation", () => ({
  replaceWithLogin: mocks.replaceWithLogin,
}));

const apiError = (statusCode: number, code: string) => ({
  message: "test",
  statusCode,
  code,
  requestId: "request",
  fieldErrors: {},
});

describe("loadSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAccessToken.mockReturnValue({ kind: "missing" });
  });

  it.each([
    [400, "BAD_REQUEST"],
    [401, "UNAUTHORIZED"],
  ])("treats refresh %s/%s as anonymous", async (statusCode, code) => {
    mocks.refresh.mockRejectedValue(new Error("anonymous"));
    mocks.getApiError.mockReturnValue(apiError(statusCode, code));
    await expect(loadSession()).resolves.toBeNull();
    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(mocks.getMe).not.toHaveBeenCalled();
  });

  it.each([
    [400, "VALIDATION_ERROR"],
    [401, "TOKEN_REPLAYED"],
    [403, "FORBIDDEN"],
    [503, "SERVICE_UNAVAILABLE"],
  ])("rethrows unexpected refresh %s/%s", async (statusCode, code) => {
    const error = new Error("unexpected");
    mocks.refresh.mockRejectedValue(error);
    mocks.getApiError.mockReturnValue(apiError(statusCode, code));
    await expect(loadSession()).rejects.toBe(error);
    expect(mocks.clearAccessToken).not.toHaveBeenCalled();
  });

  it("loads the current user after refresh", async () => {
    const account = { user: { id: "user" } };
    mocks.refresh.mockResolvedValue(undefined);
    mocks.getMe.mockResolvedValue(account);
    await expect(loadSession()).resolves.toBe(account);
  });

  it("skips proactive refresh when an access token already exists", async () => {
    const account = { user: { id: "user" } };
    mocks.getAccessToken.mockReturnValue({ kind: "value", value: "token" });
    mocks.getMe.mockResolvedValue(account);
    await expect(loadSession()).resolves.toBe(account);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([400, 401])(
    "treats current-user HTTP %s as anonymous",
    async (statusCode) => {
      mocks.getAccessToken.mockReturnValue({ kind: "value", value: "token" });
      mocks.getMe.mockRejectedValue(new Error("anonymous current user"));
      mocks.getApiError.mockReturnValue(apiError(statusCode, "UNAUTHORIZED"));

      await expect(loadSession()).resolves.toBeNull();

      expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    },
  );

  it("does not hide unexpected current-user errors", async () => {
    const error = new Error("suspended");
    mocks.getAccessToken.mockReturnValue({ kind: "value", value: "token" });
    mocks.getMe.mockRejectedValue(error);
    mocks.getApiError.mockReturnValue(apiError(403, "FORBIDDEN"));
    await expect(loadSession()).rejects.toBe(error);
  });
});

const createHarness = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
  const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { queryClient, wrapper };
};

const account = {
  user: {
    id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
    fullName: "Template User",
    email: "user@example.com",
    phone: null,
    role: "USER" as const,
    status: "ACTIVE" as const,
    emailVerifiedAt: "2026-08-18T00:00:00.000Z",
    createdAt: "2026-08-18T00:00:00.000Z",
    updatedAt: "2026-08-18T00:00:00.000Z",
  },
};

describe("session mutation hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("populates the session cache only after login and current-user lookup", async () => {
    const { queryClient, wrapper } = createHarness();
    mocks.login.mockResolvedValue({});
    mocks.getMe.mockResolvedValue(account);
    const { result } = renderHook(() => useLogin(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        email: "user@example.com",
        password: "CorrectHorseBatteryStaple!1",
        rememberMe: false,
      });
    });

    expect(mocks.login).toHaveBeenCalledOnce();
    expect(mocks.getMe).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(AUTH_SESSION_QUERY_KEY)).toEqual(account);
  });

  it("clears in-memory credentials and every query even when logout fails", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    queryClient.setQueryData(["unrelated"], "cached");
    mocks.logout.mockRejectedValue(new Error("network"));
    const { result } = renderHook(() => useLogout(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("fully clears the session after a password change", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    mocks.changePassword.mockResolvedValue({});
    const { result } = renderHook(() => useChangePassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        currentPassword: "OldCorrectHorseBatteryStaple!1",
        newPassword: "NewCorrectHorseBatteryStaple!1",
        passwordConfirmation: "NewCorrectHorseBatteryStaple!1",
      });
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.replaceWithLogin).toHaveBeenCalledOnce();
  });

  it("fully clears the session after a password reset", async () => {
    const { queryClient, wrapper } = createHarness();
    queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    mocks.resetPassword.mockResolvedValue({});
    const { result } = renderHook(() => useResetPassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        token: "opaque-reset-token",
        body: {
          newPassword: "NewCorrectHorseBatteryStaple!1",
          passwordConfirmation: "NewCorrectHorseBatteryStaple!1",
        },
      });
    });

    expect(mocks.clearAccessToken).toHaveBeenCalledOnce();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(mocks.replaceWithLogin).toHaveBeenCalledOnce();
  });
});
```

### [UNTRACKED] `apps/web/src/features/auth/hooks/auth.hooks.ts`

```typescript
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";
import type {
  AuthUserData,
  ChangePasswordBody,
  EmailRequestBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "@template/contracts";

import { usersApi } from "@/features/users/api/users.api";
import {
  clearAccessToken,
  getAccessToken,
  getApiError,
  type ApiError,
} from "@/services/api/api-client";

import { authApi } from "../api/auth.api";
import { replaceWithLogin } from "../utils/session-navigation";

export const AUTH_SESSION_QUERY_KEY = ["auth", "session"] as const;

const isAnonymousRefreshError = (error: ApiError): boolean =>
  (error.statusCode === 400 && error.code === "BAD_REQUEST") ||
  (error.statusCode === 401 && error.code === "UNAUTHORIZED");

export const loadSession = async (): Promise<AuthUserData | null> => {
  if (getAccessToken().kind === "missing") {
    try {
      await authApi.refresh();
    } catch (error: unknown) {
      if (isAnonymousRefreshError(getApiError(error))) {
        clearAccessToken();
        return null;
      }
      throw error;
    }
  }
  try {
    return await usersApi.getMe();
  } catch (error: unknown) {
    const apiError = getApiError(error);
    if (apiError.statusCode === 400 || apiError.statusCode === 401) {
      clearAccessToken();
      return null;
    }
    throw error;
  }
};

export const useSession = () =>
  useQuery({
    queryKey: AUTH_SESSION_QUERY_KEY,
    queryFn: loadSession,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: false,
  });

export function useLogin(): UseMutationResult<
  AuthUserData,
  unknown,
  LoginBody
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body) => {
      await authApi.login(body);
      return usersApi.getMe();
    },
    onSuccess: (account) => {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    },
  });
}

export const useRegister = () =>
  useMutation({ mutationFn: (body: RegisterBody) => authApi.register(body) });

export const useVerifyEmail = () =>
  useMutation({ mutationFn: (token: string) => authApi.verifyEmail(token) });

export const useResendVerification = () =>
  useMutation({
    mutationFn: (body: EmailRequestBody) => authApi.resendVerification(body),
  });

const useSessionEndingMutation = (allDevices: boolean) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => (allDevices ? authApi.logoutAll() : authApi.logout()),
    onSettled: () => {
      clearAccessToken();
      queryClient.clear();
    },
  });
};

export const useLogout = () => useSessionEndingMutation(false);
export const useLogoutAll = () => useSessionEndingMutation(true);

export const useForgotPassword = () =>
  useMutation({
    mutationFn: (body: EmailRequestBody) => authApi.forgotPassword(body),
  });

export const useResetPassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ token, body }: { token: string; body: ResetPasswordBody }) =>
      authApi.resetPassword(token, body),
    onSuccess: () => {
      clearAccessToken();
      queryClient.clear();
      replaceWithLogin();
    },
  });
};

export const useValidateResetToken = (token: string) =>
  useQuery({
    queryKey: ["auth", "reset-token", token] as const,
    queryFn: () => authApi.validateResetToken(token),
    enabled: token.length > 0,
    staleTime: 300_000,
    retry: false,
  });

export const useChangePassword = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ChangePasswordBody) => authApi.changePassword(body),
    onSuccess: () => {
      clearAccessToken();
      queryClient.clear();
      replaceWithLogin();
    },
  });
};
```

### [UNTRACKED] `apps/web/src/features/auth/utils/safe-return-path.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import { resolvePostLoginPath, sanitizeReturnPath } from "./safe-return-path";

describe("safe return paths", () => {
  it.each(["/dashboard", "/settings"])("allows %s", (path) => {
    expect(sanitizeReturnPath(path)).toBe(path);
  });

  it.each([
    "https://attacker.example/dashboard",
    "//attacker.example/dashboard",
    "/auth/login",
    "/dashboard?token=secret",
    "/dashboard%00",
    "/user@example.com",
    "/dashboard\\redirect",
    "%E0%A4%A",
  ])("rejects unsafe value %s", (path) => {
    expect(sanitizeReturnPath(path)).toBeNull();
  });

  it("uses the dashboard only when resolving a missing or unsafe path", () => {
    expect(resolvePostLoginPath(null)).toBe("/dashboard");
    expect(resolvePostLoginPath("//attacker.example")).toBe("/dashboard");
  });
});
```

### [UNTRACKED] `apps/web/src/features/auth/utils/safe-return-path.ts`

```typescript
import { DEFAULT_RETURN_PATH } from "../constants/auth.constants";

const ALLOWED_ROOTS = ["/dashboard", "/settings"] as const;
const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
]);

export const sanitizeReturnPath = (
  value: string | null | undefined,
): string | null => {
  if (value === undefined || value === null || value.length === 0) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (
    value.includes("://") ||
    value.includes(String.fromCharCode(92)) ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    })
  ) {
    return null;
  }
  try {
    const parsed = new URL(value, "https://template.invalid");
    if (parsed.origin !== "https://template.invalid") return null;
    if (
      !ALLOWED_ROOTS.some(
        (root) =>
          parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
      )
    ) {
      return null;
    }
    for (const key of parsed.searchParams.keys()) {
      if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};

export const resolvePostLoginPath = (
  value: string | null | undefined,
): string => sanitizeReturnPath(value) ?? DEFAULT_RETURN_PATH;
```

### [UNTRACKED] `apps/web/src/features/auth/utils/session-navigation.ts`

```typescript
export const replaceWithLogin = (): void => {
  if (typeof window !== "undefined") window.location.replace("/auth/login");
};
```

### [UNTRACKED] `apps/web/src/features/users/api/users.api.ts`

```typescript
import type { AuthUserData, UpdateProfileBody } from "@template/contracts";

import { apiClient, type ApiResponse } from "@/services/api/api-client";

export const usersApi = {
  async getMe(): Promise<AuthUserData> {
    const response =
      await apiClient.get<ApiResponse<AuthUserData>>("/users/me");
    return response.data.data;
  },
  async updateMe(body: UpdateProfileBody): Promise<AuthUserData> {
    const response = await apiClient.patch<ApiResponse<AuthUserData>>(
      "/users/me",
      body,
    );
    return response.data.data;
  },
};
```

### [UNTRACKED] `apps/web/src/features/users/components/profile-form.tsx`

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  updateProfileBodySchema,
  type UpdateProfileBody,
} from "@template/contracts";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { FormField } from "@/components/forms/form-field";
import { useSession } from "@/features/auth/hooks/auth.hooks";
import { useUpdateProfile } from "@/features/users/hooks/users.hooks";
import { applyApiFormError } from "@/shared/forms/form";

type ProfileInput = z.input<typeof updateProfileBodySchema>;

export function ProfileForm() {
  const user = useSession().data?.user ?? null;
  const updateProfile = useUpdateProfile();
  const [message, setMessage] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    getValues,
    register,
    setError,
  } = useForm<ProfileInput, unknown, UpdateProfileBody>({
    resolver: zodResolver(updateProfileBodySchema),
    values: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? null,
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setMessage(null);
    try {
      await updateProfile.mutateAsync(values);
      setMessage("Profile details saved.");
    } catch (error) {
      setMessage(applyApiFormError(error, { getValues, setError }));
    }
  });

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        void onSubmit(event);
      }}
      noValidate
    >
      <div className="settings-form__heading">
        <div>
          <p className="eyebrow">Profile</p>
          <h2>Personal details</h2>
        </div>
        <p>Only explicitly safe account fields reach the browser.</p>
      </div>
      <div className="settings-form__fields">
        <FormField
          id="fullName"
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register("fullName")}
        />
        <FormField
          id="phone"
          label="Phone (optional)"
          type="tel"
          autoComplete="tel"
          error={errors.phone?.message}
          {...register("phone")}
        />
        <FormField
          id="profileEmail"
          label="Email"
          type="email"
          value={user?.email ?? ""}
          disabled
          readOnly
        />
      </div>
      {message === null ? null : (
        <p className="form-notice" role="status">
          {message}
        </p>
      )}
      <button className="button" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
```

### [UNTRACKED] `apps/web/src/features/users/hooks/users.hooks.test.tsx`

```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useUpdateProfile } from "./users.hooks";

const mocks = vi.hoisted(() => ({ updateMe: vi.fn() }));

vi.mock("@/features/auth/hooks/auth.hooks", () => ({
  AUTH_SESSION_QUERY_KEY: ["auth", "session"] as const,
}));

vi.mock("../api/users.api", () => ({
  usersApi: { updateMe: mocks.updateMe },
}));

describe("useUpdateProfile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces the authoritative session cache with the returned profile", async () => {
    const sessionKey = ["auth", "session"] as const;
    const updatedAccount = {
      user: {
        id: "1b3d904e-a46c-4dd8-9cb7-d0767546ea95",
        fullName: "Updated User",
      },
    };
    mocks.updateMe.mockResolvedValue(updatedAccount);
    const queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
    const wrapper = ({ children }: Readonly<{ children: ReactNode }>) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        fullName: "Updated User",
        phone: null,
      });
    });

    expect(mocks.updateMe).toHaveBeenCalledWith({
      fullName: "Updated User",
      phone: null,
    });
    expect(queryClient.getQueryData(sessionKey)).toEqual(updatedAccount);
  });
});
```

### [UNTRACKED] `apps/web/src/features/users/hooks/users.hooks.ts`

```typescript
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateProfileBody } from "@template/contracts";

import { AUTH_SESSION_QUERY_KEY } from "@/features/auth/hooks/auth.hooks";

import { usersApi } from "../api/users.api";

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileBody) => usersApi.updateMe(body),
    onSuccess: (account) => {
      queryClient.setQueryData(AUTH_SESSION_QUERY_KEY, account);
    },
  });
};
```

### [UNTRACKED] `apps/web/src/features/workspace/components/dashboard-overview.tsx`

```tsx
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
```

### [UNTRACKED] `apps/web/src/services/api/api-client.test.ts`

```typescript
import {
  AxiosHeaders,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  apiClient,
  clearAccessToken,
  getAccessToken,
  getApiError,
  isPublicAuthRequest,
  setAccessToken,
} from "./api-client";

const navigationMocks = vi.hoisted(() => ({
  assign: vi.fn(),
  getLocation: vi.fn(() => ({ pathname: "/", search: "" })),
}));

vi.mock("./browser-location", () => ({
  assignBrowserLocation: navigationMocks.assign,
  getBrowserLocation: navigationMocks.getLocation,
}));

const responseFor = (
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): AxiosResponse<unknown> => ({
  data,
  status,
  statusText: status >= 400 ? "Error" : "OK",
  headers: new AxiosHeaders(),
  config,
});

const rejectFor = (
  config: InternalAxiosRequestConfig,
  status = 401,
  data: unknown = {},
): Promise<never> =>
  Promise.reject(
    Object.assign(new Error(`HTTP ${String(status)}`), {
      name: "AxiosError",
      code: "ERR_BAD_REQUEST",
      config,
      response: responseFor(config, data, status),
      isAxiosError: true,
    }),
  );

const refreshResponse = (config: InternalAxiosRequestConfig) =>
  responseFor(config, {
    success: true,
    statusCode: 200,
    message: "Session refreshed.",
    data: { tokens: { accessToken: "fresh-token" } },
    requestId: "refresh-request",
    timestamp: "2026-08-18T00:00:00.000Z",
    path: "/api/v1/auth/refresh",
  });

const defaultAdapter = apiClient.defaults.adapter;

afterEach(() => {
  clearAccessToken();
  if (defaultAdapter !== undefined) apiClient.defaults.adapter = defaultAdapter;
  navigationMocks.assign.mockReset();
  navigationMocks.getLocation.mockReset();
  navigationMocks.getLocation.mockReturnValue({ pathname: "/", search: "" });
});

describe("apiClient configuration and errors", () => {
  it("normalizes the configured base URL and sends credentials", () => {
    expect(apiClient.defaults.baseURL).toBe("http://localhost:4000/api/v1");
    expect(apiClient.defaults.withCredentials).toBe(true);
  });

  it("keeps the access token in discriminated module memory", () => {
    expect(getAccessToken()).toEqual({ kind: "missing" });
    setAccessToken("token");
    expect(getAccessToken()).toEqual({ kind: "value", value: "token" });
  });

  it("parses the real error envelope and groups repeated field errors", () => {
    const result = getApiError({
      isAxiosError: true,
      response: {
        status: 422,
        headers: {},
        data: {
          success: false,
          statusCode: 422,
          code: "VALIDATION_ERROR",
          message: "Validation failed.",
          requestId: "request-1",
          errors: [
            { field: "body.email", message: "Invalid." },
            { field: "body.email", message: "Already used." },
          ],
        },
      },
    });
    expect(result).toEqual({
      message: "Validation failed.",
      statusCode: 422,
      code: "VALIDATION_ERROR",
      requestId: "request-1",
      fieldErrors: { "body.email": ["Invalid.", "Already used."] },
    });
  });

  it("uses generic English network and timeout fallbacks", () => {
    expect(getApiError({ isAxiosError: true }).statusCode).toBe(0);
    expect(getApiError({ isAxiosError: true }).message).toContain(
      "Unable to reach",
    );
    expect(
      getApiError({ isAxiosError: true, code: "ECONNABORTED" }).message,
    ).toContain("timed out");
  });

  it("preserves a response-header request ID for malformed envelopes", () => {
    const result = getApiError({
      isAxiosError: true,
      response: {
        status: 503,
        data: "not-an-envelope",
        headers: { "x-request-id": "header-request" },
      },
    });
    expect(result.requestId).toBe("header-request");
    expect(result.code).toBe("HTTP_ERROR");
    expect(result.message).toContain("temporarily unavailable");
  });

  it("classifies only exact public auth paths, including absolute URLs", () => {
    expect(isPublicAuthRequest("/auth/login?next=x")).toBe(true);
    expect(
      isPublicAuthRequest(
        "http://localhost:4000/api/v1/auth/validate-reset-token?token=x",
      ),
    ).toBe(true);
    expect(isPublicAuthRequest("/auth/login-extra")).toBe(false);
    expect(isPublicAuthRequest("/users/me")).toBe(false);
  });
});

describe("apiClient transport security", () => {
  it("attaches and then removes the in-memory bearer token", async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = (config) => {
      requests.push(config);
      return Promise.resolve(responseFor(config, {}));
    };
    setAccessToken("access-token");
    await apiClient.get("/users/me");
    clearAccessToken();
    await apiClient.get("/users/me");
    expect(requests[0]?.headers.get("Authorization")).toBe(
      "Bearer access-token",
    );
    expect(requests[1]?.headers.get("Authorization")).toBeUndefined();
  });

  it("never writes access tokens to browser storage", async () => {
    const storageSpy = vi.spyOn(Storage.prototype, "setItem");
    apiClient.defaults.adapter = (config) =>
      Promise.resolve(responseFor(config, {}));
    setAccessToken("memory-only");
    await apiClient.get("/users/me");
    expect(storageSpy).not.toHaveBeenCalled();
  });

  it("attaches decoded CSRF only to unsafe methods", async () => {
    Object.defineProperty(document, "cookie", {
      configurable: true,
      value: "csrfToken=csrf%20value",
    });
    const requests: InternalAxiosRequestConfig[] = [];
    apiClient.defaults.adapter = (config) => {
      requests.push(config);
      return Promise.resolve(responseFor(config, {}));
    };
    await apiClient.get("/users/me");
    for (const method of ["post", "put", "patch", "delete"] as const) {
      await apiClient.request({ method, url: "/resource", data: {} });
    }
    expect(requests[0]?.headers.get("x-csrf-token")).toBeUndefined();
    for (const request of requests.slice(1)) {
      expect(request.headers.get("x-csrf-token")).toBe("csrf value");
    }
  });

  it("does not refresh any public authentication 401", async () => {
    let refreshCalls = 0;
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") refreshCalls += 1;
      return rejectFor(config);
    };
    for (const path of [
      "/auth/register",
      "/auth/login",
      "/auth/refresh",
      "/auth/forgot-password",
      "/auth/reset-password",
    ]) {
      await expect(apiClient.post(path, {})).rejects.toBeDefined();
    }
    expect(refreshCalls).toBe(1);
  });

  it("refreshes one protected 401 and replays it once with the new token", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    const authorization: unknown[] = [];
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return Promise.resolve(refreshResponse(config));
      }
      protectedCalls += 1;
      authorization.push(config.headers.get("Authorization"));
      return protectedCalls === 1
        ? rejectFor(config)
        : Promise.resolve(responseFor(config, { ok: true }));
    };
    setAccessToken("expired-token");
    await expect(apiClient.get("/users/me")).resolves.toMatchObject({
      data: { ok: true },
    });
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
    expect(authorization).toEqual([
      "Bearer expired-token",
      "Bearer fresh-token",
    ]);
  });

  it("uses a single refresh for concurrent protected failures", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    apiClient.defaults.adapter = async (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return refreshResponse(config);
      }
      protectedCalls += 1;
      if (protectedCalls <= 2) {
        await gate;
        return rejectFor(config);
      }
      return responseFor(config, {});
    };
    const first = apiClient.get("/users/me");
    const second = apiClient.get("/users/preferences");
    await vi.waitFor(() => {
      expect(protectedCalls).toBe(2);
    });
    release();
    await expect(Promise.all([first, second])).resolves.toHaveLength(2);
    expect(refreshCalls).toBe(1);
  });

  it("clears the token and redirects safely when refresh fails", async () => {
    navigationMocks.getLocation.mockReturnValue({
      pathname: "/settings",
      search: "?section=security",
    });
    apiClient.defaults.adapter = (config) => rejectFor(config);
    setAccessToken("expired");
    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    expect(getAccessToken()).toEqual({ kind: "missing" });
    expect(navigationMocks.assign).toHaveBeenCalledWith(
      "/auth/login?returnTo=%2Fsettings%3Fsection%3Dsecurity",
    );
  });

  it("drops credential-bearing return paths on refresh failure", async () => {
    navigationMocks.getLocation.mockReturnValue({
      pathname: "/settings",
      search: "?token=secret",
    });
    apiClient.defaults.adapter = (config) => rejectFor(config);
    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    expect(navigationMocks.assign).toHaveBeenCalledWith("/auth/login");
  });

  it("does not redirect again while already on an auth route", async () => {
    navigationMocks.getLocation.mockReturnValue({
      pathname: "/auth/login",
      search: "",
    });
    apiClient.defaults.adapter = (config) => rejectFor(config);
    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    expect(navigationMocks.assign).not.toHaveBeenCalled();
  });

  it("never refreshes a replayed request twice", async () => {
    let protectedCalls = 0;
    let refreshCalls = 0;
    apiClient.defaults.adapter = (config) => {
      if (config.url === "/auth/refresh") {
        refreshCalls += 1;
        return Promise.resolve(refreshResponse(config));
      }
      protectedCalls += 1;
      return rejectFor(config);
    };
    await expect(apiClient.get("/users/me")).rejects.toBeDefined();
    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2);
  });
});
```

### [UNTRACKED] `apps/web/src/services/api/api-client.ts`

```typescript
import axios, {
  type AxiosError,
  type AxiosInstance,
  type AxiosResponse,
} from "axios";

import type { SuccessEnvelope } from "@template/contracts";

import { publicEnvironment } from "@/config/public-environment";

import { assignBrowserLocation, getBrowserLocation } from "./browser-location";

export type ApiResponse<T> = Omit<SuccessEnvelope<T>, "data"> & {
  readonly data: T;
};

export type ApiError = Readonly<{
  message: string;
  statusCode: number;
  code: string;
  requestId: string;
  fieldErrors: Readonly<Record<string, readonly string[]>>;
}>;

export type ValueState<T> =
  { readonly kind: "missing" } | { readonly kind: "value"; readonly value: T };

type ParsedErrorEnvelope = Readonly<{
  message: string;
  statusCode: number;
  requestId: string;
  code: string;
  errors: unknown;
}>;

const STATUS_MESSAGES: Readonly<Record<number, string>> = Object.freeze({
  0: "Unable to reach the server. Check your connection and try again.",
  400: "The request contains invalid data. Review it and try again.",
  401: "Your session has expired. Sign in again to continue.",
  403: "You do not have permission to perform this action.",
  404: "The requested resource could not be found.",
  409: "The request conflicts with the current resource state.",
  422: "Some submitted values are invalid.",
  429: "Too many requests. Wait a moment and try again.",
  500: "The server encountered an unexpected error.",
  501: "The requested operation is not available.",
  502: "The upstream service returned an invalid response.",
  503: "The service is temporarily unavailable.",
  504: "The upstream service took too long to respond.",
});

const CSRF_COOKIE_NAME = "csrfToken";
const CSRF_HEADER_NAME = "x-csrf-token";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PUBLIC_AUTH_PATHS = new Set([
  "/auth/register",
  "/auth/verify-email",
  "/auth/resend-verification",
  "/auth/login",
  "/auth/refresh",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/auth/validate-reset-token",
]);
const CREDENTIAL_QUERY_KEYS = new Set([
  "token",
  "access_token",
  "refresh_token",
  "id_token",
  "code",
  "secret",
  "password",
]);

const baseURL = publicEnvironment.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
const basePath = new URL(baseURL).pathname.replace(/\/+$/, "");

let accessToken: ValueState<string> = { kind: "missing" };
let refreshPromise: ValueState<Promise<string>> = { kind: "missing" };

declare module "axios" {
  interface AxiosRequestConfig {
    _templateRetried?: boolean;
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL,
  withCredentials: true,
});

export const setAccessToken = (token: string): void => {
  accessToken = { kind: "value", value: token };
};

export const getAccessToken = (): ValueState<string> => accessToken;

export const clearAccessToken = (): void => {
  accessToken = { kind: "missing" };
};

const readBrowserCookie = (name: string): ValueState<string> => {
  if (typeof document === "undefined") return { kind: "missing" };
  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((value) => value.trim())
    .find((value) => value.startsWith(prefix));
  if (cookie === undefined) return { kind: "missing" };
  try {
    return {
      kind: "value",
      value: decodeURIComponent(cookie.slice(prefix.length)),
    };
  } catch {
    return { kind: "missing" };
  }
};

const getRequestPath = (url: string): string => {
  try {
    const pathname = new URL(url, baseURL).pathname;
    return pathname.startsWith(basePath)
      ? pathname.slice(basePath.length) || "/"
      : pathname;
  } catch {
    return url.split("?")[0] ?? url;
  }
};

export const isPublicAuthRequest = (url: string): boolean =>
  PUBLIC_AUTH_PATHS.has(getRequestPath(url));

const isUnsafeMethod = (method: string): boolean =>
  UNSAFE_METHODS.has(method.toUpperCase());

const safeCurrentPath = (): string | null => {
  const location = getBrowserLocation();
  if (location === null) return null;
  const value = `${location.pathname}${location.search}`;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (location.pathname.startsWith("/auth/")) return null;
  const parsed = new URL(value, "https://template.invalid");
  for (const key of parsed.searchParams.keys()) {
    if (CREDENTIAL_QUERY_KEYS.has(key.toLowerCase())) return null;
  }
  return `${parsed.pathname}${parsed.search}`;
};

const redirectToLogin = (): void => {
  const location = getBrowserLocation();
  if (location === null || location.pathname.startsWith("/auth/")) return;
  const returnTo = safeCurrentPath();
  assignBrowserLocation(
    returnTo === null
      ? "/auth/login"
      : `/auth/login?returnTo=${encodeURIComponent(returnTo)}`,
  );
};

const refreshAccessToken = (): Promise<string> => {
  if (refreshPromise.kind === "value") return refreshPromise.value;
  const promise = apiClient
    .post<ApiResponse<{ tokens: { accessToken: string } }>>("/auth/refresh", {})
    .then((response) => {
      const token = response.data.data.tokens.accessToken;
      setAccessToken(token);
      return token;
    })
    .finally(() => {
      refreshPromise = { kind: "missing" };
    });
  refreshPromise = { kind: "value", value: promise };
  return promise;
};

apiClient.interceptors.request.use((config) => {
  if (accessToken.kind === "value") {
    config.headers.set("Authorization", `Bearer ${accessToken.value}`);
  }
  if (isUnsafeMethod(config.method ?? "GET")) {
    const csrfToken = readBrowserCookie(CSRF_COOKIE_NAME);
    if (csrfToken.kind === "value") {
      config.headers.set(CSRF_HEADER_NAME, csrfToken.value);
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;
    const config = error.config;
    const requestUrl = config?.url;
    if (
      config === undefined ||
      typeof requestUrl !== "string" ||
      error.response?.status !== 401 ||
      isPublicAuthRequest(requestUrl) ||
      config._templateRetried === true
    ) {
      throw error;
    }
    config._templateRetried = true;
    try {
      await refreshAccessToken();
      return await apiClient.request(config);
    } catch {
      clearAccessToken();
      redirectToLogin();
      throw error;
    }
  },
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readFieldErrors = (value: unknown): Record<string, string[]> => {
  if (!Array.isArray(value)) return {};
  const grouped = new Map<string, string[]>();
  for (const item of value) {
    if (!isRecord(item)) continue;
    const field = item["field"];
    const message = item["message"];
    if (typeof field !== "string" || typeof message !== "string") continue;
    grouped.set(field, [...(grouped.get(field) ?? []), message]);
  }
  return Object.fromEntries(grouped);
};

const readErrorEnvelope = (value: unknown): ValueState<ParsedErrorEnvelope> => {
  if (!isRecord(value) || value["success"] !== false)
    return { kind: "missing" };
  const message = value["message"];
  const statusCode = value["statusCode"];
  const requestId = value["requestId"];
  const code = value["code"];
  if (
    typeof message !== "string" ||
    typeof statusCode !== "number" ||
    typeof requestId !== "string" ||
    typeof code !== "string"
  ) {
    return { kind: "missing" };
  }
  return {
    kind: "value",
    value: { message, statusCode, requestId, code, errors: value["errors"] },
  };
};

const readHeaderRequestId = (
  response: AxiosResponse<unknown> | undefined,
): string => {
  const value: unknown = response?.headers["x-request-id"] as unknown;
  return typeof value === "string" ? value : "";
};

export const getApiError = (error: unknown): ApiError => {
  const axiosError: AxiosError | undefined = axios.isAxiosError(error)
    ? error
    : undefined;
  const envelope = readErrorEnvelope(axiosError?.response?.data);
  const responseStatus = axiosError?.response?.status ?? 0;
  const statusCode =
    envelope.kind === "value" ? envelope.value.statusCode : responseStatus;
  const isTimeout =
    axiosError?.code === "ECONNABORTED" || axiosError?.code === "ETIMEDOUT";
  return {
    message:
      envelope.kind === "value"
        ? envelope.value.message
        : isTimeout
          ? "The request timed out. Try again."
          : (STATUS_MESSAGES[statusCode] ??
            "The request could not be completed."),
    statusCode,
    code:
      envelope.kind === "value"
        ? envelope.value.code
        : statusCode === 0
          ? "NETWORK_ERROR"
          : "HTTP_ERROR",
    requestId:
      envelope.kind === "value"
        ? envelope.value.requestId
        : readHeaderRequestId(axiosError?.response),
    fieldErrors:
      envelope.kind === "value" ? readFieldErrors(envelope.value.errors) : {},
  };
};
```

### [UNTRACKED] `apps/web/src/services/api/browser-location.ts`

```typescript
export type BrowserLocationSnapshot = Readonly<{
  pathname: string;
  search: string;
}>;

export const getBrowserLocation = (): BrowserLocationSnapshot | null =>
  typeof window === "undefined"
    ? null
    : {
        pathname: window.location.pathname,
        search: window.location.search,
      };

export const assignBrowserLocation = (path: string): void => {
  if (typeof window !== "undefined") window.location.assign(path);
};
```

### [UNTRACKED] `apps/web/src/services/api/index.ts`

```typescript
export {
  apiClient,
  clearAccessToken,
  getAccessToken,
  getApiError,
  isPublicAuthRequest,
  setAccessToken,
} from "./api-client";
export type { ApiError, ApiResponse, ValueState } from "./api-client";
```

### [UNTRACKED] `apps/web/src/shared/forms/form.test.ts`

```typescript
import { describe, expect, it, vi } from "vitest";

import { applyApiFormError } from "./form";

describe("applyApiFormError", () => {
  it("maps only known fields and strips the body prefix", () => {
    const setError = vi.fn();
    const message = applyApiFormError(
      {
        isAxiosError: true,
        response: {
          status: 422,
          headers: {},
          data: {
            success: false,
            statusCode: 422,
            code: "VALIDATION_ERROR",
            message: "Review the fields.",
            requestId: "request",
            errors: [
              { field: "body.email", message: "Invalid email." },
              { field: "__proto__", message: "Unsafe." },
            ],
          },
        },
      },
      { getValues: () => ({ email: "" }), setError },
    );
    expect(message).toBe("Review the fields.");
    expect(setError).toHaveBeenCalledOnce();
    expect(setError).toHaveBeenCalledWith("email", {
      type: "server",
      message: "Invalid email.",
    });
  });
});
```

### [UNTRACKED] `apps/web/src/shared/forms/form.ts`

```typescript
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import type {
  FieldPath,
  FieldValues,
  UseFormProps,
  UseFormReturn,
  UseFormSetError,
} from "react-hook-form";
import type { ZodType } from "zod";

import { getApiError } from "@/services/api/api-client";

export const useZodForm = <
  TInput extends FieldValues,
  TOutput extends FieldValues,
>(
  schema: ZodType<TOutput, TInput>,
  options: Omit<UseFormProps<TInput, TInput, TOutput>, "resolver"> = {},
): UseFormReturn<TInput, TInput, TOutput> =>
  useForm<TInput, TInput, TOutput>({
    ...options,
    resolver: zodResolver(schema),
  });

type FormErrorTarget<TFields extends FieldValues> = Readonly<{
  getValues: () => TFields;
  setError: UseFormSetError<TFields>;
}>;

const isKnownField = <TFields extends FieldValues>(
  values: TFields,
  field: string,
): field is FieldPath<TFields> =>
  Object.prototype.hasOwnProperty.call(values, field);

export const applyApiFormError = <TFields extends FieldValues>(
  error: unknown,
  form: FormErrorTarget<TFields>,
): string => {
  const apiError = getApiError(error);
  for (const [rawField, messages] of Object.entries(apiError.fieldErrors)) {
    const field = rawField.replace(/^body\./u, "");
    const message = messages[0];
    if (!isKnownField(form.getValues(), field) || message === undefined)
      continue;
    form.setError(field, { type: "server", message });
  }
  return apiError.message;
};
```

### [UNTRACKED] `apps/web/src/shared/forms/index.ts`

```typescript
export { applyApiFormError, useZodForm } from "./form";
```

### [UNTRACKED] `apps/web/src/shared/query/index.ts`

```typescript
export { createQueryClient, shouldRetryRequest } from "./query-client";
```

### [UNTRACKED] `apps/web/src/shared/query/query-client.test.ts`

```typescript
import {
  AxiosError,
  AxiosHeaders,
  type InternalAxiosRequestConfig,
} from "axios";
import { describe, expect, it } from "vitest";

import { createQueryClient, shouldRetryRequest } from "./query-client";

const httpError = (status: number): AxiosError => {
  const config: InternalAxiosRequestConfig = {
    headers: new AxiosHeaders(),
    method: "GET",
    url: "/test",
  };
  const error = new AxiosError("failed", "ERR_BAD_REQUEST", config);
  error.response = {
    data: {},
    status,
    statusText: "Error",
    headers: new AxiosHeaders(),
    config,
  };
  return error;
};

describe("query client defaults", () => {
  it("creates isolated clients with a 30-second stale time", () => {
    const first = createQueryClient();
    const second = createQueryClient();
    expect(first).not.toBe(second);
    expect(first.getDefaultOptions().queries?.staleTime).toBe(30_000);
    expect(first.getDefaultOptions().mutations?.retry).toBe(false);
  });

  it("retries only network and 500 through 504 errors at most twice", () => {
    expect(shouldRetryRequest(0, new AxiosError("network"))).toBe(true);
    for (const status of [500, 501, 502, 503, 504]) {
      expect(shouldRetryRequest(0, httpError(status))).toBe(true);
    }
    for (const status of [400, 401, 403, 404, 409, 422, 429, 505]) {
      expect(shouldRetryRequest(0, httpError(status))).toBe(false);
    }
    expect(shouldRetryRequest(2, new AxiosError("network"))).toBe(false);
    expect(shouldRetryRequest(0, new TypeError("bug"))).toBe(false);
  });
});
```

### [UNTRACKED] `apps/web/src/shared/query/query-client.ts`

```typescript
import { QueryClient } from "@tanstack/react-query";
import axios from "axios";

import { getApiError } from "@/services/api/api-client";

const DEFAULT_STALE_TIME_MS = 30_000;
const MAX_RETRY_COUNT = 2;

export const shouldRetryRequest = (
  failureCount: number,
  error: unknown,
): boolean => {
  if (failureCount >= MAX_RETRY_COUNT) return false;
  if (!axios.isAxiosError(error)) return false;
  const statusCode = getApiError(error).statusCode;
  return statusCode === 0 || (statusCode >= 500 && statusCode <= 504);
};

export const createQueryClient = (): QueryClient =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_TIME_MS,
        retry: shouldRetryRequest,
      },
      mutations: { retry: false },
    },
  });
```

### [UNTRACKED] `apps/web/src/test/setup.ts`

```typescript
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

### [UNTRACKED] `apps/web/src/types/environment.d.ts`

```typescript
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NEXT_PUBLIC_API_URL?: string;
  }
}
```

### [UNTRACKED] `apps/web/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

process.env.NEXT_PUBLIC_API_URL ??= "http://localhost:4000/api/v1";

export default defineConfig({
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    environment: "jsdom",
    globals: false,
    restoreMocks: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
```

### [UNTRACKED] `packages/contracts/eslint.config.mjs`

```javascript
import { createNodeConfig } from "@template/eslint-config/node";

export default createNodeConfig({
  tsconfigRootDir: import.meta.dirname,
  allowDefaultProject: ["vitest.config.ts"],
});
```

### [UNTRACKED] `packages/contracts/package.json`

```json
{
  "name": "@template/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "development": "./src/index.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "rimraf dist node_modules/.cache/tsconfig.build.tsbuildinfo && tsc -p tsconfig.build.json",
    "check-types": "tsc --noEmit",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "test": "vitest run --config vitest.config.ts",
    "test:watch": "vitest --config vitest.config.ts"
  },
  "dependencies": {
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@template/eslint-config": "workspace:*",
    "@template/typescript-config": "workspace:*",
    "@types/node": "24.13.3",
    "eslint": "9.39.1",
    "rimraf": "6.1.3",
    "typescript": "5.9.3",
    "vitest": "4.1.10"
  },
  "engines": {
    "node": ">=24 <25"
  }
}
```

### [UNTRACKED] `packages/contracts/src/account/account.schema.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  ACCOUNT_RESPONSE_FIELD_ALLOWLIST,
  safeUserSchema,
} from "./account.schema.ts";

const safeUser = {
  id: "11111111-1111-4111-8111-111111111111",
  fullName: "Template User",
  email: "user@example.com",
  phone: null,
  role: "USER",
  status: "ACTIVE",
  emailVerifiedAt: "2026-08-18T00:00:00.000Z",
  createdAt: "2026-08-18T00:00:00.000Z",
  updatedAt: "2026-08-18T00:00:00.000Z",
};

describe("safe account contracts", () => {
  it("accepts exactly the approved browser-visible user fields", () => {
    expect(Object.keys(safeUser).sort()).toEqual(
      [...ACCOUNT_RESPONSE_FIELD_ALLOWLIST].sort(),
    );
    expect(safeUserSchema.parse(safeUser)).toEqual(safeUser);
  });

  it("rejects password and token storage fields", () => {
    expect(
      safeUserSchema.safeParse({ ...safeUser, passwordHash: "secret" }).success,
    ).toBe(false);
    expect(
      safeUserSchema.safeParse({ ...safeUser, resetTokenHash: "secret" })
        .success,
    ).toBe(false);
  });
});
```

### [UNTRACKED] `packages/contracts/src/account/account.schema.ts`

```typescript
import { z } from "zod";

import { nonEmptyBoundedString } from "../http/http.schema.ts";

export const userRoleSchema = z.enum(["USER", "ADMIN"]);
export const userStatusSchema = z.enum([
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
]);

export const safeUserSchema = z
  .object({
    id: z.uuid(),
    fullName: nonEmptyBoundedString(150),
    email: z.email().max(320),
    phone: z.string().min(1).max(30).nullable(),
    role: userRoleSchema,
    status: userStatusSchema,
    emailVerifiedAt: z.iso.datetime({ offset: true }).nullable(),
    createdAt: z.iso.datetime({ offset: true }),
    updatedAt: z.iso.datetime({ offset: true }),
  })
  .strict();

export const authUserDataSchema = z.object({ user: safeUserSchema }).strict();

export const authSessionDataSchema = z
  .object({
    user: safeUserSchema,
    tokens: z.object({ accessToken: z.string().min(1) }).strict(),
  })
  .strict();

export const accountResponseSchemas = Object.freeze({
  safeUser: safeUserSchema,
  authUserData: authUserDataSchema,
  authSessionData: authSessionDataSchema,
});

export const ACCOUNT_RESPONSE_FIELD_ALLOWLIST = [
  "id",
  "fullName",
  "email",
  "phone",
  "role",
  "status",
  "emailVerifiedAt",
  "createdAt",
  "updatedAt",
] as const;

export type UserRole = z.infer<typeof userRoleSchema>;
export type UserStatus = z.infer<typeof userStatusSchema>;
export type SafeUser = z.infer<typeof safeUserSchema>;
export type AuthUserData = z.infer<typeof authUserDataSchema>;
export type AuthSessionData = z.infer<typeof authSessionDataSchema>;
```

### [UNTRACKED] `packages/contracts/src/auth/auth.schema.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  changePasswordBodySchema,
  loginBodySchema,
  registerBodySchema,
  resetPasswordBodySchema,
} from "./auth.schema.ts";

describe("authentication request contracts", () => {
  it("normalizes email, whitespace, and optional phone input", () => {
    const result = registerBodySchema.parse({
      fullName: "Template User",
      email: "  USER@Example.COM ",
      phone: " ",
      password: "a-secure-password",
    });
    expect(result.email).toBe("user@example.com");
    expect(result.phone).toBeNull();
  });

  it("requires explicit remember-me and rejects unknown login fields", () => {
    expect(
      loginBodySchema.safeParse({
        email: "user@example.com",
        password: "password",
      }).success,
    ).toBe(false);
    expect(
      loginBodySchema.safeParse({
        email: "user@example.com",
        password: "password",
        rememberMe: false,
        organizationId: "not-supported",
      }).success,
    ).toBe(false);
  });

  it("enforces password confirmation and credential rotation", () => {
    expect(
      resetPasswordBodySchema.safeParse({
        newPassword: "a-new-secure-password",
        passwordConfirmation: "different-password",
      }).success,
    ).toBe(false);
    expect(
      changePasswordBodySchema.safeParse({
        currentPassword: "same-secure-password",
        newPassword: "same-secure-password",
        passwordConfirmation: "same-secure-password",
      }).success,
    ).toBe(false);
  });
});
```

### [UNTRACKED] `packages/contracts/src/auth/auth.schema.ts`

```typescript
import { z } from "zod";

import { nonEmptyBoundedString } from "../http/http.schema.ts";

export const PASSWORD_MIN_LENGTH = 15;
export const PASSWORD_MAX_LENGTH = 128;

export const emailSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
  z.email().max(320),
);

export const phoneSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}, z.string().max(30).nullable());

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH)
  .max(PASSWORD_MAX_LENGTH);

export const registerBodySchema = z
  .object({
    fullName: nonEmptyBoundedString(150),
    email: emailSchema,
    phone: phoneSchema.optional().default(null),
    password: passwordSchema,
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    rememberMe: z.boolean(),
  })
  .strict();

export const emailRequestBodySchema = z.object({ email: emailSchema }).strict();

export const tokenQuerySchema = z.object({ token: z.string().min(1) }).strict();

export const resetPasswordBodySchema = z
  .object({
    newPassword: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.passwordConfirmation, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirmation"],
  });

export const changePasswordBodySchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .strict()
  .refine((value) => value.newPassword === value.passwordConfirmation, {
    message: "Password confirmation does not match.",
    path: ["passwordConfirmation"],
  })
  .refine((value) => value.newPassword !== value.currentPassword, {
    message: "New password must differ from current password.",
    path: ["newPassword"],
  });

export const updateProfileBodySchema = z
  .object({
    fullName: nonEmptyBoundedString(150).optional(),
    phone: phoneSchema.optional(),
  })
  .strict()
  .refine(
    (value) => value.fullName !== undefined || value.phone !== undefined,
    {
      message: "At least one supported field must be provided.",
      path: ["body"],
    },
  );

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type EmailRequestBody = z.infer<typeof emailRequestBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
```

### [UNTRACKED] `packages/contracts/src/http/http.schema.test.ts`

```typescript
import { describe, expect, it } from "vitest";

import {
  errorEnvelopeSchema,
  paginationMetaSchema,
  successEnvelopeSchema,
} from "./http.schema.ts";

const base = {
  requestId: "request-1",
  timestamp: "2026-08-18T00:00:00.000Z",
  path: "/api/v1/test",
};

describe("HTTP envelope contracts", () => {
  it("keeps success and error payloads discriminated", () => {
    expect(
      successEnvelopeSchema.parse({
        ...base,
        success: true,
        statusCode: 200,
        message: "Okay.",
        data: { value: true },
      }).success,
    ).toBe(true);
    expect(
      errorEnvelopeSchema.parse({
        ...base,
        success: false,
        statusCode: 400,
        code: "VALIDATION_ERROR",
        message: "Invalid input.",
        errors: [{ field: "email", message: "Invalid email." }],
      }).success,
    ).toBe(false);
  });

  it("requires success data and rejects legacy error data", () => {
    expect(
      successEnvelopeSchema.safeParse({
        ...base,
        success: true,
        statusCode: 204,
        message: "Done.",
      }).success,
    ).toBe(false);
    expect(
      errorEnvelopeSchema.safeParse({
        ...base,
        success: false,
        statusCode: 400,
        code: "BAD_REQUEST",
        message: "Invalid input.",
        data: null,
      }).success,
    ).toBe(false);
  });

  it("validates promoted pagination metadata", () => {
    const valid = {
      page: 2,
      limit: 25,
      total: 63,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    };
    expect(paginationMetaSchema.safeParse(valid).success).toBe(true);
    expect(
      paginationMetaSchema.safeParse({ ...valid, totalPages: 4 }).success,
    ).toBe(false);
    expect(
      successEnvelopeSchema.safeParse({
        ...base,
        success: true,
        statusCode: 200,
        message: "Okay.",
        data: [],
        paginationMeta: valid,
      }).success,
    ).toBe(true);
  });
});
```

### [UNTRACKED] `packages/contracts/src/http/http.schema.ts`

```typescript
import { z } from "zod";

export const nonEmptyBoundedString = (maximum: number) =>
  z
    .string()
    .min(1)
    .max(maximum)
    .refine((value) => value.trim().length > 0, {
      message: "must not contain only whitespace",
    })
    .refine((value) => !value.includes("\u0000"), {
      message: "must not contain null characters",
    });

export const fieldErrorSchema = z
  .object({
    field: nonEmptyBoundedString(200),
    message: nonEmptyBoundedString(500),
  })
  .strict();

export const paginationMetaSchema = z
  .object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
    hasNextPage: z.boolean(),
    hasPreviousPage: z.boolean(),
  })
  .strict()
  .refine(
    (meta) =>
      meta.total === 0
        ? meta.totalPages === 0
        : meta.totalPages === Math.ceil(meta.total / meta.limit),
    {
      message: "totalPages must equal ceil(total / limit)",
      path: ["totalPages"],
    },
  )
  .refine((meta) => meta.hasPreviousPage === meta.page > 1, {
    message: "hasPreviousPage must agree with page",
    path: ["hasPreviousPage"],
  })
  .refine((meta) => meta.hasNextPage === meta.page < meta.totalPages, {
    message: "hasNextPage must agree with totalPages",
    path: ["hasNextPage"],
  });

export const successEnvelopeSchema = z
  .object({
    success: z.literal(true),
    statusCode: z.number().int().min(100).max(599),
    message: nonEmptyBoundedString(500),
    data: z.unknown(),
    paginationMeta: paginationMetaSchema.optional(),
    requestId: z.string().min(1).max(128),
    timestamp: z.iso.datetime({ offset: true }),
    path: z.string().min(1).max(2_000),
  })
  .strict()
  .refine((envelope) => Object.hasOwn(envelope, "data"), {
    message: "data is required",
    path: ["data"],
  });

export const errorEnvelopeSchema = z
  .object({
    success: z.literal(false),
    statusCode: z.number().int().min(100).max(599),
    code: nonEmptyBoundedString(80),
    message: nonEmptyBoundedString(500),
    errors: z.array(fieldErrorSchema).optional(),
    stack: z.string().min(1).optional(),
    requestId: z.string().min(1).max(128),
    timestamp: z.iso.datetime({ offset: true }),
    path: z.string().min(1).max(2_000),
  })
  .strict();

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type PaginationMeta = z.infer<typeof paginationMetaSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
export type SuccessEnvelope<T = unknown> = Omit<
  z.infer<typeof successEnvelopeSchema>,
  "data"
> & { readonly data: T };
```

### [UNTRACKED] `packages/contracts/src/index.ts`

```typescript
export {
  accountResponseSchemas,
  ACCOUNT_RESPONSE_FIELD_ALLOWLIST,
  authSessionDataSchema,
  authUserDataSchema,
  safeUserSchema,
  userRoleSchema,
  userStatusSchema,
} from "./account/account.schema.ts";
export type {
  AuthSessionData,
  AuthUserData,
  SafeUser,
  UserRole,
  UserStatus,
} from "./account/account.schema.ts";
export {
  changePasswordBodySchema,
  emailRequestBodySchema,
  emailSchema,
  loginBodySchema,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordSchema,
  phoneSchema,
  registerBodySchema,
  resetPasswordBodySchema,
  tokenQuerySchema,
  updateProfileBodySchema,
} from "./auth/auth.schema.ts";
export type {
  ChangePasswordBody,
  EmailRequestBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
  UpdateProfileBody,
} from "./auth/auth.schema.ts";
export {
  errorEnvelopeSchema,
  fieldErrorSchema,
  nonEmptyBoundedString,
  paginationMetaSchema,
  successEnvelopeSchema,
} from "./http/http.schema.ts";
export type {
  ErrorEnvelope,
  FieldError,
  PaginationMeta,
  SuccessEnvelope,
} from "./http/http.schema.ts";
```

### [UNTRACKED] `packages/contracts/tsconfig.build.json`

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "declarationMap": true,
    "inlineSources": true,
    "noEmit": false,
    "noEmitOnError": true,
    "sourceMap": true,
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.build.tsbuildinfo"
  },
  "exclude": ["node_modules", "dist", "coverage", "src/**/*.test.ts"]
}
```

### [UNTRACKED] `packages/contracts/tsconfig.json`

```json
{
  "extends": "@template/typescript-config/node.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "tsBuildInfoFile": "node_modules/.cache/tsconfig.tsbuildinfo"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "coverage"]
}
```

### [UNTRACKED] `packages/contracts/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
```

### [UNTRACKED] `packages/database/prisma/migrations/20260818000000_init_authentication/migration.sql`

```sql
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "phone" VARCHAR(30),
    "role" "user_role" NOT NULL DEFAULT 'USER',
    "status" "user_status" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "email_verified_at" TIMESTAMPTZ(6),
    "verification_token_hash" CHAR(64),
    "verification_token_expires_at" TIMESTAMPTZ(6),
    "reset_token_hash" CHAR(64),
    "reset_token_expires_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_role_idx" ON "users"("status", "role");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiry_idx" ON "refresh_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "users"
  ADD CONSTRAINT "ck_users_email_normalized"
  CHECK ("email" = lower(btrim("email")));

ALTER TABLE "users"
  ADD CONSTRAINT "ck_users_status_timestamps_consistent"
  CHECK (
    "status" = 'PENDING_VERIFICATION'
    OR "email_verified_at" IS NOT NULL
  );
```

### [UNTRACKED] `packages/database/src/seed-config.ts`

```typescript
import argon2 from "argon2";

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@template/contracts";

import {
  UserRole,
  UserStatus,
  type Prisma,
} from "./generated/prisma/client.js";

export type SeedGroupName = "ADMIN" | "USER";
export type SeedDecision =
  | Readonly<{ kind: "disabled"; group: SeedGroupName }>
  | Readonly<{
      kind: "enabled";
      group: SeedGroupName;
      email: string;
      fullName: string;
      passwordHash: string;
      role: UserRole;
    }>;

export class SeedConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SeedConfigurationError";
  }
}

type SeedEnvironment = Readonly<Record<string, string | undefined>>;

const ARGON2_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

export const parseSeedGroup = async (
  group: SeedGroupName,
  environment: SeedEnvironment,
  nodeEnv: string,
): Promise<SeedDecision> => {
  const keys = [
    `SEED_${group}_EMAIL`,
    `SEED_${group}_NAME`,
    `SEED_${group}_PASSWORD`,
  ] as const;
  const values = keys.map((key) => environment[key]);
  const present = values.filter((value) => value !== undefined).length;
  if (present === 0) return { kind: "disabled", group };
  if (present !== values.length) {
    throw new SeedConfigurationError(
      `${keys.join(", ")} must be configured together.`,
    );
  }
  if (nodeEnv === "production") {
    throw new SeedConfigurationError(
      `Refusing to seed ${group.toLowerCase()} credentials in production.`,
    );
  }

  const email = (values[0] ?? "").trim().toLowerCase();
  const fullName = (values[1] ?? "").trim();
  const password = values[2] ?? "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(email)) {
    throw new SeedConfigurationError(`SEED_${group}_EMAIL is invalid.`);
  }
  if (fullName.length === 0) {
    throw new SeedConfigurationError(`SEED_${group}_NAME is required.`);
  }
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new SeedConfigurationError(
      `SEED_${group}_PASSWORD must contain between ${String(PASSWORD_MIN_LENGTH)} and ${String(PASSWORD_MAX_LENGTH)} characters.`,
    );
  }

  return {
    kind: "enabled",
    group,
    email,
    fullName,
    passwordHash: await argon2.hash(password, ARGON2_OPTIONS),
    role: group === "ADMIN" ? UserRole.ADMIN : UserRole.USER,
  };
};

export const buildSeedUpsert = (
  decision: Extract<SeedDecision, { kind: "enabled" }>,
  now: Date,
): Prisma.UserUpsertArgs => {
  const account = {
    fullName: decision.fullName,
    passwordHash: decision.passwordHash,
    role: decision.role,
    status: UserStatus.ACTIVE,
    emailVerifiedAt: now,
    verificationTokenHash: null,
    verificationTokenExpiresAt: null,
    resetTokenHash: null,
    resetTokenExpiresAt: null,
  } satisfies Prisma.UserUpdateInput;
  return {
    where: { email: decision.email },
    update: account,
    create: { email: decision.email, ...account },
  };
};
```

### [UNTRACKED] `packages/database/tests/integration/global-setup.ts`

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { PostgreSqlContainer } from "@testcontainers/postgresql";

const execFileAsync = promisify(execFile);

const deployMigrations = async (databaseUrl: string): Promise<void> => {
  const pnpmScript = process.env["npm_execpath"];
  if (pnpmScript === undefined) {
    throw new Error(
      "npm_execpath is required to deploy integration migrations.",
    );
  }
  await execFileAsync(
    process.execPath,
    [pnpmScript, "exec", "prisma", "migrate", "deploy"],
    {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: databaseUrl },
      timeout: 180_000,
      windowsHide: true,
    },
  );
};

export default async function setup(): Promise<() => Promise<void>> {
  delete process.env["DATABASE_URL"];
  const container = await new PostgreSqlContainer("postgres:18.4")
    .withDatabase("template_integration")
    .withUsername("template_test")
    .withPassword("test-only-password")
    .withStartupTimeout(120_000)
    .start();
  const databaseUrl = container.getConnectionUri();
  process.env["DATABASE_URL"] = databaseUrl;

  try {
    await deployMigrations(databaseUrl);
  } catch (error) {
    await container.stop();
    throw error;
  }

  return async () => {
    delete process.env["DATABASE_URL"];
    await container.stop();
  };
}
```

### [UNTRACKED] `packages/database/tests/integration/migration.integration.test.ts`

```typescript
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { Pool } from "pg";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

const databaseUrl = (): string => {
  const value = process.env["DATABASE_URL"];
  if (value === undefined || value.length === 0) {
    throw new Error("The Testcontainers DATABASE_URL was not provided.");
  }
  return value;
};

describe("fresh authentication migration", () => {
  it("creates exactly the required application tables, columns, and indexes", async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const tables = await pool.query<{ table_name: string }>(
        `SELECT table_name
           FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            AND table_name <> '_prisma_migrations'
          ORDER BY table_name`,
      );
      expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
        "refresh_tokens",
        "users",
      ]);

      const columns = await pool.query<{
        table_name: string;
        column_name: string;
      }>(
        `SELECT table_name, column_name
           FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name IN ('users', 'refresh_tokens')
          ORDER BY table_name, ordinal_position`,
      );
      const userColumns = columns.rows
        .filter(({ table_name }) => table_name === "users")
        .map(({ column_name }) => column_name);
      const refreshTokenColumns = columns.rows
        .filter(({ table_name }) => table_name === "refresh_tokens")
        .map(({ column_name }) => column_name);
      expect(userColumns).toEqual([
        "id",
        "email",
        "password_hash",
        "full_name",
        "phone",
        "role",
        "status",
        "email_verified_at",
        "verification_token_hash",
        "verification_token_expires_at",
        "reset_token_hash",
        "reset_token_expires_at",
        "created_at",
        "updated_at",
      ]);
      expect(refreshTokenColumns).toEqual([
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "created_at",
      ]);

      const indexes = await pool.query<{ indexname: string }>(
        `SELECT indexname
           FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname IN (
              'users_status_role_idx',
              'refresh_tokens_user_idx',
              'refresh_tokens_expiry_idx'
            )
          ORDER BY indexname`,
      );
      expect(indexes.rows.map(({ indexname }) => indexname)).toEqual([
        "refresh_tokens_expiry_idx",
        "refresh_tokens_user_idx",
        "users_status_role_idx",
      ]);
    } finally {
      await pool.end();
    }
  });

  it("cascades refresh records and deploys idempotently", async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const deleteRule = await pool.query<{ delete_rule: string }>(
        `SELECT delete_rule
           FROM information_schema.referential_constraints
          WHERE constraint_schema = 'public'
            AND constraint_name = 'refresh_tokens_user_id_fkey'`,
      );
      expect(deleteRule.rows[0]?.delete_rule).toBe("CASCADE");
    } finally {
      await pool.end();
    }

    const pnpmScript = process.env["npm_execpath"];
    if (pnpmScript === undefined) throw new Error("npm_execpath is required.");
    const { stdout, stderr } = await execFileAsync(
      process.execPath,
      [pnpmScript, "exec", "prisma", "migrate", "deploy"],
      {
        cwd: process.cwd(),
        env: { ...process.env, DATABASE_URL: databaseUrl() },
        timeout: 120_000,
        windowsHide: true,
      },
    );
    expect(`${stdout}${stderr}`).toMatch(
      /No pending migrations|already in sync/iu,
    );
  });

  it("installs exactly the approved user checks and enforces their data rules", async () => {
    const pool = new Pool({ connectionString: databaseUrl() });
    try {
      const constraints = await pool.query<{ conname: string }>(
        `SELECT conname
           FROM pg_constraint
          WHERE conrelid = 'public.users'::regclass
            AND contype = 'c'
          ORDER BY conname`,
      );
      expect(constraints.rows.map(({ conname }) => conname)).toEqual([
        "ck_users_email_normalized",
        "ck_users_status_timestamps_consistent",
      ]);

      const insert = async (
        email: string,
        status: "ACTIVE" | "PENDING_VERIFICATION",
        verifiedAt: Date | null,
      ) =>
        pool.query(
          `INSERT INTO users
             (email, password_hash, full_name, status, email_verified_at, updated_at)
           VALUES ($1, $2, $3, $4::user_status, $5, CURRENT_TIMESTAMP)
           RETURNING id`,
          [email, "argon2-test-hash", "Migration User", status, verifiedAt],
        );

      await expect(
        insert(" Uppercase@example.com ", "PENDING_VERIFICATION", null),
      ).rejects.toMatchObject({ code: "23514" });
      await expect(
        insert("active@example.com", "ACTIVE", null),
      ).rejects.toMatchObject({ code: "23514" });
      const pending = await insert(
        "pending@example.com",
        "PENDING_VERIFICATION",
        null,
      );
      const active = await insert("verified@example.com", "ACTIVE", new Date());
      expect(pending.rowCount).toBe(1);
      expect(active.rowCount).toBe(1);
      await pool.query(
        `DELETE FROM users
          WHERE email IN ('pending@example.com', 'verified@example.com')`,
      );
    } finally {
      await pool.end();
    }
  });
});
```

### [UNTRACKED] `packages/database/tests/schema-contract.test.ts`

```typescript
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const currentDirectory = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(currentDirectory, "..");
const schema = readFileSync(
  join(packageRoot, "prisma", "schema.prisma"),
  "utf8",
);

describe("authentication-only Prisma schema", () => {
  it("contains exactly the required application models and enums", () => {
    const models = [...schema.matchAll(/^model\s+(\w+)/gmu)].map(
      (match) => match[1],
    );
    const enums = [...schema.matchAll(/^enum\s+(\w+)/gmu)].map(
      (match) => match[1],
    );
    expect(models).toEqual(["User", "RefreshToken"]);
    expect(enums).toEqual(["UserRole", "UserStatus"]);
  });

  it("contains no demo or business-specific model inventory", () => {
    expect(schema).not.toMatch(
      /DemoMessage|Organization|Project|Quotation|Payment/u,
    );
  });
});
```

### [UNTRACKED] `packages/database/tests/seed-config.test.ts`

```typescript
import argon2 from "argon2";
import { describe, expect, it } from "vitest";

import {
  buildSeedUpsert,
  parseSeedGroup,
  SeedConfigurationError,
} from "../src/seed-config.js";

const complete = {
  SEED_ADMIN_EMAIL: "  Admin@Example.COM ",
  SEED_ADMIN_NAME: " Seed Administrator ",
  SEED_ADMIN_PASSWORD: "CorrectHorseBatteryStaple!42",
};

describe("optional seed groups", () => {
  it("skips when all three values are absent", async () => {
    await expect(parseSeedGroup("ADMIN", {}, "development")).resolves.toEqual({
      kind: "disabled",
      group: "ADMIN",
    });
  });

  it("fails clearly when any group is partial", async () => {
    await expect(
      parseSeedGroup(
        "USER",
        { SEED_USER_EMAIL: "user@example.com" },
        "development",
      ),
    ).rejects.toBeInstanceOf(SeedConfigurationError);
  });

  it("refuses configured credentials in production", async () => {
    await expect(
      parseSeedGroup("ADMIN", complete, "production"),
    ).rejects.toThrow(/production/iu);
  });

  it("normalizes email/name, enforces policy, and hashes with Argon2id", async () => {
    const decision = await parseSeedGroup("ADMIN", complete, "development");
    expect(decision.kind).toBe("enabled");
    if (decision.kind !== "enabled") return;
    expect(decision.email).toBe("admin@example.com");
    expect(decision.fullName).toBe("Seed Administrator");
    expect(decision.role).toBe("ADMIN");
    expect(decision.passwordHash).toMatch(/^\$argon2id\$/u);
    await expect(
      argon2.verify(decision.passwordHash, "CorrectHorseBatteryStaple!42"),
    ).resolves.toBe(true);
    expect(JSON.stringify(decision)).not.toContain(
      "CorrectHorseBatteryStaple!42",
    );
  });

  it("rejects passwords outside the configured policy", async () => {
    await expect(
      parseSeedGroup(
        "ADMIN",
        { ...complete, SEED_ADMIN_PASSWORD: "too-short" },
        "development",
      ),
    ).rejects.toThrow(/between 15 and 128/iu);
  });

  it("upserts both roles into active verified state and clears stale tokens", async () => {
    const decision = await parseSeedGroup("ADMIN", complete, "development");
    if (decision.kind !== "enabled") throw new Error("Expected enabled seed.");
    const now = new Date("2026-08-18T00:00:00.000Z");
    const args = buildSeedUpsert(decision, now);
    expect(args.update).toMatchObject({
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: now,
      verificationTokenHash: null,
      verificationTokenExpiresAt: null,
      resetTokenHash: null,
      resetTokenExpiresAt: null,
    });
    expect(args.create).toMatchObject({
      email: "admin@example.com",
      role: "ADMIN",
      status: "ACTIVE",
      emailVerifiedAt: now,
    });
  });

  it("supports the generic USER group without defaults", async () => {
    const decision = await parseSeedGroup(
      "USER",
      {
        SEED_USER_EMAIL: "user@example.com",
        SEED_USER_NAME: "Seed User",
        SEED_USER_PASSWORD: "AnotherSecurePassword!42",
      },
      "test",
    );
    expect(decision).toMatchObject({
      kind: "enabled",
      group: "USER",
      email: "user@example.com",
      role: "USER",
    });
  });
});
```

### [UNTRACKED] `packages/database/tests/tsconfig.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "noEmit": true,
    "rootDir": "."
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

### [UNTRACKED] `packages/database/vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", "tests/integration/**"],
    environment: "node",
    globals: false,
  },
});
```

### [UNTRACKED] `packages/database/vitest.integration.config.ts`

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    globals: false,
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    pool: "forks",
    maxWorkers: 1,
    isolate: false,
    globalSetup: ["tests/integration/global-setup.ts"],
  },
});
```
