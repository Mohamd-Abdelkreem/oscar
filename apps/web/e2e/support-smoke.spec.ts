import { test, expect } from "./support/fixtures";

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
