# P09 Withdrawal Integration Contract

**Status**: Proposed consumer contract. Existing endpoints below are implemented by
P08; the explicitly proposed compatibility additions must be implemented/tested before
P09 wiring. Schemas remain owned once in
[withdrawal.schema.ts](../../../packages/contracts/src/withdrawals/withdrawal.schema.ts),
[wallet.schema.ts](../../../packages/contracts/src/wallet/wallet.schema.ts) and their
public exports. This is not an implementation or another OpenAPI schema source.

## Protocol and authority

Paths below are relative to the existing `/api/v1` API prefix. Central Axios already
owns the prefix, cookies/CSRF and memory access token; adapters use relative paths.
Validate unknown success envelopes and domain payloads with current shared helpers.
GET reads are no-store, current-session/current-role authorized and owner-scoped for
employees. Every POST retains CSRF, strict validation and existing limits; safe admin
commands derive actor/time on the server. No browser-supplied financial/audit authority.

Amounts are canonical exact USDT strings, not numbers; feeBps is an integer rate.
Instants are shared validated UTC ISO strings; business display uses Asia/Baghdad.
Command keys use `Idempotency-Key`, bound to actor, operation and original payload.
Business uniqueness still protects commands with changed/missing keys.

## Existing employee endpoints retained

| Method/path                                      | Input                                             | Validated result / HTTP                                        |
| ------------------------------------------------ | ------------------------------------------------- | -------------------------------------------------------------- |
| GET `/withdrawals/me`                            | Empty query                                       | `withdrawalStatusSchema`; 200                                  |
| GET `/withdrawals/me/destination`                | Empty query                                       | `withdrawalDestinationSchema`; 200                             |
| POST `/withdrawals/me/destination/confirmations` | `{ address }`                                     | Destination projection; 201                                    |
| POST `/withdrawals/me/destination/resend`        | `{ expectedVersion }`                             | Destination projection; 200                                    |
| POST `/withdrawals/me/destination/consume`       | `{ token }`                                       | Confirmed destination projection; 200                          |
| POST `/withdrawals/quotes`                       | `{ gross }`                                       | `withdrawalQuoteSchema`; 201                                   |
| POST `/withdrawals`                              | `{ quoteId, confirmed:true }`, stable request key | `withdrawalCommandResultSchema`; 201 first commit / 200 replay |
| GET `/withdrawals/quotes/:quoteId/outcome`       | Valid quote UUID, empty query                     | `withdrawalQuoteOutcomeSchema`; 200                            |
| GET `/withdrawals`                               | Valid bounded page/limit, optional exact state    | `withdrawalHistorySchema`; 200                                 |
| GET `/withdrawals/:withdrawalId`                 | Request UUID, empty query                         | `withdrawalRequestSchema`; 200, own records only               |

Do not send locally calculated fee/net/deadline/recipient/owner as acceptance fields.
`financialRead` assumes 200; use the existing `parseApiResponse` pattern for 201/mixed
command statuses and validate HTTP status against replay facts.

### First destination

Destination is UNSET, PENDING or CONFIRMED. PENDING includes exact candidate/network,
version, issuedAt/expiresAt/nextIssuanceAt, proof PENDING/EXPIRED and delivery
NOT_ATTEMPTED/UNKNOWN/ACKNOWLEDGED/REJECTED. Provider acknowledgement is not proof of
mailbox delivery. The latest issuance/resend supersedes old proof even if delivery
fails. Current configured expiry/cooldown, not browser constants, controls eligibility.

Email targets the existing `/employee/account#withdrawal-confirmation=<opaque token>`.
Token is a 43-character URL-safe proof bound to purpose/current employee/address/
generation and exclusive expiry. Opening the URL never writes. The boundary scrubs
the fragment before protected navigation/diagnostics and retains only a private
short-lived ref for explicit authenticated inline consume. It cannot persist through
login/account switching; reopen the latest email afterward. Wrong-account/replayed/
expired/superseded proof leaves destination unchanged. Once confirmed, employee
replacement is unavailable. A lost consume reply is settled by destination GET.

