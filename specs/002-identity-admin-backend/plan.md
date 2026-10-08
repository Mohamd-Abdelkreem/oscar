# Implementation Plan: P02 - Identity, Authorization, and Admin Backend

**Branch**: `001-financial-backend-foundation` (actual Git branch) | **Date**: 2026-10-03 | **Spec**: [spec.md](spec.md)

**Roadmap Phase**: P02 - Identity, Authorization, and Admin Backend

**Feature Directory**: `specs/002-identity-admin-backend` (verified pointer and specification)

**Input**: Clarified P02 specification, [roadmap](../../PLAN.md), [constitution](../../.specify/memory/constitution.md), [engineering guides](../../docs/engineering/README.md) and verified source/manifests. `setup-plan.sh` reports feature basename `002-identity-admin-backend`; no Git branch was created or switched.

## Summary

Extend the existing authentication backend with atomic employee/sponsor/zero-wallet registration, live stable-session authority, role-specific restrictions, administrator sign-in and lifecycle, protected irreversible bootstrap, single-use email invitations, transactional audit and strict production credentials. Preserve shared cookies/CSRF, password/token services, wire envelopes, package ownership and P01 financial history.

Use a stable `AuthSession` and common User locks, a singleton admin guard, immutable referral edges and versioned control commands. Email dispatch follows durable pending provisioning and has bounded, sanitized Resend transport; uncertainty never deletes an identity or grants authority. [Research](research.md) records decisions and alternatives; [data model](data-model.md) and [contracts](contracts/http-api.md) define the proposed implementation.

This command creates design documents only. No application changes, test passes, P02 implementation completion, frontend approval or deployment are implied. Research/design steps are internal to PLAN; they do not authorize another roadmap phase or Spec Kit command.

## Technical Context

**Language/Version**: TypeScript 5.9.3, Node `>=24 <25`, pnpm `>=11 <12` / package manager 11.17.0.

**Primary Dependencies**: Existing Express 5.2.1, Zod 4.4.3, Prisma/client/adapter-pg 7.9.1, jsonwebtoken 9.0.3, Argon2 0.45.1, express-rate-limit 8.6.1 and Resend 6.20.0. Native Node fetch inside the existing email adapter addresses the installed SDK's timeout/redaction gaps. No dependency/version/lockfile change is selected.

**Storage**: PostgreSQL 18.4 integration boundary. Extend existing User/RefreshToken and P01 Wallet ownership with sessions, admin setup/invitations and identity audit. No queue, outbox, private-file, signer or chain service is required for P02.

**Testing**: Existing Vitest 4.1.10, Supertest 7.1.4 and Testcontainers 12.1.0. API integration discovery is `src/**/*.integration.test.ts`; database discovery is `tests/integration/**/*.test.ts`. Real disposable migrated PostgreSQL proves constraints/atomicity/races; injected email HTTP doubles prove adapter boundaries. Docker and image access are required when those tests are executed.

**Target Platform**: Existing Node API and a proposed protected local application bootstrap CLI. Production deployment is separately authorized. No browser/framework source changes.

**Project Type**: Existing pnpm/Turborepo monorepo; affected owners are `apps/api`, `packages/contracts`, `packages/database` and, only for the proposed compiled CLI check, `scripts/assert-build-output.mjs`.

**Performance Goals**: No P02 latency/capacity SLA is approved. Bound lists to at most 100 rows, transaction waits/retries, link lifetimes, rate-limit windows and provider attempts/response sizes. Hash passwords outside locks and omit network calls from transactions. Do not claim measured capacity from this plan.

**Constraints**: Four explicit distinct production keys; current role/status/session/ownership checks; strict inputs and safe output; append-only audit; no admin 2FA/dual approval. Frozen frontend, no live provider calls/credentials, no financial mutation except zero-wallet provisioning, and P01 convergence required before implementation.

**Scale/Scope**: P02 only; multiple admins/accounts/device sessions supported. MemoryStore is planned only for an explicitly verified single API process. Multi-process deployment requires shared rate-limit enforcement before acceptance; no speculative Redis/custom limiter table.

## Constitution Check

_Evaluated before research and repeated against the completed design. PASS describes adherence of PLAN, not acceptance of unimplemented behavior._

