# Feature Specification: P01 - Financial Backend Foundation

**Feature Branch**: main (existing branch; no branch-creation hook is installed)

**Created**: 2026-10-02

**Status**: Draft

**Input**: User description: "PHASE_ID=P01. Read docs/workflow/speckit-prompts.txt. Apply OPERATING CONTRACT and execute SPECIFY only."

**Roadmap Phase**: P01 - Financial Backend Foundation

**Feature Directory**: specs/001-financial-backend-foundation

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: The P01 financial foundation from [PLAN.md](../../PLAN.md), Section 7: exact USDT amount/rate contracts; one Baghdad business calendar; durable source-aware wallets, append-only ledger, reservation allocations, operation idempotency and audit; atomic credits, debits, reservations and releases; source reconciliation; and financial persistence upgrades with focused acceptance tests. Sections 3.2-3.3, 3.7, 4 and 5.2 supply the applicable calculation and accounting rules.
- **Exclusions**: Toolkit setup or constitution changes; registration-time wallet provisioning and identity/admin lifecycle (P02); actual package, subscription and referral-award workflows or wallet/history endpoints (P04); tasks/proofs/review (P06); chain receipt detection, custody and treasury operations (P08); withdrawal quotes, requests, active-request lifecycle, queues and dispatch scheduling (P10); signing, broadcasting, payout settlement and recovery workflows (P11); reporting/settings administration, deployment and release. P01 supplies arithmetic, calendar and accounting foundations for those phases without implementing their business workflows. No generic event engine, outbox, general accounting/reporting platform or version registry is in scope.
- **Prerequisites**: No predecessor implementation phase. The installed toolkit, populated [constitution](../../.specify/memory/constitution.md), approved roadmap, all eight [engineering guides](../../docs/engineering/README.md) and existing authentication/database/contract foundation are available. The existing build/test baseline must be checked during implementation, within P01. Availability of the required isolated database runtime and baseline pass status have not been assessed by SPECIFY.
- **Frontend boundary**: Backend only. No frontend pages, routes, layouts, popups, copy, styles, fixtures or integrations are changed. Financial contracts do not grant any client authority to set money.
- **Owner decisions**: Counted-hour extension representation and precision are settled by the clarification below. The required dedicated admin login surface remains an unresolved frontend-freeze conflict for P03; it does not block this backend specification or authorize UI work.
- **Acceptance gate**: P01 contracts, persistence upgrades and financial/calendar services must meet the scenarios and success criteria below through actual added/extended tests. Persistence, constraints, rollback and concurrency require real migrated PostgreSQL, as mandated by the roadmap. Existing authentication and schema/migration regressions must remain valid with deliberately expanded inventories. A baseline or required financial check that cannot run leaves the implementation gate incomplete. This specification and its quality checklist are not implementation or test-execution evidence.

The [operating contract](../../docs/workflow/speckit-prompts.txt) and constitution govern this phase. Future domain groups must pass their backend gates before frontend integration.

### Actors and Current Capability

Employees are the owners of recorded funds. Trusted backend operations apply validated business events to those funds. Authorized administrators will use later domain workflows for corrections; auditors and maintainers need a reconstructable history and evidence that accounting is correct. P01 itself adds no employee/admin financial endpoint.

Current source inspected for this specification:

| Evidence | Existing capability and P01 gap |
| --- | --- |
| [API router](../../apps/api/src/router.ts) | Auth, users, health and OpenAPI are composed; no financial domain routes are composed. |
| [Persistence schema](../../packages/database/prisma/schema.prisma) | User and RefreshToken exist; wallet, ledger, reservation, financial idempotency and audit persistence are absent. |
| [Contract exports](../../packages/contracts/src/index.ts) | Auth, account and HTTP contracts exist; financial amount/rate/source contracts are absent. |
| [Decimal serialization](../../apps/api/src/core/serialization/decimal.ts) | Generic decimal serialization exists; it is not bounded micro-USDT arithmetic or an exact micro-unit transport contract. |
| [Date-only helper](../../apps/api/src/core/date-only.ts) | Calendar-date validation/UTC date-only serialization exists; Baghdad task, subscription and counted-hour policies are absent. |
| [Schema inventory test](../../packages/database/tests/schema-contract.test.ts) and [migration integration test](../../packages/database/tests/integration/migration.integration.test.ts) | Inventories currently expect only auth models/tables. Financial additions must extend expectations while preserving existing auth checks and relationships. |