### Quote and acceptance observation

Quote displays server gross/feeBps/fee/net, inclusive min/max, eligible sources,
funded allocation/top-up, canAccept/blockReason, immutable recipient/version/network,
eligibility snapshot, expiry/serverNow and schedule preview. Gross=fee+net with
basis-point fee floor. Reservation is gross, non-referral first, excluding all
reserved funds and pending task rewards. Fee uses applicable snapshot terms, initially
21%; no extra employee network-cost deduction.

Material facts are rechecked on first acceptance. Stale/expired/changed terms require
fresh quote and explicit review, never acceptance of silently changed facts.
At most one active request includes SCHEDULED/SIGNING/SIGNED/SUBMITTED/UNKNOWN.

The supported definite noncommitting acceptance replies are
`WITHDRAWAL_QUOTE_STALE`/409, `WITHDRAWAL_ACTIVE`/409 and `WITHDRAWAL_BLOCKED`/403.
Validate the error envelope, exact code/status and its association with the original
guarded dispatch/current scope; status alone is insufficient. These existing branches
follow committed-request replay detection and precede reservation in
[withdrawal-reservation.service.ts](../../../apps/api/src/modules/withdrawals/withdrawal-reservation.service.ts).
Only when no earlier unresolved/in-flight dispatch exists may the client retire that
attempt's pending guard/opaque handle, preserve its draft and refresh eligibility.
Stale terms then require a fresh quote and explicit review if allowed; active/restricted
accounts stay blocked and observe the current request/status. A locally proven
pre-dispatch no-send may also retire its provisional handle. Failed handle retirement
keeps replacement dispatch blocked.

The following outcome read resolves **uncertain** attempts; a known rejection is a
command error, not a new outcome variant or persisted server state:

| Outcome             | Meaning                                    | Permitted client response                                                        |
| ------------------- | ------------------------------------------ | -------------------------------------------------------------------------------- |
| COMMITTED           | Same quote has a saved request             | Display original request, refresh relevant server views; no replacement reserve. |
| NOT_OBSERVED        | Quote remains live without observed commit | Remain uncertain/blocked; observe original identity, never infer failure.        |
| EXPIRED_UNCOMMITTED | Expired quote has no committed request     | Retire handle, fetch/review a new quote if current eligibility permits.          |

After a lost/malformed/obsolete acceptance reply, observe with the existing quote ID.
No automatic financial retry, offline replay, fabricated refund or new request key
may abandon the live uncertain intent. A later error cannot erase an earlier unresolved
dispatch. Other errors, including generic validation/admission/ledger failures and
5xx/unavailability, remain conservatively uncertain. Reload with only the opaque handle
also observes the original quote; it carries no proof of a definite rejection.
Before T013 passes, real PostgreSQL acceptance/expiry-overlap evidence must prove an
observer waiting on acceptance cannot return EXPIRED_UNCOMMITTED from an older snapshot
after that request commits. Missing/failing proof blocks frontend recovery integration.

## Existing administrator endpoints retained

| Method/path                                        | Input                                                                   | Result / HTTP                                   |
| -------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------- |
| GET `/admin/withdrawals`                           | Bounded page/limit; optional state, employeeId, q, from/to              | Proposed separate admin history projection; 200 |
| GET `/admin/withdrawals/:withdrawalId`             | Request UUID                                                            | Proposed separate admin request projection; 200 |
| POST `/admin/withdrawals/:withdrawalId/extensions` | `{ expectedVersion, countedHours, confirmed:true, reason }`, stable key | Existing base command result; 200               |
| POST `/admin/withdrawals/:withdrawalId/rejections` | `{ expectedVersion, confirmed:true, reason }`, stable key               | Existing base command result; 200               |

