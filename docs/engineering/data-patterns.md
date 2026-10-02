# Persistence, Queries, and Migrations

Use this standard when specifying or reviewing database work. Business terms come
from the owner-approved October 2, 2026 OSCAR roadmap. See
[backend boundaries](backend-standard.md), [API contracts](api-contracts.md),
[security and recovery](security.md), and [required evidence](testing.md).

## Current Baseline and Ownership

`packages/database` owns the Prisma schema, forward migrations, generated client,
and persistence types. It uses Prisma **7.9.1**, `@prisma/adapter-pg`, and PostgreSQL;
development Compose and integration containers currently use PostgreSQL **18.4**.
`createDatabaseClient` in
[`src/client.ts`](../../packages/database/src/client.ts) creates the adapter-backed
client. API composition injects it into services. Controllers and browser modules
must not construct database clients. Generate, rather than edit,
`packages/database/src/generated/prisma`. This configured output may be absent
until `pnpm db:generate` runs; do not create its files by hand.

The current [`schema.prisma`](../../packages/database/prisma/schema.prisma) contains
only `User` and `RefreshToken`. Wallet, ledger, subscription, task, referral,
deposit, withdrawal, and worker persistence below are implementation requirements,
not existing models. Keep queries in their owning service; extract a feature-local
query helper only when complex or reused. Do not add a generic repository layer.

## Exact Money and Source Provenance

- Store bounded integer **micro-USDT** in PostgreSQL bigint-compatible fields;
  use Prisma `BigInt` and JavaScript `bigint` for exact arithmetic. One USDT is
  1,000,000 micro-USDT. Check each input, sum, and stored result against its
  representable range. Storage limits are not an invented commercial deposit cap.
- Parse validated decimal strings into units without converting through `Number`,
  `parseFloat`, or floating-point multiplication. Reject unsupported precision,
  exponent/grouping syntax, and invalid signs for the particular operation.
  Preserve the exact positive units verified from an eligible deposit receipt.
- Return canonical **USDT decimal strings** in JSON: `1000001n` becomes
  `"1.000001"`, and `1000000n` becomes `"1"`. Do not expose raw `bigint` or coerce
  it to a JSON number. Formatting two display decimals must not round stored units.
- Rates use integer basis points; floor nonnegative percentage-derived amounts
  to one micro-USDT. Gross, fee, and net must reconcile exactly. A 100 USDT
  withdrawal at 2100 basis points reserves 100, pays 79, and settles 21 as fee;
  network resource costs belong to the company.

