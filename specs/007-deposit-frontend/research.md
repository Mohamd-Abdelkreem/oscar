# P07 Research: Deposit Frontend

**Date**: 2026-10-07 | **Feature**: [spec.md](spec.md) | **Status**: Design decisions resolved; implementation unexecuted.

Research used the selected feature pointer, clarified specification, constitution 1.0.0, whole roadmap, all eight engineering guides, current source/manifests, installed Next/TanStack Query guidance and three read-only investigations. Proposed paths and endpoints below are future work.

## R1 — Prerequisites and scope

- **Decision**: Reuse P06 deposit/custody/manual-credit behavior and its recorded acceptance. Complete only C3's missing target lookup and bounded test-support compatibility before dependent frontend integration.
- **Rationale**: [P06 tasks](../006-tron-custody-deposits/tasks.md) record T001–T079 complete. [P06 quickstart](../006-tron-custody-deposits/quickstart.md) records controlled Nile acceptance (3/3, exact 1.000001 USDT inbound credit and recovered sweep without another employee credit), followed by local/database/Linux remediation that reused live evidence. This is historical evidence, not a new run. The owner decision in [P03 plan](../003-auth-account-frontend/plan.md), Input, removes separate CONVERGE as a prerequisite for subsequent phases; later generated wording cannot reinstate it.
- **Alternatives considered**: Rebuilding custody or adding a separate feature would duplicate accepted work. A history-derived selector excludes first-credit employees. Broad P10 directory work exceeds C3.

## R2 — Minimal employee-choice owner

- **Decision**: Propose GET `/admin/employees/manual-credit-targets` in the existing `admins` module, with shared schemas in `packages/contracts/src/admin/admin.schema.ts`. Return only ID/name/email for USER accounts with a persisted wallet. Use existing bounded page/search helpers, default limit 25/max 100, and `createdAt DESC, id DESC` order.
- **Rationale**: `AdminsService.read` already uses RepeatableRead, locks current sessions and rechecks ADMIN authority. Existing User/Wallet fields, unique wallet ownership and role/creation/ID index support selection without a migration. List and count belong to one read snapshot; separate pages remain live. Lookup is observational and does not require financial admission.
- **Alternatives considered**: New employee services, directory CRUD, detail endpoints, subscription/history/status restrictions and search infrastructure add unnecessary policy or scope. The existing selector plus pagination reaches all targets without another search widget; the API's optional name/email search remains tested.

## R3 — Read boundaries and bounded refresh

- **Decision**: Add P07 support to existing private financial query/transport owners, preserving P04/P05 defaults. Use domain adapters/hooks, validated envelopes, scope-bound keys and retirement cleanup. Add deposit GET families and the target GET to private-read classification; never add deposit writes to automatic pre-execution authentication replay.
- **Rationale**: `financialRead` accepts HTTP 200 only; address POST needs explicit 200/202 handling. Existing query helpers lack P07 namespace/options; transport currently omits deposit reads. Same-scope accepted rows may remain visible with a transient refresh error; denied/retired data must disappear.
- **Refresh choice**: One initial read, then 5/10/20/30/60-second automatic GET delays, holding at 60 seconds and stopping after 20 completed automatic domain observations, including the initial read and failures. Pause hidden/inactive/offline readers; stop denied/obsolete/malformed readers. Retain the active window's count/backoff across same-epoch/account/role/resource/selection check-only revalidation and query recreation; current check-scoped authority/keys remain required. Authentication checks are independent of this domain budget. Suppress implicit focus/reconnect/mount/new-key domain fetches unless the same budget/nonoverlap guard admits them; exhaustion allows no automatic domain reads. Only a true admitted identity/resource/selection change or explicit existing refresh starts another window; background/resume alone does not. Keep this state transient in its owning read lifecycle. No time progression confirms a credit. Use `refetch({ cancelRefetch: false })` to join an in-flight read and disable additional query retries.
- **Verified API evidence**: Installed Query 5.101.4 source was inspected. The [official useQuery reference](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useQuery) supplies the interval/background/refetch options; the [v5 migration guide](https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5) confirms the interval callback receives the query. Implementation must match installed types, rather than assume later documentation changes apply.
- **Alternatives considered**: Fixed unbounded intervals, component timers, another cache/context and a generic command platform do not fit this feature. Existing P05 polling is not P07's backoff policy.

## R4 — Receiving instructions and presentation

