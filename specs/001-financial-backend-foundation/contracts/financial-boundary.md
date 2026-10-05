# P01 Financial Boundary

**Status**: Proposed shared contract; not implemented. **Owner**: `packages/contracts/src/financial/financial.schema.ts`, explicit exports from `src/index.ts`.

This defines reusable browser-safe wire primitives, not a public credit/debit/reservation endpoint. P01 adds no HTTP method/path, OpenAPI route, financial form or browser adapter. Later domain phases compose these schemas with their approved intent-only inputs and existing response envelope. Server grants, Prisma types, callbacks and provider evidence never enter this package.

## Amounts and rates

| Proposed schema            | Accepted value                                                                                           | Rejected value                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `usdtAmountSchema`         | Canonical nonnegative decimal string, zero through `9223372036854.775807`, at most six fractional digits | Number/bigint JSON value, negative/sign, exponent, grouping, whitespace, excess precision, leading integer zero, trailing fractional zero, empty fraction, overflow |
| `positiveUsdtAmountSchema` | Same grammar/range, greater than zero                                                                    | `"0"`, or anything invalid above                                                                                                                                    |
| `signedUsdtDeltaSchema`    | `"0"`, positive canonical amount or `-` plus a nonzero canonical magnitude within the same bound         | `"-0"`, `+` sign, negative zero fraction, magnitude above the bound                                                                                                 |
| `basisPointsSchema`        | Integer JSON number 0-10000 inclusive, no coercion                                                       | Fraction, negative, numeric string, NaN/infinity, >10000                                                                                                            |

One USDT equals 1,000,000 micro-units. Nonnegative amount grammar is `^(?:0|[1-9]\d*)(?:\.\d{0,5}[1-9])?$`, followed by an exact range check. Bound string length before exact conversion (20 nonnegative characters; 21 signed). Command magnitudes are positive; balances and percentage results may be zero. The magnitude of a signed posting is bounded by the maximum valid component movement; P01 does not emit the extra negative int64 endpoint.

Examples: `"1"`, `"1.23"`, `"0.000001"` valid; `"01"`, `"1.2300"`, `"1."`, `"1e3"`, `" 1"`, `"0.0000001"`, `"+1"` invalid. Human drafts may be normalized by later integrations before submission; this boundary neither trims nor rounds them.

Server arithmetic floors nonnegative `units * basisPoints / 10000` exactly. Initial 2100 and 1200/600/400/200/200 are approved examples, not immutable schema defaults. `"0.000009"` at 1200 yields `"0.000001"`; `"0.000001"` at 2100 yields `"0"`. Gross `"100"` at 2100 yields fee `"21"`, net `"79"`. No invented minimum; gross equals fee+net. Transient BigInt multiplication can exceed storage range while the final result remains valid.

## Sources, dates and identity

| Proposed schema              | Contract                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `fundSourceSchema`           | Exactly REFERRAL or NON_REFERRAL; detailed origins are separate server-controlled facts.                                                                                                                     |
| `businessDateSchema`         | Real Gregorian YYYY-MM-DD, years 0001-9999; reject impossible dates/leap dates, timestamp input and alternate formatting. It is not a UTC instant or authorization.                                          |
| `financialInstantSchema`     | Valid explicit-offset ISO instant at millisecond precision or less; normalize output to UTC. Reject missing offset, invalid date/time and unrepresentable/out-of-supported-calendar results.                 |
| `positiveCountedHoursSchema` | Positive plain decimal-hour string whose exact value times 3,600,000 is an integer number of milliseconds; preserve valid input spelling. Calendar result validation remains server-owned.                   |
| `financialRequestKeySchema`  | Optional at use site; 1-128 ASCII letters/digits plus `.`, `_`, `:`, `-`. No trim/coercion. Key is opaque, nonsecret and scoped by trusted actor/operation. No header or body location is introduced in P01. |

Identity namespaces/business keys and actors are server-owned under [ledger-service.md](ledger-service.md); future external APIs must not promote these into client authority. Validation proves syntax, not identity, event verification, current eligibility or safe release.

### Counted-hour extension precision

Proposed `positiveCountedHoursSchema` belongs beside the existing proposed date/instant schemas in `packages/contracts/src/financial/financial.schema.ts`, with an inferred string type and explicit package export. Its grammar is ASCII `^[0-9]+(?:\.[0-9]+)?$`. Reject numbers, bigint inputs, signs, whitespace, exponent/grouping syntax, empty integer/fraction parts and a zero value. Leading integer zeros and trailing fractional zeros are permitted: `"0001.5000"` and `"1.5"` represent the same accepted duration. The USDT canonical spelling and six-decimal limit do not apply to hours.

Use a linear ASCII scan and a bounded scratch arithmetic representation: remove leading integer zeros and trailing fractional zeros without changing the returned input string. Bound the normalized integer part to eight digits and the normalized fraction to seven digits, at most 16 characters including the decimal point. Never construct BigInt or a power of ten from an unbounded raw spelling. Redundant zeros do not count toward these normalized bounds; no arbitrary raw-string maximum or canonical-hour restriction is introduced here. Later HTTP payload limits belong to their owning endpoint.

