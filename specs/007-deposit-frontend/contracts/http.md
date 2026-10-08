# P07 HTTP Integration Contract

**Status**: Existing P06 endpoints plus one proposed C3 read. Paths below are relative to the configured API prefix; adapters reuse the central client prefix. Shared schemas remain authoritative.

## Existing P06 Endpoints

Source: [deposit routes](../../../apps/api/src/modules/deposits/deposits.routes.ts), [schemas](../../../packages/contracts/src/deposits/deposit.schema.ts), [manual service](../../../apps/api/src/modules/deposits/manual-credit.service.ts). Reuse these APIs without changing their financial policy.

| Method/path                                    | Current authority/input                                                                                          | Success contract                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| GET `/deposits/me/address`                     | Current USER; strict empty query.                                                                                | 200 depositAddressEnvelopeSchema, readiness union. Observational.                                      |
| POST `/deposits/me/address`                    | Current USER; CSRF/action limiter/financial admission; strict `{}` body and empty query.                         | 200 when READY; 202 for durable nonready work; same strict envelope.                                   |
| GET `/deposits/me/history`                     | Current USER/own history; depositHistoryQuerySchema.                                                             | 200 depositHistoryEnvelopeSchema, with serverNow/detection.                                            |
| GET `/admin/deposits`                          | Current ADMIN; adminDepositHistoryQuerySchema.                                                                   | 200 adminDepositHistoryEnvelopeSchema, with serverNow.                                                 |
| POST `/admin/deposits/manual-credits`          | Current ADMIN; CSRF/action limiter/financial admission; manualCreditBodySchema and Idempotency-Key; empty query. | 201 first commit/replayed false; 200 same-action replay/replayed true; manualCreditEnvelopeSchema.     |
| GET `/admin/deposits/manual-credits/:actionId` | Any current ADMIN; UUID actionId/empty query.                                                                    | 200 original manualCreditEnvelopeSchema; 404 DEPOSIT_NOT_FOUND when no committed action is observable. |

All protected deposit routes use no-store. Employee address/history require configured public deposit metadata; missing configuration gives 503 DEPOSIT_UNAVAILABLE. Admin history does not depend on that metadata. Address readiness does not prove a transfer; history includes only persisted credits. Pending/rejected candidate history is not an API capability.

History page/limit use shared bounds/defaults. Optional kind is CHAIN_DEPOSIT/MANUAL_CREDIT; from/to are ordered recorded-time instants. Admin query additionally permits employeeId, bounded q and exact transactionId; transactionId plus MANUAL_CREDIT is invalid. Existing UI uses only approved controls, not all optional API filters.

Manual body is strict and confirmed literal true. Positive representable canonical amount, nonblank reason and valid reference are required. P07 form maps existing reference text to `{ kind: "EXTERNAL", value }`; no forged actor/time/source/wallet fields. Action UUID is created once for explicit reviewed intent and reused as Idempotency-Key. The server rechecks actor/target/own wallet at its transactional financial boundary and derives audit. The same external reference may occur on separately deliberate actions.

POST reply identity must match action, target, stable actor.id, exact amount, reason and reference reviewed in memory. On recovered GET, validate original handle action/employee and current original actor.id against server facts; do not pretend the discarded full payload is available. Actor name/email are current display data and may change after the grant, so those mutable fields must not invalidate recovery. Another current ADMIN may observe an action on the backend, but cannot replay another actor's POST. Frontend recovery reads only its actor-scoped handle.

### Failure and uncertainty

- Reuse safe standard 400 validation, 401 current-authority denial, 403 wrong role, 429 limit and generic internal-error behavior. The shared Prisma error mapper also returns 503 SERVICE_UNAVAILABLE for database connectivity failures, distinct from domain 503 DEPOSIT_UNAVAILABLE. Additional implemented codes include DEPOSIT_NOT_FOUND, DEPOSIT_UNAVAILABLE, DEPOSIT_UNRESOLVED, MANUAL_CREDIT_REFERENCE_INVALID, MANUAL_CREDIT_CONFLICT, FINANCIAL_AMOUNT_OVERFLOW and FINANCIAL_WRITES_FENCED. Project only verified safe fields/messages; never raw provider/SQL/key/diagnostic content.
- Every manual POST, including replay, requires financial admission. Original GET remains available while financial writes are fenced. No frontend request opens admission.
- A possibly committed response failure is UNCERTAIN locally. GET 404 is current absence only: it cannot authorize replacement, forced clearing or reconstructed POST. P06 provides no cancel or terminal NOT_OBSERVED protocol.
- `walletAfter` in replay/GET is historical. Refresh current history/wallet/finance from their own endpoints after settlement.

## Proposed C3 Endpoint

**GET `/admin/employees/manual-credit-targets`** — not implemented at PLAN time.

**Owners**: Existing `apps/api/src/modules/admins/admins.routes.ts`, controller/service/mapper; OpenAPI; strict schemas in `packages/contracts/src/admin/admin.schema.ts` and exports in index.ts. Proposed names: `manualCreditTargetsQuerySchema`, `manualCreditTargetSchema`, `manualCreditTargetsDataSchema`, `manualCreditTargetsEnvelopeSchema` and inferred types. Do not duplicate them in the browser.

| Query | Proposed rule                                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------------------------------- |
| page  | Shared bounded integer; default 1.                                                                                      |
| limit | Shared bounded integer; default 25/max 100.                                                                             |
| q     | Optional shared trimmed boundedSearchSchema, max 150; name/email case-insensitive search; absent/empty means no search. |

Reject unknown/array-valued fields, unsupported sort and unsafe offsets through existing strict validation. Response is the existing success/pagination envelope with data `{ items, pagination }`; each strict item is `{ id: UUID, name, email }`. Reuse the safe account projection constraints: name from nonEmptyBoundedString(150), email from z.email().max(320) in packages/contracts/src/account/account.schema.ts. Matching pagination metadata and zero-result total/pages are validated; zero results return 200. No role/status/balance/wallet/address/subscription/audit/secrets.

Selection predicate is USER with a persisted owned wallet, including first-credit and zero-history accounts, without additional status/subscription restrictions. Order createdAt DESC/id DESC. Reuse existing admin list count/page pattern and `AdminsService.read` RepeatableRead/session-lock/current-ADMIN check. Both queries share one snapshot; later pages are live. Existing schema/index suffices, so no migration.

Authentication/current ADMIN is mandatory, with Cache-Control no-store. GET needs no CSRF or financial admission; observations remain readable under a financial fence. Errors: 400 VALIDATION_ERROR, 401 UNAUTHORIZED (including revoked/disabled current actor), 403 FORBIDDEN, bounded identity-transaction retry exhaustion 409 CONFLICT, global 429, shared 503 SERVICE_UNAVAILABLE for database connectivity and safe generic 500. Selection never substitutes for manual POST's target revalidation.

**Acceptance before frontend**: strict schema tests plus `apps/api/src/modules/admins/manual-credit-targets.integration.test.ts` against real migrated PostgreSQL/current application middleware, including authority, first-credit/multi-page/search/minimal-output/no-store/fence cases. A fixture list or history-derived lookup cannot satisfy this gate.
