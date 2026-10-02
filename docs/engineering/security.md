# Security and Authority Boundaries

Use this guide before implementing or reviewing identity, financial, custody,
file-access, or deployment changes. Read [backend standard](backend-standard.md)
for runtime ownership, [API contracts](api-contracts.md) for transport,
[data patterns](data-patterns.md) for persistence, and [testing](testing.md) for
verification. Controls reduce risk; they do not guarantee complete security.

## Existing Controls and Planned Work

The current API has bearer access-token verification, a database lookup of current
active/verified account state, role middleware, Argon2id password hashing, hashed
refresh/verification/reset credentials, refresh rotation, CSRF middleware, bounded
auth rate limits, Helmet, CORS allowlisting, and redacted request logging. These
owners live in `apps/api/src/middlewares/`, `modules/auth/`,
`infrastructure/security/`, `infrastructure/logger/`, and `core/config/`.

This baseline has important limits:

- `auth.middleware.ts` checks current account status and role, but does not check
  access-token session revocation. Deleting refresh rows does not immediately
  invalidate an already-issued access token.
- `core/config/auth.config.ts` currently defaults refresh, verification, and reset
  signing secrets to the access signing secret if their settings are absent,
  including in production. This must change before production release under S04.
- Current rate-limit factories have no shared store configured. Their limits are
  process-local; do not claim they coordinate multiple API processes.
- Financial models, admin invitations/production bootstrap, protected proof storage,
  TRON custody/signing, durable scheduling, and tested financial recovery are planned
  work. Admin fixture screens do not establish server authorization.

## Threats to Review

| Threat                                                              | Required boundary                                                         |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Forged browser balances, roles, terms, deadlines, or payout success | Server-derived decisions and database invariants                          |
| Cross-user reads, direct evidence access, or stale privileges       | Current identity, role, resource ownership, lifecycle checks              |
| Replayed/concurrent money commands or duplicate chain scans         | Atomic source ledger, business uniqueness, conditional transitions        |
| Timeout/crash during payment or loss of Redis                       | Persisted attempts/reservations, reconciliation, database scheduling      |
| Admin account, signer, or VPS compromise                            | Narrow signer authority, separated secrets, limits, audit, dispatch pause |
| Malicious uploads, URLs, provider payloads, or nested errors        | Runtime allowlists, safe file/egress boundaries, minimal projections      |
| Restoring a stale database or losing deposit keys                   | Recoverable off-VPS custody records, WAL recovery, fenced reconciliation  |

## Identity and Authorization

**S01 - The server grants permission.** Authenticate, then authorize every protected
API operation and direct file request. Use current server role/status, resource
ownership, and action-specific restrictions; never trust a submitted actor/owner ID,
role, balance, subscription, sponsor assignment, reward, fee, deadline, approval, or
payout result. Optional sponsor input at registration identifies a candidate only;
the service validates and fixes the relationship under the approved business rules.
Recheck changing restrictions/current object state at the transactional operation or
signing claim so a pre-read cannot authorize a raced write. Choose 404 versus 403
according to existence privacy and apply it consistently to resource and file access.

| Authority                          | Contract                                                                                             |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Public registration/login/recovery | Validated bounded input; no client-selected ADMIN role or privileged fallback                        |
| Employee                           | Current active/verified account, permitted action, own resources                                     |
| Administrator                      | Current active/verified ADMIN account and required action/reason policy                              |
| Single-use link                    | Only its declared user/action/address scope; expiry and atomic consumption                           |
| Worker/signer                      | Authenticated process authority over fixed durable operations, independent of browser/admin payloads |

**S02 - Preserve the shared authentication protocol.** Existing access tokens are
returned for bearer use; refresh tokens are carried in HttpOnly cookies, with a
readable CSRF cookie/header pair. Keep one frontend refresh owner and the existing
route-specific CSRF behavior. Authenticated writes already require CSRF in current
routes; cookie refresh validates CSRF when its refresh cookie is present. Do not
remove these checks by treating the transport as a different protocol. GET/HEAD
must not approve, purchase, reserve, reset, verify, or dispatch business operations.

Retain algorithm/issuer/audience/type verification, bounded expiry, and atomic
single-use credential consumption. Refresh rotation must preserve its absolute
expiry. Use Argon2id for passwords, not fast token hashes or reversible encryption.
Preserve the shared bounded password policy. Do not store tokens/passwords in browser
storage or persistent application caches. Sensitive OSCAR actions must verify current
session authority as well as account authority; define/test revocation semantics
without promising immediate access-token revocation from today's refresh deletion.

**S03 - Admin authority is explicit.** Administrators sign in with their own email
and password through the planned dedicated admin login screen, reusing shared auth
services. There is no public admin signup or client role selector. The first admin
uses a protected production bootstrap procedure; additional admins receive bounded,
single-use email invitations to set their own password. The existing optional seed
credentials are local-only and rejected in production; they are not the production
bootstrap. Admin deactivation must revoke the affected authority.

