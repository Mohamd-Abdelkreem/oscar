# Feature Specification: P07 - Deposit Frontend

**Feature Branch**: 007-deposit-frontend (verified current branch; feature selection is independent of branch naming)

**Created**: 2026-10-07

**Status**: Clarified; ready for P07 planning. Implementation and the narrow target-lookup acceptance gate remain unexecuted.

**Input**: User description: "PHASE_ID=P07. Read docs/workflow/speckit-prompts.txt. Apply OPERATING CONTRACT and execute SPECIFY only."

**Roadmap Phase**: P07 - Deposit Frontend

**Feature Directory**: specs/007-deposit-frontend

## Roadmap Scope and Gates _(mandatory)_

- **Deliverables**: Connect existing employee deposit and administrator deposit history to assigned public address/QR/copy, configured USDT token/network, truthful detection state, persisted exact amounts/history and separately audited manual credits. Preserve bounded refresh, search/filter/navigation and existing grant reason/reference/confirmation. C3 adds only minimal authorized live employee-choice prerequisite support for that selector within this same feature, before dependent integration. Authority: [PLAN.md](../../PLAN.md), Sections 3.3, 3.6, 5.2, 5.6, 6, 7/P07, 8 and 9. Current P07 maps to original P09; original P07 task/review work belongs to current P05.
- **Exclusions**: Rebuilding P01-P06 money, identity, subscriptions, tasks, custody, indexing, treasury or manual-credit backend; P08-P09 withdrawals; P10 employee directory/CRUD, detail tabs, audit/dashboard/settings/policy integration; P11 deployment, WAL/point-in-time recovery and release. No new asset/network, commercial deposit limit, direct-to-package payment, employee-controlled key, deposit approval/rejection, 72-hour deposit hold, admin 2FA or dual approval. C3's minimal employee-choice prerequisite is the sole bounded backend addition to this frontend phase; broader P10 work stays excluded. This CLARIFY run changes only the active spec and permitted checklist markers.
- **Prerequisites**: Populated [constitution](../../.specify/memory/constitution.md) version 1.0.0; existing P01-P05 financial/account/frontend foundations; and complete P06 backend, isolated recovery and controlled testnet acceptance. [P06 tasks](../006-tron-custody-deposits/tasks.md) record implementation acceptance PASS and T001-T079 complete. [P06 quickstart](../006-tron-custody-deposits/quickstart.md) records actual Nile provisioning/deposit/sweep acceptance, later local/database/Linux remediation and reuse of earlier live testnet results. These are reused records; no application tests or testnet runs occurred during SPECIFY or CLARIFY. The owner instruction in [P03 plan](../003-auth-account-frontend/plan.md), Input, removes separate CONVERGE as a prerequisite for P02 and subsequent phases. Preserve mandatory backend acceptance and do not reinstate superseded generated procedural wording. The live grant-target lookup remains missing current capability. C3 assigns its minimal delivery to P07; actual backend authority/bounds/output tests must pass before dependent frontend integration. Recorded P06 acceptance does not establish this new prerequisite as implemented.
- **Frontend boundary**: Only existing /employee/deposit and /admin/deposits surfaces and necessary shared deposit integration behavior. Preserve routes, layout, Cairo, Arabic/RTL, styling, spacing, breakpoints, icons and popup presentation. Runtime values and real handlers may replace fixtures. C1 permits only the listed deposit copy/status corrections; C2 permits only necessary deposit placement/state behavior using existing regions/shared surfaces. All unrelated presentation remains frozen. Existing admin sign-in is implemented; the prompt pack's historical absent-login warning is not a current missing-route claim. Employee-detail links do not imply P10 detail integration is complete.
- **Owner decisions**: C1-C3 are resolved under the owner's explicit delegation to select recommended simple answers. C1 permits only identified obsolete deposit copy/status corrections, C2 permits bounded reuse of existing presentation surfaces, and C3 assigns only minimal live target-choice support to this feature. Decisions/evidence appear below; prior unrelated phase exceptions do not expand them.
- **Acceptance gate**: Required predecessor acceptance and C3's narrow employee-choice backend acceptance must pass before dependent integration; C1-C2 are bounded presentation exceptions, not implementation evidence. Correct account/address/network/amount/history must survive reload; repeats must not display/post extra credits; chain/manual credits must remain distinct; delay/error, access changes, clipboard failure and phone/desktop QR/address flows must be truthful. Actual deposit component/adapter/hook and browser acceptance, affected shared regressions and the full P07 regression checkpoint must pass. Missing services or execution evidence leave implementation incomplete. Production/release gates remain P11.

