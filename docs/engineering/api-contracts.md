# API Contracts and HTTP Boundaries

Scope: the wire agreement between OSCAR Express and Next.js, owned once by
`@template/contracts`. These rules supplement, not duplicate, the
[backend](backend-standard.md), [frontend](frontend-standard.md),
[data](data-patterns.md), [security](security.md) and [testing](testing.md) guides.

## 1. Verified Owners

| Existing Location                                        | Responsibility                                                 |
| -------------------------------------------------------- | -------------------------------------------------------------- |
| `packages/contracts/src/auth/auth.schema.ts`             | Auth/profile request schemas and inferred types                |
| `packages/contracts/src/account/account.schema.ts`       | Safe user/session response data                                |
| `packages/contracts/src/http/http.schema.ts`             | Success/error envelopes, field errors and pagination metadata  |
| `packages/contracts/src/index.ts`                        | Explicit public package exports                                |
| `apps/api/src/modules/auth/dto/`, `modules/users/dto/`   | Aliases of shared request schemas/types                        |
| `apps/api/src/middlewares/validation.middleware.ts`      | Async request parsing and target-prefixed field errors         |
| `apps/api/src/core/responses/api-response.ts`            | Existing `ResponseHelper` success envelopes                    |
| `apps/api/src/infrastructure/openapi/openapi.ts`         | Existing OpenAPI construction                                  |
| `apps/web/src/services/api/api-client.ts`                | Central transport/error normalization; not full DTO validation |
| `apps/web/src/features/auth/api/`, `features/users/api/` | Existing typed producer/consumer adapters                      |

Add future OSCAR domain schemas beside these. Shared contracts remain browser-safe:
no Prisma, Express, filesystem, environment secrets, custody SDK or server initialization.
Do not rename the package to an example's `@workspace/contracts`.

## 2. Input Contract Decisions

For every body/query/params field define type, required/optional presence, nullability,
normalization, length/range, supported precision and safe coercion.
Strict command schemas reject unsupported fields, including privileged fields.
The schema is not authorization: current actor and resource authority remain server-owned.

Preserve PATCH omission versus explicit null versus blank. Normalize email where its
contract owns that decision; never trim/change passwords or significant content.
Current login accepts existing passwords independently of the stronger new-password
policy. Keep credential-entry compatibility when changing registration/reset rules.

Treat all query values as untrusted strings/arrays, not already typed values.
Do not use generic Boolean coercion for textual `false`; parse supported spellings
deliberately. Reject invalid/oversized pagination, unknown sort keys and malformed IDs.
A well-formed UUID/address alone proves neither existence nor ownership.

Derive output types with `z.infer` / `z.output`; use `z.input` when preprocessing,
defaults or transforms make raw form input differ from parsed values.
Do not copy schemas/types separately into API DTOs and web models.
Feature view models may add display-only state, not redefine authoritative wire facts.

## 3. Preserve the Existing Protocol

A successful JSON response uses `success`, `statusCode`, `message`, `data`,
`requestId`, `timestamp` and `path`, with optional `paginationMeta`.
Use `ResponseHelper` with its actual existing signature; do not introduce a second
response protocol. Keep HTTP status consistent with the declared operation.

An error response uses `success: false`, stable `code`, safe `message`,
`statusCode`, `requestId`, `timestamp`, `path` and optional `errors`.
Each field error has `field` and `message`; request paths include the target,
such as `body.email`, `query.page` or `params.employeeId`.
Do not expose stack traces in production even though the shared schema permits
a development-only optional `stack`.

The shared success envelope validates envelope structure, not the domain `data`,
which is currently unknown. Validate data with the endpoint's response schema.
`ResponseHelper` generics and Axios generics do not perform that validation.

Do not assume every success is HTTP 200 or every failure is validation.
Define observable status/code behavior per endpoint. Bodyless responses, explicit
empty JSON, multipart uploads and private binary files require their own documented
content types and semantics; a private image is not a JSON success envelope.

## 4. Output Allowlists and Consumer Validation

Map selected server records deliberately into public DTOs. Never spread a Prisma
user/withdrawal/key record into a response. Test both required visible fields and
absence of internal tokens, hashes, keys, notes and unauthorized identities.