| Principle                                   | Before research                           | After design and evidence                                                                                                                                                                                                                                      |
| ------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Scope/evidence                          | PASS                                      | Matching P02 pointer/spec; actual branch and proposed work distinguished; outputs confined to the plan suite. Source/manifests and installed APIs inspected.                                                                                                   |
| II — Frontend preservation                  | PASS                                      | Zero frontend work; missing admin login/invite/reason/recovery surfaces remain owner gates for P03. No fabricated destination or fixture identity.                                                                                                             |
| III — Ownership/design                      | PASS                                      | Existing auth/response/contract/database owners retained; focused sessions/admin responsibilities only; no new dependency, framework, generic outbox or speculative queue.                                                                                     |
| IV — Backend prerequisites                  | PASS for bounded PLAN; predecessor CLOSED | Owner-selected P01 read-only CONVERGE passed on 2026-10-03 with zero findings, reusing recorded database remediation evidence. P02 requirements review and implementation acceptance remain pending; P03 cannot integrate until the entire P02 backend passes. |
| V — Financial/custody invariants            | PASS                                      | Registration/backfill only create zero owned wallets; existing source amounts, ledger, reservations and financial audit intact. No payouts/custody/calendar/commission implementation claimed.                                                                 |
| VI — Current authority/protected boundaries | PASS                                      | Live sessions, locked actor/target checks, role-specific lifecycle, last-admin guard, safe secrets/Resend transport, explicit reasons and atomic audit designed. Accepted no-2FA/single-admin-action residual risk retained.                                   |
| VII — Verification/truthful completion      | PASS                                      | Concrete future test owners and real PostgreSQL/provider-boundary scenarios below; commands verified from manifests. PLAN documentation checks distinguished from reused P01 evidence and unperformed P02 tests.                                               |

