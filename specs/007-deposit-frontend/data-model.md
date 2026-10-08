# P07 Data Model

**Status**: Design only. Existing wire contracts below come from [deposit.schema.ts](../../packages/contracts/src/deposits/deposit.schema.ts); proposed lookup/client state does not add database entities or migrations.

## Existing Receiving Instructions

Every address response contains `serverNow`, configured `network` and strict `token { symbol: "USDT", contract, decimals: 6 }`. Network is TRON_MAINNET/TRON_SHASTA/TRON_NILE; the frontend does not select a network.

| State        | Additional fields                                                                                                       | Client behavior                                                                                                  |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| UNASSIGNED   | None                                                                                                                    | No usable address. One guarded empty-body POST may request assignment.                                           |
| PROVISIONING | assignmentId; readiness REQUESTED/KEY_STORED/RECOVERY_ACKED                                                             | Observe GET; no address/QR/copy.                                                                                 |
| UNAVAILABLE  | Optional assignmentId; reasonCode RECOVERY_UNAVAILABLE/EVIDENCE_CONFLICT/PROVIDER_UNAVAILABLE; retryable                | Existing safe feedback. No fallback address or automatic provisioning loop.                                      |
| READY        | assignmentId, address, readyAt, activationState UNKNOWN/INACTIVE/ACTIVE, optional nullable resourceCheckedAt, detection | Render only this validated public address in visible/QR/copy values. Activation state does not establish credit. |

`readyAt <= serverNow` is enforced by the shared schema. Assignment persistence/recovery transitions remain P06 server-owned. The client never advances readiness using a timer or reads protected custody material.

Detection contains `status` (NOT_STARTED/SCANNING/RETRYING/PAUSED/UNRESOLVED), nullable `lastSuccessfulScanAt` and `serverNow`. It describes observation health, not an individual transaction outcome. READY instructions may coexist with degraded detection; show both facts. Employee history also supplies detection; it is independent of whether its page is empty.

## Existing Persisted History

Common row fields: UUID `id`, UUID `operationId`, positive exact canonical decimal `amount`, `source: NON_REFERRAL`, and `recordedAt` instant. Discriminate by `kind`; use operationId as the stable UI row key (or kind plus id), never array index or TxID alone. Chain/manual records can share id, so id alone is insufficient.

| Kind          | Fields beyond common projection                                                                                              | Privacy/presentation                                                                                                                                             |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CHAIN_DEPOSIT | network, tokenContract, transactionId (64 lowercase hex), nonnegative logIndex, public address, confirmedAt, state CONFIRMED | One canonical event is identified by network/transaction/log index. Distinct logs can share a TxID. Candidate/provider uncertainty is absent from credited rows. |
| MANUAL_CREDIT | actionId UUID, state RECORDED                                                                                                | No chain network/address/TxID exists. Employee receives no actor/reason/reference.                                                                               |

Admin rows add employee `{ id, name, email }`; admin manual rows additionally add actor identity, reason and reference. The existing external-reference value is bounded/validated administrative text; a ledger-operation reference is an alternate existing backend kind. P07's existing form uses EXTERNAL only, without adding another selector.

Employee page data includes items/pagination/serverNow/detection; admin page data includes items/pagination/serverNow. Page metadata must agree with envelope metadata and requested bounds. Existing server ordering includes operationId as the final combined-history tie-breaker. Pages are live observations, not a retained cross-request database snapshot.

Amounts stay strings through inputs, contracts, confirmation and rendering. Reuse shared positive-USDT schema and exact display; no parseFloat, Number, cent rounding or local arithmetic. Timestamps are server instants formatted explicitly in Asia/Baghdad; browser timezone does not own business dates.

## Existing Manual Grant and Outcome

Request: `{ actionId, employeeId, amount, confirmed: true, reason, reference }`, plus a stable Idempotency-Key. Reason is trimmed/nonblank/max 500. EXTERNAL reference is trimmed, 3–256 characters, contains a letter/number and excludes control/format characters. Use the existing shared schema for exact amount range/precision and all allowlists.

