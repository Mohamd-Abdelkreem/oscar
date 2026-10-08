# P07 T048/T049 recorded command results — 2026-10-08

These excerpts and results are retained from the actual tool execution record in this chat. They are not complete raw stdout logs. Earlier logs were mistakenly stored in Playwright's disposable `output/playwright/p03` directory and were cleared when later browser runs initialized. Current browser logs and captures will be copied into this separate ignored directory after completion.

## Focused acceptance

- Initial component regression: 1 failed, 4 passed (unnamed dialog).
- Final deposit screen component suite: 5 passed, exit 0; 36.74 seconds.
- Existing confirmation dialog suite: 2 passed, exit 0; 3.90 seconds.
- Final web lint, web types and web E2E types: exit 0.
- Corrected admin deposit adapter suite: 20 passed, exit 0; 4.06 seconds.
- Affected deposit/financial contract suites: 142 passed in two files, exit 0; 1.20 seconds.
- Both package E2E type profiles passed fresh, exit 0.

Final focused browser output, captured from the completed command:

```text
P03-SCENARIO-1 passed
P03-SCENARIO-2 passed
P03-SCENARIO-3 passed
P03-SCENARIO-4 passed
P03-SCENARIO-5 passed
P03-SCENARIO-6 passed
P03-SCENARIO-7 passed
P03-RUN passed
P07_FOCUSED_BROWSER_EXIT=0
```

## Full aggregate

`pnpm verify` passed with native tool exit 0. Recorded output fragments:

```text
@template/web:test:  Test Files  98 passed (98)
@template/web:test:       Tests  564 passed (564)
@template/web:test:    Duration  192.98s
@template/database:test:integration:  Test Files  8 passed (8)
@template/database:test:integration:       Tests  66 passed (66)
@template/database:test:integration:    Duration  123.88s
@template/api:test:integration:  Test Files  37 passed (37)
@template/api:test:integration:       Tests  445 passed (445)
@template/api:test:integration:    Duration  2093.74s
```

Execution provenance from recorded Turbo output: web lint/types/tests/build fresh; lint and types each 3/4 cached; unit graph 5/6 cached (API 451/451, contracts 275/275, database 9/9 and two dependency builds); both integrations bypassed cache, with two cached dependency builds; build 3/4 cached (API/contracts/database).

Final aggregate output fragment:

```text
 Tasks:    4 successful, 4 total
Cached:    3 cached, 4 total
  Time:    52.431s
$ node scripts/assert-build-output.mjs
Build output verified: 13 required entry artifacts present; 728 emitted files contain no test artifacts.
P07_CONVERGENCE_VERIFY_EXIT=0
```

Database schema hash before/after aggregate: `7DE8C65C71DB438F877F95CDC41C4D6A0D51C06B343177403856046282CD3287`. The task-publication integration file passed 7/7 in 44.69 seconds. A non-fatal pg Client.query deprecation appeared during API integration.

## Interrupted full browser attempt

44 scenarios passed. Recorded failure output:

```text
P03-SCENARIO-45 failed P03_API_START_FAILED
P03-SCENARIO-46 failed P03_API_START_FAILED
P03-SCENARIO-47 failed P03_API_START_FAILED
```

The run was interrupted with tool exit 1; there was no completed runner result. Docker was unavailable concurrently. After recovery, Docker info reported server 29.1.3/Linux and both test-service ports were free. Startup logs reported insufficient disk space copying the distribution during restart; the trigger for that restart was not established. Current free-space checks passed; no unrelated Docker data was pruned and no source/config/test-policy changes were made. A new entire-suite run is in progress.

## Final entire browser acceptance

The new entire-suite run completed 91/91 scenarios, one worker/no retries, native tool exit 0. Complete raw stdout is retained in `full-browser-final.log` in this same directory. It ends with:

```text
P03-SCENARIO-91 passed
P03-RUN passed
P07_CONVERGENCE_FULL_BROWSER_EXIT=0
```

Fresh independent QR equality passed 16/16; `p07-qr-decoding.json` and P07 PNG captures are retained alongside this record, outside Playwright's disposable directory. Earlier failures and log-retention limitations above remain historical facts.
