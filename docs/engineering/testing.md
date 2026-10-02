# Testing and Verification

Use this standard before implementation and during review. Tests prove agreed
behavior at the boundary being claimed. Follow the owner-approved October 2, 2026
roadmap for business rules and phase checkpoints, with
[persistence invariants](data-patterns.md), [API boundaries](api-contracts.md),
[frontend behavior](frontend-standard.md), and [security](security.md).

## Installed Harness and Discovery

The workspace uses Vitest **4.1.10**, Testing Library React **16.3.2**, Supertest
**7.1.4**, and PostgreSQL Testcontainers **12.1.0**. Use the locked Node 24/pnpm 11
environment and existing package scripts; do not introduce another runner.

| Package               | Unit/component discovery                                           | Integration discovery            |
| --------------------- | ------------------------------------------------------------------ | -------------------------------- |
| `@template/contracts` | `src/**/*.test.ts`; Node                                           | No integration script            |
| `@template/database`  | `tests/**/*.test.ts`, excluding `tests/integration/**`; Node       | `tests/integration/**/*.test.ts` |
| `@template/api`       | `src/**/*.test.ts`, excluding `src/**/*.integration.test.ts`; Node | `src/**/*.integration.test.ts`   |
| `@template/web`       | `src/**/*.test.ts` and `src/**/*.test.tsx`; jsdom                  | No integration script            |

Each package has `vitest.config.ts`; API/database additionally have
`vitest.integration.config.ts`. API setup is `apps/api/vitest.setup.ts`; web setup
is `apps/web/src/test/setup.ts`, which installs jest-dom matchers and calls Testing
Library cleanup. Keep tests colocated with the owning feature where the current
pattern supports it. Use `.integration.test.ts` for API database/HTTP evidence and
the database integration directory for migration checks. A `.spec.ts` under an
arbitrary folder is not automatically discovered by these configs.

API/database integration configs run files serially with one worker using
`fileParallelism: false`, `maxWorkers: 1`, and `isolate: false`. Their global setups,
[`API`](../../apps/api/tests/integration/global-setup.ts) and
[`database`](../../packages/database/tests/integration/global-setup.ts), start
separate PostgreSQL **18.4** containers, replace `DATABASE_URL`, run Prisma
`migrate deploy`, and stop the container. They require an available Docker runtime,
image access, and the pnpm-provided `npm_execpath`. Preserve this isolation; do not
silently fall back to a developer database or SQLite. Serial test files do not
prove or prevent business concurrency inside a test.

The current backend is auth/users/health infrastructure. Financial modules,
Redis/BullMQ workers, protected file storage, a configured Playwright suite, and
testnet profiles are not implemented by these standards. Existing `output/playwright`
captures are historical browser evidence, not an installed automated E2E gate.

## Commands That Exist Today

Run from the repository root. The package commands below invoke the declared
Vitest configuration; appending a package-relative filename narrows the run:

```sh
pnpm --filter @template/api test:integration src/modules/auth/auth.service.integration.test.ts
```

```sh
pnpm --filter @template/contracts test
pnpm --filter @template/database test
pnpm --filter @template/database test:integration
pnpm --filter @template/api test
pnpm --filter @template/api test:integration
pnpm --filter @template/web test
pnpm lint
pnpm check-types
pnpm build
pnpm verify:build-output
pnpm verify
```

Root `pnpm test` delegates package unit/component tests through Turbo; root
`pnpm test:integration` delegates the API/database integration scripts. Turbo tests
depend on dependency builds, and unit results can be cached. A cached result is not
a fresh execution; use package/file runs when reporting newly executed evidence.

`pnpm verify` currently runs database format/validate/generate, format check, lint,
types, unit tests, integration tests, build, build-output verification, and
`git diff --check`, in that order. **`db:format` writes the Prisma schema**; account
for unrelated working-tree edits before running the aggregate. The build-output
check verifies compiled entry artifacts and excludes emitted test files; it is not
a browser or deployment test. Do not use the root write-format command to rewrite
unrelated files for a focused change.