`countedHours` stays a string validated by `positiveCountedHoursSchema`; positive
supported fractional values must represent whole milliseconds and produce a supported
deadline. Reason is trimmed, required and max500. Extension adds to current dueAt,
preserves originalDueAt and normalizes earliest dispatch. Safe rejection releases
the exact original sources once with zero charged fee. Stale/version/state/claim races
are rejected atomically. Same exact keyed replay returns the original effect;
altered body/key binding conflicts. Existing admission/financial guards stay intact.

## Proposed readiness and pre-issuance metadata correction

Proposed shared status shape changes only:

- `withdrawalExecutionReady`: boolean instead of literal false in withdrawal status
  and wallet projections.
- `network`: nullable configured `tronNetworkSchema` in withdrawal status, needed
  to review the network before the first issuance. It is null if public metadata is
  absent. Pending/confirmed destination retains its saved network independently.

Proposed public-only capability input is explicit validated public network/token
metadata plus the configured `TRON_PAYOUT_KEY_ID` UUID reference. It never includes
private key files, provider credentials, signer configuration or a client override.
The API process boundary may receive this non-secret reference; protected signer
policy/key inventory/startup remains independently verified before enabling controls.
The configured key reference stays internal to API composition; the browser receives
readiness and configured network, never the payout-key inventory reference.

One helper uses current registered API boot admission, acknowledged current generation,
financial fence and dispatch pause. Ready is true only when configuration and all
those checks permit a new request. Missing capability/admission gives false; malformed
configured input fails configuration; unexpected query failures remain errors.
This is not a signer-health promise. Both status and wallet use the same helper.

First quote/acceptance consult it in their owning transaction under existing admission
locks. Disabled capability uses existing safe unavailable/fenced/conflict behavior,
never reserves. Original committed outcome remains observable after later pause/fence;
POST replay may still be refused by existing write admission, so use outcome GET.
User funds, confirmed matching destination, restriction and active-request checks are
additional requirements. Readiness does not imply canAccept. Shortages/dispatch pause
never erase accepted reservations, block authorized history reads or assert refund.

For initial address review use returned configured network; do not hardcode mainnet
or fetch/provision a deposit address. Absent network disables issuance/review safely.
If saved proof/destination network differs from configured network, preserve its saved
read facts and disable incompatible issuance/quote; never relabel it.

## Proposed admin-only projection

Proposed `adminWithdrawalRequestSchema` composes existing request validation with
`employee: employeeFinancialIdentitySchema` and boolean `canExtend`/`canReject`.
Proposed `adminWithdrawalHistorySchema` uses the existing financial page shape.
Both exports belong in the existing shared contracts package.

Employee identity is current `{ id, fullName, email }`, matching existing current
name/email search; accepted payout recipient/money/eligibility remains snapshotted.
Select/map only those identity fields through the existing destination relation.
No fixture or P10 directory lookup. Employee responses omit these admin additions.

Both safe flags use SCHEDULED, no attempt, current API mutation admission and existing
version/scheduleVersion bounds. A preparing attempt with null TxID is still unsafe.
Dispatch pause alone leaves safe scheduled administration available; a financial
fence/unacknowledged boot does not. The write service rechecks current state/version
under locks regardless of displayed flags. Keep base command results unchanged and
refetch enriched admin list/detail afterward.

## Proposed admin command observation

**New read-only API, not yet implemented**:
GET `/admin/withdrawals/:withdrawalId/actions/outcome`.

Strict query: `kind=EXTEND|REJECT`, validated `requestKey`, and bounded positive
`expectedVersion` parsed from query text through the existing configuration-version
constraint. No submitted actor ID. Proposed query/result schemas live beside existing
withdrawal schemas; route/controller/service/OpenAPI stay in existing owners.

Within one current-ADMIN-authorized RepeatableRead transaction, read the current
request and lookup existing unique `(actorScope,kind,requestKey)` using authenticated
actor. An action must match target and expectedVersion. Lookup is independent of
latest100 history. Return strict variants with kind/key/target/expectedVersion,
serverNow and current enriched admin request:

