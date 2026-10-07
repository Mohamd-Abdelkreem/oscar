# P05 Validation Guide

**Status**: P05 implementation is complete: T001-T092 are checked, backend Gate B passed before frontend integration, and final Gate F passed on 2026-10-06. See the Phase 9 evidence below for fresh checks, the corrected shared browser failure and reused backend evidence. Earlier failures and batch-only status remain historical records. Production/recovery/independent-review and release obligations remain later gates.

## Prerequisites and isolated setup

1. Use the repository root, Node >=24 <25 and pinned pnpm 11.17.0. Preserve P01-P04, unrelated working-tree changes and existing feature selection. Constitution/spec/plan must still bind `specs/005-proofs-tasks-codes-review`. Later IMPLEMENT also requires its checklist/analysis/predecessor gates and explicit task scope.
2. Backend integration needs Docker with PostgreSQL 18.4 image access. Existing API/database Testcontainers global setup creates disposable migrated databases; it requires pnpm's `npm_execpath`. Never substitute a developer/production database, SQLite or mocked transaction.
3. P05 file tests allocate a private temporary root and staging budget per scenario, inject storage/clock at existing `createApp` composition, use actual installed multipart/decoder children and release files/processes/DB clients on failure. The API manifest pins `@fastify/busboy` 3.2.2 and `sharp` 0.35.5. Native installation and resource evidence are recorded below; the design rationale remains in [research](research.md).
4. The browser harness starts a fresh real test API/database and built Next app per scenario using private IPC control, P05 fixed-clock/subscription/task/code fixtures, synthetic images and isolated storage; there is no production fixture endpoint. Chromium must be available to Playwright 1.63.0. Do not silently use real mail, external task fetches, testnet/mainnet or a live signer.
5. `PROOF_STORAGE_ROOT` and finite file budgets are implemented in the API proof configuration and documented in root `.env.example`. Local setup uses an absolute private root outside public/static/source; tests create theirs automatically. Actual ingress must cap aggregate multipart bytes separately from original file bytes; production resource/backup controls remain P11 obligations.

The accepted prerequisites are recorded, reused local P03/P04 results: P03 T001-T065; P04 T001-T078 with B/F complete and 1,178 fresh package tests plus 77 browser scenarios. Source paths and recorded-cache caveats are in research. Reverify affected foundations during implementation; this is not a fresh run or release approval.

## Implemented runtime and HTTP reference

`apps/api/src/server.ts` constructs `ProofsRuntime`, connects PostgreSQL and reconciles storage/lifecycle before listening. Shutdown stops private reads, intake and lifecycle work before disconnecting the database. Importing `createApp` or the router starts no scanner. There is no P05 worker or testnet profile.

Startup streams private filesystem entries in batches of at most 100 keys and queries only the matching database owners, with `take: 100`. It validates every file and completes temporary-byte accounting before orphan cleanup, then finishes all filesystem reconciliation batches before HTTP admission. Accepted READY/DELETING bytes are retained without counting them as temporary capacity; DELETED content is removed. A lookup, validation or late-batch budget failure keeps upload admission closed until a successful restart. Periodic lifecycle scans retain their existing 100-record limit.

