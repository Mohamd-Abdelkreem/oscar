import { test, expect, p07Fixtures, p07State } from "./support/fixtures";
import { randomUUID } from "node:crypto";
import {
  identitySessionDataSchema,
  successEnvelopeSchema,
  depositAddressEnvelopeSchema,
  depositHistoryEnvelopeSchema,
  adminDepositHistoryEnvelopeSchema,
  manualCreditTargetsEnvelopeSchema,
  manualCreditEnvelopeSchema,
} from "@template/contracts";
import {
  managementActor,
  managementApiUrl,
  managementPassword,
} from "./support/admin-management";

test("P07 private support provisions through real HTTP and preserves exact chain/manual effects", async ({
  scenario,
  request,
}) => {
  const fixtures = await p07Fixtures(scenario);
  const before = await p07State(scenario, "employee@p03.test");
  expect(before.assignment).toBeNull();
  // Synthetic READY must refuse a missing real provisioning request.
  await expect(
    scenario.command({ command: "p07-ready", email: "employee@p03.test" }),
  ).rejects.toThrow("P03_API_FAILED");
  const login = await request.post(`${managementApiUrl}/auth/login`, {
    data: {
      email: "employee@p03.test",
      password: managementPassword,
      rememberMe: false,
    },
  });
  expect(login.status()).toBe(200);
  const actor = identitySessionDataSchema.parse(
    successEnvelopeSchema.parse(await login.json()).data,
  );
  const csrf = (await request.storageState()).cookies.find(
    (cookie) => cookie.name === "csrfToken",
  );
  if (!csrf) throw new Error("P07_CSRF_MISSING");
  const headers = {
    Authorization: `Bearer ${actor.tokens.accessToken}`,
    "x-csrf-token": csrf.value,
  };
  const readAddress = async () => {
    const response = await request.get(
      `${managementApiUrl}/deposits/me/address`,
      { headers },
    );
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    return depositAddressEnvelopeSchema.parse(await response.json()).data;
  };
  expect((await readAddress()).state).toBe("UNASSIGNED");
  const noCsrf = await request.post(`${managementApiUrl}/deposits/me/address`, {
    headers: { Authorization: headers.Authorization },
    data: {},
  });
  expect(noCsrf.status()).toBe(403);
  const provision = await request.post(
    `${managementApiUrl}/deposits/me/address`,
    { headers, data: {} },
  );
  expect(provision.status()).toBe(202);
  expect(
    depositAddressEnvelopeSchema.parse(await provision.json()).data.state,
  ).toBe("PROVISIONING");
  expect(
    (await p07State(scenario, "employee@p03.test")).assignment?.state,
  ).toBe("REQUESTED");
  await scenario.command({ command: "p07-ready", email: "employee@p03.test" });
  const ready = await readAddress();
  expect(ready).toMatchObject({
    state: "READY",
    network: "TRON_NILE",
    token: { symbol: "USDT", decimals: 6 },
  });
  for (const event of ["unfinalized", "wrong-token"] as const)
    await scenario.command({
      command: "p07-credit",
      email: "employee@p03.test",
      event,
    });
  expect((await p07State(scenario, "employee@p03.test")).wallet).toEqual(
    before.wallet,
  );
  for (let replay = 0; replay < 2; replay++)
    await scenario.command({
      command: "p07-credit",
      email: "employee@p03.test",
      event: "two-logs",
    });
  const chain = await p07State(scenario, "employee@p03.test");
  expect(chain.receipts).toHaveLength(2);
  expect(chain.receipts[0]?.transactionId).toBe(
    chain.receipts[1]?.transactionId,
  );
  expect(chain.receipts.map((receipt) => receipt.amount)).toEqual([
    "1.000001",
    "2.000001",
  ]);
  expect(chain.wallet).toMatchObject({
    availableNonReferral: "3.000002",
    availableReferral: "0",
    reservedReferral: "0",
    reservedNonReferral: "0",
  });
  expect(chain.operations).toBe(2);
  expect(chain.auditCount).toBe(2);
  expect(chain.reservations).toEqual(before.reservations);
  const history = await request.get(`${managementApiUrl}/deposits/me/history`, {
    headers,
  });
  expect(
    depositHistoryEnvelopeSchema.parse(await history.json()).data.items,
  ).toHaveLength(2);
  expect(
    (
      await request.get(
        `${managementApiUrl}/admin/employees/manual-credit-targets`,
        { headers },
      )
    ).status(),
  ).toBe(403);
  const admin = await managementActor(request);
  const targets = await request.get(
    `${managementApiUrl}/admin/employees/manual-credit-targets?q=first-credit`,
    { headers: admin.headers },
  );
  expect(
    manualCreditTargetsEnvelopeSchema.parse(await targets.json()).data.items,
  ).toEqual([
    expect.objectContaining({
      id: fixtures.firstCreditId,
      email: "first-credit@p07.test",
    }),
  ]);
  const actionId = randomUUID();
  const grant = await request.post(
    `${managementApiUrl}/admin/deposits/manual-credits`,
    {
      headers: {
        ...admin.headers,
        "Idempotency-Key": actionId,
      },
      data: {
        actionId,
        employeeId: fixtures.firstCreditId,
        amount: "1.000001",
        confirmed: true,
        reason: "P07 exact first grant",
        reference: { kind: "EXTERNAL", value: "P07 support grant" },
      },
    },
  );
  expect(grant.status()).toBe(201);
  const granted = manualCreditEnvelopeSchema.parse(await grant.json()).data;
  expect(granted).toMatchObject({
    actionId,
    amount: "1.000001",
    employeeId: fixtures.firstCreditId,
  });
  const observation = await request.get(
    `${managementApiUrl}/admin/deposits/manual-credits/${actionId}`,
    { headers: admin.headers },
  );
  expect(
    manualCreditEnvelopeSchema.parse(await observation.json()).data.operationId,
  ).toBe(granted.operationId);
  const adminHistory = await request.get(
    `${managementApiUrl}/admin/deposits?employeeId=${fixtures.firstCreditId}`,
    { headers: admin.headers },
  );
  expect(
    adminDepositHistoryEnvelopeSchema.parse(await adminHistory.json()).data
      .items,
  ).toHaveLength(1);
  const manual = await p07State(scenario, "first-credit@p07.test");
  expect(manual.wallet.total).toBe("1.000001");
  expect(manual).toMatchObject({
    manualCredits: 1,
    operations: 1,
    auditCount: 1,
    receipts: [],
    reservations: [],
  });
  expect(await p07State(scenario, "employee@p03.test")).toEqual(chain);
});

test("P03 support starts isolated migrated persistence and actual HTTP routes", async ({
  scenario,
  request,
}) => {
  const state = await scenario.command({
    command: "state",
    email: "employee@p03.test",
  });
  expect(state).toMatchObject({
    user: { role: "USER", status: "ACTIVE", verified: true, sessions: 0 },
  });
  const response = await request.get(
    "http://127.0.0.1:4103/api/v1/health/live",
  );
  expect(response.ok()).toBe(true);
});

test("P03 support starts isolated real services and a fresh browser", async ({
  page,
  scenario,
}) => {
  const state = await scenario.command({
    command: "state",
    email: "employee@p03.test",
  });
  expect(state).toMatchObject({
    user: { role: "USER", status: "ACTIVE", verified: true, sessions: 0 },
  });
  const response = await page.goto("/employee/auth/reset-password");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(await page.context().cookies()).toEqual([]);
});