Apply the constitution and [operating contract](../../docs/workflow/speckit-prompts.txt). All eight [engineering guides](../../docs/engineering/README.md) were read. Historical guide inventories do not override current source or the roadmap. Existing capabilities below are evidence, not proposed architecture.

### Actors and Current Capability

Actors are a currently authenticated employee viewing their own instructions/history, a currently authorized administrator inspecting history or deliberately granting a manual credit, and protected backend processes supplying facts. Employees do not confirm chain transfers. One authorized administrator may confirm a permitted grant; accepted compromised-admin/host and no-2FA/no-dual-approval residual risks remain.

Source inspection on 2026-10-07 establishes these facts:

| Evidence                                                                                                                                                                                                                                                                                 | Current capability and P07 gap                                                                                                                                                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Deposit contracts](../../packages/contracts/src/deposits/deposit.schema.ts), [routes](../../apps/api/src/modules/deposits/deposits.routes.ts) and [manual-credit service](../../apps/api/src/modules/deposits/manual-credit.service.ts)                                                 | Address readiness, detection health, employee/admin persisted history, confirmed manual grants and original-action observation exist with current authority checks. Pending chain candidates are separate from credited history.                                   |
| [P06 acceptance](../006-tron-custody-deposits/quickstart.md)                                                                                                                                                                                                                             | Recorded Nile 3/3 acceptance includes one exact 1.000001 USDT inbound credit and a recovered treasury sweep without a second employee credit. Later remediation reused live evidence alongside fresh local checks. No fresh acceptance is claimed here.            |
| [Employee card](../../apps/web/src/features/employee/components/deposit/deposit-card.tsx)                                                                                                                                                                                                | Uses a fixture address/network/currency, fixture history and a 700 ms simulated confirmation. Address/QR/copy, notice region, empty-history text, rows and verifying-row refresh exist; nonready/detection-error/manual-row/pagination states are not wired.       |
| [Admin screen](../../apps/web/src/features/admin/components/deposits/deposits-screen.tsx) and [local action](../../apps/web/src/features/admin/context/actions/use-deposit-actions.ts)                                                                                                   | History/search/pagination and employee/amount/reference/reason form with final confirmation exist. Fixture targets, floating-point amounts, local reference deduplication, fabricated manual TxIDs, local balances and client-derived audit remain to be replaced. |
| [Employee financial feedback](../../apps/web/src/features/employee/components/common/financial-feedback.tsx) and [admin confirmation](../../apps/web/src/features/admin/components/common/admin-confirm-dialog.tsx)                                                                      | Shared loading/error/retry/pagination and asynchronous confirmation/error surfaces exist. Missing deposit placement/behavior stays within C2; a new popup is not assumed necessary.                                                                                |
| [Users routes](../../apps/api/src/modules/users/users.routes.ts), [admin routes](../../apps/api/src/modules/admins/admins.routes.ts), [wallet routes](../../apps/api/src/modules/wallets/wallets.routes.ts) and [deposit routes](../../apps/api/src/modules/deposits/deposits.routes.ts) | Own profile, individual wallet and history identities exist. No bounded live employee-choice lookup was found for the grant selector. History cannot supply an employee who has never received any credit.                                                         |