- **Decision**: GET first; only a validated UNASSIGNED result triggers one guarded empty-body provisioning POST outside the retrying query function. Lost reply triggers GET observation. Offer address/QR/copy only from READY. Use C1/C2's existing regions, feedback, pagination, alert and confirmation surfaces.
- **Rationale**: Server assignment uniqueness is authoritative; the browser need not persist a provisioning command. Detection statuses describe observation health, separately from credited history. Existing history contains CONFIRMED chain receipts and RECORDED manual credits, never candidate/rejected rows. Exact strings and the existing money formatter retain all meaningful fractional digits. Explicit Baghdad formatting is reused for timestamps.
- **Alternatives considered**: Fixture addresses, timers marking deposits confirmed, invented pending rows, approval/rejection controls, new popups and unrelated policy-copy edits are excluded. Safe explorer configuration is absent from the integration contract; omit optional links rather than invent a destination.

## R5 — Original manual-credit action and uncertainty

- **Decision**: Add one focused `features/admin/utils/manual-credit-command-runtime.ts`, patterned after existing durable financial actions. Before dispatch, under an actor-scoped Web Lock, persist and read back a validated minimal `{ version: 1, actionId, employeeId }` handle. Keep the frozen reviewed amount/reason/reference only in memory. Use actionId as Idempotency-Key. After reload, observe GET-by-actionId only.
- **Rationale**: P06 binds global action identity to actor/key/payload. A lost response can still follow a committed grant. GET 404 means no committed result is currently observable; it does not authorize clearing uncertainty, replacing the action or resubmitting a reconstructed payload. `walletAfter` is the original operation's historical snapshot, so refresh live wallet/finance/history after a validated committed outcome instead of patching balances.
- **Concurrency/failure choice**: Use `ifAvailable` and existing storage notifications; another tab or missing/failed lock/storage disables new dispatch with existing feedback. Persist no tokens, amount, reason, reference, query results or custody data. Retirement clears visible payload/draft and hides the old actor handle while retaining its recovery identity for a returning original actor. An unresolved handle blocks a new grant by that actor in this browser. No terminal cancellation protocol is added.
- **Verified API evidence**: [W3C Web Locks](https://www.w3.org/TR/web-locks/) defines asynchronous conditional acquisition; a missing available lock invokes the callback with null. It coordinates cooperating browser contexts, while server transactions/idempotency remain the money safety boundary.
- **Alternatives considered**: Reference text as a global duplicate key, automatic write retries, deletion after timeout/404, storing the full sensitive payload and copying task cancellation semantics are unsafe or unnecessary. Retained 404 uncertainty can remain unresolved indefinitely with the present API; the existing alert must say so truthfully.

## R6 — Deterministic browser harness and checkpoint

- **Decision**: Extend private E2E IPC with P07 scenarios and one explicitly admitted, guarded clean disposable API boot, before custody fixtures are installed. Pass admission to the app and affected P04/P05 financial callers; inject public test metadata and deterministic provider/signer boundaries.
- **Rationale**: Current `apps/api/tests/e2e/server.ts` omits `depositMetadata` and `financialAdmission`. P04 financial scenario callers also lack admission. The integration fixture admission guard permits `template_api_integration`/`p02_identity_*`, not E2E `p03_e2e`/`p05_e2e`. This is a source-inspected compatibility gap, not an executed failure. Preserve that guard by using a dedicated guarded E2E admission/funding path or injecting an already admitted fixture path. Production defaults and negative fence cases remain fail-closed.
- **Alternatives considered**: Opening arbitrary databases, weakening production admission, HTTP fixture routes, mock browser success and live funds for ordinary E2E runs are excluded. Synthetic READY assignments prove frontend behavior only; P06's protected process/recovery acceptance remains the custody evidence.

## R7 — Dependencies and independent QR acceptance

- **Decision (owner revision, 2026-10-07)**: Keep runtime dependencies unchanged. Add exact test-only `jsqr` 1.4.0 and independently decode rendered QR screenshot pixels. The owner explicitly selected automated decoding instead of the original separate-phone camera gate. Compare decoded/API/visible/copied addresses for two accounts before/after reload at 320/390/430/1280px; send no funds.
- **Rationale**: QR generator input and SVG assertions prove wiring but cannot establish that displayed pixels decode correctly. The browser decodes screenshot PNG pixels to RGBA; jsQR independently reads those pixels in the test process. No generator value or SVG path is supplied to the decoder.
- **Alternatives considered**: Actual-phone scanning was the original plan and remains unperformed; it is no longer the required gate after the explicit owner decision. SVG/prop inspection still cannot substitute for independent image decoding.

## Resolution

No business clarification or constitutional exception remains unresolved. C1–C3 are the accepted bounded owner decisions in the spec. Required future gates are lookup/backend tests, harness compatibility, frontend/browser/full checkpoint verification and independent QR decoding. This PLAN run starts no services or application tests and generates no tasks or implementation.
