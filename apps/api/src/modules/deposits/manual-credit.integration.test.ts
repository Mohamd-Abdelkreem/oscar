import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import {
  manualCreditOutcomeSchema,
  manualCreditEnvelopeSchema,
  errorEnvelopeSchema,
  MAX_USDT_AMOUNT,
} from "@template/contracts";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import {
  withAdmittedFinancialDatabase,
  financialFixtureAdmission,
  withAdmittedIndependentFinancialClients,
  financialRaceBarrier,
} from "../ledger/testing/financial-fixtures.js";
import { LedgerService } from "../ledger/ledger.service.js";
import { ManualCreditService } from "./manual-credit.service.js";
import {
  depositHttp,
  depositIdentity,
  manualGrant,
  manualState,
} from "./testing/deposit-http-fixtures.js";

describe("manual administrative grants", () => {
  it("rejects representable addition overflow and corrupt committed evidence without partial alias or money writes", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const service = new ManualCreditService(
        database,
        () => new Date(),
        financialFixtureAdmission(database),
      );
      const body = {
        ...manualGrant(employee.user.id),
        amount: MAX_USDT_AMOUNT,
      };
      const committed = await service.create(
        depositIdentity(admin),
        body,
        randomUUID(),
      );
      const before = await manualState(database);
      await expect(
        service.create(
          depositIdentity(admin),
          manualGrant(employee.user.id),
          randomUUID(),
        ),
      ).rejects.toMatchObject({ code: "FINANCIAL_AMOUNT_OVERFLOW" });
      expect(await manualState(database)).toEqual(before);
      await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SET LOCAL session_replication_role = replica`;
        await transaction.manualCredit.update({
          where: { id: committed.actionId },
          data: { reason: "Damaged restored evidence" },
        });
      });
      const damaged = await manualState(database);
      await expect(
        service.create(depositIdentity(admin), body, randomUUID()),
      ).rejects.toMatchObject({ code: "DEPOSIT_UNRESOLVED" });
      await expect(
        service.outcome(depositIdentity(admin), body.actionId),
      ).rejects.toMatchObject({ code: "DEPOSIT_UNRESOLVED" });
      expect(await manualState(database)).toEqual(damaged);
    }));
  it("checks session authority inside the financial boundary for original and replay commands", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const service = new ManualCreditService(
        database,
        () => new Date(),
        financialFixtureAdmission(database),
      );
      const body = manualGrant(employee.user.id);
      await service.create(depositIdentity(admin), body, randomUUID());
      await database.authSession.update({
        where: { id: admin.session.id },
        data: { revokedAt: new Date() },
      });
      const before = await manualState(database);
      for (const intent of [body, { ...body, actionId: randomUUID() }])
        await expect(
          service.create(depositIdentity(admin), intent, randomUUID()),
        ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      expect(await manualState(database)).toEqual(before);
    }));
  it("commits an initial grant once and recovers the original outcome with a new key and GET", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const http = depositHttp(database);
      const body = manualGrant(employee.user.id);
      const first = await http
        .write("/admin/deposits/manual-credits", admin)
        .set("Idempotency-Key", body.actionId)
        .send(body);
      expect(first.status).toBe(201);
      const outcome = manualCreditOutcomeSchema.parse(
        manualCreditEnvelopeSchema.parse(first.body).data,
      );
      expect(outcome).toMatchObject({
        actionId: body.actionId,
        source: "NON_REFERRAL",
        walletAfter: { availableNonReferral: "1.000001", total: "1.000001" },
        replayed: false,
      });
      const replay = await http
        .write("/admin/deposits/manual-credits", admin)
        .set("Idempotency-Key", randomUUID())
        .send(body);
      expect(replay.status).toBe(200);
      expect(
        manualCreditOutcomeSchema.parse(
          manualCreditEnvelopeSchema.parse(replay.body).data,
        ),
      ).toEqual({ ...outcome, replayed: true });
      const before = await manualState(database);
      const read = await http.read(
        `/admin/deposits/manual-credits/${body.actionId}`,
        admin,
      );
      expect(read.status).toBe(200);
      expect(read.headers["cache-control"]).toBe("no-store");
      expect(
        manualCreditOutcomeSchema.parse(
          manualCreditEnvelopeSchema.parse(read.body).data,
        ),
      ).toEqual({ ...outcome, replayed: true });
      expect(await manualState(database)).toEqual(before);
      expect(before.grants).toHaveLength(1);
      expect(before.postings).toHaveLength(1);
      expect(before.audit).toHaveLength(1);
      expect(before.receipts).toHaveLength(0);
      expect(before.audit[0]).toMatchObject({
        reason: body.reason,
        actorUserId: admin.user.id,
        referenceOperationId: null,
      });
    }));
  it("conflicts changed action/key/actor intent and rejects foreign ledger references with no partial effect", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const other = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const secondAdmin = await createIdentityFixture(database, {
        role: "ADMIN",
      });
      const http = depositHttp(database);
      const body = manualGrant(employee.user.id);
      const first = await http
        .write("/admin/deposits/manual-credits", admin)
        .set("Idempotency-Key", body.actionId)
        .send(body);
      expect(first.status).toBe(201);
      const before = await manualState(database);
      for (const [actor, patch, key] of [
        [admin, { amount: "2" }, randomUUID()],
        [admin, { reason: "Changed reason" }, randomUUID()],
        [secondAdmin, {}, randomUUID()],
        [admin, { actionId: randomUUID() }, body.actionId],
      ] as const) {
        const response = await http
          .write("/admin/deposits/manual-credits", actor)
          .set("Idempotency-Key", key)
          .send({ ...body, ...patch });
        expect(response.status).toBe(409);
        expect(errorEnvelopeSchema.parse(response.body).code).toBe(
          "MANUAL_CREDIT_CONFLICT",
        );
      }
      const reference = {
        kind: "LEDGER_OPERATION",
        operationId: manualCreditEnvelopeSchema.parse(first.body).data
          .operationId,
      };
      const foreign = await http
        .write("/admin/deposits/manual-credits", admin)
        .set("Idempotency-Key", randomUUID())
        .send({
          ...body,
          actionId: randomUUID(),
          employeeId: other.user.id,
          reference,
        });
      expect(foreign.status).toBe(400);
      expect(errorEnvelopeSchema.parse(foreign.body).code).toBe(
        "MANUAL_CREDIT_REFERENCE_INVALID",
      );
      expect(await manualState(database)).toEqual(before);
      const valid = await http
        .write("/admin/deposits/manual-credits", admin)
        .set("Idempotency-Key", randomUUID())
        .send({ ...body, actionId: randomUUID(), reference });
      expect(valid.status).toBe(201);
      expect(await database.depositReceipt.count()).toBe(0);
      if (employee.wallet === null) throw new Error("Employee wallet required");
      const report = await new LedgerService(
        database,
        { businessNamespaces: ["p06.manual-credit"], processIds: [] },
        financialFixtureAdmission(database),
      ).reconcileWallet(employee.wallet.id, {
        actor: { type: "USER", userId: admin.user.id },
        observe: async () => {},
      });
      expect(report.consistent).toBe(true);
    }));
  it("rejects malformed intent, missing key/CSRF, wrong role and revoked ADMIN replay", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const http = depositHttp(database);
      const body = manualGrant(employee.user.id);
      for (const patch of [
        { source: "REFERRAL" },
        { confirmed: false },
        { reason: " " },
        { amount: "0" },
        { actorUserId: admin.user.id },
      ]) {
        const response = await http
          .write("/admin/deposits/manual-credits", admin)
          .set("Idempotency-Key", randomUUID())
          .send({ ...body, ...patch });
        expect(response.status).toBe(400);
      }
      expect(
        (await http.write("/admin/deposits/manual-credits", admin).send(body))
          .status,
      ).toBe(400);
      expect(
        (
          await http
            .write("/admin/deposits/manual-credits", admin)
            .set("Cookie", "")
            .set("X-CSRF-Token", "")
            .send(body)
        ).status,
      ).toBe(403);
      expect(
        (
          await http
            .write("/admin/deposits/manual-credits", employee)
            .send(body)
        ).status,
      ).toBe(403);
      const committed = await http
        .write("/admin/deposits/manual-credits", admin)
        .set("Idempotency-Key", body.actionId)
        .send(body);
      expect(committed.status).toBe(201);
      await database.authSession.update({
        where: { id: admin.session.id },
        data: { revokedAt: new Date() },
      });
      const before = await manualState(database);
      expect(
        (
          await http
            .write("/admin/deposits/manual-credits", admin)
            .set("Idempotency-Key", body.actionId)
            .send(body)
        ).status,
      ).toBe(401);
      expect(
        (
          await http.read(
            `/admin/deposits/manual-credits/${body.actionId}`,
            admin,
          )
        ).status,
      ).toBe(401);
      expect(await manualState(database)).toEqual(before);
    }));
  it("concurrent independent repeats converge on one actor/action with distinct request aliases", async () =>
    withAdmittedFinancialDatabase(async (database, url) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const body = manualGrant(employee.user.id);
      await withAdmittedIndependentFinancialClients(
        url,
        async (first, second) => {
          const barrier = financialRaceBarrier(2);
          const execute = async (client: typeof database) => {
            await barrier();
            return new ManualCreditService(
              client,
              () => new Date(),
              financialFixtureAdmission(client),
            ).create(depositIdentity(admin), body, randomUUID());
          };
          const replies = await Promise.all([execute(first), execute(second)]);
          expect(new Set(replies.map((reply) => reply.operationId)).size).toBe(
            1,
          );
          expect(replies.filter((reply) => !reply.replayed)).toHaveLength(1);
        },
      );
      expect(await database.manualCredit.count()).toBe(1);
      expect(await database.requestIdentity.count()).toBe(2);
    }));
  it.each(["audit", "domain"])(
    "rolls back late %s failure including wallet, alias and ledger",
    async (stage) =>
      withAdmittedFinancialDatabase(async (database) => {
        const employee = await createIdentityFixture(database);
        const admin = await createIdentityFixture(database, { role: "ADMIN" });
        const table =
          stage === "audit" ? "financial_audit_records" : "manual_credits";
        await database.$executeRawUnsafe(
          "CREATE FUNCTION reject_test_grant() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test-only late grant failure'; END $$",
        );
        await database.$executeRawUnsafe(
          `CREATE TRIGGER reject_test_grant BEFORE INSERT ON ${table} FOR EACH ROW EXECUTE FUNCTION reject_test_grant()`,
        );
        const before = await manualState(database);
        const response = await depositHttp(database)
          .write("/admin/deposits/manual-credits", admin)
          .set("Idempotency-Key", randomUUID())
          .send(manualGrant(employee.user.id));
        expect(response.status).toBe(500);
        expect(await manualState(database)).toEqual(before);
      }),
  );
});
