# Backend Standard

Use this guide before implementing or reviewing API, worker, or signer changes.
Read the [engineering index](README.md), [code style](code-style.md),
[API contracts](api-contracts.md), [data patterns](data-patterns.md),
[security](security.md), and [testing](testing.md) for their respective rules.
An existing shortcut does not establish an exception to a stated requirement.

## Verified Baseline

The current API is TypeScript ESM on Node 24, Express 5.2.1, Zod 4.4.3,
Prisma 7.9.1 with `@prisma/adapter-pg`, and PostgreSQL. Package names remain
`@template/api`, `@template/contracts`, and `@template/database`. Check
[the API manifest](../../apps/api/package.json) and
[the database manifest](../../packages/database/package.json) when versions change.

| Existing owner                 | Responsibility                                                             |
| ------------------------------ | -------------------------------------------------------------------------- |
| `apps/api/src/server.ts`       | Database creation, connection, HTTP startup, timeouts, shutdown            |
| `apps/api/src/app.ts`          | App factory, global middleware, API mounting, final errors                 |
| `apps/api/src/router.ts`       | Construction and mounting of health, auth, and users modules               |
| `apps/api/src/modules/`        | Feature routes, controllers, services, DTO aliases, mappers                |
| `apps/api/src/core/`           | Configuration, errors, envelopes, request types, pagination, serialization |
| `apps/api/src/infrastructure/` | Email, security primitives, logging, OpenAPI, Prisma error mapping         |
| `apps/api/src/middlewares/`    | Authentication, role authorization, CSRF, validation, limits               |
| `packages/contracts/src/`      | Browser-safe runtime schemas and inferred transport types                  |
| `packages/database/`           | Prisma configuration, schema, migrations, generated client, client factory |

The database currently contains `User` and `RefreshToken`; financial domain models
are not implemented. Ledger, subscriptions, referrals, tasks, deposits, withdrawals,
admin lifecycle, worker, and protected signer behavior below are requirements for
future OSCAR work, not claims that these modules exist. TronWeb, Redis/BullMQ, and
upload-processing dependencies are also planned additions.

## Ownership Rules

**B01 - Compose at process and router boundaries.** Reuse `createApp` and
`createApiRouter`. Routes receive their controller and middleware; controllers
receive services; services receive database and needed collaborators. Construct a
database client once per owning process using `createDatabaseClient`. Do not create
clients per request or inside each service. Existing explicit constructor wiring is
sufficient; do not add a DI container or generic repository framework.

**B02 - Keep HTTP adaptation thin.** Controllers read authenticated context and
validated input, call a use case, and use `ResponseHelper` for the established
envelope and request ID. Routes and controllers must not query Prisma, calculate
fees, award rewards, decide eligibility, or manage financial transactions. Missing
required authenticated/validated context is a wiring defect; do not substitute an
empty actor ID or accept an unchecked cast as proof of validation.

**B03 - Put decisions in services.** Services own eligibility, allowed transitions,
transaction boundaries, immutable terms, and required audit. Pass actor identity
from server authentication; recheck changing account/resource state at the operation
boundary. Prefer one clear use case over a service that merely renames ORM methods.
Extract focused collaborators when responsibilities grow, without a mandatory
folder/class matrix for every feature.

**B04 - Parse once at the HTTP boundary.** Extend shared Zod schemas in
`@template/contracts`; feature DTO files may alias them, as
`modules/users/dto/update-profile.dto.ts` already does. Use `validationMiddleware`
and read parsed query data from `request.validated`; do not overwrite Express query
properties. Preserve async parsing and target-prefixed field errors. Reject
unsupported authority fields and ambiguous shapes. TypeScript types alone do not
validate a request. See [API contracts](api-contracts.md) for wire details.

**B05 - Select and map explicitly.** Select the needed persistence fields and map
them to the authorized contract, following `users.mapper.ts`. Do not return or spread
raw database/provider records into responses. Keep private keys, hashes, storage
paths, private evidence, and internal audit data out of unrelated projections.
Convert timestamps and exact amounts at the boundary, not by changing global JSON
behavior. Existing Decimal serialization is not the planned micro-USDT arithmetic
or a BigInt transport implementation.

**B06 - Give queries a useful owner.** Simple focused Prisma queries may stay in a
small service. Extract complex/reused selections and query helpers into the owning
feature when that improves clarity. Pass the transaction client to helpers used
inside a transaction; never silently fall back to the root client. Filter, sort,
aggregate, and paginate in PostgreSQL with explicit bounds and a unique tie-breaker.
Avoid unbounded request queries and N+1 list loading.

**B07 - Keep adapters outside business logic.** SDK, email, network, file, and signing
details belong in focused infrastructure adapters. Reuse the existing `EmailDelivery`
boundary. Use bounded timeouts and deliberate retries; sanitize provider failures.
An email provider acknowledgement is not proof of mailbox delivery, and a broadcast
acknowledgement is not payout settlement. Map unknown outcomes explicitly.

## Transactions and State

**B08 - One owner for dependent writes.** Commit a business operation, its financial
postings/source projections, and required audit in one PostgreSQL transaction.
All money changes must use the same financial service boundary once implemented.
Do not hold a database transaction across email, TRON, Redis, or file-processing I/O.
Use durable state and explicit failure/cleanup rules where those boundaries cannot
commit together. Schema, exact money, and ledger constraints belong in
[data patterns](data-patterns.md); authority and signer controls belong in
[security](security.md).