### Owner Decisions

**C1 - Frozen deposit content.** The employee card describes a demonstration-only address, a 10 USDT demonstration minimum and confirmation timing awaiting final administration approval. Employee/admin status choices include rejected deposits. The admin form promises external-reference deduplication, while P06 permits that reference on distinct deliberate action identities. No actual deposit 72-hour control or admin rejection action was found; the roadmap prohibition still holds.

**C1 decision**: Under the owner's delegated instruction to select the recommended simple answers, approve only the identified deposit warning/instruction/reference copy corrections and unsupported status/filter corrections in the existing deposit surfaces. Instructions must identify the real configured receiving assignment, automatic verified credit with variable network/provider latency, no commercial minimum/maximum, no 72-hour deposit hold and no administration approval/rejection step. Reference wording must distinguish repeat observation of the same action from a separately deliberate grant. Preserve all other frozen copy, routes and visual design; this exception does not permit broader policy-page edits or redesign.

**C2 - Missing runtime presentation.** Existing notice/address/history regions, refresh control, shared employee feedback/pagination and admin alert/confirmation can support integration. The employee card lacks readiness/detection-error/pagination/manual-row presentation; manual rows have no chain TxID/address. Clipboard failure and uncertain retained manual actions need visible feedback. Required reason/reference/confirmation controls already exist, but the current confirmation previews employee/amount/reference without the entered reason; FR-019 requires the complete intent to be reviewed within that same description.

**C2 decision**: Approve necessary deposit-specific use of the existing notice/address/history regions, refresh control, shared employee feedback/pagination and admin alert/confirmation. They may present readiness, detection delay/error, bounded history navigation, manual rows with no chain fields, truthful clipboard failure, full exact grant intent including its reason, and retained-action uncertainty/recovery. Reuse existing controls and preserve surrounding presentation; add no route, popup or redesigned component system. This also permits relevant loading/disabled/error state and exact-amount validation on existing controls. No local timer, new action identity or hidden success may resolve a financial uncertainty.

**C3 - Live target choices.** The administrator selector uses fixtures; current history identifies only employees with past records. Initial/new grants are approved P06 behavior, so limiting targets to employees in history would drop a requirement.

**C3 decision**: Include minimal live employee-choice support as a narrowly approved prerequisite within this same P07 feature, owned by the established account/admin backend boundary. Deliver/test it before dependent frontend integration; create no additional roadmap phase or duplicate feature. Provide bounded searchable/navigable choices with only stable employee ID, name and email needed by the existing selector. Every target allowed by existing manual-credit policy must be reachable, including USER accounts with their persisted wallet and no prior history; introduce no paid-subscription, prior-deposit or additional status restriction. Enforce current authorized ADMIN/session access and safe minimal output with truthful failure/empty states. Selection is not grant authority: the existing server must revalidate target and current administrator at confirmation. Broad P10 directory/CRUD/detail administration, custody changes and new financial policy remain excluded. This is authorization to specify/plan the bounded prerequisite, not to implement it during CLARIFY.

## Clarifications

### Session 2026-10-07

The owner instructed CLARIFY to select the recommended answer to each material question without complexity or overengineering. The answers below were selected under that explicit delegation; no further interactive answer was required. The quality checklist retains its original SPECIFY metadata/notes as required by CLARIFY's marker-only write boundary; its current checkbox markers reflect revalidation against these accepted decisions.

