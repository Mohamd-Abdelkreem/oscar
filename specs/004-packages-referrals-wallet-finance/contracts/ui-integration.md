# P04 UI Integration Contract

**Status**: Proposed integration only, after the entire backend gate B. Six existing domain routes and account financial regions; no new route, standalone screen or popup. [Spec C1-C2](../spec.md) are the only P04 presentation exceptions. Preserve Arabic/RTL/Cairo/light appearance, section order/navigation/layout/style/breakpoints and unrelated copy.

## Existing Surfaces and Allowed Wiring

| Surface under apps/web/src/features            | Authoritative wiring and C1-C2 boundary                                                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| employee/components/packages                   | Current catalog/membership and quote, full price/top-up/funded sources/accepted term/conditional gross; existing sheet confirms persisted purchase; remove discounted price/admin-pending/timer success |
| employee/components/team                       | Own fixed invite identity, L1-L5 relative members/counts/current rates and own commission history; bounded paging, viewer-attributable amounts, no other member earnings/email                          |
| employee/components/wallet                     | Four sources/owned/available/reserved/locked/eligible funds, server filters/pages and existing detail sheet; truthful operation labels and neutrality, no reward reversal                               |
| employee/components/account/account-screen.tsx | Existing subscription/balance cells and wallet link only; preserve real identity/password/logout and unavailable future withdrawal-address region                                                       |
| admin/components/packages                      | Current detail/version, canonical amount draft, reason and separate review/confirm within existing edit dialog; future-only saved terms; dirty draft/conflict preservation                              |
| admin/components/referrals                     | Bounded root search, separate root, relative levels/paths/SQL counts and root-beneficiary decision history; current vs saved rates; no client full-tree BFS                                             |
| admin/components/finance                       | SQL-filtered totals/ledger/pages/details; reuse pagination/detail dialog; source restrictions/neutral reservations and permitted audit labels                                                           |

Use employee Button/ConfirmationSheet and admin AdminButton/AdminConfirmDialog/AdminSelect/AdminPagination peers. C2 allows only necessary local space/Arabic labels for approved feedback/controls. No general settings editor/employee-adjustment action. Changes beyond C1-C2 remain owner-decision gates.

## Server Data and Scope

Proposed employee API/hooks: packages, wallet, referrals; proposed admin API/hooks: packages, finance, referrals, each under existing feature directories. They call central API client, parse shared envelope/domain data and return safe DTOs. Components never call Axios or copy server money/membership into fixture context.

Query keys include account/role/epoch/check/domain/resource/root/filter/page identity. Enable after current route/session authority. Capture current check and selection generation, consume AbortSignal, verify returned resource/root and refuse stale success/error admission. Epoch alone is insufficient after authority revalidation. Cancel/clear retired private work and detail selection; no previous-root/filter placeholder data as authoritative detail. A denied scope stays denied until a newer allowed read for that scope, including handlers.

Loading, unavailable, denied, genuine empty, filtered-empty, stale-known, conflict, pending, uncertain and committed results have distinct existing-surface feedback. Never map malformed/unavailable data to zero balance, Free membership or empty history. Out-of-range pages recover only from settled same-scope metadata; filters/root change reset page and details. Summaries follow declared server scope, not current page.

## Purchase Intent Lifecycle

1. Obtain owned quote for explicit selected package intent. Display full target debit, exact top-up/sources and accepted dates/terms. Quote is not a reservation; recheck current authority/selection before handler dispatch.
2. Claim one actor-scoped intent in proposed `employee/utils/purchase-command-runtime.ts`, outside sheet lifecycle, and persist/read back its opaque quote handle before dispatch under an account-scoped Web Lock. Fail closed with existing feedback if storage/locking fails. A tab/reload first reads any existing handle and reconciles it before new intent. Derive the UI's stable request key from quoteId so reload recovers it without extra payload storage. No credential/amount/payload is stored. Pending state survives close/remount and UI deadline; duplicate callers cannot queue a replacement.
3. Dispatch once via proposed hook/adapter with retry:false and networkMode:always. Do not persist/dehydrate/resume mutation, serialize it into a queued mutation scope, or add P04 to automatic 401 replay allowlist. Offline click receives failure/uncertainty rather than delayed reconnect dispatch.
4. Observe completion independent of mounted sheet. Only validated matching current authority/selection may show committed success/close. Invalidate relevant matching current catalog/quote/subscription/wallet/team/finance scopes; walletAfter is historical, not a live patch.
5. Timeout/cancel/lost response/malformed success becomes uncertain and retains original quote/key. Read original quote outcome. Live NOT_OBSERVED is not terminal failure; no fresh quote/refund/automatic write. Outcome includes original safe terms for visible same-quote review/retry with current authority. COMMITTED or EXPIRED_UNCOMMITTED from the shared buyer-lock/expiry barrier is terminal; read failure/lock timeout remains uncertain.
6. Reload/tabs reconcile required opaque per-account handle and bounded server outcome/history. Retirement clears private payload/draft/selection and detaches presentation, retaining unresolved handle for that account. Once dispatched/uncertain, clear only matching handle after authorized COMMITTED or buyer-locked EXPIRED_UNCOMMITTED. Failed retries/reconciliation and timer/TTL alone cannot clear it. Local pre-dispatch failure may release a newly claimed handle only if no request for that intent was ever dispatched. Old completion cannot populate another account. Server remains durable authority.