| Outcome      | Condition                                                       | Additional result / client behavior                                                                                                                                                 |
| ------------ | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COMMITTED    | Exact actor/key/kind action exists with matching target/version | Safe original action: id/kind/actor/time/reason/expectedVersion/committedVersion and before/after due/schedule facts. Show actual saved action/current request; stop unknown guard. |
| NOT_OBSERVED | No matching action, current version equals expectedVersion      | No action. Remain unresolved; do not submit an independent action.                                                                                                                  |
| SUPERSEDED   | No matching action, current version exceeds expectedVersion     | No action. Old first write cannot occur; refetch and explicitly review newer facts, without claiming own success/refund.                                                            |

Future expectedVersion and keys bound to a different target/version return a safe
409 conflict; malformed inputs 400, absent request 404, current authority 401/403.
Reuse existing error owners, including payload-binding conflict; no new broad error
protocol. Unexpected failures remain failures, never NOT_OBSERVED defaults.
Outcome GET performs no write, reservation, release, queue wakeup or key creation,
and remains available under financial fence/dispatch pause to authorized admins.

COMMITTED proves the saved key, not an arbitrary edited body. Client binds key to
original parsed body and keeps its fingerprint immutable. An explicit manual retry
can use only the same reviewed body/key; changed reason/hours cannot reuse it.
No automatic retry. A reloaded handle without reproducible original intent can only
observe. This endpoint adds no database persistence or generic idempotency service.

## Lifecycle, paging, refresh and errors

Use all nine exact states and matching settlement/release/blocker facts. Original
recipient/network/source/fee terms never change because account data expires/changes.
RemainingCountedHours/milliseconds is a returned snapshot, not elapsed due-minus-local
clock. Show original/current due, earliest dispatch and server audit inline. Zero is
due/awaiting execution, not paid. Ordinary actions are latest100, not full audit history.

Employee history requests limit25; admin limit10. Existing pagination metadata gives
matching total/pages; list ordering is acceptedAt descending plus id descending.
Search/date filters remain server-owned (from inclusive, to exclusive). Reset page
on filter changes; expose empty/filtered-empty/error/out-of-range distinctly. Never
invent global status totals from the current page or request an unbounded history.

After confirmed/observed outcomes, invalidate scoped withdrawal/destination and relevant
wallet/ledger/eligibility views. Reuse the P07 observation policy: at most 20 completed
cycles per actor/role/epoch/domain and normalized resource/filter/page window, including
the immediate first eligible read. Success/transient failure both count; wait 5, 10,
20, 30, then 60 seconds after completion, capped at 60 seconds. Queries use `retry:false`,
no automatic fetch outside the budget and coalesced overlapping observations.
Stop on terminal resolution/denial/contract failure/departure/exhaustion; pause scheduling
when hidden/unfocused/offline. Focus/reconnect resumes the same unexhausted window;
explicit authorized user refresh or one-shot refresh after a newly confirmed command/
newly observed persisted transition may reset it through the same observation owner.
Deduplicate transition refresh by persisted identity/version; unchanged polling,
countdowns and rerenders cannot reset it. Affected disabled readers require this
bounded refresh alongside invalidation. Count/backoff survives ordinary checks/remounts/
query-entry garbage collection/recreation in the same QueryClient until authority/
resource retirement. Exhaustion preserves last-known uncertainty, drafts and command
recovery guards and offers refresh.
Fresh authority/resource checks reject obsolete completions and preserve dirty drafts
through transient refresh errors. Never show malformed success as empty/zero data.

Extend central safe allowlists for existing WITHDRAWAL_* codes and relevant editable
fields (`gross`, `address`, `countedHours`, `reason`, `expectedVersion`). Proof/token
errors stay safe generic feedback, with no token echoed. Distinguish stale quote,
active conflict, restriction/access denial, unavailability, pending/uncertain and
contract failure. Do not add withdrawal writes to automatic 401 refresh/replay paths.

No manual-complete, hold/release, employee cancellation/replacement or arbitrary status
endpoint is introduced. Required projection/admission/observation privacy and race
checks are specified in [quickstart](../quickstart.md).