- Q: C1 - May P07 correct the identified obsolete frozen deposit copy and unsupported status/filter choices? → A: Yes; permit only those bounded corrections inside existing deposit surfaces, preserving routes, visual design and unrelated frozen copy. Keep settled automatic-credit/no-hold/no-commercial-limit rules and explain action-based duplicate safety accurately.
- Q: C2 - May existing regions and shared feedback/navigation/confirmation present the missing deposit states and complete grant intent? → A: Yes; approve only necessary placement/state behavior in those existing surfaces for readiness/errors/history/manual records/copy failure, exact intent including reason, and uncertain-action recovery; no new route, popup or redesign.
- Q: C3 - Which scope delivers real bounded target choices for the existing selector, including first-credit employees? → A: P07 owns only minimal ADMIN-authorized employee-choice prerequisite support, completed/tested before dependent integration; return ID/name/email for targets already permitted by existing grant policy, with no broad P10 administration or new eligibility rules.

## User Scenarios & Testing _(mandatory)_

Implementation must create/extend actual automated acceptance tests. These scenarios describe required observable results, not executions. Predecessor acceptance and the narrow C3 backend acceptance must pass before dependent frontend work; C1-C2's accepted presentation boundaries apply throughout.

### User Story 1 - Receive correct personal deposit instructions (Priority: P1)

As an employee, I need my assigned public address, QR/copy and configured token/network to transfer to the correct destination without relying on a demonstration address.

**Why this priority**: Wrong or unready instructions can misdirect funds before history is involved.

**Independent Test**: Sign in as two employees, retrieve ready/nonready instructions, inspect/copy/decode them, reload and switch sessions. No funds are sent unless a separately authorized testnet run is selected.

**Acceptance Scenarios**:

1. **Given** a ready assignment, **When** its employee opens the page, **Then** visible address, decoded QR and successful copied value agree with that account's configured instructions and persist after reload. (FR-001-003, FR-015)
2. **Given** no assignment, provisioning, unavailable recovery/provider support or invalid response, **When** instructions load or retrieval/provisioning safely repeats, **Then** actual readiness/availability is shown without a fixture/unready address offered as usable or a success claim. (FR-003-005, FR-014, FR-028)
3. **Given** clipboard refusal, **When** copying is attempted, **Then** no copied-success message appears and the full address remains inspectable for manual copying. (FR-015, FR-027-028)
4. **Given** account/session change or access denial during a read, **When** old work completes, **Then** the prior account's address/history cannot appear in the new account or restore denied access. (FR-001, FR-014)

---

### User Story 2 - Observe real credit and history (Priority: P1)

As an employee or administrator, I need persisted deposit facts and clear uncertainty to distinguish credited money from transfers still being checked or unavailable detection.

**Why this priority**: Refresh, timers and provider delay must not fabricate spendable money or duplicate credit.

**Independent Test**: Use persisted chain/manual records and controlled detection failures; refresh, paginate/filter, reload and inspect server-owned wallet values through the real test application and preserved browser surfaces.

**Acceptance Scenarios**:

1. **Given** a verified confirmed transfer, **When** history/balance are observed, **Then** one persisted chain credit with exact amount/identity appears, including Saturday/Sunday, without a 72-hour deposit hold or admin decision. (FR-005-011, FR-013)
2. **Given** an unconfirmed, disappearing, wrong-token/network/recipient or unresolved candidate, **When** refresh runs or browser time advances, **Then** no credited row, balance increment or rejection decision is invented. (FR-004-006, FR-008, FR-011)
3. **Given** one transfer observed repeatedly/concurrently, **When** history is reread, **Then** one canonical event remains one credit; two distinct eligible logs in one transaction retain separate identities/amounts. (FR-008-009)
4. **Given** empty, filtered-empty or failed/malformed history reads, **When** the list settles, **Then** real empty results remain distinct from unavailable data; navigation/filtering respects current server scope and never shows another employee's previous page. (FR-010-012, FR-014, FR-028)
5. **Given** a recorded manual grant, **When** either audience sees it, **Then** it is labeled manual, has no fabricated chain TxID/address, and exposes admin actor/reason/reference only to an authorized administrator. (FR-009-010, FR-016)
6. **Given** network/provider delay followed by recovery, **When** bounded relevant refresh resumes, **Then** the view reaches persisted state without a latency guarantee, repeat credit or optimistic wallet patch. (FR-006-008, FR-013)
7. **Given** configured safe explorer support or its absence, **When** chain/manual history renders, **Then** only genuine chain records may link to a validated matching-network destination; no guessed or manual-credit chain link appears. (FR-025)