Do not directly reuse credential-command completion semantics as the financial owner: existing unmounted credential observations become obsolete and have no purchase recovery identity. Reuse focused scope/pending patterns, without changing credential protocol or inventing a universal command framework.

## Configuration Draft and Command Lifecycle

Open current authoritative package detail, not an old list row as write authority. Preserve dirty fields during unrelated/transient refresh; remotely changed editable fields require explicit conflict choice. Use shared command schemas/form errors and exact decimal text, not parseFloat. Confirm entered reason, reviewed before/after values and expected version inside existing dialog. Claim stable command UUID outside dialog reset; pending/uncertain save cannot be unlocked by closing.

Configuration writes share purchase's no-retry/no-offline/no-401-replay policy. Reconcile original actor/command after unknown result; historical after-snapshot triggers current reread rather than overwriting a newer counter. Denied handlers cannot revive after late success. General settings UI and employee-detail adjustments remain later scope.

Freeze the reviewed UUID, target, expectedVersion, allowed fields, reason and confirmation in the focused actor-command owner across close/remount. NOT_OBSERVED preserves uncertainty; while the exact original payload and current authority remain available, the existing dialog offers a visible review and explicit same-intent retry. Retry cannot substitute refreshed values or a new UUID. Only a validated matching committed result or the original PATCH's CONFIGURATION_SUPERSEDED lock/version proof clears a dispatched guard; then read current configuration before a new intent. Generic stale/denied/error, failed observation and absence never clear it. A proved never-dispatched intent may release locally. Reload/tab/account changes never restore an executable mutation or copy private draft into another scope; missing exact payload remains uncertain/read-only rather than guessed. No new popup or automatic replay is needed.

Admin package rows unwrap AdminCatalogItem.terms and display the validated server activeSubscriptionsCount; never snapshot or derive that count locally. Admin finance's existing neutral-operation metric reads summary.neutralOperationsCount for all matching filtered operations, not loaded rows. Missing counts are unavailable. Preserve both approved columns/metrics and use C1-C2 existing feedback for declared scopes.

## Money, Fixtures and Accessibility

P04 money remains validated canonical strings end-to-end. Proposed `employee/utils/money-display.ts` groups integer text and shows at least two, up to six meaningful fractional digits without Number conversion; commands always retain exact values. Adapt common MoneyAmount in place with a compatible legacy number branch for untouched fixture callers. Admin cells reuse exact formatter. Sign/color is display logic, never financial authority. Amount/identifier text stays LTR-isolated.

Remove P04 production fixture dependencies and obsolete package mutation exposure; preserve task/deposit/withdrawal/home/admin future fixture providers. Update only superseded purchase-demo assertions. Account identity and navigation remain existing P03 behavior. No fake financial response fallback.

Check confirmation initial focus, containment, Escape/dismiss, background interaction, pending guard and focus restoration in reused controls. Keyboard/Arabic labels/status/error feedback, readable mixed-direction money and usable 320/390/430px plus desktop flow are acceptance requirements. Existing rendering outside C1-C2 remains the comparison baseline. Do not multiply every state across every viewport or redesign shared controls incidentally.

## Acceptance Evidence

Colocated adapter/hook/runtime/component tests must cover exact DTOs, malformed success, duplicate/remount/offline/unknown, dirty/conflicting drafts, current check/root/account changes and absence of fixture success. Real migrated web/API/DB browser suites cover persisted reload/outcome, all six routes/account regions, root-relative privacy, page recovery and narrow/focus flows. Reuse existing P03 identity/UI-preservation suites. Entire gate B must pass before this work; full gate F requires explicit browser/type/full regression evidence.