Run affected files plus relevant shared regressions after each task batch. Run the
full current regression at P05, P09, P12, P14, and final P15, as required by the
roadmap. Newly added worker/signer/E2E gates must be registered and explicitly run;
the present aggregate cannot prove unregistered work. Do not rerun every unrelated
suite after every small edit. See [Vitest CLI](https://vitest.dev/guide/cli.html)
for verified file filtering and runner options.

## Choose Evidence by Behavior

| Claim                      | Evidence needed                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Contract/serialization     | Accepted/rejected fields, precision/range, omitted/null distinctions, strict authority fields, exact safe JSON output |
| Pure money/calendar rule   | Fixed inputs, boundaries, rounding, invariants, explicit timezone and clock                                           |
| Service policy             | Observable result and effects; focused doubles for external dependencies                                              |
| Money/constraint/atomicity | Real migrated PostgreSQL, real service operation, final ledger/projection/domain state                                |
| HTTP authority             | Actual `createApp`, routes, middleware, authentication/CSRF, contract response and persisted state                    |
| Form/cache                 | Rendered interaction and real QueryClient; adapter/transport boundary fakes                                           |
| Worker scheduling          | Real isolated PostgreSQL/Redis, controlled clock, stale/duplicate job and restart outcomes                            |
| Private proof storage      | Actual isolated files, validation/access/retention results and cleanup                                                |
| Browser behavior           | Configured real browser navigation, cookies, history, focus, viewport, and RTL behavior                               |

Do not require one test per method or 100% coverage. Group meaningful scenarios
around a behavior and its risks. Internal call counts, giant snapshots, or assertions
copied from implementation are insufficient evidence of money correctness.
Spies are justified for an observable boundary such as releasing a blob URL or
preventing a second external send; they do not prove a database rollback.

Existing examples to extend include
[`auth.schema.test.ts`](../../packages/contracts/src/auth/auth.schema.test.ts),
[`auth.service.integration.test.ts`](../../apps/api/src/modules/auth/auth.service.integration.test.ts),
[`app.integration.test.ts`](../../apps/api/src/app.integration.test.ts), and
[`auth.hooks.test.tsx`](../../apps/web/src/features/auth/hooks/auth.hooks.test.tsx).
The HTTP suite constructs `createApp` with a real database and an email-delivery
double; reproduce that composition boundary. Auth service unit tests that mock
transaction callbacks do not establish financial atomicity.

Current employee/admin local-state tests prove demo interactions. Some preserve
old financial behavior: immediate submission credit, differential upgrade debit,
and elapsed-time withdrawal schedules. Those assertions are superseded by the
roadmap for real financial implementation. Deliberately migrate affected tests
while preserving approved UI behavior; a green demo suite is not financial acceptance.

## Financial and Calendar Acceptance

Every implementing phase adds or extends actual test files. Money tests must cover
micro-unit parsing/JSON round trips, representable bounds, invalid precision, floor
rounding, and exact gross/fee/net conservation. Assert balances by source and by
available/reserved state, not only one displayed total.

Use real PostgreSQL for these required outcomes:

- Concurrent purchases cannot overspend or create duplicate subscription/referral
  effects. Debit the full target price; calculate upgrade commissions from the
  positive difference against the previous snapshotted price. Purchase spending
  uses referral funds first, while excluding every reserved amount.
- Daily claim uniqueness survives an upgrade. Submission snapshots entitlement
  without credit; duplicate/concurrent approval credits once, approval versus
  rejection chooses one final decision, and later expiry/ban preserves valid
  submission-time reward terms.
- Receipt replay produces one credit; separate eligible transfer logs in one
  transaction each credit once. Wrong network/token/recipient/failed execution
  cannot credit. Sweeps never credit employees again.
- Concurrent withdrawals produce one active request/reservation. Free/expired
  accounts retain referral ownership but cannot start a withdrawal from it; their
  eligible non-referral funds remain usable. Paid expiry after acceptance preserves
  the original request. Repeated safe cancellation restores its exact source
  allocation once, including referral eligibility restrictions.
- Extension versus stale due job cannot dispatch early. Block/address change
  versus signing yields safe unsent cancellation or active reconciliation, never
  payment plus refund. Lost broadcast acknowledgement reconciles the same durable
  attempt; it cannot create another payment or release reserved money.
- Worker crash after commit, queue publication loss, duplicate workers, and Redis
  restart preserve accepted records and allow database scanning to repair wakeups.
  Restore recovers post-snapshot off-chain commits and reconciles chain activity
  before dispatch, without duplicate payment or lost wallet history.

Control time with a supplied clock or Vitest system time where appropriate; restore
timers after each test. Baghdad rules must be tested as `Asia/Baghdad`, independent
of the host timezone. Cover task 12:00 inclusive/18:00 exclusive and weekends;
purchase before/exactly/after 18:00 and weekend first work dates; 365 weekday dates
with exclusive expiry; and 72 counted weekday hours. Friday 12:00 plus 72 counted
hours is Wednesday 12:00. Normalize a new dispatch that lands exactly at a blocked
weekend boundary to the next eligible weekday; confirmations/reconciliation still
run on weekends. Do not use sleeps to cross a time boundary.

For financial races, dispatch competing operations using separate clients or
connections and an explicit start/lock barrier. `Promise.all` around queries on one
transaction connection does not make those queries concurrent. Assert competing
responses, the winning persisted result, exact posting counts, source totals, and
the losing operation's unchanged effects. Sequential replay alone is not a race.

To prove multi-write rollback, trigger a controlled real failure after an earlier
dependent write in the service and inspect the complete final state. A handcrafted
transaction test unrelated to the service, or a mocked `$transaction`, proves a
different boundary. Preserve auth and migration regressions as schema expands.

## Fixtures, Doubles, and Cleanup

Use deterministic, minimal fixtures with distinct users and business-source IDs.
The present API suites delete auth tables inside their disposable container; as
domains and shared test state grow, scope cleanup or allocate isolated databases.
Never reset or delete unrelated developer/production data to make a test pass.

Fake Resend/TRON/provider network boundaries by default, including unavailable,
late, duplicate, malformed, and unknown-outcome responses. Do not mock Prisma for
money integration, Redis for queue lifecycle claims, or file storage for access
claims. When those infrastructures are introduced, add the real isolated harness
and state its prerequisites. Use test-only signer keys and recovery records.

Frontend tests use accessible roles/labels and the rendered interaction, with a
fresh real QueryClient per independent session. Exercise pending/double-submit,
conflict, late/wrong-scope responses, error recovery, logout/remount, and invalidation
where the feature needs them. Keep money commands unretried automatically; test
explicit recovery/idempotency. Adapter tests inspect final requests and safe output.
Follow [Testing Library query priorities](https://testing-library.com/docs/queries/about/)
and [Testcontainers PostgreSQL](https://node.testcontainers.org/modules/postgresql/)
without replacing the layer under test.

Close clients, containers, servers, Redis connections, file fixtures, listeners,
timers, and pending work on success and failure. Restore mocks, globals, and clocks;
`restoreMocks` does not perform every cleanup. Keep real failure diagnostics free
of private keys, signing payloads, tokens, and user proofs. Do not leave `.only`,
`.skip`, or `.todo` as substitutes for required acceptance. Fix flakiness at its
cause instead of forced exits, arbitrary sleeps, retries, or timeout inflation.

## Browser, Testnet, and Completion Gates

P03 must add a configured Playwright E2E harness and web `test:e2e` script. P08 must
add an explicitly gated API `test:testnet` profile. **Neither script exists today.**
`apps/web/e2e/*.spec.ts` and `apps/api/testnet/*.testnet.test.ts` are proposed paths;
confirm actual scripts/config/discovery before reporting commands as run. Saved
screenshots, jsdom, and Supertest do not establish browser cookie isolation,
history, hydration, focus, or device behavior.

For integrated screens, verify approved Cairo/Arabic/RTL behavior on phone and
desktop, relevant loading/error/restricted/conflict states, keyboard/focus/dialogs,
and narrow layouts. Cover LTR isolation for amounts/addresses and visible content
above bottom navigation. Use the viewport guidance in
[frontend-standard.md](frontend-standard.md); do not multiply every state across
every viewport mechanically. Unexpected console errors or privileged requests
fail the relevant browser check.

Normal unit/integration/browser CI must never spend real funds or contact a live
signer. Testnet execution is separate and opt-in, with explicit network/token,
fresh test-only credentials, designated recipients, provider access, and test
funding. Reject mainnet configuration and missing configuration without fallback.
Exclude testnet files from normal discovery. Report public transaction IDs and
reconciled outcomes, never secrets. Missing required testnet infrastructure means
that gate has not passed.

For a bug, reproduce meaningful failing behavior, make the focused fix, and verify
adjacent cases. Apply `test-guard` to changed tests and applicable production/docs
review skills. Do not weaken a valid assertion to hide a defect.

A phase report records completed scope, changed files, actual tests added/changed,
commands executed, fresh versus cached results, failures, and remaining blockers.
Missing infrastructure or unexecuted required financial tests leaves the phase
incomplete. A local green suite is evidence for its tested boundary, not deployment
approval, restore readiness, or authority to launch real-money operations.