**B09 - Protect races at the write.** A pre-read improves error messages but does
not protect concurrency. Use appropriate uniqueness, locking, conditional current
state/version predicates, and isolation. Retry only the identified transient
transaction conflict, with bounds and a safe replayable operation. Never blanket
retry uniqueness errors or repeat external transfers. Check the affected-row count
and return the documented conflict when another actor wins.

**B10 - Separate retries from new actions.** Define each command's business identity,
duplicate result, and payload-conflict outcome. Client idempotency keys are scoped to
actor/operation and payload; durable business-source uniqueness must still prevent
duplicate money effects with a new or missing key. Use explicit transitions rather
than unrestricted status patches. A stale quote or scheduled job must not overwrite
newer state. A version counter detects stale terms; immutable operation snapshots
preserve purchased rewards, fees, commission decisions, and destinations.

**B11 - Use one deliberate calendar policy.** OSCAR business dates and counted
deadlines use `Asia/Baghdad`, independently of host/browser timezone. Store instants
consistently and compute daily eligibility/deadlines on the server. Task hours,
subscription work dates, and withdrawal counted hours are different rules. The
existing `core/date-only.ts` validates date-only strings; it does not implement
Baghdad business scheduling. Add the focused timezone-aware implementation needed
by the phase and control its clock in boundary tests.

**B12 - Preserve history.** Admin corrections append audited entries; do not rewrite
ledger postings or genuine chain receipts. Lifecycle changes must preserve financial,
sponsor, address-assignment, submission, and audit history. Specify permitted cleanup
per entity instead of imposing soft deletion everywhere. Applied migrations move
forward; do not rewrite history or fabricate new semantics for legacy records.

## Durable Background Work

**B13 - The database owns accepted work.** Store withdrawal state, counted deadline,
schedule version, reservation, and attempt identity durably. Deposit indexing owns
its cursor and event identities. A worker scans bounded eligible batches and claims
work atomically; every job rechecks current database state, timing, and preconditions.
Duplicate workers and stale extension jobs must be safe. Redis/BullMQ supplies
wakeups and bounded retry assistance; database scanning repairs lost wakeups.
Queue availability cannot determine wallet truth. See
[BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs).

Do not introduce a generic outbox or event-delivery framework. Purchases/commissions
and task rewards settle inside their database transaction. Use the relevant durable
business record for scheduling, reconciliation, and retries.

**B14 - Separate privileged runtimes.** Future worker and signer entrypoints may
live in the API build, but run with separate process identities, permissions, and
secrets. They do not exist yet, and current `dev`/`start` scripts start only the API.
Add and verify scripts/build inclusion when implementing them. Importing the public
app/router must not load custody keys, start workers, or expose signing operations.
Signer intents and recovery requirements are defined in [security](security.md).

## Configuration and Lifecycle

**B15 - Validate configuration before accepting traffic/work.** Extend the existing
`core/config/` owners and keep ordinary modules away from direct environment reads.
Use typed, bounded settings and fail on missing or malformed required values. Update
the root `.env.example` with placeholders and document each new process's required
settings. The API's `env.ts` loads the workspace `.env` outside production when
`RAILWAY_ENVIRONMENT` is absent; production expects injected configuration.
Do not imply the Prisma CLI has the same loader: `packages/database/prisma.config.ts`
loads the workspace `.env` separately.

Use Prisma 7's existing generated client/factory and `PrismaPg` adapter, with CLI
connection configuration in `prisma.config.ts`. Do not copy Prisma 6 connection or
generator assumptions. See [Prisma driver adapters](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/database-drivers).
Production secret, network, and signer fail-closed rules are in
[security](security.md); current configuration does not satisfy all of them.

**B16 - Own startup, shutdown, and async failures.** Keep middleware and request
logging in `app.ts`, and startup/timeouts/signals in `server.ts`. Preserve the final
not-found/error handlers. Express 5 forwards rejected promises from returned async
handlers; detached callbacks/timers still need an explicit owner and failure path.
Do not add an Express 4 async-wrapper convention. See
[Express error handling](https://expressjs.com/en/guide/error-handling/).

Workers/signers must stop claiming new work during shutdown, settle or persist
owned work safely, close queues/listeners/timers, and disconnect their database.
After restart, reconcile persisted attempts before dispatch. Do not add untracked
fire-and-forget work to financial flows or use forced exit to hide leaked resources
in tests. Request IDs correlate diagnostics; they do not replace business identities.

## Review Checklist

- Routes have the intended authentication, role, CSRF, limit, and runtime schemas;
  services receive server identity and parsed values.
- Controllers remain HTTP adapters; services own invariants; queries inside
  transactions use their transaction client; outputs use allowed projections.
- The command's atomic state, snapshots, duplicate semantics, and concurrency
  protection are explicit and backed by PostgreSQL evidence where needed.
- External failures, lost acknowledgements, restart, stale work, and cleanup have
  truthful outcomes; no timeout causes a guessed settlement/refund.
- Process imports, configuration, secret boundaries, scripts, OpenAPI, and contracts
  agree with the actual implementation.
- Relevant [testing checks](testing.md) pass, including persisted state after
  consequential HTTP commands. Report what ran and any missing infrastructure;
  a checklist does not establish that a test passed.