None of the P01 financial deliverables is claimed to be implemented by this document.

## Clarifications

### Session 2026-10-02

- Q: Which precision rule should apply to counted-hour extensions? → A: Accept positive decimal strings of hours, including fractions, only when they convert exactly to whole milliseconds. Reject fractional-millisecond values without rounding (Option A).

## User Scenarios & Testing _(mandatory)_

The scenarios exercise foundational operations with controlled, trusted business inputs. They do not require later product workflows or authorize exposing financial primitives publicly.

### User Story 1 - Keep Every USDT Amount Exact (Priority: P1)

An employee's funds and an administrator's financial records retain every supported micro-unit when amounts are accepted, calculated, stored and returned.

**Why this priority**: A precision or rounding error changes financial ownership before any higher-level workflow can be trusted.

**Independent Test**: Supply supported and invalid amount/rate values, calculate percentages and gross/fee/net, and compare exact returned values with the accepted amounts.

**Acceptance Scenarios**:

1. **Given** amounts "1", "1.000001" and "0.000001", **When** they pass through acceptance and output, **Then** each retains its exact value, with one USDT equal to 1,000,000 micro-units and no numeric money field in the JSON result.
2. **Given** an amount with seven fractional digits, exponent/grouping syntax, a numeric value, a negative command amount or a value beyond the supported range, **When** it is submitted, **Then** it is rejected without rounding, truncation or financial mutation.
3. **Given** "0.000009" and 1200 basis points, **When** the percentage amount is calculated, **Then** it is "0.000001"; **Given** "0.000001" and 2100 basis points, **Then** the result is "0".
4. **Given** a gross amount of "100" and 2100 basis points, **When** fee and net are calculated, **Then** fee is "21", net is "79", and gross equals their exact sum. This calculation does not accept or send a withdrawal.
5. **Given** an individually valid amount whose addition would overflow a wallet component or total, **When** a credit is attempted, **Then** the complete operation is rejected and all existing records remain unchanged.

### User Story 2 - Preserve Fund Sources Through Spending and Reservation (Priority: P1)

An employee's referral and other funds remain distinguishable through credits, spending, reservation and safe release, so locked or reserved money cannot become spendable by changing its label.

**Why this priority**: Source loss can grant unauthorized spending or withdrawals even when a displayed total looks correct.

**Independent Test**: Apply the foundation's operations to a wallet with mixed sources and inspect exact available/reserved components and its history after each transition.

**Acceptance Scenarios**:

1. **Given** "70" available non-referral and "30" available referral funds, **When** a purchase-purpose debit of "20" is accepted, **Then** available non-referral remains "70", available referral becomes "10", and ownership totals "80".
2. **Given** that remaining wallet and trusted eligibility allowing both sources, **When** "75" gross is reserved, **Then** "70" non-referral and "5" referral move to reserved, "5" referral remain available, and ownership still totals "80".
3. **Given** that reservation and subsequent expiry of paid eligibility, **When** the owning workflow authorizes safe release, **Then** precisely "70" non-referral and "5" referral return to available once; the wallet again contains "70" non-referral and "10" referral, with the retained referral funds still ineligible for a new Free-account withdrawal.
4. **Given** a Free/expired eligibility context with available funds of both sources, **When** a withdrawal-purpose reservation is attempted, **Then** only eligible non-referral funds may be reserved; insufficient eligible funds produce no partial reservation. Purchase-purpose spending may still use unreserved referral funds first.
5. **Given** funds already reserved, **When** another debit/reservation tries to consume them, **Then** it cannot do so; a reservation/release never changes total ownership.
6. **Given** a reservation already released or otherwise closed, or one whose owning workflow cannot establish safe release, **When** release is requested, **Then** no second credit or guessed refund occurs.

### User Story 3 - Apply One Atomic Effect Despite Repeats and Races (Priority: P1)

A trusted backend caller can recover from a repeated or interrupted operation without crediting twice, overspending, or leaving history inconsistent with ownership.

