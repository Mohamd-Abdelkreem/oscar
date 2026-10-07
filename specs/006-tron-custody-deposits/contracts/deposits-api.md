# P06 Deposit HTTP Contract

**Status**: proposed endpoints/schemas for implementation, not registered routes. Owner: new `packages/contracts/src/deposits/deposit.schema.ts`, API `modules/deposits/` and existing OpenAPI composition. P07 consumes these contracts only after P06 acceptance; this document authorizes no UI edits.

Paths below are relative to the existing configured `API_PREFIX` (default `/api/v1`). Preserve existing `ResponseHelper` success/error envelopes and request IDs. Strict schemas reject unknown body/query/params fields. Use existing canonical financial amount/instant/request-key and bounded page schemas, not duplicate business parsers. All responses are `Cache-Control: no-store`; request/response bodies and provider payloads are not logged.

## Routes and authority

| Method/path                                    | Current server authority                                                                              | Result                                                                                                                                                                         |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET `/deposits/me/address`                     | Active verified USER/current session; owner derived from session                                      | 200 public assignment state; GET never provisions/signs/credits.                                                                                                               |
| POST `/deposits/me/address`                    | Same USER/current session, existing authenticated-write CSRF/limits; recheck at transactional request | Empty strict body. 202 durable provisioning pending; 200 if already READY. Concurrent/repeated POSTs observe the same unique assignment. No private-key operation inside HTTP. |
| GET `/deposits/me/history`                     | Same USER/current session; implicit own wallet scope                                                  | 200 bounded persisted confirmed chain/manual history and safe detection health.                                                                                                |
| GET `/admin/deposits`                          | Active verified ADMIN/current session                                                                 | 200 authorized bounded employee deposit/manual history.                                                                                                                        |
| POST `/admin/deposits/manual-credits`          | Current ADMIN/session at commit, CSRF, bounded critical-action limit and confirmed/reason policy      | 201 first committed grant; 200 exact replay. No chain receipt creation.                                                                                                        |
| GET `/admin/deposits/manual-credits/:actionId` | Current ADMIN/session; authorized history read                                                        | 200 committed administrative outcome for lost-response observation; 404 if no committed grant. Absence does not authorize silently replacing the original actionId.            |

No public TxID-credit, deposit reject/approve, arbitrary wallet patch, signing, sweep, key export or custody configuration route is added. Stale/deactivated/revoked account/session cannot obtain a write replay. Provisioning POST checks runtime/control admission before creating a binding; a restore fence returns FINANCIAL_WRITES_FENCED instead of creating work against incomplete ownership. Inbound automatic credit retains permanent ownership independently of employee API eligibility.

## Assignment response

Proposed `depositAddressDataSchema` is a strict discriminated union with common `serverNow`, `network` and `token` (`symbol: USDT`, exact configured public contract, `decimals: 6`). Its states are:

- UNASSIGNED: no address; provisioning has not been requested.
- PROVISIONING: safe `assignmentId` and readiness state, no address/key/recovery location. A retry observes existing work.
- UNAVAILABLE: safe retryable reason code and assignmentId if one exists; no fake address. This covers an explicit known recovery/readiness failure, not a swallowed database outage.
- READY: `assignmentId`, public `address`, `readyAt`, separate `activationState` (UNKNOWN/INACTIVE/ACTIVE), optional observed resource freshness and safe `detection` state.

`detection` contains status (NOT_STARTED/SCANNING/RETRYING/PAUSED/UNRESOLVED), `lastSuccessfulScanAt` nullable and `serverNow`. Durable discovery attribution limits candidate health to the assignment's employee. Unfinalized/unavailable/throttled owned candidates report RETRYING; conflicting or otherwise unresolved evidence reports UNRESOLVED and takes precedence over a newer retryable candidate. Successful accounting clears candidate uncertainty. These observations do not create a confirmed history row. No guarantee of instant chain detection, activation or funds is inferred from READY. Public metadata must match the immutable assignment/configured token; network mismatch or unavailable DB/config returns an error, not successful invented data. POST responses use the same union. Nonready states expose no address as usable before off-host acknowledgement.