**Required target behavior:** feature adapters validate unknown successful responses
before returning domain data. Current auth/users adapters largely use static generics;
do not claim complete runtime parsing already exists.

This small example demonstrates the required validation step using existing exports.
It is not a newly implemented adapter or a new API endpoint.

```ts
import {
  authUserDataSchema,
  successEnvelopeSchema,
  type AuthUserData,
} from "@template/contracts";

export const parseCurrentUserResponse = (raw: unknown): AuthUserData => {
  const envelope = successEnvelopeSchema.parse(raw);
  return authUserDataSchema.parse(envelope.data);
};
```

An invalid envelope or data throws a validation error; never substitute a default
user, empty history or zero balance. The adapter/UI must classify this as a safe
contract failure, without displaying raw payloads/issues or mislabeling it as an
offline/network failure. Test valid, missing, wrong-type and private-field responses.
Async schema refinements require async parsing.

Validate external provider responses at their infrastructure boundary too.
Provider success does not alone authorize a ledger credit or prove token/network/
recipient/receipt finality; see [security](security.md).

## 5. Dates, USDT, Versions and Commands

- Instants use ISO strings with explicit timezone, normally UTC. Baghdad business
  dates are date-only values; a due deadline is an instant. Do not conflate them.
- Planned USDT DTOs use canonical decimal strings with up to six fractional digits,
  never JSON bigint, float or a formatted currency label.
- Preserve exact raw token units internally. Parsing/storage bounds and percentage
  rounding follow [data](data-patterns.md); do not invent another money parser.
- Version counters/quotes identify stale accepted terms. The backend revalidates;
  an expected version is not a permission or a substitute for an atomic update.
- Clients submit intent, not authoritative fee, balance, subscription, reward,
  approval, deadline, role, wallet ownership or payout result.
- Financial idempotency headers/body fields need documented actor/operation/payload
  binding and conflict behavior. A new request key does not bypass business uniqueness.
- An unknown payout outcome is an active uncertainty, not a transport error proving
  failure. Return truthful server state, eligible balances and original destination.

Do not add future financial endpoints to docs as if implemented. Agree route,
contracts, authorization and error semantics in the responsible phase.

## 6. Lists and Pagination

Define page/limit or cursor, bounded filters, allowed stable sort and a deterministic
tie-breaker. Choose the existing pagination envelope/helper when appropriate.
If a domain introduces cursor pagination, document its distinct shape and behavior
instead of silently calling it the page-based contract.

Specify whether totals include filters and whether zero results produce zero pages.
Preserve current metadata semantics; producer/consumer tests must agree.
Return minimal view-specific data, with owner/admin projections and no unbounded tree
or ledger response. Search parameters are not permission filters.

## 7. OpenAPI, Compatibility and Tests

For every implemented endpoint keep method/path, input/output/content type,
statuses, auth/authority, pagination and idempotency aligned with route registration.
Reuse existing OpenAPI schema construction; do not maintain hand-copied divergent
DTO definitions or invent required errors the runtime cannot produce.

When removing a route, test its original method with earlier guards satisfied;
an auth/CSRF failure does not demonstrate route removal.
When changing an exported schema, coordinate API producer, mapper, frontend adapter,
form mapping, tests and OpenAPI. Consider deployed client compatibility.

Use shared schema tests and real boundary tests from [testing](testing.md).
At minimum exercise unsupported fields, normalization/optional semantics,
response allowlists, malformed success, safe errors, and affected compatibility.
Mocks must conform to the current accepted contract and cannot approve money behavior.

## 8. Review Checklist

- Is each wire shape owned once, browser-safe and exported intentionally?
- Are raw versus parsed values, null/missing, money and date semantics explicit?
- Is the response safely projected and domain data validated at consumption?
- Are authority/idempotency separate from mere input validation?
- Do HTTP status, field errors, content type and OpenAPI match the real route?
- Do producer/consumer tests reject malformed or privileged inputs/outputs?

References: [Zod parsing and inference](https://zod.dev/basics),
[Zod schema API](https://zod.dev/api).
Use only APIs verified against the repository's installed Zod version.