---

### User Story 3 - Grant and reconcile a manual credit (Priority: P2)

As an administrator, I need to select the real employee, review exact amount/reason/reference and confirm one audited grant, including recovery from a lost reply.

**Why this priority**: Grants change money and require intentional authorization, exactness and duplicate-safe recovery.

**Independent Test**: After C3's live-target prerequisite passes, grant to an employee with no prior history using the existing form/confirmation. Exercise double submit, conflict, lost reply, reopen/reload and role changes; inspect original action, history and server balances.

**Acceptance Scenarios**:

1. **Given** an employee with no past credit, **When** an admin selects them from authorized live choices and reviews a positive exact amount/reason/reference, **Then** confirmation identifies the real employee and complete intent; only explicit confirmation submits it. (FR-017-019, FR-026)
2. **Given** amount 1.000001 USDT, **When** confirmed/recorded, **Then** confirmation/history/wallet preserve all meaningful units without two-decimal truncation or a new commercial minimum. (FR-009, FR-018-019)
3. **Given** duplicate clicks, dialog close/reopen or competing sessions observing the same action, **When** it is submitted/observed again, **Then** the original outcome is reconciled without a second grant; changed payload/actor conflict is not success. (FR-020-022)
4. **Given** possible commit with a lost reply, **When** the admin recovers the view, **Then** retained action stays visibly uncertain until observed, is not silently replaced/retried as a new grant, and updates balances/history only from persisted facts. (FR-021-024, FR-028)
5. **Given** the same external reference on independently deliberate confirmed grants, **When** each has its own action identity, **Then** reference alone is not treated as global deduplication; each authorized outcome is separate and no chain receipt is edited. (FR-022-024, FR-027)
6. **Given** missing reason/reference, malformed/unsupported amount, wrong target or revoked admin authority, **When** submission is attempted, **Then** it fails without posting or fake audit; denial prevents obsolete completions from re-enabling it. (FR-001, FR-014, FR-018-019, FR-023)
7. **Given** a settled grant, **When** affected views refresh, **Then** source remains NON_REFERRAL administrative funds, existing source/reservation allocations remain intact, and actual persisted actor/time/reason/reference are shown only where authorized. (FR-013, FR-016, FR-023-024)
8. **Given** anonymous, employee or revoked/disabled administrator access, invalid lookup bounds, duplicate employee names, a first-credit target, lookup failure or an obsolete lookup reply, **When** choices are requested/navigated, **Then** access/bounds are enforced, permitted targets are reachable and distinguishable by name/email, only minimal identity is returned, and no fixture/history fallback or stale-scope selection is allowed. (FR-017)

### Edge Cases