## Bounded history

Employee query: `page` default 1, `limit` default 25/max 100, optional `kind` (CHAIN_DEPOSIT/MANUAL_CREDIT), optional `from`/`to` valid financial instants (inclusive UTC recorded-time bounds, from <= to). Reject arrays, unknown sort keys/fields, malformed IDs/instants, zero/oversized pages and unsafe offset arithmetic. Admin additionally accepts `employeeId` UUID, `q` trimmed/max150 employee name/email search and canonical `transactionId` for CHAIN_DEPOSIT matching; combining transactionId with MANUAL_CREDIT is invalid.

Sort is fixed `recordedAt DESC,id DESC,operationId DESC`; the globally unique operation ID breaks ties between independently keyed chain/manual rows. Query and filtered count run in one RepeatableRead snapshot. Return `data.items`, `data.pagination`, `data.serverNow`, with matching envelope `paginationMeta`; reuse existing `financialPageSchema`/`paginatedFinancialEnvelopeSchema` and metadata semantics, including totalPages=0 for zero results. All matching records remain reachable with current page filters. Separate requests see live history, so sort stability does not promise a frozen multi-request snapshot; newly inserted rows can shift offsets. P07 refresh/reset/clamping must respect this fact.

Proposed `depositHistoryRowSchema` is a strict kind union:

| Common fields                                                                                  | CHAIN_DEPOSIT fields                                                                                                    | MANUAL_CREDIT fields                                               |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `id`, `kind`, `operationId`, positive canonical `amount`, `source: NON_REFERRAL`, `recordedAt` | `network`, public `tokenContract`, `transactionId`, raw `logIndex`, public `address`, `confirmedAt`, `state: CONFIRMED` | `actionId`, `state: RECORDED`; no TxID/log/finality/receipt fields |

Employee manual rows disclose safe label/amount/time/operation only, excluding administrative reason/reference/actor. Admin rows add selected employee identity (ID/name/email); admin manual records add authenticated actor identity, bounded reason and permitted reference. Admin chain rows retain actual canonical fields. Never mix an external reference containing a TxID into chain fields. Candidate/unknown verification does not appear as confirmed financial history; assignment detection health represents that uncertainty separately.

Timestamp meanings are fixed for producers and consumers. Public chain `confirmedAt` is exactly `DepositReceipt.verifiedAt`, serialized as a UTC ISO instant: the server time of successful canonical-final verification whose evidence was used to create the committed receipt. It is not the chain block's inclusion timestamp or the time the network first achieved finality. Internal `blockTimestamp` retains canonical block inclusion time. Public `recordedAt` equals the linked `FinancialOperation.createdAt`, the server-assigned financial recording instant stored atomically with the receipt/manual grant; it is not PostgreSQL's actual commit timestamp. `from`/`to`, sorting and pagination always use `recordedAt`, never `confirmedAt`. Concurrent verification winners and later retries/replay return the immutable stored timestamps without replacing them with the current clock. Manual rows have only `recordedAt`, with no invented `confirmedAt`.

No raw Prisma/provider record, current secret, signed payload, internal path, protected envelope/digest or arbitrary admin payload is returned. Public explorer URLs are optional server-configured fixed-host derivations from validated public TxID; no user/provider-supplied link is trusted and no explorer link proves ownership/finality.

## Manual grant request and outcome

Proposed `manualCreditBodySchema` is strict:

| Field        | Validation/authority                                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `actionId`   | Required durable UUID identifying this administrative action independently of HTTP keys. P07 retains it across observation/retries.                                                                                                                                                  |
| `employeeId` | UUID target; server resolves employee/wallet. No caller-supplied wallet/balance/actor.                                                                                                                                                                                               |
| `amount`     | Existing positive canonical USDT decimal string; up to six fractional digits and existing representable bounds. No JSON number, exponent/grouping, negative/zero or noncanonical trailing fractional zero.                                                                           |
| `confirmed`  | Required literal true, bound to reviewed target/amount/reference/reason.                                                                                                                                                                                                             |
| `reason`     | Trimmed nonblank/max500; server stores normalized value and fingerprints it.                                                                                                                                                                                                         |
| `reference`  | Exactly `{ kind: EXTERNAL, value: ... }` or `{ kind: LEDGER_OPERATION, operationId: ... }`. EXTERNAL value is trimmed, 3-256 characters, contains a letter/digit, rejects controls and must describe the administrative action; LEDGER_OPERATION is a valid UUID on the same wallet. |

