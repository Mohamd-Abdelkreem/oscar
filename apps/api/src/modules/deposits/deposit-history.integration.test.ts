import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import request from "supertest";
import pino from "pino";
import { createApp } from "../../app.js";
import { Prisma } from "@template/database";
import { readDepositHistory } from "./deposits.queries.js";
import { fenceFinancialRuntime } from "../custody/runtime-control.js";
import {
  depositHistoryDataSchema,
  adminDepositHistoryDataSchema,
  paginatedFinancialEnvelopeSchema,
  depositAddressEnvelopeSchema,
  successEnvelopeSchema,
  errorEnvelopeSchema,
} from "@template/contracts";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import {
  withAdmittedFinancialDatabase,
  financialFixtureAdmission,
} from "../ledger/testing/financial-fixtures.js";
import { ManualCreditService } from "./manual-credit.service.js";
import { DepositCreditService } from "./deposit-credit.service.js";
import { DepositVerifier } from "./deposit-verifier.js";
import { DepositIndexer } from "./deposit-indexer.js";
import {
  bindDepositAssignment,
  depositClock,
  rawDeposit,
  withDepositProvider,
} from "./testing/deposit-fixtures.js";
import {
  depositHttp,
  depositIdentity,
  manualGrant,
  manualState,
} from "./testing/deposit-http-fixtures.js";