- Concurrent first-address requests or lost provisioning reply preserve the recoverable assignment; ready instructions with paused/retrying/unresolved detection retain the correct address without claiming finality.
- Zero/negative/overflow/sub-micro amounts and forged authority fail validation. Exact representable positive amounts have no invented commercial deposit minimum/maximum.
- Multiple eligible logs may share a TxID. Truncation must not merge their identities.
- Date/page/filter changes and late replies cannot overwrite newer scope, confirmed denial, dirty input or another session's facts. Dates use Baghdad independently of browser timezone.
- Manual records lack chain fields. Missing/invalid explorer configuration produces no guessed link.
- Clipboard denial cannot produce success. Long addresses and exact amounts remain usable on narrow phones.
- Retired/denied/inactive observation stops polling. Failed reads cannot fall back to seeds, zeros or confirmed status.
- Admin employee-detail links may reach a fixture-only P10 view. Preserve the boundary without claiming cross-domain integration or substituting fixture identity.
- Missing live target choices blocks fixture/arbitrary grants; history is not a complete employee directory.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Employee instructions/history MUST belong to the current authenticated employee; admin history/grants MUST require current authorized ADMIN. Retired/suspended/banned/unauthorized sessions MUST not expose private data or grant credit. Task-only/withdrawal-only restrictions MUST not invent a deposit hold.
- **FR-002**: Ready instructions MUST use the account's unique company-controlled public assignment. Address, QR and successful copied value MUST agree and identify configured supported USDT token/TRON network explicitly.
- **FR-003**: Unassigned, provisioning, unavailable and ready MUST remain distinct. Unready/fixture/guessed addresses MUST not be offered as usable. Repeat/concurrent retrieval/provisioning MUST preserve the existing recoverable assignment and expose actual outcomes only.
- **FR-004**: User input/TxIDs, explorer pages, refresh clicks, timers and browser clocks MUST NOT authorize credit/finality. The frontend MUST consume verified persisted outcomes, never locally confirm a transfer.
- **FR-005**: Verified deposits MUST appear as automatic credits every day, including weekends, without a 72-hour deposit hold, admin approval/rejection, unapproved commercial minimum/maximum or zero-latency promise.
- **FR-006**: Detection not started, scanning, retrying, paused and unresolved MUST be distinguishable from confirmed credit. Scan/observation time describes freshness, not candidate finality or a guaranteed credit deadline.
- **FR-007**: Refresh MUST use bounded reads/backoff only during relevant authenticated page/state observation, avoid overlapping duplicate requests, and stop obsolete work on retirement, denial or teardown. Failure MUST permit safe recovery without clearing known history into fabricated empty results.
- **FR-008**: History/status MUST reflect persisted canonical credits; unconfirmed/unresolved candidates MUST not become credited rows. Replay/concurrent reads MUST not add rows/balance increments; distinct eligible log identities in one transaction MUST remain separate.
- **FR-009**: Amounts MUST preserve exact accepted USDT units, including up to six meaningful fractional digits, in display, confirmation and submitted intent. Formatting MUST NOT hide meaningful units or perform authoritative floating-point calculations.
- **FR-010**: Employee/admin history MUST distinguish chain deposits from recorded manual grants. Manual rows MUST not fabricate TxID/address/network or impersonate blockchain confirmation.
- **FR-011**: Reload/remount MUST retrieve persisted account/address/history independently of fixtures. Ordering/timestamps MUST preserve server chronology and Baghdad date presentation; weekends MUST not delay/hide confirmed credits.
- **FR-012**: History/search/filter/navigation MUST use bounded authoritative scopes and deterministic ordering. Empty, filtered-empty, loading, refresh failure and denial MUST be distinct. Filter changes reset stale pagination; out-of-range navigation has an approved way back. Unsupported rejected/verifying history filters MUST not manufacture records from detection health.
- **FR-013**: Observed chain/manual credits MUST refresh affected existing server-owned wallet/ledger/history. No copy, click, timer or optimistic local patch may increase funds. A grant remains NON_REFERRAL administrative funds without changing existing source/reservation allocation.
- **FR-014**: Invalid responses MUST fail closed with safe feedback, never seed/zero/empty-success defaults. Late reads/commands MUST stay bound to their original session/resource, never restoring denied access or updating another account.
- **FR-015**: Copy success MUST follow successful clipboard completion. Failure MUST leave the value inspectable and show truthful feedback through the authorized existing surface.
- **FR-016**: Grant actor/reason/reference MUST be limited to authorized admin history. Custody secrets/ciphertext, signing payloads, provider/auth credentials and internal storage/diagnostics MUST stay out of employee responses, browser output and feedback.
- **FR-017**: P07 MUST deliver/test minimal current-ADMIN-authorized, bounded searchable/navigable employee choices for the existing selector before dependent frontend integration. Return only stable ID/name/email; every target allowed by existing grant policy, including first-credit USER accounts with their persisted wallet, MUST be reachable. Introduce no new subscription/history/status eligibility rule. Fixtures/history-only reconstruction MUST not supply authority; existing grant execution still revalidates target/current actor. Anonymous/employee/revoked or disabled ADMIN reads MUST be denied; invalid bounds/input and unavailable lookup MUST fail truthfully without private fields or fixture fallback.
- **FR-018**: A grant MUST require a positive representable exact amount, meaningful nonblank reason and permitted reference. The existing input may supply an external administrative reference. Unsupported precision, forged fields, invalid targets or missing input MUST fail without credit; source/audit actor/time remain server-owned.
- **FR-019**: Existing final confirmation MUST show actual employee, full exact amount, reason and reference bound to the submitted action. Only explicit confirmation with current authority may request recording; closing/resetting MUST not bypass pending protection.
- **FR-020**: A deliberate grant MUST retain one stable action identity/payload across duplicate clicks, lost replies and later observation. Repeat MUST resolve the original outcome; timeout/navigation/reset MUST not create an automatic financial replay, new identity or new grant.
- **FR-021**: Potentially committed grants with unknown replies MUST remain visibly uncertain until the original action is reconciled. No silent compensating second grant or success/failure inferred solely from transport behavior is permitted.
- **FR-022**: Same-action replay and changed-payload/actor conflicts MUST be truthful. External reference text MUST NOT be global business identity; the backend permits it across separately deliberate confirmed actions. Reconciliation MUST not create another action.
- **FR-023**: Success MUST derive source, operation and audit facts from the server. The frontend MUST not create fake TxIDs, ledger postings, employee balance patches or client audit, or rewrite genuine chain receipts.
- **FR-024**: Settled grants MUST refresh affected history/wallet/finance from persisted facts. Transient failure MUST preserve a valid dirty draft/original uncertain action; confirmed denial blocks handlers until newer current authority is established.
- **FR-025**: Optional explorer links MUST match public chain transactions and explicitly configured validated destinations/networks. Absent safe configuration means no guessed link; manual grants have no fabricated chain destination.
- **FR-026**: Existing form/reason/reference/confirmation and deposit routes/layout/navigation/popups/design MUST be reused/preserved under C1-C2's bounded exceptions. C3 authorizes only minimal live employee-choice prerequisite support in P07 before dependent integration; broader employee-detail/directory/CRUD/audit integration stays P10. No new financial authority, target policy or custody behavior may be added.
- **FR-027**: Under the accepted C1 exception, P07 MUST correct only the identified obsolete deposit warning/minimum/approval/reference promises and unsupported deposit status/filter choices. Corrections MUST preserve settled financial rules, unrelated frozen copy, routes and visual design; this exception permits no redesign or broader policy edits.
- **FR-028**: Under the accepted C2 exception, readiness/detection/error/navigation/manual-row/clipboard/complete-intent/uncertain-action presentation MUST reuse the approved existing regions and shared feedback/navigation/confirmation surfaces. Placement and runtime state changes MUST remain limited to these deposit needs; they MUST NOT add a page/popup, redesign the surrounding UI or conceal financial uncertainty.
- **FR-029**: Phone/desktop flows MUST retain Arabic/RTL/Cairo, LTR-isolated inspectable addresses/amounts, usable QR/copy, accessible labels/focus/confirmation and content above bottom navigation, without overflow, clipped actions, overlap or unexpected console errors/privileged requests.
- **FR-030**: Implementation MUST create/extend actual deposit component, adapter/hook and browser tests, run affected shared checks/full P07 checkpoint and distinguish fresh/cached/reused/unexecuted evidence. Screenshots/checklist approval MUST not replace persisted/browser acceptance or required services.