`Idempotency-Key` header is required, using existing `financialRequestKeySchema` (1-128 allowed characters). Header/key does not replace actionId. Source/origin/kind/actor/time/audit/balance/TxID authority fields are absent and rejected. Server fixes CREDIT/ADMIN_ADJUSTMENT and available NON_REFERRAL. Initial wallet grant needs no fake existing operation; a valid external reference suffices. External references are not implicitly globally unique or chain evidence.

Proposed `manualCreditOutcomeSchema`: `actionId`, `operationId`, `employeeId`, `amount`, `source: NON_REFERRAL`, `recordedAt`, `state: RECORDED`, safe authorized reference/reason/actor projection, existing `walletAfter` components and `replayed` boolean. Current ADMIN may observe the committed outcome by actionId. No private chain/signed/recovery field is added; there is no provisional credit success.

Replay rules:

1. Original actor + same normalized target/amount/reason/reference/confirmation/actionId + same/new request key returns the existing outcome once. Request aliases remain actor/operation scoped; business uniqueness is global actionId.
2. Changed consequential payload or actor under that actionId conflicts. Same existing request key pointing to a different action/payload conflicts. No second grant is committed.
3. Concurrent valid repeats converge on one grant/operation/posting/audit. A response lost after commit is resolved through GET/original POST, retaining the same ID/key/payload. Different explicit actionIds represent different grants, so a transport error never triggers a new one silently.
4. Existing CORRECTION stays source-specific with prior same-wallet operation; this endpoint exposes only new positive grants. Neither flow edits receipts/postings or relabels referral/reserved balances.

## Error and pending behavior

Existing protocol errors are preserved: 400 VALIDATION_ERROR with target-prefixed field paths; 401 UNAUTHORIZED for absent/stale authority; 403 FORBIDDEN for wrong role/action policy; existing CSRF/rate-limit failures. Proposed domain codes below must be implemented/tested in owning error mapping, without raw provider/SQL/secret details:

| HTTP/code (proposed)                | Meaning / safe recovery                                                                                        |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 404 DEPOSIT_NOT_FOUND               | Authorized requested grant/target is unavailable; no success/balance is inferred.                              |
| 409 MANUAL_CREDIT_CONFLICT          | Action/key/payload/actor conflict; observe original action, no new grant.                                      |
| 409 DEPOSIT_UNRESOLVED              | Financial/receipt ownership/evidence invariant cannot be safely established; preserve history and investigate. |
| 409 FINANCIAL_WRITES_FENCED         | Restore admission is closed; no financial mutation committed. Observations remain allowed.                     |
| 400 MANUAL_CREDIT_REFERENCE_INVALID | Missing/foreign/nonmeaningful reference at domain validation; no grant.                                        |
| 409 FINANCIAL_AMOUNT_OVERFLOW       | Representable addition would overflow; no partial credit/grant. No commercial deposit cap is added.            |
| 503 DEPOSIT_UNAVAILABLE             | Required config/database/readiness boundary unavailable; never fake address/empty history/zero balance.        |

A provisioning 202 is durable pending work, not failure or completed address issuance. GET/POST return truthful nonready state while recovery is pending; provider outages never manufacture confirmed rows. Private error fields are allowlisted and no unsupported detail is cached by future consumers.

## Producer/consumer evidence

P06 adds strict schema tests and actual app/DB tests for every route, exact amounts, source/reference/actor binding, replay/conflict/current-session/CSRF/cross-account denial, more-than-one-page rows/counts and secret absence. Existing wallet/finance contracts continue accepting CREDIT/ADMIN_ADJUSTMENT with grant `correction=null`; no P06 frontend edit occurs. P07 must runtime-parse these domain envelopes in its existing feature adapters and reuse approved feedback/confirmation surfaces after its owner/UI gate.