Outcome: actionId, operationId, employeeId, amount, NON_REFERRAL source, recordedAt, RECORDED state, actor identity, reason/reference, walletAfter and replayed. The server commits ledger/source/audit atomically and binds action/key/actor/payload. `walletAfter` is the original operation's stored snapshot; it is not necessarily today's wallet. A validated outcome prompts live refetch, never a wallet patch.

POST requires current ADMIN, target USER with own persisted wallet, CSRF, rate limits and financial admission. GET original outcome requires current ADMIN but remains observational during financial fencing. GET 404 establishes only current absence of a committed observable action, not cancellation or proof of noncommit.

## Proposed Employee-Choice Projection

Shared strict row: `{ id: UUID, name, email }`, reusing safe account constraints nonEmptyBoundedString(150) for name and z.email().max(320) for email; no wallet ID/balance, role/status, address, subscription, audit or private fields. Strict query: existing bounded page/limit and optional trimmed bounded q (name/email). Default page 1/limit 25; maximum limit 100 and search 150 characters; unsafe offsets rejected.

Relationship: existing User (role USER) with its existing persisted Wallet, matched by wallet ownership. No history/subscription/status predicate. Existing unique Wallet owner and User role/createdAt/id index suffice. Page/count share the existing RepeatableRead/current-ADMIN transaction. Order createdAt DESC/id DESC; creation fields are not exposed. No migration/index or stored projection is proposed.

## Proposed Client Scope and State

Read identity includes P07 namespace, current private financial/session scope, role, domain and normalized selection (page/limit/filter/search/actionId as applicable). Late obsolete results cannot update state/cache. Retirement cancels/removes P07 private queries and hides accepted data. Transient failure may retain known rows only in the same admitted scope, accompanied by visible error.

Transient grant draft: selected `{ id, name, email }`, amount string, reason, external reference and validation/confirmation state. Freeze its validated intent at review; no edits can mutate a dispatched action. Keep at most the current target page and one selected identity for paging label continuity. Retirement clears/hides the old draft and full reviewed payload.

Durable handle: strict `{ version: 1, actionId: UUID, employeeId: UUID }` in an actor-scoped storage key. No amount/reason/reference/session token/address/query data is persisted. An actor-scoped Web Lock and readback guard creation/dispatch; storage events coordinate cooperating tabs. Missing/busy lock or storage failure blocks new dispatch safely. Server idempotency, not this browser lock, prevents duplicate money effects.

| Local state                   | Allowed transition                                                                                      | Forbidden inference                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| DRAFT                         | Validate/select/review within current authority.                                                        | Selection is not server grant authority.                                           |
| REVIEWED                      | Explicit confirm acquires lock, creates/reads back handle and dispatches the frozen request once.       | No hidden/automatic confirmation.                                                  |
| DISPATCHED / UNCERTAIN        | Observe original action by GET; retain handle across close/reload.                                      | Timeout/404/conflict/malformed response cannot clear it or authorize a new action. |
| RECORDED                      | Validate matching committed facts; clear only matching handle under coordination and refetch live data. | Historical walletAfter cannot overwrite current wallet.                            |
| Proven pre-dispatch rejection | Preserve editable draft; no request sent, so no uncertainty was created.                                | A generic HTTP 4xx does not prove an earlier uncertain action cannot commit.       |
| RETIRED                       | Scrub/hide visible draft/payload; original actor may later recover only the minimal handle and GET.     | Another actor cannot reuse/inspect the retained action.                            |

After reload, the full original payload is unavailable: never reconstruct a POST from current fields. Match handle action/employee and stable current actor.id against a valid server result; accept server facts for the original action. Actor name/email are mutable display data, not recovery identity. A retained action with persistently absent observation remains unresolved; P07 adds no cancellation or forced-clear protocol.