**Why this priority**: Multiple devices, concurrent domain operations and lost replies are normal sources of duplicate financial attempts.

**Independent Test**: Repeat and concurrently compete foundation operations against real persisted wallets; inspect outcomes, posting counts, allocations, audit and final source balances.

**Acceptance Scenarios**:

1. **Given** one valid credit with a stable business identity, **When** it is delivered 100 times, including with different or absent client request keys, **Then** there is one committed credit and one financial effect.
2. **Given** a completed operation, **When** the same actor, operation, request key and validated payload are replayed, **Then** the caller receives the existing outcome without new postings, audit effects or balance changes.
3. **Given** an existing request identity or business identity, **When** it is reused with a changed amount, wallet, source or other consequential intent, **Then** the caller receives a conflict and neither operation is modified.
4. **Given** "100" available funds, **When** two independent debit operations of "80" compete, **Then** exactly one can commit, ownership becomes "20", and the losing operation leaves no posting or partial effect.
5. **Given** "100" available funds, **When** a debit of "60" and reservation of "60" compete, **Then** at most one can commit and no source component becomes negative.
6. **Given** an operation with multiple dependent writes, **When** a controlled failure occurs after an earlier write but before commit, **Then** its postings, projections, reservation, outcome and required audit all remain as they were before the attempt.
7. **Given** a committed operation whose reply is lost, **When** the caller retries or reconciles that identity, **Then** it discovers the committed outcome without a second effect; an unconfirmed response alone never authorizes reservation release.
8. **Given** one releasable reservation, **When** two safe release attempts compete, **Then** only one release effect is posted and the recorded source allocation is restored once.

### User Story 4 - Use the Same Baghdad Business Boundaries (Priority: P2)

Employees and later domain workflows receive consistent task windows, subscription dates and counted deadlines regardless of the browser or server host's timezone.

**Why this priority**: Different interpretations of time alter work eligibility and when reserved funds may be dispatched.

**Independent Test**: Evaluate a controlled set of instants and dates under multiple host timezones and compare them with the approved Baghdad calendar outcomes.

**Acceptance Scenarios**:

1. **Given** a Monday-Friday Baghdad date, **When** time is just before 12:00, exactly 12:00, just before 18:00 or exactly 18:00, **Then** the task window is respectively closed, open, open and closed; Saturday/Sunday are closed throughout.
2. **Given** a weekday purchase instant before 18:00, **When** the subscription counting dates are calculated, **Then** that date is the first counted date; exactly 18:00 or later uses the next Monday-Friday date. Weekend purchases first count Monday. Immediate activation time remains separate.
3. **Given** a first counted work date, **When** a 365-work-date term is calculated, **Then** exactly 365 Monday-Friday dates count, including the first; missed work does not extend the term. Expiry is midnight at the start of the calendar date immediately after the final counted date, exclusive, even if that expiry date is Saturday.
4. **Given** Friday 12:00 Baghdad, **When** 72 counted hours are added, **Then** the deadline is Wednesday 12:00 Baghdad. A Saturday starting instant accumulates no hours until Monday; all weekday hours count, including hours outside the task window.
5. **Given** a counted deadline landing exactly at Saturday 00:00, **When** the earliest new-dispatch instant is calculated, **Then** it is normalized to Monday 00:00 Baghdad. Positive extensions add counted hours to the existing deadline, not a restarted 72-hour period.
6. **Given** a Saturday/Sunday confirmed credit event or confirmation of a previously sent transfer, **When** calendar classifications are consulted, **Then** the calendar imposes no weekend credit/reconciliation hold. Provider verification and dispatch themselves remain later-phase work.
7. **Given** the same input instants on hosts with different timezones or across a year boundary, **When** calculations repeat, **Then** Baghdad dates and resulting instants are identical.
8. **Given** a supported existing counted deadline, **When** a positive decimal-hour extension is supplied, **Then** "1.5" adds exactly 5,400,000 counted milliseconds and "0.0000025" adds exactly 9 counted milliseconds, skipping Saturday/Sunday as usual. "0.0000001" (0.36 milliseconds) and "0.000001" (3.6 milliseconds), numeric inputs, malformed strings and nonpositive durations are rejected without rounding, truncation or a changed deadline.