The existing
[`decimal.ts`](../../apps/api/src/core/serialization/decimal.ts) handles
Decimal-like values; it does not implement micro-USDT parsing, bounds, or bigint
serialization. Add and test the financial boundary during implementation. See
[Prisma 7 BigInt behavior](https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types#working-with-bigint)
and [PostgreSQL 18 numeric types](https://www.postgresql.org/docs/18/datatype-numeric.html).

Maintain referral/non-referral and available/reserved components alongside the
understandable total. Pending task submissions are not wallet credits. Purchases
consume unreserved referral funds first, then other funds, including referral funds
temporarily ineligible for withdrawal. A new withdrawal reserves eligible
non-referral funds first, then eligible referral funds. Persist that exact allocation.
Rejection or safe cancellation restores the same source components; expiry changes
eligibility, not ownership. Reserved funds cannot fund a purchase or another request.

Keep a small append-only ledger of known OSCAR operations and atomically update its
wallet/source projections. Reconcile operation amounts, projections, reservations,
releases, and settlements. Admin correction is a new audited entry with a reason
and reference. Do not rewrite past postings, impersonate a chain receipt, or add a
general accounting engine.

## Schema, Constraints, and Indexes

Read migration SQL as well as Prisma declarations. The
[auth migration](../../packages/database/prisma/migrations/20260818000000_init_authentication/migration.sql)
already adds `ck_users_email_normalized` and
`ck_users_status_timestamps_consistent`, which are not visible as Prisma field
constraints. Friendly request validation complements database constraints.

New financial schema must enforce nonnegative wallet/source/reservation values,
foreign keys, meaningful state restrictions, and unique business sources. Signed
ledger deltas have their own deliberate rules; do not apply a blanket nonnegative
check to every monetary field. Name SQL constraints for precise error handling.
Choose retention/deletion per relationship. Auth refresh-token cascade behavior
does not justify cascading deletion of financial history.

Enforce these identities at the database write, rather than by a prior existence
check alone:

| Business fact         | Required protection                                                                                      |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Employee subscription | At most one current paid subscription; expiry and replacement transitions recheck eligibility atomically |
| Daily task claim      | Unique employee plus Baghdad business date, independent of subscription ID                               |
| Task decision/reward  | One final decision and one reward business source                                                        |
| Referral award        | Unique purchase, recipient, and relative level                                                           |
| Chain receipt         | Unique configured network, transaction ID, and receipt log index                                         |
| Withdrawal            | At most one active request per employee, including scheduled, signing, submitted, and unknown outcomes   |
| Address assignment    | Unique recoverable employee/address mapping; never reassign an old deposit address                       |

Use a unique current pointer, conditional update, lock, or named partial unique
index where it matches the model. A time-dependent "active now" predicate is not
a substitute for explicit expiry/state transitions. Read the actual SQL definition
and test all in-flight states when using a partial index.

Index actual authorization filters, joins, status/deadline scans, and pagination
ordering. Use representative query plans before adding speculative indexes.
Bound background batches to the operational workload and support resumable scans;
do not prescribe arbitrary row caps for every feature.

## Query and Pagination Discipline

Select necessary columns and load relations deliberately. Follow
[`SAFE_USER_SELECT` and `mapSafeUser`](../../apps/api/src/modules/users/users.mapper.ts)
for selecting and explicitly mapping safe output. Do not hide N+1 queries behind
`Promise.all`, return raw ORM records, or load a full financial table to filter it
in the application.

Validate public filters and sort fields through shared contracts, derive employee
scope from server authority, and query live lists in PostgreSQL. The existing
[`parsePagination`](../../apps/api/src/core/pagination/pagination.ts) uses page 1,
limit 25, maximum limit 100, and checks safe offset arithmetic. Reuse its current
contract for compatible offset lists; it is not a deposit or balance limit.

Use deterministic ordering with a unique tie-breaker, and match the row/count
filter. A default transaction at PostgreSQL `ReadCommitted` does not guarantee
that two reads see one snapshot. Request `RepeatableRead` only where an internally
consistent rows/count result is required. A stable sort does not freeze a changing
dataset across requests; define cursor or snapshot behavior when the feature
needs it. Specify null ordering when nullable sort fields matter.

Use parameterized Prisma queries. Where required SQL locking/constraints cannot be
expressed adequately through Prisma, keep parameterized SQL in a small owning
module with real PostgreSQL evidence. Never interpolate user values or accept
client-chosen SQL identifiers.

## Transaction and Concurrency Contract

Before implementing a command, identify its eligible rows/read predicates,
dependent writes, business-source identity, audit requirements, competing outcomes,
transaction boundary, isolation, retry policy, and failure state.

The existing
[`AuthService`](../../apps/api/src/modules/auth/auth.service.ts) demonstrates
transactional token consumption, refresh rotation, and password/session changes.
It does not implement OSCAR financial atomicity. Its registration email failure
cleanup is compensation after an external effect, not a distributed rollback;
detached email promises are not durable work execution.

All money changes enter one transactional financial service. Pass the same
transaction client through every dependent write, including ledger, projections,
reservation, domain result, referral decision, and required audit. Do not use the
root client inside that transaction or open an independent transaction in a helper.
Keep hashing, file processing, provider calls, email, and blockchain I/O outside
long database transactions.

Protect read-modify-write invariants with deterministic row locking, conditional
updates whose affected count is checked, database uniqueness, or suitable isolation.
Lock shared wallets/rows in a consistent order. `Serializable` may support a
cross-row invariant; it does not replace source uniqueness or payout state rules.
Retry recognized transaction conflicts only within a documented bounded policy
that rechecks eligibility and preserves the operation's identity. Never silently
retry a stale quote against new terms or rerun an external transfer.

HTTP idempotency is scoped to actor, operation, and key and bound to the validated
payload. Same-key/different-payload requests conflict. Replays return the existing
outcome or the defined in-progress result. Business-source uniqueness must prevent
duplicate effects even with another or absent client key.

The current
[`mapPrismaError`](../../apps/api/src/infrastructure/database/prisma-error.mapper.ts)
maps `P2002`/relationship conflicts and `P2034` to conflict, `P2025` to not found,
and only approved named checks to validation errors. Add narrowly classified
domain handling for new constraints. A generic uniqueness error is not proof that
a receipt or token was already processed; inspect the exact constraint and existing
business result. Return safe API errors without SQL, credentials, or provider data.
Use [Prisma 7 transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
and [PostgreSQL 18 isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
with the installed API; unversioned Prisma guidance may describe a different major.

## Snapshots, Time, and Durable Recovery

Current package/settings counters identify stale input; immutable operation terms
preserve history. Snapshot purchased price/reward/calendar/fee terms, submission
entitlement, referral event eligibility/rates/base, and accepted withdrawal amounts,
source allocation, destination/address version, and schedule policy. Do not add a
version-registry subsystem or reinterpret history after an admin edit/reactivation.

Store UTC instants separately from Baghdad business dates and use an explicit
`Asia/Baghdad` calendar with a controllable server clock. Subscription work dates,
task windows, and counted withdrawal hours are distinct policies. Neither local
host timezone, browser time, ordinary 365-day addition, nor elapsed 72-hour addition
implements those policies. Test boundary examples in [testing.md](testing.md).

Durable deposit cursors/receipts and withdrawal rows own recovery. Workers claim
eligible records atomically and recheck state, deadline, and schedule version.
Redis/BullMQ provides wakeups; a database scan repairs lost publication and stale
jobs become safe no-ops. Queue loss must not lose an accepted reservation.
Do not introduce a universal outbox or promise exactly-once queue delivery.

Persist transfer attempt identity and broadcast intent before sending. A timeout
or lost response leaves an active reservation until the original attempt is
reconciled. Safe unsent cancellation releases once; a possibly sent transfer cannot
be refunded or redirected. See [security.md](security.md) for protected custody,
signer, and off-VPS recovery requirements. Restore must recover post-snapshot
off-chain commits and reconcile chain outcomes before dispatch resumes; chain
rescanning alone cannot reconstruct task rewards, purchases, or reservations.

## Forward Migration and Review Gate

Use the existing `prisma.config.ts` schema/migration configuration and package
scripts. Create new forward SQL migrations; never rewrite possibly applied history.
Development migration generation, data backfill, and deployment are different
steps. Review generated SQL, preserve historical constraints, and plan compatible
backfills and validation for populated tables. Do not substitute `db:push` or
`db:migrate:reset` for a deployable migration.

Verify a fresh migrated database, a meaningful populated upgrade, constraint
failure/atomicity behavior, and repeated deployment. Update the auth-only inventory
expectations in `packages/database/tests/schema-contract.test.ts` and
`packages/database/tests/integration/migration.integration.test.ts` deliberately
as OSCAR models are added; do not remove them merely to obtain green tests. Use
[Prisma 7 migration customization](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/customizing-migrations)
for unsupported SQL features.

Review requires actual changed test files and executed relevant PostgreSQL suites,
not a mocked transaction callback or schema-format check. Record unexecuted checks
and missing infrastructure honestly. Local results do not establish deployed
migration state, recovery readiness, or authorization to spend real funds.