describe("deposit HTTP history and provisioning", () => {
  it.each(["unfinalized", "disappeared", "conflict"] as const)(
    "projects owned %s candidates without inventing history or affecting another owner",
    async (scenario) =>
      withAdmittedFinancialDatabase(async (database) => {
        const employee = await createIdentityFixture(database);
        const other = await createIdentityFixture(database);
        if (employee.wallet === null) throw new Error("Missing wallet");
        const walletId = employee.wallet.id;
        const account = await bindDepositAssignment(
          database,
          { ownerUserId: employee.user.id, wallet: employee.wallet },
          undefined,
          new Date(),
        );
        const raw = rawDeposit();
        let unavailable = scenario === "disappeared";
        if (scenario === "unfinalized")
          raw.solidified.block_header.raw_data.number = 122;
        if (scenario === "conflict")
          raw.block.transactions = [{ txID: "ff".repeat(32) }];
        const before = await database.wallet.findUniqueOrThrow({
          where: { id: employee.wallet.id },
        });
        let now = depositClock();
        await withDepositProvider(
          raw,
          async (provider, config) => {
            const admission = financialFixtureAdmission(database);
            const credit = new DepositCreditService(
              database,
              new DepositVerifier(database, provider, config, () => now),
              admission,
              () => now,
            );
            const indexer = new DepositIndexer(database, {
              provider,
              config,
              credit,
              admission,
              clock: () => now,
            });
            await indexer.scanNext();
            expect(
              await database.depositCandidateDiscovery.count({
                where: { assignmentId: account.assignmentId },
              }),
            ).toBe(1);
            await indexer.accountNext();
            const candidate =
              await database.depositCandidate.findFirstOrThrow();
            expect(candidate.lastErrorCode).not.toBeNull();
            const http = depositHttp(database);
            for (const path of [
              "/deposits/me/address",
              "/deposits/me/history",
            ]) {
              const response = await http.read(path, employee);
              expect(response.status).toBe(200);
              const data = successEnvelopeSchema.parse(response.body).data;
              expect(data).toMatchObject({
                detection: {
                  status: scenario === "conflict" ? "UNRESOLVED" : "RETRYING",
                },
              });
            }
            const otherHistory = depositHistoryDataSchema.parse(
              successEnvelopeSchema.parse(
                (await http.read("/deposits/me/history", other)).body,
              ).data,
            );
            expect(otherHistory.detection.status).toBe("NOT_STARTED");
            expect(otherHistory.items).toEqual([]);
            expect(await database.depositReceipt.count()).toBe(0);
            expect(await database.financialOperation.count()).toBe(0);
            expect(
              await database.wallet.findUniqueOrThrow({
                where: { id: walletId },
              }),
            ).toEqual(before);
            if (scenario !== "conflict") {
              unavailable = false;
              raw.solidified.block_header.raw_data.number = 123;
              now = new Date(now.getTime() + 60000);
              await indexer.accountNext();
              const recovered = depositHistoryDataSchema.parse(
                successEnvelopeSchema.parse(
                  (await http.read("/deposits/me/history", employee)).body,
                ).data,
              );
              expect(recovered.detection.status).toBe("SCANNING");
              expect(recovered.items).toHaveLength(1);
              expect(await database.depositReceipt.count()).toBe(1);
            }
          },
          () =>
            new Response(
              JSON.stringify({
                success: true,
                data: [
                  {
                    transaction_id: raw.transactionId,
                    block_timestamp: raw.info.blockTimeStamp,
                  },
                ],
                meta: {},
              }),
            ),
          () => (unavailable ? {} : raw.info),
        );
      }),
  );
  it("keeps rows and filtered counts on one snapshot while later responses see a concurrent grant", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const grants = new ManualCreditService(
        database,
        () => new Date(),
        financialFixtureAdmission(database),
      );
      await grants.create(
        depositIdentity(admin),
        manualGrant(employee.user.id),
        randomUUID(),
      );
      await database.$transaction(
        async (transaction) => {
          const query = { page: 1, limit: 25, kind: "MANUAL_CREDIT" as const };
          const first = await readDepositHistory(
            transaction,
            query,
            employee.user.id,
          );
          // The root client's separate connection commits after the reader established its snapshot.
          await grants.create(
            depositIdentity(admin),
            manualGrant(employee.user.id),
            randomUUID(),
          );
          const sameSnapshot = await readDepositHistory(
            transaction,
            query,
            employee.user.id,
          );
          expect(sameSnapshot.total).toBe(1);
          expect(sameSnapshot.operations).toEqual(first.operations);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
      );
      const response = await depositHttp(database).read(
        "/deposits/me/history?kind=MANUAL_CREDIT",
        employee,
      );
      const history = paginatedFinancialEnvelopeSchema(
        depositHistoryDataSchema,
      ).parse(response.body).data;
      expect(history.items).toHaveLength(2);
      expect(history.pagination.total).toBe(2);
    }));
  it("reaches chain and manual rows sharing a history ID and recorded time exactly once", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      if (employee.wallet === null) throw new Error("Missing wallet");
      await bindDepositAssignment(database, {
        ownerUserId: employee.user.id,
        wallet: employee.wallet,
      });
      const raw = rawDeposit();
      await withDepositProvider(raw, async (provider, config) => {
        const credit = new DepositCreditService(
          database,
          new DepositVerifier(database, provider, config, depositClock),
          financialFixtureAdmission(database),
          depositClock,
        );
        expect((await credit.process(raw.transactionId)).state).toBe(
          "ACCOUNTED",
        );
      });
      const receipt = await database.depositReceipt.findFirstOrThrow();
      await new ManualCreditService(
        database,
        depositClock,
        financialFixtureAdmission(database),
      ).create(
        depositIdentity(admin),
        { ...manualGrant(employee.user.id), actionId: receipt.id },
        randomUUID(),
      );
      const grant = await database.manualCredit.findUniqueOrThrow({
        where: { id: receipt.id },
      });
      expect(grant.recordedAt).toEqual(receipt.recordedAt);
      const expected = [
        receipt.financialOperationId,
        grant.financialOperationId,
      ]
        .sort()
        .reverse();
      const http = depositHttp(database);
      for (const [path, identity] of [
        ["/deposits/me/history", employee],
        ["/admin/deposits?employeeId=" + employee.user.id, admin],
      ] as const) {
        for (let repeat = 0; repeat < 3; repeat++) {
          const found: string[] = [];
          for (let page = 1; page <= 2; page++) {
            const response = await http.read(
              path +
                (path.includes("?") ? "&" : "?") +
                `page=${String(page)}&limit=1`,
              identity,
            );
            const data = successEnvelopeSchema.parse(response.body).data;
            const history =
              identity.user.role === "ADMIN"
                ? adminDepositHistoryDataSchema.parse(data)
                : depositHistoryDataSchema.parse(data);
            expect(history.pagination.total).toBe(2);
            expect(history.items).toHaveLength(1);
            found.push(...history.items.map((row) => row.operationId));
          }
          expect(found).toEqual(expected);
          expect(new Set(found).size).toBe(2);
        }
      }
    }));
  it("keeps GET read-only and returns durable pending, readiness and safe failure distinctly", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      const http = depositHttp(database);
      expect(
        (await request(http.app).get("/api/v1/deposits/me/address")).status,
      ).toBe(401);
      expect(
        depositAddressEnvelopeSchema.parse(
          (await http.read("/deposits/me/address", employee)).body,
        ).data.state,
      ).toBe("UNASSIGNED");
      expect(await database.depositAddressAssignment.count()).toBe(0);
      const pending = await http
        .write("/deposits/me/address", employee)
        .send({});
      expect(pending.status).toBe(202);
      expect(depositAddressEnvelopeSchema.parse(pending.body).data.state).toBe(
        "PROVISIONING",
      );
      const pendingData = depositAddressEnvelopeSchema.parse(pending.body).data;
      if (pendingData.state !== "PROVISIONING")
        throw new Error("Expected provisioning fixture");
      const [repeat, concurrent] = await Promise.all([
        http.write("/deposits/me/address", employee).send({}),
        http.write("/deposits/me/address", employee).send({}),
      ]);
      expect(
        depositAddressEnvelopeSchema.parse(concurrent.body).data,
      ).toMatchObject({ assignmentId: pendingData.assignmentId });
      expect(
        depositAddressEnvelopeSchema.parse(repeat.body).data,
      ).toMatchObject({ assignmentId: pendingData.assignmentId });
      await database.depositAddressAssignment.update({
        where: { id: pendingData.assignmentId },
        data: { lastErrorCode: "RECOVERY_UNAVAILABLE" },
      });
      const unavailable = await http.read("/deposits/me/address", employee);
      expect(
        depositAddressEnvelopeSchema.parse(unavailable.body).data,
      ).toMatchObject({
        state: "UNAVAILABLE",
        reasonCode: "RECOVERY_UNAVAILABLE",
      });
      expect(
        depositAddressEnvelopeSchema.parse(unavailable.body).data,
      ).not.toHaveProperty("address");
      expect((await http.read("/deposits/me/address", admin)).status).toBe(403);
      expect(
        (
          await http
            .write("/deposits/me/address", employee)
            .send({ employeeId: admin.user.id })
        ).status,
      ).toBe(400);
      await fenceFinancialRuntime(database, {
        operatorIdentity: "test-only-recovery",
        reason: "Test restore fence",
      });
      const fenced = await http
        .write("/deposits/me/address", employee)
        .send({});
      expect(fenced.status).toBe(409);
      expect(errorEnvelopeSchema.parse(fenced.body).code).toBe(
        "FINANCIAL_WRITES_FENCED",
      );
      expect(await database.depositAddressAssignment.count()).toBe(1);
      expect((await http.read("/deposits/me/address", employee)).status).toBe(
        200,
      );
      expect(
        (
          await http
            .write("/deposits/me/address", employee)
            .set("Cookie", "")
            .set("X-CSRF-Token", "")
            .send({})
        ).status,
      ).toBe(403);
      expect(
        (
          await http.read(
            "/deposits/me/address?employeeId=" + admin.user.id,
            employee,
          )
        ).status,
      ).toBe(400);
      await database.authSession.update({
        where: { id: employee.session.id },
        data: { revokedAt: new Date() },
      });
      expect((await http.read("/deposits/me/address", employee)).status).toBe(
        401,
      );
    }));
  it("pages tied chain/manual history using recorded-time filters and employee/admin allowlists", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const other = await createIdentityFixture(database);
      const admin = await createIdentityFixture(database, { role: "ADMIN" });
      if (employee.wallet === null) throw new Error("Employee wallet required");
      await bindDepositAssignment(
        database,
        {
          ownerUserId: employee.user.id,
          wallet: employee.wallet,
        },
        undefined,
        new Date(),
      );
      const raw = rawDeposit();
      const verification = new Date("2026-10-10T19:59:00.000Z");
      await withDepositProvider(raw, async (provider, config) => {
        expect(
          (
            await new DepositCreditService(
              database,
              new DepositVerifier(
                database,
                provider,
                config,
                () => verification,
              ),
              financialFixtureAdmission(database),
              depositClock,
            ).process(raw.transactionId)
          ).state,
        ).toBe("ACCOUNTED");
      });
      const grants = new ManualCreditService(
        database,
        depositClock,
        financialFixtureAdmission(database),
      );
      for (let index = 0; index < 2; index++)
        await grants.create(
          depositIdentity(admin),
          manualGrant(employee.user.id),
          randomUUID(),
        );
      await grants.create(
        depositIdentity(admin),
        manualGrant(other.user.id),
        randomUUID(),
      );
      const http = depositHttp(database);
      const address = await http.read("/deposits/me/address", employee);
      expect(address.status).toBe(200);
      expect(
        depositAddressEnvelopeSchema.parse(address.body).data,
      ).toMatchObject({ state: "READY", detection: { status: "NOT_STARTED" } });
      expect(
        (await http.write("/deposits/me/address", employee).send({})).status,
      ).toBe(200);
      const before = await manualState(database);
      const expectedIds = [
        ...before.receipts.map((row) => row.id),
        ...before.grants
          .filter((row) => row.employeeId === employee.user.id)
          .map((row) => row.id),
      ]
        .sort()
        .reverse();
      const found: string[] = [];
      for (let page = 1; page <= 3; page++) {
        const response = await http.read(
          `/deposits/me/history?page=${String(page)}&limit=1`,
          employee,
        );
        expect(response.status).toBe(200);
        expect(response.headers["cache-control"]).toBe("no-store");
        const history = paginatedFinancialEnvelopeSchema(
          depositHistoryDataSchema,
        ).parse(response.body).data;
        expect(history.pagination.total).toBe(3);
        found.push(...history.items.map((row) => row.id));
        for (const row of history.items) {
          expect(row.recordedAt).toBe(depositClock().toISOString());
          if (row.kind === "CHAIN_DEPOSIT")
            expect(row.confirmedAt).toBe(verification.toISOString());
          else {
            expect(row).not.toHaveProperty("reason");
            expect(row).not.toHaveProperty("actor");
            expect(row).not.toHaveProperty("reference");
            expect(row).not.toHaveProperty("confirmedAt");
          }
        }
      }
      expect(found).toEqual(expectedIds);
      const filtered = await http.read(
        `/admin/deposits?employeeId=${employee.user.id}&kind=MANUAL_CREDIT&from=${depositClock().toISOString()}&to=${depositClock().toISOString()}`,
        admin,
      );
      expect(
        adminDepositHistoryDataSchema.parse(
          successEnvelopeSchema.parse(filtered.body).data,
        ).pagination.total,
      ).toBe(2);
      const chain = await http.read(
        `/admin/deposits?transactionId=${raw.transactionId}`,
        admin,
      );
      expect(
        adminDepositHistoryDataSchema.parse(
          successEnvelopeSchema.parse(chain.body).data,
        ).pagination.total,
      ).toBe(1);
      const noRows = await http.read(
        "/deposits/me/history?to=2026-10-10T19:59:59Z",
        employee,
      );
      expect(
        depositHistoryDataSchema.parse(
          successEnvelopeSchema.parse(noRows.body).data,
        ).pagination,
      ).toMatchObject({ total: 0, totalPages: 0 });
      expect(
        adminDepositHistoryDataSchema.parse(
          successEnvelopeSchema.parse(
            (await http.read("/admin/deposits?q=no-matching-person", admin))
              .body,
          ).data,
        ).pagination.total,
      ).toBe(0);
      expect((await http.read("/admin/deposits", employee)).status).toBe(403);
      expect(
        (
          await http.read(
            "/deposits/me/history?employeeId=" + other.user.id,
            employee,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await http.read(
            "/admin/deposits/manual-credits/" + randomUUID(),
            admin,
          )
        ).status,
      ).toBe(404);
      expect(await manualState(database)).toEqual(before);
    }));
  it("returns unavailable configuration instead of an invented address or empty history", async () =>
    withAdmittedFinancialDatabase(async (database) => {
      const employee = await createIdentityFixture(database);
      const configured = depositHttp(database);
      const app = createApp({
        database,
        logger: pino({ level: "silent" }),
        financialAdmission: financialFixtureAdmission(database),
        emailDelivery: {
          provider: "console",
          send: () => Promise.resolve({ providerMessageId: "unused" }),
        },
      });
      for (const path of ["/deposits/me/address", "/deposits/me/history"]) {
        const unavailable = await request(app)
          .get("/api/v1" + path)
          .auth(configured.credential(employee), { type: "bearer" });
        expect(unavailable.status).toBe(503);
        expect(errorEnvelopeSchema.parse(unavailable.body).code).toBe(
          "DEPOSIT_UNAVAILABLE",
        );
        expect(unavailable.headers["cache-control"]).toBe("no-store");
      }
    }));
});