### User Story 5 - Explain History and Preserve Existing Accounts (Priority: P2)

An auditor can explain each recorded change and a maintainer can introduce financial persistence without losing existing accounts, security constraints or history.

**Why this priority**: Reliable ownership needs a durable explanation, and the financial foundation must extend the existing application safely.

**Independent Test**: Reconcile a sequence of mixed-source operations and an appended correction, then inspect fresh and populated persistence upgrades and existing authentication regressions.

**Acceptance Scenarios**:

1. **Given** credits, debits, reservations and releases, **When** their history is reconciled, **Then** every source/state movement explains the final components exactly and references its originating operation and trusted actor/time.
2. **Given** an incorrect prior posting, **When** an authorized correction with reason/reference is applied through the foundation, **Then** a new audited operation changes the appropriate source components and the original posting remains unchanged. This does not create an admin adjustment endpoint.
3. **Given** a mismatch between recorded movements and current components, **When** reconciliation is performed, **Then** the mismatch is reported and neither history nor balances are silently rewritten to guessed values.
4. **Given** populated existing accounts and refresh records, **When** the financial persistence upgrade is applied and then reapplied, **Then** accounts, credentials, refresh relationships and existing checks remain intact, without invented legacy financial balances or duplicate financial effects.
5. **Given** financial history attached to an existing owner, **When** an account deletion would erase that history, **Then** it is prevented from cascading through financial records; final account lifecycle behavior belongs to later phases.

### Edge Cases

