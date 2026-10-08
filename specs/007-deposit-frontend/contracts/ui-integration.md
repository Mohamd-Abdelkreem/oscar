# P07 Existing-UI Integration Contract

**Status**: Proposed integration of existing routes/components under accepted C1–C3. No new route, popup, layout or design system.

## Private Reads and Refresh

Use feature deposit adapters/hooks and existing central Axios/query boundaries. Add P07 scope support to `apps/web/src/shared/query/financial-query.ts`, preserving P04/P05 defaults. Keys include current private scope, role/domain and normalized page/filter/search/action selection. Each completion validates HTTP/envelope, current scope and authority before presentation/cache changes. Cancel/remove private P07 queries on retirement. Denial hides data and blocks handlers until newer current authority; an obsolete reply cannot undo it.

Classify `/deposits`, `/admin/deposits` and `/admin/employees/manual-credit-targets` GET families as private in api-client. Do not add deposit writes to preExecutionAuthPaths, automatic retry or authentication replay. Address POST needs explicit 200/202 validation because financialRead's 200-only behavior remains unchanged for other callers.

One initial GET followed by delays 5/10/20/30/60 seconds, holding at 60 seconds, stops after 20 completed automatic domain observations including the initial read and errors. Disable secondary query retries for these readers. Pause hidden/inactive/offline readers; stop denied/obsolete/malformed readers. Poll only visible provisioning/relevant detection/original-action observation, not target choices or every old history page. Coordinate current first-page history refresh with receiving/detection observations; suppress intervals on navigated history pages. Join in-flight refresh using cancelRefetch false; never overlap or cancel/restart repeated user clicks. Intervals never mutate confirmation/history/money.

The active observation window belongs to the admitted epoch/account/role, domain and normalized resource/selection. Retain its completed count and backoff position across check-only authentication revalidation for that same identity/selection, including focus, online and background/resume. Preserve current check-scoped authorization and query keys; changing scope.check or recreating/remounting a query within that window must not reset the budget. Authentication checks continue independently and are not deposit-domain observations. A true admitted epoch/account/role/resource/selection change or explicit existing refresh may start a new window. Suppress implicit Query focus/reconnect/mount/new-key domain fetches unless they pass through this same budget and nonoverlap guard. Once exhausted, no automatic domain GET may run until a permitted reset; existing feedback/manual refresh remains available. Keep the budget transient within the owning read lifecycle; add no browser persistence or generic framework.

Initial empty and unavailable reads differ. During a transient refresh failure, same-scope accepted records may remain visible with safe feedback; never display those as freshly verified. Malformed output creates an unavailable boundary state with explicit retry, never fallback fixtures. No accepted data survives denial/retirement into another account. Use operationId (or kind plus id) as history row identity; chain/manual row id values can collide and TxID can identify several receipt logs.

## Employee Route

Use current `features/employee/components/deposit/deposit-card.tsx` and address-qr wrapper. GET address/history independently after current USER admission. Only validated UNASSIGNED triggers one guarded empty POST outside queryFn. Server uniqueness handles remount/duplicate provisioning races. Lost reply means reread GET; no automatic POST loop or fabricated ready state.

| Fact                             | Existing surface behavior permitted by C2                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Loading/UNASSIGNED/PROVISIONING  | Existing notice/address region + shared loading/feedback; no usable address/QR/copy.                                       |
| UNAVAILABLE/malformed/read error | Safe reason/retryability in existing feedback/notice; full failure distinct from empty history.                            |
| READY                            | Full LTR inspectable assigned address, existing 180px QR and copy; configured public network/USDT token only.              |
| Degraded detection               | Existing notice/history feedback states delay/retrying/paused/unresolved separately from recorded credit.                  |
| Chain history                    | Persisted exact amount/time/public transaction/address; kind/confirmed facts only.                                         |
| Manual history                   | Existing row regions identify recorded manual credit/operation; no fabricated TxID/address/network/admin-private metadata. |
| Bounded page navigation          | Existing FinancialPages placed in the history region; current server page only.                                            |
| Clipboard denied                 | Await failure, show safe feedback, no copied-success announcement; full address remains inspectable.                       |