FR-001-025 acceptance is traced in US1-US3 and their edge cases. FR-026-028 are enforced by the scope/C1-C3 gates. FR-029-030 are checked by SC-007-008 at implementation acceptance.

### Key Entities _(include if feature involves data)_

- **Receiving instructions**: Account assignment readiness, supported token/network, ready-only public address, detection health and observation time. Keys remain protected and absent.
- **Chain history record**: One canonical verified event identity, exact credited amount, public transaction/network/recipient and persisted times; several records may share a TxID for distinct logs.
- **Manual history record**: Authorized grant, actual employee, exact NON_REFERRAL amount, operation/action identity/time and administrator-only actor/reason/reference; no invented chain fields.
- **Grant intent and observation**: Selected target/amount/reason/reference/confirmation, stable action identity and known/uncertain outcome. Observing is distinct from authorizing another grant.
- **Employee choice**: Stable ID/name/email distinguishing a permitted real target, including one with no history and duplicate-name cases. P07 owns its bounded ADMIN-authorized supply under C3, with existing target policy and no broader administration.
- **History scope**: Current account/authority, search/filter/page and bounded records/totals; another scope's results cannot be presented as current.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Every two-account/reload case has identical assigned visible address, decoded QR and successful copied value, with zero fixture/unready/cross-account addresses offered as usable. (US1)
- **SC-002**: Required replay/delay/failure cases retain exactly one persisted credit per canonical event and two independent credits for two eligible logs; zero unverified candidates become confirmed/spendable funds. (US2)
- **SC-003**: Weekday/weekend observation shows equal confirmed-credit availability with zero deposit holds/admin decision steps or unapproved commercial limits. (US2)
- **SC-004**: Every empty/unavailable/malformed/denied/obsolete-response case remains distinguishable; zero prior-account data, fabricated success or fallback balances/history appear. (US1-US3)
- **SC-005**: One deliberate grant to a first-credit employee records one exact amount, including 1.000001 USDT. All same-action duplicate/lost-reply cases preserve that outcome; zero fake chain fields/local audit/balance authority appears. (US3; C3 prerequisite)
- **SC-006**: Every history/reload/confirmation precision case preserves complete units; every chain/manual case is visibly distinguished and admin details remain hidden from employees. (US2-US3)
- **SC-007**: All primary instructions/history/grant-confirmation journeys complete using approved existing surfaces on phone/desktop. Focused 320px and representative 390px/430px phone plus desktop checks have zero overflow/clipped actions/unexpected console errors; keyboard/focus and QR/copy checks pass. (US1-US3; C1/C2 decisions)
- **SC-008**: All required P07 automated acceptance/full current regression pass with necessary services and a record distinguishing actual fresh/reused/cached results; zero unperformed checks are represented as passed. This is required implementation acceptance, not a SPECIFY claim. (FR-030)

## Assumptions

- Existing authentication, exact money, private query/transport, wallet/finance and deposit backend are reused. Source and recorded predecessor execution were inspected; deployed financial operation is not inferred.
- The already existing reference field can supply a meaningful external reference for the supported grant path. No new reference-kind selector is necessary for that path; existing-ledger reference support remains backend capability.
- Detection uncertainty is separate from credited history. Refresh observes truth; the frontend never provides chain finality or invents pending transfer claims.
- Explorer support may remain absent without valid configured destinations; no default host/network is guessed.
- Missing live employee choices blocks dependent integration until P07's narrow C3 backend prerequisite passes. Fixture/history-only targets are not a fallback; broad P10 functionality remains excluded.
- C1-C3 are accepted only under this CLARIFY request's explicit recommended-answer delegation. They authorize the stated P07 presentation exceptions and minimal employee-choice prerequisite, preserving unrelated frozen UI and P10 scope.
- No application code/tests, plans/tasks, service startup, transaction/deployment/funds, commit or push is executed by SPECIFY or CLARIFY. P06 evidence is reused; P07 lookup/backend/frontend verification remains future work.