- Zero is valid for balances and rounded percentage results; credit, debit and reservation commands require a positive amount. A zero rounded fee/commission does not justify an invented minimum.
- Minimum precision, maximum supported amount, aggregate overflow, excessive fractional digits, signed zero, blank/whitespace, leading/trailing zeros, numeric money, exponent and grouped syntax must have the explicit outcomes in FR-001-FR-004.
- A purchase/reservation can fit total ownership yet exceed unreserved or action-eligible funds; it must fail without partial allocation.
- Source eligibility changes after reservation never rewrite the saved allocation; release cannot relabel referral funds as other funds.
- Same-key duplicates, changed payloads, distinct actors reusing the same textual key, different keys for one business event and concurrent releases require independent identity and authority checks.
- Losing a response before or after commit must not create a new effect or prove that funds should be released.
- An invalid/nonexistent wallet owner, missing trusted operation context or forged ownership/financial authority must not mutate or expose another wallet.
- A failure after a posting/projection change must leave no orphan audit, operation outcome or reservation.
- Leap dates, month/year changes, Friday-to-weekend cutoffs, exactly 18:00, and expiry immediately before/at/after the exclusive boundary must retain the same Baghdad policy.
- Fractional-hour extensions may exceed one millisecond yet still contain a fractional millisecond; both "0.0000001" and "0.000001" are rejected. An exactly representable small fraction such as "0.0000025" is accepted; no rounding or invented minimum extension replaces the exact-duration rule.
- Missing required database/runtime evidence leaves the implementation gate open; no mock success or live provider fallback satisfies P01.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The foundation MUST support USDT only, exactly to six fractional digits, with one USDT equal to 1,000,000 micro-units. Accepted amounts and calculations MUST never lose or invent a micro-unit.
- **FR-002**: Amounts at the financial JSON boundary MUST be canonical decimal strings: "0" for zero; no sign for nonnegative values; no leading integer zeros except zero itself; an optional fraction of one to six digits ending in a nonzero digit. Examples include "1", "1.23" and "0.000001". Numbers, exponent/grouping syntax, whitespace, unsupported signs, empty fractions, excess precision and noncanonical forms such as "01" or "1.2300" MUST be rejected at this boundary without rounding. Signed ledger movements MAY carry a leading minus for an actual debit, subject to the same precision/canonical rules; command magnitudes remain positive.
- **FR-003**: Nonnegative amounts MUST lie between "0" and "9223372036854.775807" inclusive, the upper range derived from signed 64-bit micro-unit storage and expressed in USDT. Every stored component, ownership total and signed movement MUST fit its representable bounds; additions/subtractions MUST detect overflow or underflow before mutation. This is a technical representability limit, not a new commercial deposit cap.
- **FR-004**: Rates MUST use integer basis points, with 10,000 basis points equal to 100%. Supported percentage rates are 0-10,000 inclusive; fractional, negative or out-of-range rates MUST be rejected. Percentage-derived nonnegative amounts MUST be floored to one micro-unit. The initial fee 2100 and referral rates 1200/600/400/200/200 MUST produce the approved percentages exactly; gross MUST equal fee plus net. Verified credit units MUST not be rounded by a percentage calculation.
- **FR-005**: The financial boundary MUST validate its declared amounts, rates, sources, dates and operation identity. No client-provided balance, actor authority, eligibility, reward, commission, fee, deadline or outcome MAY override server-derived decisions; unsupported authority fields MUST be rejected rather than assigned. Safe outputs MUST preserve exact amounts without raw numeric money or private persistence/credential data.
- **FR-006**: Each foundation wallet MUST belong unambiguously to one existing account, with at most one wallet per account and no orphan owner. Creating financial persistence MUST not add registration-time wallet provisioning, which belongs to P02.
- **FR-007**: Wallet ownership MUST distinguish available referral, reserved referral, available non-referral and reserved non-referral funds. All four components MUST remain nonnegative; their sum MUST equal total ownership.
- **FR-008**: A pending or unverified business event MUST not itself credit available funds. Credits MUST be based on a trusted owning operation's validated event and recorded source classification; P01 MUST not fabricate provider confirmation or task approval.
- **FR-009**: Every committed source/state movement MUST have append-only history tying exact deltas to its wallet, operation kind, originating business identity and server-derived time. More detailed origins MUST remain distinguishable without losing the referral/non-referral classification.
- **FR-010**: Positive credits MUST increase only the recorded source's available funds and MUST not overwrite a balance or rewrite a prior event.
- **FR-011**: Purchase-purpose debits MUST consume only unreserved funds, referral first and then non-referral, even when retained referral funds are ineligible for withdrawal. Insufficient purchase-eligible funds MUST reject the entire debit.
- **FR-012**: Withdrawal-purpose reservations MUST move the entire requested gross from eligible available funds to reserved, non-referral first and then eligible referral. The fee/net calculation MUST not reduce the amount reserved. Free/expired eligibility excludes referral funds from a new withdrawal but does not erase their ownership or purchase eligibility.
- **FR-013**: A reservation MUST retain its exact original source allocation, wallet and operation identity. Moving funds between available and reserved MUST preserve ownership, and no other debit/reservation MAY consume reserved funds.
- **FR-014**: A safe release MUST restore exactly the saved allocation to the same source components once, without recalculating source ordering from current balances or eligibility. Repeated/concurrent release MUST yield no additional credit; expiry MUST not convert released referral funds into non-referral funds.
- **FR-015**: Release MUST require the owning operation to establish that the reservation is safely releasable and not already released/consumed. An uncertain caller response or possibly sent payout MUST not be treated as proof of safe release. Actual payout-state reconciliation and settlement are P11 responsibilities.
- **FR-016**: Each financial change, its postings, source projections, reservation change, durable operation outcome and required audit MUST succeed together or have no effect. Required related business changes supplied by the owning domain MUST share that all-or-nothing outcome.
- **FR-017**: Failure at any point before commit MUST leave all dependent records unchanged. After commit, loss of a reply MUST leave the recorded result recoverable by the same operation identity without another effect.
- **FR-018**: Every financial effect MUST have a durable unique business-source identity. Replaying that identity with the same intent MUST be duplicate-safe even when a client key is new or absent; altered consequential intent for the same source MUST conflict without writes.
- **FR-019**: Request idempotency MUST bind the authenticated/trusted actor, operation, supplied key and validated consequential payload. Reusing a key for changed intent MUST conflict; the same textual key used by another actor or operation MUST not retrieve another scope's private outcome or collide merely because its text matches.
- **FR-020**: An authorized replay of the same intent MUST return the existing committed financial outcome, preserving its exact recorded terms and allocations, without new effects or mutation audit. An operation still being resolved MUST not be reported as a new success. Replays MUST remain subject to current authority to observe the outcome.
- **FR-021**: Competing credits, debits, reservations and releases MUST yield outcomes equivalent to a valid ordered application of permitted operations. No race MAY overspend, duplicate a source event, create negative components or leave ledger/projections inconsistent.
- **FR-022**: Any internal retry of a recognized temporary transactional conflict MUST be bounded and retain the same business/request identity while rechecking relevant current state. Insufficient funds, changed payload, invalid authority and business conflicts MUST not be blindly retried; no foundation retry MAY trigger an external transfer.
- **FR-023**: Financial authority and wallet ownership MUST come from trusted server operation context, never submitted actor/owner values alone. Missing/mismatched context and nonexistent wallet owners MUST be rejected without mutation or private outcome disclosure. Existing authentication/authorization protections MUST remain intact; action-specific eligibility and account/session lifecycle extensions belong to the owning later phases.
- **FR-024**: Historic postings and required audit MUST not be edited or deleted to correct a balance. A correction MUST append a distinct authorized operation with reason/reference, trusted actor/time and correct source effects, under the same atomicity, bounds and duplicate protections.
- **FR-025**: Reconciliation MUST compare recorded source/state movements with wallet components and outstanding allocations, identify any mismatch, and never silently repair it through guessed credits, historical edits or source reclassification.
- **FR-026**: Financial persistence upgrades MUST preserve existing accounts, refresh records and auth constraints, support a fresh installation and a populated upgrade, and be safely repeatable. They MUST not rewrite applied migration history, invent historical balances, or allow account deletion to cascade through financial history. Existing auth-only inventories MUST be deliberately extended rather than discarded.
- **FR-027**: One server-authoritative Asia/Baghdad calendar MUST supply business dates and policy calculations independently of host/browser timezone. Business dates MUST remain distinct from actual UTC instants.
- **FR-028**: Task-window calculations MUST be open only Monday-Friday from 12:00 inclusive to 18:00 exclusive in Baghdad. Weekends and exact close time MUST be ineligible; calendar computation does not itself publish tasks or grant entitlement.
- **FR-029**: Subscription calculation MUST keep the activation instant separate from its first counted work date. A weekday purchase before 18:00 first counts that date; at/after 18:00 first counts the next work date; weekend purchases first count Monday.
- **FR-030**: Subscription term calculation MUST count exactly 365 Monday-Friday dates, including the first, without extending for missed tasks. Expiry MUST be the start of the calendar date immediately after the final counted date, represented as an instant and exclusive; it MUST not be shifted merely because that expiry date is a weekend.
- **FR-031**: Counted withdrawal hours MUST include every hour of Monday-Friday Baghdad dates and exclude Saturday/Sunday. The initial 72-hour calculation MUST match Friday 12:00 to Wednesday 12:00. A weekend start MUST accumulate no time until Monday; positive extensions MUST add to the existing deadline. Extensions MUST be supplied as positive plain decimal strings of hours, not numeric JSON values. Whole and fractional hours MUST be accepted only when their exact duration is an integer number of milliseconds, with one counted hour equal to 3,600,000 milliseconds. Fractional-millisecond durations MUST be rejected without rounding or truncation.
- **FR-032**: A calculated earliest new-dispatch instant that lands at the start of a blocked weekend interval MUST normalize to the next eligible weekday instant. The calendar MUST not block daily credits, confirmation or reconciliation of already sent transfers on weekends.
- **FR-033**: Calendar boundaries MUST be deterministic for valid dates/instants, including leap/month/year changes. Invalid dates/instants, malformed extension strings, numeric extension inputs, nonpositive extensions, precision disallowed by FR-031 and unrepresentable results MUST fail explicitly without returning a guessed deadline or changing the existing one. Plain decimal-hour strings contain digits with an optional decimal point followed by digits; signs, whitespace, exponent and grouping syntax MUST be rejected. An extension whose resulting instant falls outside the supported calendar range MUST be rejected rather than clamped or rounded.
- **FR-034**: Errors and audit projections MUST retain useful operation references and safe conflict outcomes without exposing authentication secrets, private signing/provider payloads, raw persistence errors or another owner's financial data. P01 MUST add no arbitrary balance-patch, signing or client-authoritative financial endpoint.
- **FR-035**: P01 implementation MUST add/extend actual amount, contract, calendar, ledger, concurrency and migration/schema tests and run focused checks plus affected existing auth/shared regressions. Real migrated PostgreSQL MUST verify constraints, concurrent competing operations, multi-write rollback, source release and reconciliation. Unexecuted or unavailable checks MUST remain explicit unmet implementation evidence.