| Setting                   | Validated behavior                                                                                                                                                                                                                        |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROOF_STORAGE_ROOT`      | Required absolute directory separate from, and not an ancestor of, the project tree. Storage rejects symlinks and unsafe containment; provision a private persistent directory supporting file/directory sync and same-filesystem rename. |
| `PROOF_PROCESSING_SLOTS`  | Positive integer 1..2; omitted means 2. Capacity remains held through stream/child/staging cleanup.                                                                                                                                       |
| `PROOF_STAGING_MAX_BYTES` | Positive integer from slots × 41,943,040 through 268,435,456; omitted means 268,435,456. Covers temporary data/reservations including leftovers, rather than accepted persistent-file capacity.                                           |
| `PROOF_INPUT_DEADLINE_MS` | Positive integer 1..30,000; omitted means 30,000, shortened by a stricter request deadline.                                                                                                                                               |

One multipart upload contains exactly `file` and UUID `commandId`. Input is at most 5,242,880 bytes; the aggregate request is at most 5,259,264 bytes, also capped by the existing `Caddyfile`. Fully decoded single-frame PNG/JPEG/WebP is re-encoded to metadata-stripped oriented PNG, at most 33,554,432 bytes, 8,192 per dimension and 16,777,216 pixels. The child has a five-second library timeout, ten-second supervised deadline and 128 MiB JavaScript heap. These are finite processing controls; measured native RSS is not an enforced OS memory cap.

The lifecycle scans up to 100 records without overlap every 60 seconds, uses 120-second leases and expires unfinished staging after one hour. Accepted proofs retain their immutable completed-upload age for at least 30 complete days; every evidence version of a pending submission and referenced illustrations remain exempt. Final removed bytes do not remove submission, decision, financial or audit metadata. Multiple API processes need coordinated budgets or independent capped roots. P11 still owns deployed CPU/memory/volume limits, private-file backups and tested financial/database/asset recovery.

Routes are relative to the configured API prefix (default `/api/v1`). `apps/api/src/infrastructure/openapi/openapi.ts` builds the live reference at `GET /openapi.json`; request/response fields reuse the exported shared schemas. The design contracts retain their original planning status; they are not execution reports.

| Runtime family             | Methods and paths                                                                                                                                                                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Employee work              | `GET /tasks/today`, `POST /tasks/:taskId/unlock`; `GET`/`POST /task-submissions`, `GET /task-submissions/:submissionId`, `GET`/`PATCH /task-submissions/:submissionId/evidence`.                                                                                      |
| Admin publication/codes    | `GET`/`POST /admin/tasks`, `GET`/`PATCH /admin/tasks/:taskId`, `PATCH /admin/tasks/:taskId/status`; `GET`/`POST /admin/task-codes`, `GET /admin/task-codes/:codeId`, `PATCH /admin/task-codes/:codeId/status`, `GET /admin/task-codes/:codeId/usages` and `/changes`. |
| Admin review               | `GET /admin/task-submissions`, `GET /admin/task-submissions/:submissionId` and `/evidence`, `POST /admin/task-submissions/:submissionId/review`.                                                                                                                      |
| Private intake/observation | `POST /proofs` (USER) or `/admin/task-illustrations` (ADMIN); each prefix has `GET /uploads/:commandId` and `POST /uploads/:commandId/cancel`.                                                                                                                        |
| Private metadata/content   | `GET /proofs/:assetId` and `/content`; `GET /task-illustrations/:assetId` and `/content`, with current owner/admin/task-history authorization and purpose filtering.                                                                                                  |
| Domain recovery            | `GET /task-commands/:commandId?kind=...`, `POST /task-commands/:commandId/cancel` with the original operation kind and literal confirmation.                                                                                                                          |

All protected operations use current authenticated account/session authority; writes require CSRF. JSON uses the shared envelope and validated DTOs. Upload returns 201 only for accepted metadata. Private binary success is `image/png`, bounded `Content-Length`, `private, no-store`, `nosniff` and a fixed inline filename, rather than a JSON envelope. Authorized permitted removal is 410/`PROOF_REMOVED`; missing retained storage is 503/`STORAGE_UNAVAILABLE`; foreign/wrong-purpose access stays 404. Excess upload bytes return 413, unsupported type/animation 415, invalid raster 400 and occupied admission slots 429.

Domain recovery returns `OBSERVED` for committed work or `CANCELLED` for an immutable unused-key fence. Upload recovery instead returns `READY` or `FAILED`; cancellation of absent/STAGING intake returns `FAILED` with `failureCode: UPLOAD_CANCELLED`. If READY won, its accepted metadata/availability survives cancellation. `NOT_OBSERVED` and upload `PENDING` remain uncertain: retain the original handle and deliberately observe or cancel it. Never automatically resend work or a file, infer money from a timeout, or release a guard from absence. After terminal resolution, refresh current authority/state and require deliberate new intent/file selection.

## Commands after backend implementation

These scripts and test paths exist in current manifests/source. Package-relative filters narrow the actual Vitest discovery.

```sh
pnpm db:validate
pnpm db:generate
pnpm --filter @template/contracts test src/proofs src/tasks src/task-codes src/task-submissions
pnpm --filter @template/database test
pnpm --filter @template/database test:integration
pnpm --filter @template/api test src/core/business-calendar src/modules/proofs
pnpm --filter @template/api test:integration src/modules/proofs src/modules/tasks src/modules/task-codes src/modules/task-submissions
```

`proof-retention.test.ts` must cover pure controlled-time policy; DB/file race and crash cases belong to `.integration.test.ts` discovery, such as `proof-storage.integration.test.ts`. There is no new worker/testnet script for P05.

Run affected existing session/ledger/subscription/wallet regressions as well:

```sh
pnpm --filter @template/api test:integration src/modules/auth src/modules/ledger src/modules/subscriptions src/modules/wallets
pnpm --filter @template/api lint
pnpm --filter @template/api check-types
pnpm --filter @template/contracts lint
pnpm --filter @template/contracts check-types
pnpm --filter @template/database lint
pnpm --filter @template/database check-types
```

Use the smallest relevant shared-file selections for intermediate batches, then all affected behavior at B. Recorded executed filters and results are in the evidence sections below. Missing Docker/private storage/native binaries or required evidence keeps B incomplete; unit doubles are not equivalent.

## Gate B scenarios

Use fixed Baghdad times and separate clients/connections with an explicit barrier for races. Inspect observable responses and complete persisted state, not helper calls. The [HTTP contract](contracts/http-api.md) and [data model](data-model.md) own field/state details.

| Scenario                                                                                                                                                                                                   | Required result                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fresh migration, populated P04 upgrade and repeated deploy                                                                                                                                                 | New constraints/tables exist; prior users/subscriptions/referrals/sources/history remain; direct incompatible state/ownership/date/final/snapshot updates fail.                                                                                                                   |
| Monday 2026-10-05 at 11:59:59.999, 12:00, 17:59:59.999 and 18:00 Baghdad; Saturday/Sunday                                                                                                                  | Only the inclusive-open/exclusive-close weekday window permits work. Browser/host clock/date/forged fields cannot override; no publication/paused work gives no invented opportunity.                                                                                             |
| Free/expired/unverified/task-blocked/banned/revoked versus withdrawal-only block                                                                                                                           | Forbidden new work has no unlock/claim/reward; withdrawal-only block still permits otherwise eligible work. Active owners can inspect accepted history after paid expiry/task restriction.                                                                                        |
| Wrong/paused/unrelated code; pause versus unlock; code case/whitespace/global/concurrent duplicate creation                                                                                                | No invalid successful usage. One accepted unlock survives pause; globally normalized duplicate codes conflict, including retained paused codes; repeated/different-code unlock does not inflate counts.                                                                           |
| Task instruction/link edit versus stale first submission; date edit versus first unlock/submission                                                                                                         | Current revision accepted atomically or stale conflict with no consumed claim. Move before participation or accept participation and prevent date change; no moved history/claim.                                                                                                 |
| Owned valid screenshot and true declaration; foreign/unready/illustration/forged input                                                                                                                     | Exactly one valid pending claim with captured content/subscription/reward/deadline and zero wallet/ledger change; invalid work consumes no claim.                                                                                                                                 |
| Two devices/keys and subscription upgrade versus submission                                                                                                                                                | Unique employee/date survives task/subscription/key changes; one effective snapshot, no second claim. Rejected accepted work retains the date.                                                                                                                                    |
| Pending replacement before/at cutoff, lost upload reply, review versus replacement                                                                                                                         | New evidence version only before original cutoff under current work eligibility; old evidence retained on failure. Review binds exact current evidence; stale review conflicts. No new claim/reward/declaration change.                                                           |
| Captured S1 submission, then O1/edit/expiry/employee ban                                                                                                                                                   | Current authorized admin approval adds exactly captured 2 USDT once as available NON_REFERRAL, preserving referral/reserved funds; employee ban stays effective.                                                                                                                  |
| Same-key changed payload, repeated/new-key approvals, approve/reject races                                                                                                                                 | One final decision and at most one reward operation; same-key mismatch conflicts. Final rejection credits/deducts zero and cannot later approve/resubmit; final approval cannot reverse/edit.                                                                                     |
| Controlled failure after dependent service write                                                                                                                                                           | Complete prior domain/command/review/ledger/posting/audit/wallet state remains unchanged, using actual service transaction.                                                                                                                                                       |
| Lost response/current auth changes                                                                                                                                                                         | Read original saved command/resource; no guessed failure, fresh financial key/retry or fixture result. Wrong role/owner/session cannot read commands, private metadata or bytes.                                                                                                  |
| Real PNG/JPEG/WebP at/above input/request/dimension/pixel/channel/output bounds, chunked bodies, duplicate parts, traversal/control names, false MIME, truncated files, APNG/animated WebP, active formats | Allowed boundary files decode safely; forbidden/over-limit input creates no READY asset/claim/reward. Exercise actual parser work bounds, explicit literal field-name checks, canceled input deadline and killed/reaped decoder; no unbounded waits/temp files/native exhaustion. |
| Storage write/sync/rename/read failure, child stall/crash, restart at lifecycle boundaries                                                                                                                 | Truthful unavailable/failed/pending results, durable observation and safe recovery, no phantom READY, no accepted-work metadata loss or slot leak. Stored output byte cap is checked while streaming.                                                                             |
| Proof <30 complete days; old unattached proof; all superseded/current evidence of old pending submission; final old evidence; cleanup/attach/review race                                                   | Younger accepted proofs and every pending evidence version remain readable. Old final/unattached proof may remove only after fence; retained metadata survives. Interrupted unlink resumes; missing retained file reports unavailable, not fake deletion.                         |
| Filtered/paged lists/usages/domain code audit                                                                                                                                                              | Correct authorized rows/counts from same snapshot, stable order/unique tie-breaker, bounded responses; no history truncation or invalid-attempt usage.                                                                                                                            |

### Native-resource acceptance workload

Use actual installed parser/Sharp children and synthetic files; record only fixture ID, input bytes, dimensions/pixels/channels/frames, expected outcome, host/Node/Sharp/libvips versions and numeric metrics. Never include actual private proofs or decoder dumps. Measure using the method and proposed empirical ceilings in [research](research.md#native-resource-acceptance-for-gate-b): <=512 MiB per normally completed child, <=1,024 MiB sum of the two children's retained high-water values and <=128 MiB sampled API RSS growth over a warmed idle baseline. Measure an isolated API process after initialization with no outstanding work; exclude fixture generation/test-runner/browser allocations. Normal-case final child high-water is mandatory. Forced exits label sampled metrics incomplete and establish termination/cleanup only.

1. Valid corpus: PNG RGBA 4,096×4,096; PNG RGBA 8,192×2,048; JPEG 8,192×2,048 with orientation metadata; single-frame alpha WebP 4,096×4,096. Each actual fixture must be within 5,242,880 input bytes and produce allowed canonical output <=33,554,432 bytes. Record generated facts rather than assume compression/size.
2. Hostile corpus: bounded JPEG/WebP whose actual canonical PNG exceeds the output cap; >16,777,216 declared pixels; width/height >8,192; malformed/truncated compression; APNG; animated WebP. Verify fixture preconditions. Retain exact/+1 input/body/output-writer and format/channel/frame boundary cases from T015 even when a valid allowed format cannot encode a particular over-limit channel shape.
3. Run once sequentially, then ten explicit barrier-controlled two-slot rounds alternating the largest valid PNG/WebP and oversized-output/malformed cases. While both processing leases are held, a third request must receive 429 without launching another decoder. Collect observations from admission through child close and cleanup; do not inflate timeouts or retry failed fixtures.
4. Every failure leaves no READY asset, daily claim or reward, preserves prior accepted evidence and reports the documented bounded error. Enforce <=30-second input, five-second library and ten-second whole-child deadlines; verify termination/reaping, released slots/reservations and removal of unaccepted temporaries. Injected crash cases may retain only durable reconcilable STAGING records/files within the 256 MiB root budget and 40 MiB per-upload reservation.
5. An observed ceiling breach, unexpected allocation failure/OOM/crash, invalid/absent normal metric, extra decoder or leaked capacity fails B. Deliberately injected stall/kill/crash cases are identified separately and require safe failure/recovery, not a fabricated successful peak-memory result. Sampled RSS is not an enforced native cap; P11 owns production OS/container limits.

### Terminal resolution acceptance

Use separate PostgreSQL connections and deterministic lock barriers against the actual services. Cover dropped-before-arrival and rolled-back/rejected commands, cancel winning before late execution, execution winning before cancel, duplicate concurrent cancellations, same-key changed payload, and a lost cancellation response. Assert one COMMITTED outcome or immutable CANCELLED fence; a cancelled key can never execute later, and cancellation of committed review cannot reverse status or money. GET NOT_OBSERVED never retires the guard. Current wrong role/owner/revoked session receives no private outcome.

For each upload purpose, test cancellation before identity registration, during STAGING/decode, after rename/before READY, READY winning the race, duplicate/lost cancellation and restart after cancellation. FAILED/UPLOAD_CANCELLED blocks late READY and releases processing capacity only after actual cleanup/reaping. READY remains accepted and retains its original >=30-day/pending retention; removed accepted files have truthful availability. An absent-request marker has no invented hash/path/upload timestamp. Require deliberate fresh eligible read/reconfirmation or file selection before any new key; no automatic business/upload resend.

**Gate B passes only when** the entire proof/task/code/review backend and its contracts/migrations/lifecycle plus these mandatory test outcomes and affected checks pass. Record actual commands, fresh versus cached results and unavailable services. B passes before the first dependent frontend edit; it does not complete P05.

## Commands after Gate B and frontend implementation

```sh
pnpm --filter @template/web test src/features/employee/components/tasks src/features/employee/api/tasks src/features/employee/hooks/tasks src/features/employee/hooks/use-task-submission
pnpm --filter @template/web test src/features/admin/components/tasks src/features/admin/components/codes src/features/admin/components/submissions
pnpm --filter @template/web test src/features/admin/api/tasks src/features/admin/api/task-codes src/features/admin/api/task-submissions src/features/admin/hooks
pnpm --filter @template/web test src/features/proofs src/shared/query src/services/api
pnpm --filter @template/web lint
pnpm --filter @template/web check-types
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm build --concurrency=1
pnpm verify:build-output
pnpm --filter @template/web test:e2e e2e/tasks-codes-and-review.spec.ts
pnpm --filter @template/web test:e2e e2e/identity-and-admin-access.spec.ts e2e/wallet-and-ledger.spec.ts
```

The existing browser fixtures start the built Next app, so build first. Reuse relevant P03 identity/transport and P04 wallet/ledger/query/finance tests; do not alter their existing assertions or substitute fake upload/review success. Root build may reuse unchanged Turbo cache; disclose that separately from newly executed browser/package results. Broaden checks only for relevant changes/failures. P05 is not a full-current-regression checkpoint; those remain P04/P07/P09/P10/P11. Root `pnpm verify` includes a writing `db:format`, so never use it blindly on unrelated dirty work.

## Gate F journey and UI evidence

1. Current admin signs in through existing `/admin/auth/login`, creates a weekday task and actual bounded illustration, inspects task/detail/edit, creates a code, visits code list/detail/successful usage/audit and confirms pause/enable through existing surfaces. Date/hours are constrained; task edits use revision conflicts without rewriting captured claims.
2. Current paid employee sees server-authoritative upcoming/open/holiday/restricted state, unlocks with a real associated code, selects and uploads a real screenshot, affirms declaration and submits. Reload shows pending evidence/declaration/captured reward and unchanged available funds. Code pause preserves accepted unlock. Real binary reads stay private.
3. Replace pending evidence before cutoff and reload. Another-session replacement during admin review causes evidence conflict/review refresh. Review popup shows actual current screenshot, declaration, accepted instructions/link and captured reward. Distinct confirmation/reason precedes final approval or rejection; pending guard survives close/remount.
4. Reload both roles and inspect existing wallet/ledger. One approval adds the captured amount once; pending/rejected work adds/deducts zero. Final work has no resubmit/edit/reversal path, and permitted removed evidence is unavailable with retained history.
5. Exercise safe input/conflict/unknown/network/storage states, history paging and filter counts. Switch accounts/resources/logout while private read/upload/command is outstanding; old bytes/object URLs/completions cannot populate the new view. Observe original uncertain command/upload rather than issue a new financial intent.
6. Verify all nine P05 routes on phone/desktop and focused 320px forms/review/dialogs, with representative 390/430px phones. Preserve Cairo/RTL/light/section order/routes/navigation and C1/C2 boundaries. Check keyboard focus/restoration, inline labels/icons, LTR code/amounts, visible actions/bottom-nav clearance and no page overflow, clipped content, unexpected console errors or privileged employee requests.

Component/adapter tests must also prove malformed successes, false empty/zero fallbacks, final-action guards, no automatic mutation retry, accurate copied wording and blob cleanup. Real browser persistence/authorization cannot be replaced by jsdom or mocked routes. Use synthetic proofs and the existing safe reporter; no private bytes/tokens/raw command payloads in diagnostics.

**Gate F passes only when** B was evidenced first, all nine route workflows and required component/adapter/browser/affected regression checks pass within accepted presentation authority. Missing browser/Docker/storage or any required unexecuted check leaves F incomplete. No production/recovery/mainnet/security guarantee follows.

## Preimplementation cycle review - 2026-10-05

The owner authorized bounded amendments for ANALYZE U1/U2/I1, task alignment and all-item quality review before implementation. Independent backend/frontend/coverage reviews support the amended criteria; all 16 SPECIFY and 38 custom checklist questions are approved for requirements/design quality. The complete merged P05 stays on its existing feature; all 92 implementation task IDs/unchecked markers remain intact. Final docs-guard and read-only ANALYZE validate the amended suite.

Fresh availability checks reported Node 24.18.1, pnpm 11.17.0, a responding Docker 29.1.3 server, cached postgres:18.4 image and installed Chromium artifacts. Node's RSS/maxRSS metric APIs are available locally. These are environment observations, not P05 acceptance tests or a native decoder installation claim. The selected API-direct parser/Sharp installation and actual native checks belong to T017; private fixtures/roots and compiled harness changes belong to their implementation tasks.

Git Bash setup-plan reused the existing plan without copying its template; setup-tasks resolved the existing task template and correct feature. Both preserve the pointer. Application tests, migrations, dependency installation, builds, browser journeys, Gate B/F and release checks did not run in this cycle. The next action is an owner-requested IMPLEMENT with explicit TASK_SCOPE, starting at T001-T002 or NEXT_DEPENDENCY_SAFE_BATCH; no implementation is authorized by this validation guide.

## Phase 3 implementation evidence ? 2026-10-05 (complete)

Selected scope **T015-T031 is complete**. All 17 task markers are checked. This completes US3's private evidence subsystem; T032-T092 and Gate B/F remain incomplete. Feature selection, requirements approvals, constitution, roadmap, prior migrations and approved UI were preserved. No extension hooks exist.

### Runtime and verified boundaries

API-direct Busboy 3.2.2 and Sharp 0.35.5 process exactly one file and one UUID commandId. Authentication, role, CSRF and action limits precede multipart consumption. Counted limits are 5,242,880 input bytes, 5,259,264 aggregate request bytes and 33,554,432 output bytes. Actual boundary tests include exact/+1 input/request/output-writer sizes, chunked/truncated/duplicate/unknown parts, unsupported compression, malformed boundaries, control/traversal names and spoofed formats. Only decoded single-frame PNG/JPEG/WebP succeeds; APNG, animated WebP, SVG/GIF, malformed data, excessive dimensions and pixels fail safely. The supervised child applies auto-orientation, removes input metadata, uses cache-off/concurrency-one/five-second library timeout, a 128 MiB JavaScript heap and ten-second whole-child kill/reap deadline.

Server-generated private keys use exclusive files, file/directory fsync and atomic same-root directory publication before READY. Root ownership/permissions, symlink/escape/collision rejection, two held slots, 40 MiB reservations and 256 MiB leftover accounting were exercised on an actual Linux filesystem. Node's Windows directory fsync is unavailable, so Linux owns durability acceptance; the supported development TypeScript decoder path separately passed on Windows. Deployment requires a pre-created private directory outside the repository and a filesystem supporting directory fsync; server startup validates PROOF_STORAGE_ROOT before listening.

Purpose-bound intake records immutable byte hashes/completed-upload ages and processing leases. Cancellation serializes through current actor/session and asset locks, fences unused/STAGING keys, preserves accepted READY/DELETING/DELETED assets, and aborts/reaps active work before releasing capacity. Same-byte replay returns the original asset; changed bytes conflict. Original-session revocation, failures before/after rename, READY commit failure and lost commit response were exercised. Failed cleanup retains capacity, with later reconciliation releasing it without unlinking accepted bytes.

Metadata and binary reads recheck current identity and purpose/resource authority. Current owners retain proof history after paid expiry/task restriction; foreign/wrong-purpose access is 404, authorized removed content 410 and missing retained bytes 503. Current admins can inspect proofs after owner ban. Illustration reads require current referencing-task or own accepted-history authority; unattached illustrations remain admin-only. Canonical content has fixed image/png, private/no-store, nosniff and inline image.png headers. Actual createApp HTTP cases cover both confirmed cancellation routes, revoked/wrong-role/foreign sessions, denied bytes before parser work, strict input and path/secret-free errors.

Pending replacement locks actor/session, task, submission and asset, rechecks current paid work, expected version and original cutoff, appends evidence and advances only version/pointer. Captured declaration/content/subscription/reward/date/deadline and old evidence remain unchanged. Independent PostgreSQL lock barriers prove cutoff reached while waiting and both attachment-versus-cleanup winners; wallets and financial operations are unchanged. Every historical pending evidence version and referenced illustration remains exempt. Thirty-day eligibility, leased DELETING unlink/retry, final removal, unavailable retained bytes and metadata preservation were exercised against actual PostgreSQL/files.

Lifecycle scans are nonoverlapping, limited to 100 records every 60 seconds, use 120-second leases and expire unfinished STAGING after one hour. Startup reconciles ownerless and expired pre/post-rename data, retained/deleted ownership and interrupted cleanup before HTTP admission. Shutdown stops admission/scans/streams, aborts intake and reaps children before database disconnect. Restart probes cover reserved/input/output/published/cancelled stages. Deliberate native crash, ten-second stall/kill and shutdown during parser/child work leave no phantom READY, revived FAILED, missing accepted file or unreleased slot.

### Fresh checks and regression evidence

| Verification                           | Result                                                                                                                                                     |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API test                               | 30 files, 317 unit tests passed, including 18 proof-config and ten retention-policy cases.                                                                 |
| US3 integration discovery              | All seven owning files passed across final combined execution and focused follow-ups: nine grouped cases, each containing actual boundary/race assertions. |
| Final decoder integration              | Two cases passed: development TypeScript child and emitted Linux ESM/native multipart/decoder corpus.                                                      |
| Final storage integration              | Two cases passed: actual filesystem/admission/restart and independent-client attachment/cleanup race winners; exact/+1 32 MiB writer cases included.       |
| Final lifecycle integration            | One grouped case passed; JSON report at apps/api/node_modules/.cache/p05-lifecycle-final-results.json.                                                     |
| Final resource integration             | One case passed with deterministic corpus, ten barrier-controlled rounds, third-admission 429, cleanup and unchanged wallet/operation assertions.          |
| Final cancellation integration         | One case passed, including both purposes and duplicate concurrent cancellation through independent database clients.                                       |
| App/auth/task-command regression       | 41 tests passed in three owning files.                                                                                                                     |
| API lint, check-types and build        | Passed against final source; no linter/test guard disabled.                                                                                                |
| pnpm verify:build-output               | Passed: eight required entries, including emitted decoder child; 562 emitted files contain no test/fixture artifacts.                                      |
| Scoped formatting and git diff --check | Passed.                                                                                                                                                    |

Executed integration commands used pnpm --filter @template/api test:integration with the seven proof-*.integration.test.ts owning files, then focused repeats of proof-decoder, proof-storage, proof-lifecycle, proof-resource, proof-access, proof-retention and proof-cancellation as changed cases/failures required. Tests used disposable PostgreSQL 18.4 and Linux Node 24.18.1 containers with actual files/Sharp 0.35.5/libvips 8.18.7; no developer database or fake business-success route. Temporary containers and roots were removed after completion. Build-output checks cover emitted production files; integration harness snapshots prevent a subsequent build from invalidating a live bind mount.

An initial combined run passed 8/9 cases; its cancellation test's artificial 50 ms intake deadline expired while the real PostgreSQL fence was pending. The corrected final lifecycle run uses the documented 30-second input budget for cancellation and a separate short-deadline stall probe, and passed. Earlier expanded multipart tests caught an unhandled file-stream truncation error and a teardown error masking the 413 cause; both were fixed before the passing decoder rerun. Resource-fixture attempts that failed hostile WebP preconditions were rejected, not counted as resource evidence. A first cleanup-race harness missed transitive blockers; the final barrier observes direct/transitive PostgreSQL waiters. The scanner also avoids a redundant READY lock/release before its deletion claim. Existing broader Phase 2 API regression limitations remain recorded in tasks.md; no full-current API regression pass is claimed.

### Native resource observations

The final isolated API process initialized the actual app/runtime and warmed an upload before measuring. A separate fixture-generation child exited before the idle baseline; test-runner/browser/fixture-generator allocations are excluded. Baseline RSS was **212,070,400 bytes**, sampled peak **244,662,272**, growth **32,591,872** against the 134,217,728-byte ceiling. Largest retained child observation was **336,957,440 bytes** against 536,870,912; largest two-child retained sum **502,435,840** against 1,073,741,824.

| Fixture             | Input bytes | Verified facts / canonical bytes                                                                           |
| ------------------- | ----------: | ---------------------------------------------------------------------------------------------------------- |
| square.png          |     341,726 | RGBA 4096?4096; 341,726 canonical bytes.                                                                   |
| wide.png            |     332,184 | RGBA 8192?2048; 332,184 canonical bytes.                                                                   |
| oriented.jpeg       |      99,260 | 8192?2048 with orientation 6; output 2048?8192, 241,335 canonical bytes and no input metadata.             |
| alpha.webp          |      30,610 | Single-frame alpha 4096?4096; 341,629 canonical bytes.                                                     |
| hostile.jpeg        |   4,336,320 | 4096?4096; actual unconstrained canonical output 49,018,621 bytes, rejected by counted output limit.       |
| hostile.webp        |   4,142,110 | Alpha 4096?4096; actual unconstrained canonical output 66,441,056 bytes, rejected by counted output limit. |
| too-wide.png        |         132 | Width 8193, height 1; rejected.                                                                            |
| too-many-pixels.png |      75,763 | 4097?4096 = 16,781,312 pixels; rejected.                                                                   |
| animated.png        |         202 | APNG with two declared frames/frame controls; rejected.                                                    |
| animated.webp       |         202 | Decoder metadata confirms two pages; rejected.                                                             |
| malformed.png       |          94 | Truncated terminal PNG chunk; rejected.                                                                    |

The corpus ran sequentially, followed by ten two-slot rounds alternating largest PNGs, alpha WebP, oversized-output and malformed workloads. Each held both parser reservations before third admission; the third received PROOF_PROCESSING_BUSY/429 with no extra decoder. **32 actual child observations** were retained. Every normally successful child acknowledged numeric PID-bound final maxRSS before exit. Forced output-limit/invalid teardown observations were labeled partial; deliberate crash/stall supervision was measured separately in lifecycle tests. Detailed safe numeric observations are in the test-generated OS temporary file oscar-p05-resource-observations.json. Sampling is empirical evidence, not OS enforcement; P11 still owns production memory/CPU/volume/backup controls.

### Separately authorized dependency remediation

The owner answered ?do recommended? to the separate security update after the production audit identified critical Next advisories. Next and eslint-config-next are pinned to **16.3.6**; the approved lockfile change also moves Next's transitive Sharp to 0.35.5, an explicit exception to T017's original preservation instruction. Frozen installation passed. The fresh production audit reports zero critical, 20 high and 20 moderate findings; other upgrades were not part of this remediation.

Fresh web lint/types/unit/build passed (60 files/378 tests, Next 16.3.6 production build). The repeated existing support-smoke/auth-account browser run passed all 20 scenarios after correcting the API Busboy import. No web page/component/style/route changed. These are the approved dependency-remediation checks, not P05 frontend/Gate F evidence.

### Review closure

Applied speckit-implement, security-best-practices, clean-code-guard, test-guard and docs-guard. Installed Next/Vercel guidance and playwright were used for the separately authorized dependency checks. Final production guard fixes:

- proof-upload.service.ts ? separate persistence transitions/cleanup from streaming and reread the cancellation fence after locks; cleanup errors use bounded public codes.
- private-image-storage.ts ? recover abandoned accepted reservations without removing retained bytes.
- proof-lifecycle.service.ts ? avoid repeated FAILED-row starvation with a bounded cursor and claim READY deletion without a redundant unlock interval.
- proof-read.service.ts ? pass ISO instants to the calendar and support shutdown cancellation of private streams.
- multipart-image-upload.ts ? attach file errors before asynchronous opening and preserve counted-overflow/cancellation causes during iterator teardown.
- image-decoder.ts ? report unavailable crashed native processing truthfully and reap before returning.
- proofs.runtime.ts ? sanitize startup storage failures and reconcile leftover bytes of already DELETED assets.
- proofs.routes.ts ? keep illustration intake/observations and authenticated task reads on their contracted namespaces.

**clean-code-guard: 8 fixed, 0 flagged for author.** Test review retained real system-boundary fault injection, deterministic SQL barriers, explicit synthetic historical fixtures, finite deadlines, resource preconditions and cleanup. Documentation references were checked against actual code/scripts/results. No convergence, next roadmap phase, frontend integration, deployment, commit/push or real-funds operation ran.

## Phase 4 implementation evidence — 2026-10-05 (US4)

Selected scope **T032–T042** implements the backend for publication and code administration. P05 remains incomplete: employee acceptance/unlock and final review, including the participation/pause races at T046/T050, and Gate B/F are still outstanding. The next dependency group is Phase 5, T043–T050, requiring a separate owner request. Existing frontend files and requirements approvals were preserved.

### Implemented behavior

Confirmed task creation, revision-checked editing and state changes retain one weekday publication date across all states. Actor/session, task/date and illustration locks protect accepted writes; dates cannot move after first participation. Existing captured submission content and the participation marker remain unchanged. Ready illustrations require the correct purpose and present private bytes before new attachment. File checks occur outside database transactions; detail/list and committed replay/observation report unavailable retained images truthfully.

Confirmed code creation uses the shared trim/uppercase normalization and global retained uniqueness, including paused and non-ASCII codes. Task association and normalized text cannot change. State commands check the expected version and append actor/time/state audit without accepting a reason. Named date/code uniqueness failures become TASK_DATE_OCCUPIED/CODE_ALREADY_EXISTS; unrelated database errors are not relabeled or blindly retried.

Admin projections use explicit DTOs, bounded pages, deterministic ordering and RepeatableRead rows/count snapshots. Task counts include all linked codes, successful unlocks, submissions and approved submissions. Code usage contains persisted successful unlocks only, with nullable actual employee/date submission status; replay and invalid attempts add no usage. Audit pages contain committed code actions and safe actor fields.

The actual createApp router exposes /admin/tasks, /admin/task-codes and /task-commands observation/confirmed cancellation. Current authority, owned unrevoked sessions, CSRF, strict shared schemas and process-local actor limits apply. Successful private responses carry private/no-store. Fresh creation returns 201, replay 200. Cancellation follows the operation-role matrix and fences unused keys without reversing accepted work. OpenAPI documents the registered methods and response schemas; no DELETE, reassignment, reward-edit or reversal API was added.

### Fresh verification

Commands run from the repository root:

```powershell
pnpm --filter @template/api test src/core/business-calendar/business-clock.test.ts src/infrastructure/openapi/openapi.test.ts src/modules/auth/session-authority.test.ts
pnpm --filter @template/api test:integration src/modules/tasks/tasks.integration.test.ts src/modules/task-codes/task-codes.integration.test.ts src/modules/tasks/task-commands.integration.test.ts
pnpm --filter @template/api test:integration src/modules/tasks/tasks.integration.test.ts -t "keeps rows and totals"
pnpm --filter @template/api test:integration src/app.integration.test.ts src/modules/auth/auth.service.integration.test.ts
pnpm --filter @template/api test:integration src/modules/proofs/proof-access.integration.test.ts
pnpm --filter @template/api lint
pnpm --filter @template/api check-types
pnpm --filter @template/api build
pnpm verify:build-output
```

- Clock/OpenAPI/session authority: three files, **64 tests passed**, including the existing subscription/withdrawal calendar regressions and exact weekday opening/cutoff/weekend outputs.
- Publication/code/command integration: three files, **20 tests passed**. These include real authenticated HTTP and independent PostgreSQL clients for date/code/edit conflicts, safe receipts/cancellation, immutable historical fixtures, bounded filtered pages and actual Linux private-storage/canonical-upload illustration checks.
- Added concurrent rows/count snapshot test: **one passed**, six other task tests deliberately excluded by the name filter. A PostgreSQL table-lock barrier held the aggregate read after its authority snapshot; a concurrent task insert appeared only in the next read. Together with the combined run, all seven publication cases passed.
- App/auth regression: two files, **31 tests passed**.
- Real-file proof-access regression: one file, **one grouped test passed**, covering private canonical content and both purpose-specific cancellation routes.
- API lint, check-types and build passed against the final production changes. Build-output verification found eight required entries and **584 emitted files without test artifacts**.
- Scoped Prettier checks and `git diff --check` passed. Out-of-scope task lines, feature pointer, constitution and checklist approvals compared unchanged. No extension hook file exists; both hook checks were skipped.

Tests use disposable migrated PostgreSQL and, for illustration availability, the real emitted Linux API/storage/decoder runtime. Synthetic pending claims and successful unlock rows verify historical preservation and query totals; they do not establish US1 unlock/acceptance or US2 review completion. No developer database was used. Earlier attempts exposed an authentication middleware cache-header overwrite, an equal-timestamp audit fixture ordering assumption and the concurrent date uniqueness error; these were corrected before the passing runs. One Docker HTTP 500 setup attempt ran no tests and is not counted as a pass.

### Review closure

Applied security-best-practices, clean-code-guard, test-guard and docs-guard. Guard fixes were: tasks.routes.ts/task-codes.routes.ts set private cache headers after authentication; tasks.service.ts maps live file availability after its database snapshot without per-row metadata queries; task-command.service.ts refreshes illustration availability after receipt transactions; task-codes.mapper.ts selects only safe audit actor fields; task-unique-conflict.ts maps only the concrete date/code uniqueness constraints. **clean-code-guard: 5 fixed, 0 flagged for author.** Test review preserved real database/filesystem boundaries, explicit synthetic historical fixtures, specific losing-race errors, strict response parsing and finite barriers. Documentation symbols, routes, statuses and commands were checked against the source and executed results. No next phase, convergence, frontend integration, deployment or commit/push ran.

## Phase 5 implementation evidence — 2026-10-05 (US1)

Owner-selected scope **T043–T050** is complete. P05 still has **42 unchecked tasks, T051–T092**; final review/reward posting and frontend integration remain unimplemented, and Gate B/F remain incomplete. This batch does not authorize their execution. Requirement checklist approvals and the selected feature pointer were preserved.

### Implemented behavior

Employee today reads use the server Baghdad calendar, current account/session authority, effective saved subscription terms and separate task/withdrawal restrictions. Free and expired accounts have no prospective reward; accepted history remains accessible to its authorized owner after expiry or task restriction. An eligible withdrawal-blocked employee can still work. Missing, holiday, upcoming, paused and closed opportunities have truthful unavailable states.

Durable unlock checks the current revision, open publication, eligibility and associated enabled code after locks. One successful employee/task/date unlock survives code pause, does not inflate usage on replay or another key, and sets first participation without claiming the date or changing funds.

First acceptance requires an owned READY proof with present private bytes and a true execution declaration. Compatible user/session/task/asset locks serialize current revision, calendar, subscription and daily-claim checks. Acceptance captures task content/revision, saved subscription terms, exact reward, declaration and original cutoff with evidence and the domain receipt in one transaction. It never credits the wallet or writes a reward operation. Concurrent devices/keys cannot acquire another claim; upgrades cannot replace the winning captured terms. Date edits cannot move participated work.

Explicit employee/admin projections preserve accepted snapshots, actual decisions and bounded evidence history. RepeatableRead list rows/counts/status totals share the applicable filters and deterministic ordering; admin-only actor/reason fields do not enter employee details. Private availability is checked outside database transactions. Pending replacement retains claim/reward/declaration/cutoff and old evidence; final work and the exclusive cutoff prohibit replacement. Saved submission outcomes retain their original snapshots and evidence while observation refreshes availability and current replacement permission.

The actual createApp router registers `/tasks/today`, `/tasks/:taskId/unlock`, `/task-submissions`, own detail and evidence GET/PATCH. It reuses `/task-commands/:commandId` observation/cancellation, current USER authorization, CSRF on mutations, strict schemas, bounded actor limits and private/no-store responses. OpenAPI matches these paths. Admin query services are implemented for T048; admin submission routes and final-review commands remain T053 work.

### Fresh verification

Commands executed from the repository root:

```powershell
pnpm --filter @template/api test src/core/business-calendar/business-clock.test.ts src/infrastructure/openapi/openapi.test.ts src/modules/auth/session-authority.test.ts
pnpm --filter @template/api test:integration src/modules/task-submissions/task-submissions.integration.test.ts src/modules/task-submissions/daily-reward-concurrency.integration.test.ts src/modules/tasks/tasks.integration.test.ts src/modules/task-codes/task-codes.integration.test.ts src/modules/tasks/task-commands.integration.test.ts src/modules/proofs/proof-storage.integration.test.ts src/app.integration.test.ts src/modules/auth/auth.service.integration.test.ts src/modules/wallets/wallet-projections.integration.test.ts src/modules/ledger/ledger.service.integration.test.ts
pnpm --filter @template/api lint
pnpm --filter @template/api check-types
pnpm --filter @template/api build
pnpm verify:build-output
```

- Unit regressions: **3 files, 64 tests passed**.
- Final integration run: **10 files, 98 tests passed**, against disposable migrated PostgreSQL, with real services, independent clients, controlled clocks and finite SQL barriers. US1 suites include eight grouped submission cases, six participation/upgrade/device race cases and two added unlock cases. Existing publication/command/file/app/auth/wallet/ledger cases passed in this same run.
- The real emitted Linux API test uploads actual Sharp-generated PNG proof/illustration files through multipart HTTP, unlocks gated work, creates/replays/observes/cancels commands, replaces evidence and reads private history/content. It verifies original captured terms and unchanged wallet components/operation count. Retained synthetic files in policy-only fixtures are explicitly not image-decoder acceptance evidence.
- Rejected-date uniqueness uses a valid synthetic final-review fixture after real acceptance. It proves final read/resubmission/replacement restrictions and filtered counts, **not** execution of the future US2 rejection command or reward posting.
- Exact opening/cutoff/weekends, stale/forged declarations and authority fields, wrong ownership/purpose/readiness, Free/expiry/unverified/ban/revocation/task restriction, withdrawal-only permission, code pause, content/date participation races, cutoff while blocked and actual full-price upgrade versus acceptance passed. Pending credit remains zero.
- API lint, types and build passed. Build-output verification found **8 required entries and 598 emitted files without test artifacts**. Its first attempt correctly caught the new submission test helper; a narrow `tsconfig.build.json` exclusion and fresh build fixed it.
- Scoped Prettier and `git diff --check` passed. No extension hook file exists; post-execution hooks are skipped. No web source, component, style or route changed in this invocation; existing unrelated worktree edits were preserved.

An early expiry test attempted an invalid direct update to an immutable live subscription and correctly hit the database guard. The fixture now tests the saved expiry boundary through the controlled clock; required assertions were retained. The final integration run emitted a pg concurrent-query deprecation warning but had no failing tests. No browser acceptance or full Gate B/F result is claimed for this backend scope.

### Review closure

Applied speckit-implement, security-best-practices, clean-code-guard, test-guard and docs-guard against the owning engineering rules. Guard fixes:

- `submission-evidence.service.ts` — reuse the shared safe detail mapper instead of maintaining a duplicate projection.
- `employee-tasks.service.ts` — distinguish expired retained subscriptions from Free and return the validated task/calendar together, removing duplicate impossible null handling in callers.
- `task-command.service.ts` — hydrate original submission evidence availability and current replacement permission after receipt transactions without rewriting captured facts.

**clean-code-guard: 3 fixed, 0 flagged for author.** Test review retained observable persisted invariants, exact losing-race effects, two employee sessions, independent clients, finite barriers and isolated file cleanup. Documentation routes, symbols, scripts and test results were checked against source and executed output. No convergence, next roadmap phase, deployment, commit/push or real-funds operation ran.

## Phase 6 implementation evidence - 2026-10-05 (US2)

Owner-selected scope **T051-T058** is complete within `specs/005-proofs-tasks-codes-review`. Gate B/F remain incomplete; T059-T092 are outside this invocation. Existing requirements approvals, constitution, roadmap and feature selection were preserved. All results below are fresh local executions; no cached test result is used for this batch.

### Implemented behavior

`TaskReviewService` composes the existing ledger transaction with P05 command receipts. It verifies current admin/session authority before participant lookup and again under locks. Immutable employee/task/wallet identities select the existing sorted-user/wallet/reservation locks, followed by session, task, submission and current proof. The submission lock freezes the current evidence pointer; review does not load or lock an unbounded evidence history. Both reviewed versions, confirmation and a nonblank reason are mandatory.

Approval posts the submission's captured exact reward under `p05.task-reward` with the submission UUID business key, TASK_REWARD origin and NON_REFERRAL source. Credit, final review, final status/version, domain receipt/reason/before-after audit and financial operation/posting/audit commit together. Rejection changes no wallet component or financial record. Later employee upgrade, catalog edit, expiry or ban cannot replace captured terms; ban continues to deny employee access. Final decisions cannot be reversed, edited or used to resubmit the date. The existing transaction retry policy remains bounded and no transaction performs filesystem/network work.

Admin submission list/detail/evidence/review routes use existing authentication, current ADMIN role, CSRF on review, strict shared schemas, bounded action limits, safe projections and private/no-store responses. The shared admin detail mapper is reused for saved commands and queries. Exact original-key replay preserves accepted facts; changed reason/decision/versions conflict, independent keys cannot finalize again, cancellation fences unused keys and cannot reverse a committed credit. Final-review observation/replay refreshes retained file availability outside the transaction. OpenAPI now covers final review and the existing purpose-specific upload, observation, cancellation, metadata and canonical binary routes; it documents their actual producer schemas and statuses without a reversal or unrestricted status/reward patch surface.

### Fresh verification

Commands executed from the repository root:

```powershell
pnpm --filter @template/api test:integration src/modules/task-submissions/task-approval.integration.test.ts src/modules/task-submissions/daily-reward-concurrency.integration.test.ts src/modules/ledger/ledger.service.integration.test.ts src/modules/wallets/wallet-projections.integration.test.ts src/modules/subscriptions/subscription-purchase.integration.test.ts src/modules/auth/auth.service.integration.test.ts src/app.integration.test.ts src/modules/tasks/task-commands.integration.test.ts
pnpm --filter @template/api test:integration src/modules/task-submissions/task-approval.integration.test.ts -t "reviews actual canonical private proof"
pnpm --filter @template/api test src/infrastructure/openapi/openapi.test.ts src/modules/auth/session-authority.test.ts src/core/business-calendar/business-clock.test.ts
pnpm --filter @template/api check-types
pnpm --filter @template/api lint
pnpm --filter @template/api build
pnpm verify:build-output
```

- Final combined integration: **eight files, 127 tests passed**, using disposable migrated PostgreSQL 18.4, independent clients/start or lock barriers, real services and authenticated HTTP. Review/race tests cover competing approvals, approval/rejection, replacement/review, revocation while waiting, exact losing state, full rollback after credit/final writes, strict intent and terminal keys. Nonzero referral/non-referral reservation allocations remain identical; only an approved captured credit increases available non-referral funds.
- The actual emitted Linux API uploads and canonicalizes a synthetic PNG, accepts a declared claim, serves the current private proof to the admin and approves through authenticated HTTP. The final targeted follow-up closes the approval response at the HTTP response boundary after commit, recovers the original key through observation, and proves one credit. Removing the test file yields STORAGE_UNAVAILABLE on observation/replay while saved entitlement and the single operation remain unchanged. **One test passed; seven review cases were intentionally excluded by the name filter after passing in the combined run.** This is real local file/decoder/HTTP evidence, not a browser or hostile-resource checkpoint.
- Ledger reconciliation verifies captured reward amount, source, administrator audit attribution and a consistent wallet after employee ban. Wallet regression preserves locked referral funds after expiry and continuing ban restrictions. Subscription regression proves full 600-USDT O1 debit, 540-USDT commission base, referral-first allocation, retained S1 daily claim and final 2-USDT captured credit after future catalog reward edits.
- Focused unit regressions: **three files, 65 tests passed**, including OpenAPI private binary/final-review shapes and absence of reversal/status patch methods.
- API lint, check-types and build passed. Build-output verification passed with **eight required entries and 600 emitted files without test artifacts**. Scoped Prettier checks and `git diff --check` passed. Feature/constitution/roadmap/spec/plan/checklist hashes and all out-of-scope task lines were compared unchanged.

Initial failed attempts were corrected before the final passes. The first approval assertion compared the wallet's legitimate changed `updatedAt`; it now preserves exact component checks and verifies complete wallet equality for rejection. New admin OpenAPI entries initially lacked the required authority description; these were added. Lint found an async fixture with no await and an unchecked wallet-array access; both were corrected. The first five-file financial run passed 77/83 tests and reproduced six existing subscription configuration-transition failures: fresh migration seed timestamps were later than fixed quote/business clocks. Only the two affected regression setups now derive the configuration-edit instant after the recorded seed and keep its admin session valid; all original financial/stale-quote assertions and production configuration guards remain. The final eight-file run passes those regressions. The pg concurrent-query deprecation warning still appears; no failing check is concealed.

### Review closure and remaining gates

Applied speckit-implement, security-best-practices, clean-code-guard, test-guard and docs-guard against the engineering rules. Clean-code/security fixes: reuse `mapAdminSubmissionDetail` for queries/commands, lock only the current proof rather than every historical asset, refresh final-command availability after the transaction, and verify authority before pre-reading participant facts. **clean-code-guard: 4 fixed, 0 flagged for author.** Test review retained real persistence/files/network boundaries, controlled rollback and response loss, exact source/reservation effects, and safe cleanup. Docs review verified routes/schemas/statuses against actual controllers; uploads return 201 even for accepted replay, so no fictional 200 upload response is documented.

No frontend source, route, layout, static copy or design changed; no browser acceptance is claimed. No dependency, lockfile or migration changed in this batch. `.specify/extensions.yml` is absent, so pre/post hooks were skipped. P05 Gate B (T059), frontend Gate F and P11 production/resource/recovery and independent launch review remain required. The accepted single-admin/no-2FA and compromised-admin/host residual risks remain. No CONVERGE, next roadmap phase, deployment, commit/push or real-funds action ran.

## Phase 7 acceptance evidence - 2026-10-05 (initial failed attempt)

Owner-selected scope: **T059 only**, internal Phase 7 of roadmap P05. The feature pointer still selects this feature. Reused requirements-quality approvals are 16/16 and 38/38; recorded U1/U2 resolutions and P03/P04 predecessor acceptance were reviewed, without changing approval markers. T003-T058 are already checked and were not reimplemented. There is no extension hook file, so both hook checks were skipped.

### Fresh command results

All commands ran from the repository root using Node 24.18.1 and pnpm 11.17.0. Tests used the existing isolated PostgreSQL 18.4 harness; file acceptance used real synthetic files and emitted Linux API/decoder children. No Turbo-cached test result substitutes for these executions.

| Executed command                                                                                                                                             | Result                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Git Bash `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks`                                                               | Correct feature and required artifacts resolved.                                                                                                                                                                                     |
| `pnpm db:validate`; `pnpm db:generate`                                                                                                                       | Passed.                                                                                                                                                                                                                              |
| `pnpm --filter @template/contracts build`; `pnpm --filter @template/database build`; `pnpm --filter @template/api build`                                     | Passed; emitted artifacts were built before native integration.                                                                                                                                                                      |
| `pnpm --filter @template/contracts test`                                                                                                                     | 15 files, 217 tests passed, including all four P05 contract domains.                                                                                                                                                                 |
| `pnpm --filter @template/database test`                                                                                                                      | 2 files, 9 tests passed.                                                                                                                                                                                                             |
| `pnpm --filter @template/database test:integration`                                                                                                          | 6 files, 51 tests passed: fresh/populated/repeated migration and direct constraints included.                                                                                                                                        |
| `pnpm --filter @template/api test`                                                                                                                           | 30 files, 325 tests passed, including required clock/config/retention/auth/OpenAPI cases.                                                                                                                                            |
| `pnpm --filter @template/api test:integration src/modules/proofs src/modules/tasks src/modules/task-codes src/modules/task-submissions`                      | **12 files passed, 1 failed; 57 tests passed, 1 failed.** Entire selected discovery executed without a name filter. Gate B failed.                                                                                                   |
| `pnpm --filter @template/api test:integration src/modules/auth src/modules/ledger src/modules/subscriptions src/modules/wallets src/app.integration.test.ts` | 11 files, 196 tests passed.                                                                                                                                                                                                          |
| `pnpm --filter @template/contracts lint`; `pnpm --filter @template/contracts check-types`                                                                    | Passed.                                                                                                                                                                                                                              |
| `pnpm --filter @template/database lint`; `pnpm --filter @template/database check-types`                                                                      | Passed.                                                                                                                                                                                                                              |
| `pnpm --filter @template/api lint`; `pnpm --filter @template/api check-types`                                                                                | Passed.                                                                                                                                                                                                                              |
| `pnpm verify:build-output`                                                                                                                                   | Passed: 8 required entries, 600 emitted files without test artifacts, including the decoder child.                                                                                                                                   |
| `pnpm exec prettier --check <P05 backend source/test/composition paths>`                                                                                     | Passed. Included four API domains, file infrastructure, four contract domains, affected config/calendar/OpenAPI/financial regression files, database fixture/constraint/migration tests, exports, build config and artifact checker. |
| `git diff --check`                                                                                                                                           | Passed before documentation edits; final documentation verification is recorded in tasks.md.                                                                                                                                         |

The pg concurrent-query deprecation warning appeared in integration runs. Linux dependency installation also emitted npm install-script and update notices; the failing test's diagnostic is the assertion below, not an installation failure. No dependency or script-approval change was made.

### Fresh native-resource observations

The resource case passed in the otherwise failed combined run. Its generated temporary observation file reports **32 child observations, ten two-slot rounds, 19 complete and 13 partial measurements**. Normal children retain acknowledged final high-water readings; forced failure observations remain partial.

| Measurement                    | Observed bytes | Approved ceiling bytes |
| ------------------------------ | -------------: | ---------------------: |
| Warm API baseline              |    195,280,896 |          Baseline only |
| Sampled API peak               |    259,375,104 | Growth evaluated below |
| API RSS growth                 |     64,094,208 |            134,217,728 |
| Largest retained child reading |    337,895,424 |            536,870,912 |
| Largest two-child retained sum |    499,982,336 |          1,073,741,824 |

The actual corpus and third-admission denial, finite processing, cleanup and unchanged claim/wallet/operation assertions passed. These empirical readings establish this resource case only; they do not override the retention failure or impose production OS limits.

### Initial acceptance blocker

`apps/api/src/modules/proofs/proof-retention.integration.test.ts:51` attempts replacement after the saved submission is finally rejected and its proof has completed age-based deletion. It expects `EVIDENCE_CONFLICT`; actual `SubmissionEvidenceService.replace` throws `STORAGE_UNAVAILABLE` with HTTP 503. The combined test failed with that exact assertion, after reaching the preceding retention/deletion checks.

Before correction, the owning service checked private asset availability at `apps/api/src/modules/task-submissions/submission-evidence.service.ts:46` before the pending/version/deadline checks at line 71. A removed asset therefore prevented this case from reaching its final-submission conflict check. A fresh isolated run of `pnpm --filter @template/api test:integration src/modules/proofs/proof-retention.integration.test.ts` also failed its one test with the identical 503-versus-409 mismatch. This confirmed reproduction independently of the combined run; neither failure established a duplicate credit or successful forbidden replacement. The first attempt left this required result unresolved, without weakening the assertion or claiming the retention suite passed. FR-019/FR-033/FR-042, the Gate B scenarios and T059 require resolved finality/retention acceptance.

The first attempt treated T059's named documentation paths as an exclusive write boundary and stopped after recording the failure. On the owner's follow-up, that overly strict interpretation was corrected: resolving this directly blocking backend regression is necessary to finish the requested Gate B. The bounded change in `SubmissionEvidenceService.replace` retains current authorization, owned-resource filtering, pending-file availability and the authoritative locked conflict check. No test assertion was weakened, remediation task appended or CONVERGE command run. Final corrected acceptance is recorded separately below.

### Review and scope

Speckit-implement and docs-guard were applied. Existing code/security/test review closure was reused, with focused read-only clean-code-guard, test-guard and security-best-practices checks of shared transaction composition, captured reward/source rules, current role/session authority, command fences, private routes, actual file resources and controlled rollback. The finality/availability mismatch above is the required unresolved finding; no code/test fix or broader audit pass is claimed.

Only this guide and tasks.md were edited. No test was added or changed for this acceptance-only task; existing required suites were executed. Frontend source/design, feature selection, requirements approvals, constitution, roadmap, dependencies, lockfile and migrations were preserved. No browser/Gate F, full-roadmap checkpoint, deployment, production recovery or independent launch review is claimed. P05 still has **34 unchecked tasks, T059-T092**. Single-admin/no-2FA and compromised-admin/host residual risks remain. No next phase, commit/push or funds action ran.

## Phase 7 corrected acceptance - 2026-10-05 (Gate B complete)

**T059 is complete; Gate B passed. P05 remains incomplete with 33 unchecked tasks, T060-T092, including frontend Gate F.** The initial failed combined run and isolated reproduction above remain historical results.

### Bounded correction

`apps/api/src/modules/task-submissions/submission-evidence.service.ts` now loads the owned submission after authorized command observation and checks live proof availability only for a new pending replacement. A final submission reaches the existing locked status/version/deadline guard and returns `EVIDENCE_CONFLICT`/409 even after retention removes its proof bytes. Pending attachments still require present bytes; current authority, owner filtering, command replay/cancellation and transactional checks remain. No filesystem work moved into a retried transaction and no financial effect was added.

The existing real Linux/PostgreSQL regression in `proof-retention.integration.test.ts` was preserved without assertion changes. No test file was added or edited: this acceptance task executes the automated coverage already implemented in T003-T058, and the existing failing regression directly verifies the correction.

### Final executed checks

These commands ran after the correction, from the repository root:

```powershell
pnpm --filter @template/api build
pnpm --filter @template/api test
pnpm --filter @template/api check-types
pnpm --filter @template/api lint
pnpm verify:build-output
pnpm --filter @template/api test:integration src/modules/proofs src/modules/tasks src/modules/task-codes src/modules/task-submissions
pnpm --filter @template/api test:integration src/modules/auth src/modules/ledger src/modules/subscriptions src/modules/wallets src/app.integration.test.ts
pnpm exec prettier --check apps/api/src/modules/task-submissions/submission-evidence.service.ts specs/005-proofs-tasks-codes-review/quickstart.md specs/005-proofs-tasks-codes-review/tasks.md
git diff --check
```

- Full P05 integration: **13 files, 58 tests passed**, including actual parser/files/decoder/resource/recovery/retention/privacy boundaries and persisted authority/time/replay/claim/date/code/review/rollback races. The final run took 689.93 seconds; no case was excluded by a name filter.
- Affected shared API integration: **11 files, 196 tests passed**, covering auth, ledger, subscriptions, wallets and app composition. The final run took 314.40 seconds.
- API unit: **30 files, 325 tests passed**. API lint, check-types and build passed. Build-output verification passed with **eight required entries and 600 emitted files without test artifacts**, including the decoder child.
- The same invocation's earlier **217 contracts tests, nine database unit tests and 51 database integration tests** remain valid for unchanged contracts/schema/migrations. Their fresh/populated/repeated migration and constraint results, schema validation/generation and contracts/database lint/types/build are recorded in the initial command table. They were not rerun after the service-only correction.
- Scoped service/documentation formatting and `git diff --check` passed. Protected feature/constitution/roadmap/spec/plan/checklist hashes and all task lines except T059 were compared unchanged.

The final real native-resource case passed its corpus and ten two-slot rounds, with **32 child observations**: maximum child **335,527,936 bytes**, maximum pair **499,273,728 bytes**, and API RSS growth **51,511,296 bytes** (baseline 195,452,928; peak 246,964,224). These remain below the approved 536,870,912/1,073,741,824/134,217,728-byte empirical ceilings. **18 observations were complete and 14 partial**; interrupted child measurements remain identified as partial rather than treated as complete high-water readings. The workload also checks safe failures, cleanup and unchanged claim/financial state. This is local acceptance evidence, not an OS resource guarantee or P11 deployment acceptance. Existing pg concurrent-query deprecation and native npm notices did not fail the runs.

### Review closure and scope

Applied speckit-implement, clean-code-guard, security-best-practices and docs-guard, with focused test-guard review of the preserved regression. The required finality/availability finding is resolved. **clean-code-guard: 1 fixed, 0 flagged for author.** Documentation claims and commands were checked against source, manifests and executed results; earlier backend review closure is retained.

Only the service correction, this guide and tasks evidence changed in this follow-up; only T059's completion marker changed. Inherited unrelated edits, frontend source/design, dependencies, lockfile, migrations and approval markers were preserved. `.specify/extensions.yml` remains absent, so post-implementation hooks were skipped. No browser/Gate F, full-roadmap checkpoint, production recovery or independent launch review is claimed. Single-admin/no-2FA and compromised-admin/host residual risks and later P11 obligations remain. No CONVERGE, next phase, deployment, commit/push or real-funds operation ran.

## IMPLEMENT evidence — P05 Phase 8 US5 (2026-10-06, selected scope complete)

Owner scope is T060-T090 only. Gate B and the 16/16 and 38/38 requirements-quality approvals were reused from the preceding accepted backend batch. Approval markers and the feature pointer remain read-only. T091-T092 are outside this invocation; whole-phase/Gate F completion is not claimed.

### Implemented integration and fresh checks

T060-T085 integrate the existing employee task/history and admin task/code/review surfaces with validated real adapters and scoped queries. File uploads use purpose-separated multipart requests; private image bytes and object URLs remain transient. Original non-secret command handles survive reload and uncertainty without automatic resend. Confirmations use current versions, saved decisions include the persisted reason, and only confirmed approval reconciles the existing P04 financial reads. Migrated task/code/review fixture mutation callers and the unused employee task-reward factory were removed; unrelated fixture providers remain.

The necessary shared final-decision projection accepts an optional bounded reason, preserving older immutable receipts while exposing current saved review reasons. Fresh focused contract tests passed 5 tests, task-submission integration passed 8 tests, and app/CORS integration passed 24 tests earlier in this invocation. These results are reused after subsequent UI/harness-only edits; a new full backend gate is not claimed.

- `pnpm --filter @template/web test --maxWorkers=2`: **89 files, 444 tests passed**. This includes P05 adapters/hooks/components/command recovery/private previews and affected P03 identity/session/transport and P04 wallet/ledger/query/admin finance regressions.
- Web and API production and e2e type checks passed. Scoped ESLint passed for owned frontend files, browser support, native harness, changed API projection/tests and contracts. Scoped Prettier and `git diff --check` passed before this evidence update.
- The final harness shutdown/snapshot-root change also passed API e2e types and focused ESLint. Fresh browser runs verified shutdown cleanup: zero active task containers and zero directories under the active snapshot root remained.
- Earlier failed attempts are not passes: an unbounded full web run lost a worker; a code-create asynchronous test timed out before its wait was corrected; one concurrent type check exhausted heap. The bounded complete web run and sequential successful type checks above replace those attempts.

### Browser evidence and remaining acceptance

`pnpm --filter @template/web test:e2e tasks-codes-and-review.spec.ts` uses a built Next app, actual migrated PostgreSQL 18.4, a Linux Node 24.18.1 API, real private files/parser/decoder and private IPC fixtures. Its public npm download volume is cached, while database/API/private storage are fresh per scenario. Linux installation uses the API manifest's dependencies and compiled workspace exports; this is local native acceptance, not a claim of production deployment/lockfile parity. The isolated API has a finite 1,000-request test rate budget; production defaults remain unchanged. Diagnostics emit bounded infrastructure stages or source line locations without private DOM/proof content.

Earlier separate browser runs passed the primary persisted publication/unlock/upload/replacement/approval/rejection/reload/wallet journey, stale/private-read/retention/late-preview scenarios, dropped upload and actual decoder-processing cancellation, and dropped edit/cancel/commit recovery. These are partial results, not a final all-five-scenario pass. The extended primary reached second employee/admin session agreement and all business/UI assertions, then failed its final console assertion on the frozen UI's missing favicon. The test now applies the same exact favicon-404 exception as P03; other console errors still fail. The fresh main run passed the extended primary with that exact baseline exception.

Browser observations demonstrated the long review popup extending above a 320px viewport and 26 page buttons pushing Next beyond it. The existing popup now has viewport-bounded vertical scrolling; the existing pagination shows up to three nearby page buttons with Previous/Next. The named review dialog's focus/Escape/restoration checks passed before the page-control failure. An earlier generic dialog locator also selected the closed mobile sidebar and was replaced by the review dialog's accessible name. Unit coverage passes for forward/reverse focus cycling and bounded pagination. The fresh main run passed the newer stale-review/account-retirement assertions and four-width long popup checks. Its pagination case failed an initial viewport assertion while the footer was below the fold. The focused rerun explicitly checked horizontal button bounds, scrolled the existing page to the footer, and passed viewport reachability, actual page-two navigation and four-width overflow checks. No further production UI change was needed. Nine route files/layout/styles are unchanged; earlier 320/390/430/1280 masked images are in `output/playwright/p05-review/`, and now include fresh long-review and bounded-pagination images.

### Environment blocker and authorized cleanup

Final native browser runs failed at the database-start stage after C: filled and Docker's image/content metadata began returning I/O errors. Task-owned old host snapshots were moved reversibly from C: temp to ignored D: project cache. New snapshots live under `node_modules/.cache/p05-e2e`; shutdown now waits for owned container/database/snapshot cleanup before acknowledging completion.

The owner authorized unnecessary-file cleanup. `npm cache clean --force --cache C:\Users\moham\AppData\Local\npm-cache`, `bun pm cache rm`, and `pnpm store prune` completed; pnpm preserved packages used by registered projects. C: recovered to approximately 3 GB free before Docker restart. No user documents, source, browser binaries or Docker database volumes were deleted. The owner then explicitly authorized Docker Desktop restart. Its WSL bootstrap reported an inaccessible block device and failed provisioning; the normal stop timed out, so only verified Docker installation processes were stopped and WSL was shut down. Restart then detected the existing ext4 filesystem, both required images became readable, and all five unrelated database containers returned to running. No reset or virtual-disk replacement command was issued. Final free space was approximately 3.6 GB.

### Review

Applied speckit-implement, vercel-react-best-practices, security-best-practices, clean-code-guard, test-guard, playwright and docs-guard. Reviews covered current role/ownership boundaries, exact string money, private transient previews, original command identity, stale-version confirmations, preserved Next params/Suspense and test assertions against actual network/database outcomes. The unused employee reward factory was removed during code review: **clean-code-guard: 1 fixed, 0 flagged for author**. Documentation claims were checked against manifests/source and observed results. T060-T090 are complete after the fresh browser evidence below; T091-T092/Gate F remain outside scope and unchecked; single-admin/no-2FA and later P11 independent production/recovery obligations remain.

### Final browser execution and artifact verification

After Docker recovery, `pnpm --filter @template/web test:e2e tasks-codes-and-review.spec.ts` executed all five scenarios: primary persistence/second sessions/wallet, dropped upload/real processing cancellation, stale/privacy/retention/account changes and dropped edit recovery passed; the long-popup/page-control scenario failed only its unscrolled footer viewport assertion. This whole command exited 1 and is **not** recorded as a full-run pass.

Only that browser assertion changed: retain explicit horizontal bounds at 320px, scroll to the existing footer, then require visible navigation and actual server records 11-20. `pnpm --filter @template/web test:e2e tasks-codes-and-review.spec.ts --grep 'narrow long review'` passed its selected one scenario and exited 0. All five scenarios therefore have fresh passing acceptance across these two executions; there is no claim of a later single-command all-five pass. The unchanged four passed scenarios were not repeated after this test-only change. Web e2e types, focused browser ESLint, formatting and diff checks passed after the assertion correction.

Masked review artifacts were preserved under `output/playwright/p05-review/` before the focused runner reset its output folder, then refreshed with the final long-popup/pagination images. Visual inspection covered employee bottom-navigation clearance at 320px, long review at 320/1280px, and final 320px page-two controls. Automated checks cover 320/390/430/1280px, Cairo/RTL/light, LTR facts, inline icon labels, no document overflow, popup focus/Escape/restore and privileged employee request/console checks. No active task container or host snapshot remained after the final run; the five unrelated database containers remained running. Final documentation was reviewed with docs-guard against observed results and verified scripts; formatting and diff checks were rerun after recording this evidence.

## Phase 9 documentation and acceptance - 2026-10-06

Owner scope is **T091-T092 only; both are complete and Gate F passed**. All 92 P05 implementation tasks are now complete. The feature remains `specs/005-proofs-tasks-codes-review`. Requirements-quality approvals remain 16/16 and 38/38, unchanged. The recorded U1/U2 design resolutions, P03/P04 predecessor acceptance and corrected Phase 7 Gate B were reviewed and reused. Gate B passed on 2026-10-05 before Phase 8 frontend integration on 2026-10-06.

### Documentation correction and review

The documentation owners are `.env.example`, `apps/api/src/infrastructure/openapi/openapi.ts`, this guide and `tasks.md`. A directly blocking shared-regression correction also owns `apps/web/e2e/wallet-and-ledger.spec.ts` as described below. Configuration comments now state the required separate absolute root, per-process slot/deadline bounds and temporary-budget minimum/maximum; accepted persistent storage needs separate capacity/backups. The OpenAPI cancellation description now distinguishes upload `FAILED/UPLOAD_CANCELLED` from domain `CANCELLED` and preserves READY acceptance. The guide replaces stale frontend status and proposed-installation instructions with verified runtime/config/route/content-type/lifecycle facts and the required shared browser command.

Docs-guard checked these claims against the API manifest, shared schemas, registered route/controller methods, proof config/runtime/storage/lifecycle, `server.ts`, `Caddyfile`, browser fixtures and actual command results. No schema/DTO, domain behavior, financial rule, UI, dependency or migration changed. Earlier required production/security/test/React review closures are reused from Phases 3-8; this batch's focused inspection found no new fixture authority, automatic work/file resend, optimistic-money or private-scope regression in the affected adapters/hooks/runtime. No nontrivial production code or new test case was generated. Test-guard reviewed the one shared browser correction against real persisted/UI boundaries and retained financial assertions.

### Fresh command results

Commands ran from the repository root:

```powershell
pnpm --filter @template/web test --maxWorkers=2
pnpm --filter @template/api test src/infrastructure/openapi src/core/config/proofs.config src/core/business-calendar src/modules/auth/session-authority
pnpm --filter @template/web lint
pnpm --filter @template/web check-types
pnpm --filter @template/api check-types:e2e
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/api lint
pnpm --filter @template/api check-types
pnpm build --concurrency=1
pnpm verify:build-output
pnpm --filter @template/api test:integration src/modules/task-submissions/task-submissions.integration.test.ts src/app.integration.test.ts
pnpm --filter @template/web test:e2e e2e/tasks-codes-and-review.spec.ts
pnpm --filter @template/web test:e2e e2e/identity-and-admin-access.spec.ts e2e/wallet-and-ledger.spec.ts
pnpm exec prettier --write specs/005-proofs-tasks-codes-review/quickstart.md
pnpm exec prettier --check apps/api/src/infrastructure/openapi/openapi.ts specs/005-proofs-tasks-codes-review/quickstart.md specs/005-proofs-tasks-codes-review/tasks.md
git diff --check
```

| Check                                 | Observed result                                                                                                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete web unit/component run       | 89 files / 444 tests passed fresh, including P05 and shared identity/transport/wallet/query/finance cases.                                                                                                             |
| Focused API unit                      | Four files / 83 tests passed fresh: OpenAPI, proof config, Baghdad calendar and session authority.                                                                                                                     |
| Focused API integration               | Two files / 32 tests passed fresh with disposable migrated PostgreSQL: submission projection/authority/persistence and app/CORS composition. Existing pg concurrent-query deprecation warning did not fail acceptance. |
| Web/API lint and production/e2e types | All listed commands passed; type checks were sequential.                                                                                                                                                               |
| Build                                 | Four tasks successful, zero Turbo cache hits; fresh contracts/database/web/API builds, including generated Prisma client and Next 16.3.6.                                                                              |
| Build output                          | Eight required entry artifacts, 600 emitted files, no test artifacts; passed.                                                                                                                                          |
| P05 authenticated browser             | All five scenarios passed in one fresh command, zero retries.                                                                                                                                                          |
| P03 identity and P04 wallet browser   | Initial combined run: 29/30 passed, exited 1. Corrected full wallet rerun: 5/5 passed, exited 0. All 25 identity + five wallet scenarios have fresh passing evidence across the two runs.                              |
| Scoped formatting/diff                | Final owned-file checks passed after evidence recording; relative file links passed.                                                                                                                                   |

The WSL `bash` entry could not find `/bin/bash`; the installed Git Bash successfully ran `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` and returned the selected P05 directory and expected documents. Host `node --version` returned v24.18.1 and `pnpm --version` returned 11.17.0. The optional Python link-check helper was unavailable; the equivalent Node check passed all quickstart relative file links. Neither fallback changes application/test behavior. Extension configuration is absent, so pre/post implementation hooks are skipped.

### Shared-regression failure and bounded correction

The combined shared browser command passed all **25 identity scenarios** and four of five wallet scenarios. Scenario 28 failed at `wallet-and-ledger.spec.ts:159`, clicking a release-history entry on page one; it did not reach the remaining expiry/reactivation assertions. Persisted paid/released wallet balances and source assertions before that click passed. This failed command is not counted as a full shared pass.

`apps/api/tests/e2e/p04-finance.ts` creates 28 reservations and the release using one fixed scenario clock and random UUIDs. `WalletsService.history` orders by `createdAt` then UUID descending. Equal timestamps therefore place the release on either of the two authoritative pages; absence from page one is permitted. The correction waits for the existing Next history control to be enabled, checks for the release entry and navigates to page two only when needed, then retains the original click and neutral-detail/expiry/reactivation assertions. It adds no mock, sleep, automatic runner retry, timeout increase or financial/UI behavior change.

Post-correction commands are `pnpm --filter @template/web check-types:e2e`, `pnpm --filter @template/web exec eslint e2e/wallet-and-ledger.spec.ts`, `pnpm exec prettier --check apps/web/e2e/wallet-and-ledger.spec.ts` and `pnpm --filter @template/web test:e2e e2e/wallet-and-ledger.spec.ts`. Types, focused lint and formatting passed. The full five-scenario wallet rerun passed and exited 0, including all remaining expiry/reactivation assertions. All 30 distinct shared scenarios therefore have fresh passing evidence across the initial combined run and corrected wallet run; no later single-command all-30 pass is claimed. The unchanged 25 identity scenarios were not repeated after this test-only correction. Test-guard preserves all financial outcomes and the real migrated DB/browser boundary; the bounded page selection removes the unsupported first-page assumption.

### Browser and preservation evidence

Fresh P05 browser acceptance used built Next, migrated PostgreSQL 18.4, Linux Node API, real bounded private files/parser/decoder and private IPC control. All five scenarios passed together: nine-route persisted publication/code/unlock/upload/declaration/replacement/final approval/rejection/second-session/wallet journey; narrow long-review/pagination/focus; lost upload/cancellation/actual processing cancellation; stale/privacy/retention/account retirement; dropped edit/cancel/commit reconciliation. It retains the previously accepted exact favicon-404 baseline exception; unexpected console errors and privileged employee requests still fail.

Normal nine-route views and challenging forms/review cover 320/390/430/1280px with Cairo/RTL/light, LTR facts, inline labels, no page overflow, focus/Escape/restoration, reachable actions and bottom-navigation clearance. Fresh masked 320px pagination, 390px task creation and 1280px long review were inspected, alongside recorded 320px long-review/employee-clearance captures. The **48 fresh masked PNGs** were copied to ignored `node_modules/.cache/p05-gate-f-review/` before the shared browser runner resets its output directory. Existing `output/playwright/p05-review/` artifacts were preserved.

After the P05 browser command, no `oscar-p05-e2e-*` container or snapshot directory under `node_modules/.cache/p05-e2e/` remained; the five unrelated database containers were still running. Native npm-download cache reuse is separate from fresh API/database/private storage per scenario. Its Linux test installation remains the recorded manifest-based local harness, not production deployment/lockfile-parity acceptance. Phase 7 native-resource/race/rollback/migration evidence is reused, not claimed freshly rerun here.

**Gate F passed; T091-T092 and all P05 implementation tasks are complete.** Applied speckit-implement, docs-guard, playwright and test-guard; prior production/security/React review closures are reused with the focused checks above. The shared history-test finding is resolved without weakening financial assertions. Only five owned files changed; all other tracked/untracked source/config/artifact contents and every T001-T090 task line match the starting state. Feature selection, constitution, roadmap, spec/plan/research/contracts, requirement approval markers, frontend rendering/routes/layout/styles, dependencies and migrations are preserved. Final scoped formatting, relative-link and diff checks passed; no extension hook file exists. After both browser runs, task-owned native containers/snapshots were absent and unrelated database containers remained running.

P05 is an intermediate phase, so the full-current-regression checkpoints remain P04/P07/P09/P10/P11; root `pnpm verify`, production native-resource enforcement, independent money/security review, private-file/WAL restore, testnet/UAT and release approval were not run or claimed. Single-admin/no-2FA and compromised-admin/host risks remain. No CONVERGE, next phase, deployment, credential creation, commit/push or real-funds operation ran.

## Convergence remediation implementation — 2026-10-06

Owner-selected scope is the three appended tasks, executed **T095 → T093 → T094**. The final T095 native acceptance passed before frontend edits began. T001-T092 and the original accepted evidence remain historical records; this section records fresh remediation checks rather than replacing those runs. Requirements approvals and the active P05 feature selection are unchanged.

### Implemented behavior

- **T095:** `PrivateImageStorage` streams filesystem directories, validates every leaf and accounts temporary bytes before cleanup. `ProofsRuntime` queries only each batch's owners with a maximum of 100 keys/rows. It closes admission on any startup failure, retains accepted/pending bytes and ages, removes ownerless/DELETED content, and completes every filesystem batch without imposing a historical-record cap. The existing periodic lifecycle scan remains bounded separately.
- **T093:** `useTaskEditorDraft` owns editable fields and their base revision together. Pristine drafts refresh atomically; dirty drafts survive refreshed reads and require the explicit existing-style “load current version” reconciliation before confirmation. Confirmation stores reviewed fields and revision; later changes cannot silently authorize old fields with a new revision. The edit route alone preserves hidden component state during same-account session checks, using installed React `Activity`; retirement, changed identity/path and terminal denials discard it. Selected-file previews recreate/revoke their transient URLs around hidden checks.
- **T094:** The existing submission dialog shows captured subscription terms and a 25-row evidence-history page, with version/time/availability metadata and existing pagination/loading/error/retry surfaces. A replacement changes the history query identity and resets its page. Only the current proof image is displayed; final action remains bound to current reviewed submission/evidence versions and settled context. Removed metadata hides a stale current preview URL immediately. No historical image gallery or new popup/page was added.

The shared authorization/preview changes are necessary to preserve the task draft and truthful removed-proof state; other route behavior retains its default boundary. Existing C1/C2 scope permits the required review context, reconciliation control and truthful feedback inside the approved surfaces. Cairo, RTL, light presentation, navigation, route inventory and financial policies are preserved. No dependency, migration, lockfile or production funding endpoint was added. The finite upgrade funding command exists only in private test IPC and uses the existing real ledger fixture helper.

### Fresh backend and component evidence

```bash
pnpm --filter @template/api test:integration src/modules/proofs
pnpm --filter @template/api build
pnpm --filter @template/api test:integration src/modules/proofs/proof-lifecycle.integration.test.ts src/modules/proofs/proof-storage.integration.test.ts
pnpm --filter @template/api test src/modules/proofs src/modules/tasks src/modules/task-submissions src/modules/task-codes src/core/config/proofs.config src/infrastructure/openapi
pnpm --filter @template/api test:integration src/modules/task-submissions/task-submissions.integration.test.ts src/app.integration.test.ts
pnpm --filter @template/contracts test
pnpm --filter @template/web test
pnpm --filter @template/web check-types:e2e
pnpm --filter @template/api exec tsc --noEmit -p tests/e2e/tsconfig.json
```

| Check                       | Observed result                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proof integration           | Initial full selection: nine existing tests passed, new startup fixture failed. Corrected final lifecycle/storage selection: two files/four tests passed. All ten distinct proof cases have passing evidence across commands; no later all-ten single-command pass is claimed.                                                                                                            |
| Startup native probe        | Real migrated PostgreSQL/Linux; 105 accepted assets (one subsequently DELETED) plus pending/orphan/leased STAGING content, failed second/fourth lookups, successful restart, immutable upload ages and 105 sparse staging files whose budget exceeds 256 MiB only after the first 100 entries. Failed startup admits no upload; accepted pending evidence survives; no reward is created. |
| Focused API unit            | Three files/39 tests passed.                                                                                                                                                                                                                                                                                                                                                              |
| Submission/app integration  | Two files/32 tests passed against disposable migrated PostgreSQL.                                                                                                                                                                                                                                                                                                                         |
| Shared contracts            | 15 files/218 tests passed.                                                                                                                                                                                                                                                                                                                                                                |
| Complete web unit/component | 89 files/450 tests passed, including pristine/dirty drafts, session retirement, preview lifecycle, captured terms, 26-version pagination, history retry, current version binding and removed evidence metadata.                                                                                                                                                                           |
| API/web static checks       | Both full lints and production/e2e types passed; test-only fixture changes received subsequent focused lint and e2e type checks.                                                                                                                                                                                                                                                          |

Initial native attempts exposed invalid retention fixture timestamps; received/uploaded/ready ages were corrected together without bypassing database constraints. One attempt also overlapped API rebuild and native distribution copying, producing missing emitted-file failures; final builds and native acceptance were serialized. Neither failed attempt is counted as a pass. The existing pg concurrent-query deprecation warning was nonfatal.

Initial draft browser failures exposed focus revalidation discarding mounted editor state; explicit visibility-change synchronization and the scoped state-preserving boundary fixed the actual behavior. An initial discovery run failed on an incorrectly named membership-schema export, which was corrected before scenario execution. Two complete P05 browser attempts each passed four of six cases and failed the expanded catalog/history acceptance; two focused primary attempts also failed. History added legitimate duplicate text, so old locators were narrowed to the current declaration/preview while retaining all version/deletion assertions. Temporary stage/status-only diagnostics identified a 500 from a valid configuration timestamp guard: fixed October 5 preceded the real migration seed timestamp. This scenario now opts into the next future weekday at 09:00 UTC, keeps the whole task journey on that date, and uses the actual employee membership response. Other fixed-clock scenarios are unchanged. Diagnostic additions to the shared helper/reporter were removed.

The first future-date run was stopped after two IPC timeouts: the new fixture's publication date was missing from the strict reply union. Both ends now share `p05FixturesSchema`, preserving strict boundary validation. That interrupted run is not a pass. A subsequent full run passed five of six cases, including the captured reward; the privacy case failed waiting for its held image read. Its artificial month-long retention clock jump could expire an actively polling browser session and leave a scoped denial after restoring the clock. Navigating both relevant pages away during the fixture jump and reopening after restoration preserves real authorization, retention and late-response assertions without changing timeouts or retries. Initial browser failures remain failures; final browser/build results are recorded after completion.

### Final acceptance and review

```bash
pnpm --filter @template/web test:e2e e2e/tasks-codes-and-review.spec.ts
pnpm --filter @template/web test:e2e e2e/identity-and-admin-access.spec.ts e2e/wallet-and-ledger.spec.ts
pnpm build --concurrency=1 --force
pnpm verify:build-output
git diff --check
```

| Check                        | Final observed result                                                                                                                                                                                                                                                                                              |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complete P05 browser         | Six scenarios passed in one command, zero retries. Includes actual evidence replacement, persisted S2 membership after upgrade, later S1 catalog edits, captured S1 terms/history and exactly one 2-USDT reward, plus rejection, second devices, stale versions, privacy, retention and dropped-response recovery. |
| Shared P03/P04 browser       | All 25 identity and five wallet scenarios passed in one command, zero retries.                                                                                                                                                                                                                                     |
| Production build             | Four successful tasks, zero Turbo cache hits; forced contracts/database/web/API builds, including Prisma client generation.                                                                                                                                                                                        |
| Emitted output               | Eight required entries and 600 emitted files; no test artifacts.                                                                                                                                                                                                                                                   |
| Scoped formatting/diff/links | Owned source/tests/task/evidence formatting, diff checks and all four quickstart relative file links passed.                                                                                                                                                                                                       |

The P05 runner used built Next, disposable migrated PostgreSQL and the real Linux API/private image pipeline. Its existing masked captures cover nine routes, 320/390/430/1280px, Cairo/RTL/light, LTR facts, overflow, focus/Escape/restoration, reachable actions and employee navigation clearance. Long-review 320/1280px and dirty-conflict 320px captures were inspected. **52 fresh masked PNGs** are preserved in ignored `node_modules/.cache/p05-convergence-review/`; prior review artifacts remain intact. Native npm cache reuse is separate from fresh per-scenario database/API/storage and is not production installation parity.

Task-owned P05 containers/snapshots are absent after cleanup. The interrupted-run snapshot required cleanup: the tool rejected the initial computed-path removal command as blocked by policy; read-only verification of its exact absolute path and a narrower literal-path PowerShell removal succeeded. No unrelated database container or cache directory was removed.

Applied speckit-implement, clean-code-guard, test-guard, security-best-practices, React performance guidance, playwright and docs-guard. Final production review is clean; changed tests retain real infrastructure and all financial/privacy/retention assertions. The preview availability guard and hidden-state URL lifecycle are covered by component acceptance. Documentation symbols, paths, limits, commands and results were checked against source and actual runs. **clean-code-guard: clean; no required in-scope finding remains.**

**T095, T093 and T094 are complete, and all 95 implementation tasks are checked. Gate B and Gate F are revalidated for this scope.** T001-T092's original accepted content was compared unchanged; the feature pointer and requirements approvals stay read-only. Approved UI boundaries, financial policies, migrations, dependencies and unrelated working-tree changes are preserved. `.specify/extensions.yml` remains absent, so post hooks are skipped. Prior Gate B migration/race/rollback/resource evidence is reused where unchanged; this is not a full-current-regression checkpoint or production/launch acceptance. No new CONVERGE assessment, next phase, deployment, commit/push or real-funds operation ran.
