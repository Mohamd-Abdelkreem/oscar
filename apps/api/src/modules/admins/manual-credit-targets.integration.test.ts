import { randomUUID } from "node:crypto";
import { setImmediate as nextTurn } from "node:timers/promises";
import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  manualCreditTargetsEnvelopeSchema,
  errorEnvelopeSchema,
} from "@template/contracts";

import {
  createIdentityFixture,
  withIdentityDatabase,
} from "../auth/testing/identity-fixtures.js";
import {
  depositHttp,
  depositIdentity,
  manualGrant,
  manualState,
} from "../deposits/testing/deposit-http-fixtures.js";
import { withSubscriptionUserLock } from "../subscriptions/testing/subscription-fixtures.js";
import { AdminsService } from "./admins.service.js";

const path = "/admin/employees/manual-credit-targets";

describe("P07 current-admin manual credit target lookup", () => {
  it("denies anonymous, USER, stale/revoked and disabled ADMIN credentials", async () =>
    withIdentityDatabase(async (database) => {
      const http = depositHttp(database);
      expect((await request(http.app).get(`/api/v1${path}`)).status).toBe(401);
      const employee = await createIdentityFixture(database);
      expect((await http.read(path, employee)).status).toBe(403);
      for (const disposition of ["expired", "revoked", "disabled"] as const) {
        const actor = await createIdentityFixture(database, { role: "ADMIN" });
        const credential = http.credential(actor);
        if (disposition === "expired" || disposition === "revoked") {
          await database.authSession.update({
            where: { id: actor.session.id },
            data:
              disposition === "expired"
                ? { expiresAt: new Date() }
                : { revokedAt: new Date() },
          });
        } else {
          await database.user.update({
            where: { id: actor.user.id },
            data: { status: "DEACTIVATED" },
          });
        }
        const denied = await request(http.app)
          .get(`/api/v1${path}`)
          .auth(credential, { type: "bearer" });
        expect(denied.status).toBe(401);
        expect(errorEnvelopeSchema.parse(denied.body).code).toBe(
          "UNAUTHORIZED",
        );
        expect(denied.headers["cache-control"]).toBe("no-store");
      }
    }));

  it("reaches first-credit USER wallets of every status with bounded search and stable pages under a financial fence", async () =>
    withIdentityDatabase(async (database) => {
      const actor = await createIdentityFixture(database, { role: "ADMIN" });
      const http = depositHttp(database);
      const createdAt = new Date("2026-10-01T00:00:00Z");
      const targets = [];
      for (const status of [
        "ACTIVE",
        "PENDING_VERIFICATION",
        "SUSPENDED",
        "BANNED",
      ] as const) {
        const target = await createIdentityFixture(database, { status });
        await database.user.update({
          where: { id: target.user.id },
          data: {
            fullName: "Duplicate Target",
            email: `target-${status.toLowerCase()}@example.com`,
            createdAt,
            tasksBlocked: true,
            withdrawalsBlocked: true,
          },
        });
        targets.push(target.user.id);
      }
      const withoutWallet = await createIdentityFixture(database);
      await database.wallet.delete({
        where: { ownerUserId: withoutWallet.user.id },
      });
      const before = await manualState(database);
      const found = [];
      for (let page = 1; page <= 2; page++) {
        const response = await http.read(
          `${path}?page=${String(page)}&limit=2&q=%20duplicate%20`,
          actor,
        );
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const parsed = manualCreditTargetsEnvelopeSchema.parse(response.body);
        expect(parsed.data.pagination).toMatchObject({
          total: 4,
          totalPages: 2,
          page,
          limit: 2,
        });
        for (const target of parsed.data.items) {
          expect(Object.keys(target).sort()).toEqual(["email", "id", "name"]);
          found.push(target.id);
        }
      }
      expect(found).toEqual(targets.sort().reverse());
      const email = await http.read(`${path}?q=TARGET-BANNED`, actor);
      expect(
        manualCreditTargetsEnvelopeSchema.parse(email.body).data.items,
      ).toHaveLength(1);
      const all = manualCreditTargetsEnvelopeSchema.parse(
        (await http.read(path, actor)).body,
      ).data;
      expect(all.pagination.total).toBe(4);
      for (const selection of ["q=missing", "page=4&limit=2"]) {
        expect(
          manualCreditTargetsEnvelopeSchema.parse(
            (await http.read(`${path}?${selection}`, actor)).body,
          ).data.items,
        ).toEqual([]);
      }
      for (const invalid of [
        "limit=101",
        "page=0",
        "q=a&q=b",
        "status=ACTIVE",
        `page=${String(Number.MAX_SAFE_INTEGER)}&limit=100`,
      ]) {
        expect((await http.read(`${path}?${invalid}`, actor)).status).toBe(400);
      }
      // The default unacknowledged financial boot remains fenced; reads never open it.
      const grant = await http
        .write("/admin/deposits/manual-credits", actor)
        .set("Idempotency-Key", randomUUID())
        .send(manualGrant(found[0] ?? actor.user.id));
      expect(grant.status).toBe(409);
      expect(errorEnvelopeSchema.parse(grant.body).code).toBe(
        "FINANCIAL_WRITES_FENCED",
      );
      expect(await manualState(database)).toEqual(before);
    }));

  it("uses one rows/count snapshot while an independent connection commits a new target", async () =>
    withIdentityDatabase(async (database) => {
      const actor = await createIdentityFixture(database, { role: "ADMIN" });
      const first = await createIdentityFixture(database);
      await withSubscriptionUserLock(
        database,
        actor.user.id,
        async (release) => {
          const pending = new AdminsService(database).listManualCreditTargets(
            depositIdentity(actor),
            { page: 1, limit: 25 },
          );
          try {
            let blocked = false;
            for (let attempt = 0; attempt < 100; attempt++) {
              const activity = await database.$queryRaw<
                { blocked: boolean }[]
              >`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND query LIKE '%ORDER BY id FOR UPDATE%' AND wait_event_type='Lock') AS blocked`;
              if (activity[0]?.blocked) {
                blocked = true;
                break;
              }
              await nextTurn();
            }
            expect(blocked).toBe(true);
            await createIdentityFixture(database);
            release();
            const page = await pending;
            expect(page.items.map((target) => target.id)).toEqual([
              first.user.id,
            ]);
            expect(page.pagination.total).toBe(1);
          } finally {
            release();
            await pending;
          }
        },
      );
      const fresh = await new AdminsService(database).listManualCreditTargets(
        depositIdentity(actor),
        { page: 1, limit: 25 },
      );
      expect(fresh.items).toHaveLength(2);
      expect(fresh.pagination.total).toBe(2);
      await database.authSession.update({
        where: { id: actor.session.id },
        data: { revokedAt: new Date() },
      });
      await expect(
        new AdminsService(database).listManualCreditTargets(
          depositIdentity(actor),
          { page: 1, limit: 25 },
        ),
      ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }));
});