### Key Entities _(include if feature involves data)_

- **Wallet**: An account's USDT ownership, split by referral/non-referral source and available/reserved state.
- **Ledger Posting**: An immutable explanation of exact wallet/source/state changes linked to a known business operation; corrections create new postings.
- **Financial Operation**: The trusted actor, owning wallet(s), operation kind, stable business identity, validated intent and durable outcome that bind an all-or-nothing change.
- **Request Identity**: An actor/operation-scoped request key and consequential payload binding used to recover an existing outcome safely; it does not replace business uniqueness.
- **Reservation Allocation**: The exact source amounts moved from available to reserved for an owning operation, with an unambiguous closed/released outcome; later withdrawal phases supply their full lifecycle.
- **Audit Record**: Server-derived actor/process identity, time, action, affected operation and required reason/reference, retained without secrets or private provider payloads.
- **Business Calendar Result**: Baghdad business date, task-window classification, first/final counted work dates, exclusive expiry or counted-hour deadline derived from the approved policy. This is a logical result, not a requirement for an additional stored table.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every supported amount in the acceptance boundary set returns exactly the same value to one micro-unit; every invalid precision/syntax/range case is rejected. Every percentage case floors correctly and every gross/fee/net case conserves the full amount.
- **SC-002**: Across 100 deliveries of one credit/debit business identity, including changed/missing request keys, exactly one financial effect exists. For concurrent "80" debits against "100", exactly one succeeds and final ownership is "20"; no tested race yields negative or mismatched source components.
- **SC-003**: Every controlled failure before commit leaves zero partial postings, allocations, balance changes, durable successes or mutation audit effects. Every lost-reply replay recovers the original outcome without an extra effect.
- **SC-004**: In every mixed-source reservation/release acceptance case, the released allocation equals the recorded allocation exactly, ownership is conserved and retained referral funds remain correctly classified after eligibility changes.
- **SC-005**: Every specified task, purchase, 365-work-date, expiry, 72-counted-hour and extension-precision boundary has the same expected Baghdad result under at least two distinct host timezones, including weekend and year/leap-date cases. Whole/fractional-hour acceptance and fractional-millisecond/input rejection match FR-031/FR-033 exactly, without an altered deadline on rejection.
- **SC-006**: Fresh installation, populated auth-data upgrade and repeated upgrade preserve all existing auth records and checks; no financial history is lost or invented. The expanded financial inventories and affected authentication regressions pass on the required real persistence boundary.
- **SC-007**: An auditor can reconstruct 100% of source/state changes in the acceptance sequences from operation-linked history, including every correction and required actor/time/reason/reference; unexplained differences are reported rather than silently rewritten.

## Assumptions

- The strict canonical JSON amount grammar in FR-002 is the default financial wire agreement for this new foundation. Human draft input may be normalized before submission by a later integration; P01 does not change form behavior. No extra precision is rounded into an acceptable command.
- A percentage is bounded to 0-100% for this foundation, represented by integer basis points. Zero resulting fees/commissions are valid arithmetic results. Initial fees, rates, duration and formulas are approved rules, not questions to reopen.
- P01 exercises reusable operations using controlled existing-account fixtures and trusted operation context. Production wallet provisioning during registration is P02; domain eligibility, event verification and full workflows remain in their named phases.
- Domain owners will supply validated business identities and eligibility under their approved rules. P01 cannot turn an unverified deposit, pending submission or unknown payment response into authority to credit, settle or release funds.
- Source-aware atomicity and durable operation history are necessary foundations for future settlement/recovery, but this phase does not implement payout settlement, external-provider handling, Redis jobs, custody or restore tooling.
- All eight engineering guides were read for this phase. They constrain later implementation; this specification does not select new dependencies, route methods, schema layouts or technical architecture.
- The specification-quality review establishes completeness of intended behavior only. No application code, automated tests, migrations, production configuration or live financial verification is created or executed by SPECIFY.