No constitution exception is requested. Unmet evidence appears under [execution and integration gates](#execution-and-integration-gates). The same eight guides govern implementation and subsequent review.

## Project Structure

### Documentation (this feature)

```text
specs/002-identity-admin-backend/
  spec.md                     # Specification; unchanged by PLAN
  checklists/requirements.md  # Existing requirement markers; unchanged
  plan.md
  research.md
  data-model.md
  quickstart.md
  contracts/http-api.md
  contracts/operations.md
```

No `tasks.md` is generated by PLAN.

### Source Code (repository root)

This is a future ownership map, not a claim that proposed files exist:

| Responsibility                        | Existing targets                                                                                                                                                                                                                      | Proposed focused targets                                                                                                                       |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared wire schemas                   | `packages/contracts/src/auth/auth.schema.ts`, `account/account.schema.ts`, `http/http.schema.ts`, `src/index.ts`                                                                                                                      | `packages/contracts/src/identity/identity.schema.ts`, `admin/admin.schema.ts` and colocated tests                                              |
| Persistence/migration                 | `packages/database/prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`, `src/seed-config.ts`                                                                                                                                | Two forward P02 migrations and `tests/integration/identity-upgrade.integration.test.ts`                                                        |
| Shared auth/session lifecycle         | `apps/api/src/modules/auth/auth.service.ts`, controller/routes/rate-limiters, DTO aliases/types                                                                                                                                       | `apps/api/src/modules/auth/auth-session.service.ts` and `session-authority.ts` for reusable transactional authority                            |
| Own profile/employee controls         | `apps/api/src/modules/users/users.service.ts`, controller/routes/mapper                                                                                                                                                               | `apps/api/src/modules/users/employee-restrictions.service.ts`, sharing authority/audit helpers                                                 |
| Admin lifecycle/invitations/bootstrap | `apps/api/src/router.ts`, `modules/index.ts` composition                                                                                                                                                                              | `apps/api/src/modules/admins/`: thin routes/controller, lifecycle, invitation service, mapper, audit writer and `admin-bootstrap.cli.ts`       |
| Internal request authority            | `apps/api/src/middlewares/auth.middleware.ts`, `core/types/request-context.types.ts`, `core/types/express.d.ts`                                                                                                                       | Internal session context separate from safe public User                                                                                        |
| Safe request/error diagnostics        | `apps/api/src/infrastructure/logger/request-sanitizer.ts`, `logger.ts`, `middlewares/error-handler.middleware.ts`                                                                                                                     | Credential-referrer omission and bounded unexpected-error projection; preserve safe response codes/metadata                                    |
| Config/provider/OpenAPI               | `apps/api/src/core/config/auth.config.ts`, `auth-rate-limit.config.ts`, `email.config.ts`, `resend.config.ts`; `infrastructure/security/jwt.service.ts`; `infrastructure/email/`; `infrastructure/openapi/openapi.ts`; `.env.example` | Pure production-secret parser, invitation template and bounded Resend transport; example lists names/blank required values without credentials |
| CLI packaging                         | `apps/api/package.json`, `scripts/assert-build-output.mjs`                                                                                                                                                                            | Proposed `admin:bootstrap` invokes compiled CLI; emitted-entrypoint/no-test-artifact checks                                                    |

**Structure Decision**: Preserve thin HTTP composition, domain services and focused helpers, browser-safe contracts and database-owned invariants. Split session/email/transaction responsibilities where independently reusable; no mandatory empty layers. No `apps/web` target is authorized. Bootstrap stays outside public routing.

## Backend Design and Ordering

These are dependency groups for later task generation, not generated tasks or implementation authority.

1. **Persistence and contracts:** Historical-admin viability preflight before populated cutover; forward-only enum/schema changes, populated-history backfill, irreversible admin marker, immutable referral and audit protections. Retain legacy account exports for frozen callers and add strict required-field IdentityUser/IdentityUserData/IdentitySessionData schemas for API DTO aliases/OpenAPI, per the [HTTP compatibility decision](contracts/http-api.md#request-and-projection-rules). Confirm migration/seed/test-fixture compatibility in [data-model.md](data-model.md).
2. **Sessions and configuration:** Stable session creation/rotation/revocation and live middleware; internal session context; strict four-key parser. Retain default access 15 minutes, ordinary refresh 24 hours, remembered refresh 30 days, verification/invitation 24 hours, reset 30 minutes and verification cooldown 60 seconds. Expiry is exclusive and rechecked after locks.
3. **Registration/account:** Atomic User/sponsor/zero-wallet creation; current-purpose activation/reset; recovery never activates/restores; password reset/change/all-logout revoke every prior session. Current logout uses authenticated stable session despite cookie rotation. Profile writes only fullName/phone, with transactional authority recheck.
4. **Admin behavior:** Shared `/auth/admin/login`, protected first-admin CLI, guard-serialized lifecycle/invitation services, role-specific controls and stale-version conflicts. Admin denial revokes target sessions and outstanding issuer invitations atomically with audit. Preserve independent controls and every financial source/history value.
5. **Email/transport/OpenAPI:** Retain pending state on rejection/unknown send. Persist invitation attempt intent, send after commit and condition result on current generation/attempt. Validate provider success, sanitize diagnostics and update OpenAPI with shared routes/contracts. No outbox/expiry worker.
6. **Acceptance/regressions:** Add actual tests below, run focused then affected suites, complete security/code/test/docs review and record execution evidence. Only then assess P02 convergence/P03 readiness.

### Transaction and Failure Rules

- Admin guard first when changing admin population/invitations, including pending ADMIN email activation; then relevant User IDs ascending, sessions and refresh/invitation rows deterministically. Ordinary employee auth/profile starts at User. A preliminary immutable-role read may choose the admin path, but authority is rechecked under locks; never acquire the guard after User. Later financial callers must preserve P01 User → Wallet → allocation order and recheck session under that transaction; P02 does not add those callers.
- Recheck current password hash when comparison happened beforehand. Use server time after lock waits, strict expiry and exact hash/generation binding. JWT clock tolerance cannot extend persisted action/session expiry.
- Commit state, revocation and required identity audit together. Audit failure rolls back authority changes. Protected reads enforce live authority; consequential writes repeat it under lock.
- Interactive transaction maxWait is 5,000 ms, timeout 10,000 ms, at most three total attempts and zero deliberate retry delay. Retry only P2034 or verified known Prisma adapter error with driverAdapterError.cause.originalCode exactly 40001/40P01. Recheck authority/time/intent each attempt; stale versions, uniqueness/state/credential/provider errors are not transient retries. Generated-code collision has a separate exact-constraint maximum of three fresh-code attempts without delay. No password hashing or provider dispatch inside transaction retry bodies.
- Read-only credential validation/HEAD never consumes; explicit POST/PATCH performs actions. Invitation/refresh single-use comes from database competition, not browser locks.
- Client/provider acknowledgement loss means inspect saved state or request bounded replacement. Do not infer rollback, mailbox delivery or absent identity. Email retries reuse exact key/payload for one logical attempt; reissue invalidates old authority.
- Safe errors retain existing envelopes/codes. Never serialize database/provider error objects, tokens, hashes, submitted private payloads or secret values. Logs allow only safe operation/action/outcome/provider codes. Audit derives actor/time from trusted context and excludes credentials.
- Correct existing referrer/unknown-error leaks through the logger/error-handler owners: omit credential-bearing Referer and raw unexpected error objects/messages/stacks in every environment. Preserve existing pathname/query sanitation; validated client request IDs are correlation metadata, never audit authority.
- Refresh limits include a bounded source bucket before credential checks and a verified stable-session/source bucket (default 60 each per 15 minutes), so rotation cannot reset the entire budget. Current logout uses server session ID for its 30-per-15-minute bucket. Retain current credential-attempt buckets and share admin/ordinary login buckets.

## Verification Strategy

All paths below are future creation/extension work. No P02 behavior tests were run by PLAN. Tests exercise externally meaningful behavior and invariants.

| Owner and test files                                                                                                                                                                | Required evidence                                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **New:** `apps/api/src/modules/auth/oscar-auth.integration.test.ts`; **extend:** `auth.service.integration.test.ts`                                                                 | Employee-only registration; duplicate/concurrent normalized email; valid/invalid/self/cyclic sponsor attempts; one zero Wallet; failed provisioning rollback; code stability; retained pending state on known/unknown email; activation replacement/replay/expiry and no unsuspension.                                                |
| **New:** `apps/api/src/modules/auth/session-revocation.integration.test.ts`; **extend:** `auth.controller.test.ts`, `auth.service.test.ts`, `apps/api/src/app.integration.test.ts`  | Two sessions; rotation preserves access; single/all logout, reset/change/full denial first-request revocation; refresh/revocation and password/reset races; fixed expiry; no revival; cookie/CSRF behavior and profile-write race.                                                                                                    |
| **New:** `apps/api/src/modules/admins/authorization.integration.test.ts`; **extend:** `app.integration.test.ts`                                                                     | Valid ADMIN login; generic wrong/employee/disabled/unverified denial; anonymous/stale-admin access; own profile and mass-assignment denial; independent controls/stale versions; wallet/sponsor/history unchanged; self/last-admin/concurrent lifecycle protection.                                                                   |
| **New:** `apps/api/src/modules/admins/admin-invites.integration.test.ts`                                                                                                            | Competing bootstrap creates one pending admin/marker/audit; repeated bootstrap denied; unused-email conflict; invitation replacement/revocation/expiry/purpose/replay; accept vs issuer-deactivate; earlier acceptance retained; no password/email/role overwrite; generation delivery race, lost acknowledgement and audit rollback. |
| **Extend:** `packages/database/tests/schema-contract.test.ts`, `tests/integration/migration.integration.test.ts`; **new:** `tests/integration/identity-upgrade.integration.test.ts` | Fresh/populated P01 upgrade; enum commit ordering; missing Wallet/code backfill once; exact existing ledger/reservation/source/audit retained; sponsors null; legacy credentials invalidated; role/code/sponsor and session owner/expiry constraints; append-only audit and seed behavior.                                            |
| **Extend:** `apps/api/src/infrastructure/security/jwt.service.test.ts`; **new:** `apps/api/src/core/config/auth.config.test.ts`, `email.config.test.ts`                             | Session binding, wrong issuer/audience/purpose/algorithm, strict expiry; missing/short/placeholder/default/reused keys including six pairs, fallback denial, valid independent keys; Resend/company/HTTPS/invitation config and sentinel nonexposure.                                                                                 |
| **Extend:** `apps/api/src/infrastructure/email/email-delivery.test.ts`, `email.service.test.ts`, `infrastructure/openapi/openapi.test.ts`; **new:** invitation-template tests       | Fixed origin/no redirects, 10-second abort/64 KiB cap, same-key/payload retry, rejection vs uncertainty, malformed/truncated success, no secret/body/SDK logs; recipient URLs; API acceptance distinct from delivery; route/schema fidelity.                                                                                          |
| **Extend:** `apps/api/src/infrastructure/logger/request-sanitizer.test.ts`, `logger.test.ts`, `middlewares/error-handler.middleware.test.ts`, `app.integration.test.ts`             | Sentinel action/provider/signing credentials absent from real HTTP/logger query/referrer/success/failure paths; unknown errors expose no raw objects/messages/stacks; correlation IDs are not audit authority; refresh rotation cannot reset stable limiter budget.                                                                   |
| **Extend:** `packages/contracts/src/auth/auth.schema.test.ts`, `account/account.schema.test.ts`, `http/http.schema.test.ts`; **new:** identity/admin schema tests                   | Unknown-field denial; password policy; bounded code/reason/token/pagination; confirmation/version/control intent; role/status-safe DTOs; existing envelopes/field-error paths.                                                                                                                                                        |

Concurrency tests use separate real database connections and controlled barriers, not arbitrary sleeps. Check just before/at/after expiry and a lock wait spanning expiry. Inject transport faults and crash points after commit/before dispatch/after acknowledgement/before result persistence; doubles prove adapter behavior, not live deliverability. Cleanup only owned disposable data; never delete financial history or relax constraints to repair fixtures.

[Quickstart](quickstart.md) provides manifest-backed commands/prerequisites. Run focused files per bounded change, then affected API/contract/database suites and lint/types/build/output checks. Preserve P01 financial/calendar/ledger/migration regressions. Full roadmap checkpoints stay P05/P09/P12/P14/P15 and release; PLAN does not run them.

Before accepting production edits, apply the operating contract's security-best-practices, clean-code-guard, test-guard and docs-guard as applicable. P03 owns framework/browser skills and evidence after backend/surface gates.

## Execution and Integration Gates

- **Before P02 implementation:** P01 final owner-selected read-only CONVERGE passed on 2026-10-03 with zero findings: 74 requirements/acceptance criteria, 40 tasks, eight design areas and seven constitution principles checked, with predecessor tasks unchanged. Recorded completed tasks/67-test run were reused; no tests ran in that review. Review the corrected P02 requirements/checklist evidence before a separately selected implementation batch.
- **P02 completion:** Implement all FR/SC behavior in contracts/migrations/services/endpoints; build/validate protected CLI; pass actual acceptance/affected tests and resolve reviews. Missing Docker/integration evidence leaves acceptance open. A formatter/planned test/email double cannot establish production delivery/security.
- **Before P03 integration:** Backend gates pass; owner resolves missing admin login/invite/password-setting surfaces, confirmation/reason gaps, edit-admin email scope, fixture last-activity display and recovery copy/lifetime/admin reuse. UI remains frozen until that decision; no fabricated frontend destination.
- **Before launch:** Verify company/domain/sender/support, approved invitation URL, independent secrets and actual process/proxy topology/effective limits. Replicas require verified shared limiter. Accepted no-2FA/single-admin-action and compromised-host/admin risks remain for independent launch review. Deployment/real-money authorization separate.
- **Later domains:** Task/referral/withdrawal enforcement and unsent-vs-in-flight cancellation/refund stay P04/P06/P10-P11. P02 exposes current restrictions without changing reservations or redirecting/refunding payouts.

The owner-authorized correction resolves the prior compatibility, historical-lockout, recovery, bootstrap and confirmation findings in their owning artifacts. The companion contracts/data model now also define audit allowlists, page/count snapshots, exact retry bounds, action-link/version rules and delayed invitation outcomes. Requirements review is still pending; corrected design is not checklist approval or implemented acceptance. External evidence/owner gates stay open. The requested follow-up is read-only P02 ANALYZE; no P02 implementation is authorized.

## Complexity Tracking

No constitution violation is proposed. [Research](research.md) justifies the bounded stable-session, admin-guard, immutable-referral and provider-transport complexity. Open P02 acceptance/UI/deployment gates are requirements to satisfy, not exceptions justified by this section.