Material admin mutations require confirmation; sensitive financial/address/account
actions also require a server-validated reason. Bind the operation to current target
state and saved terms; derive audit actor/time from server context. Where the accepted
action policy uses current-password reauthentication, verify it directly at that
action. Follow [OWASP transaction authorization](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
for server enforcement and operation binding.

Any one administrator may authorize an administrative action. The owner excluded
admin 2FA and dual approval.
Do not add either as an implemented requirement. A compromised authorized admin can
perform allowed actions; audit does not prevent this. Preserve this residual risk,
restricted signer authority, operational limits, and independent money/security
review before launch.

## Secrets and Public Output

**S04 - Fail closed on secret/network configuration.** Production requires explicit
independent values for `AUTH_JWT_SECRET`, `AUTH_REFRESH_JWT_SECRET`,
`AUTH_VERIFICATION_JWT_SECRET`, and `AUTH_RESET_JWT_SECRET`. Reject missing,
placeholder, malformed, or shared-fallback production keys. The current length check
and fallback do not establish this policy. Custody, encryption, and signing secrets
must likewise have no development/test/default-key fallback. A testnet run must fail
if it resolves to mainnet; never silently substitute a network, token, or account.

Keep secrets out of source, command arguments, ordinary scripts, fixtures, dashboard
settings, browser bundles, `NEXT_PUBLIC_*`, API output, and logs. Load each process's
secrets only at its owning boundary. Passwords stay hashed; recoverable custody
material uses a maintained authenticated encryption primitive, random nonces,
validated key sizes, versioned ciphertext, and assignment-bound context. Protect
decryption material separately from ciphertext and backups. Define rotation/recovery
before depending on encrypted data; encryption on the same compromised host does
not defeat host compromise.

**S05 - Project allowed output and diagnostics.** Use explicit employee/admin
projections, stable safe error codes/messages, and correlation IDs. Never serialize
raw persistence/provider errors, stack traces, private proof contents, secret keys,
signed payloads, or internal storage paths. Existing log redaction is a baseline,
not proof that every new nested object/message is safe. Allowlist provider failure
fields before logging; sanitize secret-bearing URL queries, paths, and redirects
where applicable. Do not log raw request/response bodies for financial/file flows.

Prevent exposure through email-link previews, browser caches, component props,
analytics, DOM fields, build artifacts, and test reports. Production must not use
local console email previews. Serve credentials/private financial or evidence
responses with deliberate no-store/private policies; check actual proxy/browser
headers. Return paths must reject external, protocol-relative, backslash, control,
and credential-bearing destinations. See [frontend standard](frontend-standard.md)
for cache and browser handling.

## Money and Payment Safety

**S06 - Preserve exact source accounting.** Use bounded integer micro-USDT and exact
server arithmetic, with canonical decimal strings over JSON. Percentage calculations
use integer basis points and floor to one micro-USDT; verified deposit units remain
exact. The append-only ledger and available/reserved projections must commit
atomically through one financial service. Keep referral/non-referral provenance;
expiry changes spend/withdraw eligibility, not ownership. Release the exact reserved
source allocation once. Admin corrections are new audited entries with reason and
reference, never edits to receipts/history. Detailed constraints and formulas belong
in [data patterns](data-patterns.md).

Bind HTTP idempotency to actor/operation/payload and enforce business-source
uniqueness independently. Protect purchase/reward/deposit/reservation races at the
database write. Reject arbitrary balance/status patch endpoints. Task approval posts
one snapshotted reward; approval/rejection are final, without a later clawback flow.
One active withdrawal includes scheduled, signing, submitted, and unknown outcomes.
Redis, a screen, or a received job cannot create financial authority.

**S07 - Verify canonical chain evidence.** Use TronWeb/TronGrid inside protected
adapters. A supplied transaction ID, displayed symbol, webhook, explorer link, or
provider acknowledgement cannot authorize credit. Verify configured network,
allowlisted token contract, decoded recipient, raw amount, successful execution,
and the selected confirmed/solidified canonical receipt criterion. Deduplicate by
network + transaction ID + receipt log index; one transaction can contain multiple
eligible transfer logs. Preserve pagination/restart cursors and credit each valid
event exactly once through the atomic ledger. See
[TRON exchange wallet integration](https://developers.tron.network/docs/exchangewallet-integrate-with-the-tron-network).

Manual admin credits have separate audited identities and labels; they never
impersonate chain transfers. Deposits are automatically credited after verification,
including weekends, with no withdrawal-style hold or admin rejection step.

**S08 - Restrict custody and signing.** Generate independent deposit key pairs inside
the protected custody boundary. Before publishing an address, obtain acknowledged
recoverable encrypted off-VPS records linking key/address/employee assignment.
Do not reassign old addresses, expose employee private keys, or rely on a later
nightly backup to recover already-published keys.

The protected signer accepts only authenticated durable intents with fixed
operation/network/token/source/destination/amount and independent policy/resource
limits. There is no arbitrary signing or key-export endpoint. Persist attempt
identity, signed bytes, transaction ID, and broadcast intent before broadcast.
Persisted signing material is sensitive and stays out of general audit/log/API output.
Retry/reconcile the same attempt after a lost reply; do not create a new payment or
refund a reservation because of a timeout. Unknown outcomes remain active/reserved.
Replacement requires proof that the previous attempt cannot execute/succeed.
Settle only from verified successful canonical-final evidence.

Due employee payouts remain automatic when execution preconditions pass. Account
ban/block or admin destination replacement cancels only safely unsent scheduled
requests; a raced/in-flight attempt must reconcile and must never be sent-and-refunded.
Destination changes never redirect an existing request. Company treasury sweeps are
operator-triggered protected fixed-destination operations with persisted attempts;
manual capped resource funding does not add an approval step to employee payouts.
Keep limited treasury funds, basic alerts, and an emergency new-dispatch pause.

## Uploads, Network, and Recovery

**S09 - Proofs are private files.** Allow decoded PNG/JPEG/WebP only, maximum 5 MB per
uploaded file, with explicit decoded-dimension/resource limits and safe raster
processing. Validate content and successful decoding; extension/MIME/signature
checks alone do not prove safety. Reject active/arbitrary formats. Bound multipart
parts, bytes, temporary storage, processing time, and concurrent work at app/proxy
boundaries. The upload implementation must define the exact byte limit consistently.
See [OWASP file upload guidance](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).

Generate server storage names and prove resolved-path containment. Keep proofs out
of static/public directories; direct reads require the same current resource policy
as the API. Avoid public optimized-image URLs for private proofs. Set safe content
types, no-sniff, private caching, and appropriate download/preview headers. Handle
failed upload/submission replacement and orphan cleanup deliberately. Retain files
for at least 30 days from upload; pending-review proofs are exempt from age deletion.
Final age-expired files may be removed while submission/financial/audit metadata stays.

**S10 - Bound hostile requests and external I/O.** Retain auth/critical-action limits
and hash sensitive key components. Match trusted proxy hops to actual ingress;
untrusted forwarded IP/host headers must not grant permission or bypass limits.
Keep credentialed CORS origins explicit. Use parameterized database APIs and validated
query shapes; do not merge request objects into writes or construct shell commands
from input. TRON/email destinations come from validated server configuration, not
user-provided provider URLs. Bound timeouts, redirects, pagination, and response size.
Do not fetch private/metadata endpoints through an arbitrary URL import feature.

**S11 - Verify deployment and recover financial truth.** Use TLS at public ingress,
production cookie settings, compatible web security headers, private internal ports,
least-privilege non-root processes, and separately scoped API/worker/signer/database
permissions. API Helmet does not prove headers on Next.js pages. Keep inspector/debug
ports and secret-bearing source/build artifacts private. Review locked dependencies
against applicable advisories without unrelated upgrades.

Recovery must cover private assets, deposit assignments/keys, immutable signing
attempts, and PostgreSQL commits. Test off-VPS WAL/point-in-time recovery for
post-snapshot off-chain purchases, rewards, and adjustments; blockchain rescans cannot
reconstruct them. Fence financial writes and dispatch during restore, recover those
commits, reconcile chain activity/in-flight attempts, then resume. Never guess balances
or issue a replacement payment to fill a recovery gap. A VPS host compromise can
cross container boundaries; process separation is risk reduction, not a guarantee.

## Review Evidence

- Missing/stale identity, wrong owner/role, restrictions, alternate credentials,
  forged authority fields, and direct private file reads are denied.
- Duplicate/concurrent purchase, reward decisions, deposit logs, reservations,
  cancellation/signing races, and repeated release preserve final database invariants.
- Lost wakeups/Redis restart, stale jobs, crashes before/after broadcast, and unknown
  outcomes reconcile without duplicate payment, erased reservation, or guessed refund.
- Malformed/oversized/hostile images, path traversal, CSRF, return paths, and provider
  failures exercise the actual boundary and meaningful cleanup behavior.
- Sentinel secrets are absent from outputs, nested logs/errors, caches, email previews,
  browser bundles, and verification artifacts where applicable.
- Production configuration, controlled testnet behavior, key recovery, WAL restore,
  and dispatch fencing have actual evidence. Missing infrastructure is an unmet gate.
- Independent money/security review records findings and the accepted one-admin/no-2FA
  residual risk before launch. No review or test result is a security guarantee.