These bounds preserve every representable duration: the supported years 0001-9999 span fewer than 100,000,000 elapsed hours, and counted weekday hours cannot exceed that span. Also, `3,600,000 = 2^7 * 3^2 * 5^5`; a normalized finite decimal with more than seven fractional digits could yield integer milliseconds only if its numerator ended in zero, contradicting normalization. This is a representability check, not a new minimum or commercial extension limit.

For normalized hours with integer numerator `n` and fractional scale `s`, compute `numerator = n * 3600000` and `denominator = 10^s` using BigInt. Require a positive numerator and exactly zero remainder before division. Reject any fractional-millisecond duration rather than flooring, rounding or truncating it. One proposed browser-safe exact-duration conversion helper in the same `financial.schema.ts` owns grammar, scratch normalization, bounds and conversion; both schema refinement and the server calendar use it through explicit package exports. Its transient BigInt millisecond result stays inside validation/arithmetic and is never serialized. The schema returns the original validated string, with no BigInt or numeric duration in its JSON output and no Node/Prisma/Luxon import. No second parser, extra file or framework is needed.

The proposed server calendar in `apps/api/src/core/business-calendar/business-clock.ts` imports that shared conversion helper and converts its exact integer milliseconds only after checking safe integer representability. The normalized range yields fewer than 360,000,000,000,000 milliseconds, below `Number.MAX_SAFE_INTEGER`; verify that bound before converting the integer milliseconds to Number for Luxon. Do not parse decimal hours through Number/parseFloat or hand fractional hours to Luxon. Validate input/output instant years and intermediate Baghdad business dates against 0001-9999 explicitly as well as checking Luxon validity; a valid library date alone does not establish the supported policy range.

Add this exact duration to the existing deadline by counting every Monday-Friday Baghdad hour and excluding Saturday/Sunday. The initial delay remains 72 counted hours, supplied internally as `"72"`; task windows, subscription expiry and new-dispatch normalization retain their separate rules. Return the resulting deadline as a validated UTC instant. Malformed/nonpositive input, fractional milliseconds and an out-of-range result produce bounded safe validation/precision/range failures without echoing raw input, returning a guessed deadline or changing the original deadline. No extension endpoint or authority to extend a withdrawal is added by P01.

Examples: `"1"` = 3,600,000 ms; `"1.5"` and `"0001.5000"` = 5,400,000 ms; `"0.0000025"` = 9 ms, including redundant trailing-zero spellings. Reject `"0.0000001"` = 0.36 ms and `"0.000001"` = 3.6 ms, plus `"0"`, `"00.000"`, `"-1"`, `"+1"`, `" 1"`, `"1e3"`, `"1,000"`, `".5"`, `"1."` and numeric `1.5`.

## Strict result projections

Proposed `walletComponentsSchema` is a strict object with only `availableReferral`, `reservedReferral`, `availableNonReferral`, `reservedNonReferral`, `total`, all canonical nonnegative strings. Exact sum of the four equals total, and total fits the supported bound. No numeric money, raw BigInt, inferred zero fallback or private fields.

Proposed `sourceAllocationSchema` is a strict object with `nonReferral`, `referral`, `gross`; both source amounts are nonnegative, gross positive, and their exact sum equals gross. It reports original allocation, not current withdrawal eligibility.

Proposed `financialOperationResultSchema` contains `operationId` and `walletId` UUIDs, one operation `kind` (CREDIT, PURCHASE_DEBIT, RESERVE, RELEASE, CORRECTION), UTC `recordedAt`, canonical magnitude `amount`, strict `walletAfter`, and an optional reservation object required only for RESERVE/RELEASE. Reservation has UUID `id`, original `allocation`, and state ACTIVE/RELEASED respectively. The server records `recordedAt` inside the transaction and exposes it only after successful commit; it is not PostgreSQL's measured commit instant. Correction retains its original reference in protected persistence, not an unrestricted output payload. Match discriminators/presence with strict object branches.

These are foundational internal mapped results; later wallet/history APIs design their own minimal authorized projections. A replay returns this immutable recorded financial result, not freshly sampled wallet values. Transport metadata such as whether the result was replayed belongs to the internal service, outside the stored result.

## Validation and compatibility

- Infer public types from schemas; no duplicated frontend/backend money business schema. Shared validation may use BigInt transiently for range/sum checks but returns JSON-safe strings only, without Node/Prisma/Luxon imports.
- Reject unknown fields in composed objects, including forged actor, role, eligibility, balance, fee, reward, deadline and payout state. These fields are not input defaults or writable merely because a result includes them.
- Keep existing account/auth/http exports and protocol intact. A future HTTP adapter uses current ResponseHelper/error envelope and separately parses domain data; no P01 endpoint status is claimed.
- Do not return raw Prisma/provider records, audit payloads, signing credentials, hashes, request-binding fingerprints or another owner's data. No global BigInt JSON override.

**Future acceptance**: `financial.schema.test.ts` exercises accepted/rejected boundary values, unsupported fields, signed zero, overflow, real dates/offsets, exact sum conservation, discriminator shape and absence of private fields; extension cases cover permitted leading/trailing zeros, exact small fractions and fractional-millisecond/type/grammar rejection. Proposed `business-clock.test.ts` verifies adding accepted extensions to the existing deadline, unchanged deadlines on rejection, supported-year overflow and identical Baghdad results under two host timezones. Existing contract regression suite must remain valid. These schemas and tests do not exist yet.