C1 corrections are limited to obsolete demonstration address/minimum/administration approval/rejected-status wording. Instructions reflect recoverable assigned receiving address, automatic verified credit with variable latency, no commercial minimum/maximum or 72-hour hold. Preserve unrelated copy/style. No client candidate/rejection state or 700ms simulated confirmation remains.

## Admin Route and Choices

Use current `features/admin/components/deposits/deposits-screen.tsx`, AdminSelect/AdminPagination, alert and AdminConfirmDialog. History uses server search/page and actual kind filter; keep existing table/layout. Exact decimal strings flow to existing MoneyAmount/formatter without cent rounding. Dates use explicit Baghdad formatting. Manual rows use permitted employee/actor/reason/reference/operation data in existing row regions; chain rows use genuine chain fields. Clipboard success waits for actual success.

While grant form is relevant, load one 25-target page from the accepted C3 API. Use existing pagination, no directory accumulation/new combobox. API optional q remains available without inventing a new search control. Label name/email to distinguish duplicate names; retain at most the one selected `{ id, name, email }` option if absent from another page, because AdminSelect finds its current label in options. Failure/denial has safe feedback and disables review/submit without fixture fallback; transient failure preserves valid input. Retirement scrubs old actor draft/selection.

Amount is a canonical positive representable string under the shared money schema; unsupported precision/zero/negative/overflow fail. Existing reason/reference validation is shared. Review freezes complete intent and existing confirmation description shows employee, full exact amount, reason/reference. Async pending/disabled/error props prevent close/reset/duplicate clicks from creating another action.

C1 reference wording explains original-action replay protection; it no longer promises global reference-text deduplication. Separate deliberately confirmed actions may reuse reference text.

## Manual Action Protocol

1. Current ADMIN reviews validated draft. If an original handle remains unresolved, show existing uncertainty/observation feedback and block a new grant.
2. Explicit confirm acquires actor-scoped Web Lock with ifAvailable. Busy/missing lock or failed storage/readback blocks dispatch with safe existing feedback. Under the lock, reread existing handle; create/persist validated minimal `{ version: 1, actionId, employeeId }` only if no unresolved handle exists. Keep full frozen payload in memory; use actionId as Idempotency-Key.
3. Dispatch once through current CSRF/private transport. Validate 201/200, replay flag and matching action/employee/stable actor.id/exact amount/reason/reference. Mutable actor name/email are display fields, not recovery identity. Never mutate local wallet/audit or generate chain fields.
4. Timeout/lost reply/malformed success/conflict becomes retained UNCERTAIN. Close/reopen/navigation/reload preserves minimal identity. A different actor cannot reuse/inspect it; a returning original actor can recover it and GET only. Scrub full payload/draft on retirement.
5. Explicit existing observation/retry and bounded automatic GETs read the original action. 404/transport/contract/conflict failure retains uncertainty. No automatic/reconstructed POST, new identity, terminal absent state, cancellation or forced clear.
6. A validated committed outcome matching the handle/current original actor.id settles it under storage coordination; remove only that handle and invalidate/refetch scoped P07 history and existing P04 wallet/finance. Ignore historical walletAfter as live balance. Late obsolete completions cannot mutate a newer actor's UI/cache.

Use storage notifications/useSyncExternalStore as existing action runtimes do; no universal command framework. A pre-dispatch validation/storage/lock rejection preserves an editable draft and sends nothing. Do not treat arbitrary 4xx as proof an earlier possibly committed action cannot complete. A persistently absent original action can remain uncertain indefinitely under this API; existing alert communicates that and permits later observation.

## Required Preservation and Acceptance

Keep routes/App Router/layout/navigation/Cairo/RTL/spacing/icons/colors/breakpoints/control sizes and popup presentation outside bounded C1/C2 placements unchanged. No P10 employee-detail/audit integration. No explorer link without explicit validated configuration; omission is the chosen P07 behavior.

Automated tests cover real scoped/validated data, precision, complete review, pending/reload/lost-reply uncertainty, no extra persisted credit and clipboard truth. Compare phone/desktop behavior with existing design, including 320/390/430px checks and keyboard/focus. Per the owner's 2026-10-07 revision, independently decode actual rendered ready QR screenshot pixels with jsQR at 320/390/430/1280px and compare its value with API/visible/copied assignment for two accounts before/after reload. This replaces the separate-phone scan gate. Rendering QR SVG/props alone is not independent decode evidence. No funds are sent by these acceptance checks.
