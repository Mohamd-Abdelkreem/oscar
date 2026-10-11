import { describe, expect, it } from "vitest";
import { createIdentityFixture } from "../auth/testing/identity-fixtures.js";
import { financialFixtureAdmission } from "../ledger/testing/financial-fixtures.js";
import {
  withWithdrawalDatabase,
  withClockedWithdrawalDatabase,
  controlledWithdrawalRace,
} from "./testing/withdrawal-fixtures.js";
import {
  reservationEmployee,
  reservationServices,
  RESERVATION_NOW,
} from "./testing/withdrawal-reservation-fixtures.js";
import { WithdrawalsService } from "./withdrawals.service.js";
import { EmployeeRestrictionsService } from "../users/employee-restrictions.service.js";
import {
  withWithdrawalRole,
  admitWithdrawalRuntimeFixture,
  claimWithdrawalFixture,
} from "./testing/withdrawal-authority-fixtures.js";
import { LedgerService } from "../ledger/ledger.service.js";
import {
  cancelScheduledWithdrawal,
  lockWithdrawalRequest,
  withdrawalReleaseContext,
} from "./withdrawal-cancellation.service.js";
import { withdrawalTermsHash } from "./withdrawal-quote.service.js";
import { readSessionAuthority } from "../auth/session-authority.js";
import { AuthSessionService } from "../auth/auth-session.service.js";

describe("safe scheduled withdrawal administration", () => {
  it.each(["EXTEND", "REJECT", "BLOCK", "BAN"] as const)(
    "rolls back all dependent financial and identity writes when %s action persistence fails",
    async (operation) => {
      await withWithdrawalDatabase(async (database) => {
        const employee = await reservationEmployee(database, {
          paid: true,
          nonReferral: "70",
          referral: "30",
        });
        const admin = await createIdentityFixture(database, {
          role: "ADMIN",
          now: RESERVATION_NOW,
        });
        const identity = { userId: admin.user.id, sessionId: admin.session.id };
        const services = reservationServices(database);
        const quote = await services.quotes.create(employee.identity, {
          gross: "80",
        });
        const accepted = await services.reservations.accept(employee.identity, {
          quoteId: quote.quoteId,
          confirmed: true,
        });
        const snapshot = async () => ({
          employee: await database.user.findUniqueOrThrow({
            where: { id: employee.user.id },
          }),
          sessions: await database.authSession.findMany({
            where: { userId: employee.user.id },
          }),
          wallet: await database.wallet.findUniqueOrThrow({
            where: { ownerUserId: employee.user.id },
          }),
          allocation: await database.reservationAllocation.findMany(),
          request: await database.withdrawalRequest.findUniqueOrThrow({
            where: { id: accepted.withdrawal.id },
          }),
          actions: await database.withdrawalAction.count(),
          postings: await database.ledgerPosting.count(),
          operations: await database.financialOperation.count(),
          audit: await database.auditRecord.count(),
          identityAudit: await database.identityAuditRecord.count(),
        });
        const before = await snapshot();
        await database.$executeRawUnsafe(
          "CREATE FUNCTION fail_us3_action() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'controlled action failure'; END $$",
        );
        await database.$executeRawUnsafe(
          "CREATE TRIGGER fail_us3_action BEFORE INSERT ON withdrawal_actions FOR EACH ROW EXECUTE FUNCTION fail_us3_action()",
        );
        try {
          if (operation === "EXTEND")
            await expect(
              new WithdrawalsService(
                database,
                () => RESERVATION_NOW,
                financialFixtureAdmission(database),
              ).extend(identity, accepted.withdrawal.id, {
                expectedVersion: 1,
                countedHours: "1.25",
                confirmed: true,
                reason: "Controlled rollback",
              }),
            ).rejects.toThrow();
          else if (operation === "REJECT")
            await expect(
              new WithdrawalsService(
                database,
                () => RESERVATION_NOW,
                financialFixtureAdmission(database),
              ).reject(identity, accepted.withdrawal.id, {
                expectedVersion: 1,
                confirmed: true,
                reason: "Controlled rollback",
              }),
            ).rejects.toThrow();
          else
            await expect(
              new EmployeeRestrictionsService(
                database,
                financialFixtureAdmission(database),
                () => RESERVATION_NOW,
              ).updateRestrictions(identity, employee.user.id, {
                expectedVersion: 0,
                confirmed: true,
                reason: "Controlled rollback",
                ...(operation === "BAN"
                  ? { status: "BANNED" as const }
                  : { withdrawalsBlocked: true }),
              }),
            ).rejects.toThrow();
        } finally {
          await database.$executeRawUnsafe(
            "DROP TRIGGER fail_us3_action ON withdrawal_actions",
          );
          await database.$executeRawUnsafe("DROP FUNCTION fail_us3_action()");
        }
        expect(await snapshot()).toEqual(before);
      });
    },
  );
  it("allows task-only restriction, cancels on a withdrawal block, and commits matching identity history", async () => {
    await withWithdrawalDatabase(async (database, databaseUrl) => {
      const employee = await reservationEmployee(database, {
        paid: true,
        nonReferral: "70",
        referral: "30",
      });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const services = reservationServices(database);
      const quote = await services.quotes.create(employee.identity, {
        gross: "80",
      });
      const accepted = await services.reservations.accept(employee.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      await withWithdrawalRole(
        { database, databaseUrl, role: "p06_api" },
        async (api) => {
          const admission = await admitWithdrawalRuntimeFixture(
            database,
            api,
            "API",
          );
          const restrictions = new EmployeeRestrictionsService(
            api,
            admission,
            () => RESERVATION_NOW,
          );
          const identity = {
            userId: admin.user.id,
            sessionId: admin.session.id,
          };
          await restrictions.updateRestrictions(identity, employee.user.id, {
            expectedVersion: 0,
            confirmed: true,
            reason: "Tasks only",
            tasksBlocked: true,
          });
          expect(
            (
              await database.withdrawalRequest.findUniqueOrThrow({
                where: { id: accepted.withdrawal.id },
              })
            ).state,
          ).toBe("SCHEDULED");
          await restrictions.updateRestrictions(identity, employee.user.id, {
            expectedVersion: 1,
            confirmed: true,
            reason: "Withdrawals blocked",
            withdrawalsBlocked: true,
          });
          expect(
            (
              await database.withdrawalRequest.findUniqueOrThrow({
                where: { id: accepted.withdrawal.id },
              })
            ).state,
          ).toBe("CANCELLED");
          expect(
            await database.identityAuditRecord.count({
              where: { action: "EMPLOYEE_CONTROL" },
            }),
          ).toBe(2);
          expect(
            await database.financialOperation.count({
              where: { kind: "RELEASE" },
            }),
          ).toBe(1);
          expect(
            await database.wallet.findUniqueOrThrow({
              where: { ownerUserId: employee.user.id },
            }),
          ).toMatchObject({
            availableNonReferralUnits: 70000000n,
            availableReferralUnits: 30000000n,
            reservedNonReferralUnits: 0n,
            reservedReferralUnits: 0n,
          });
          await expect(
            api.user.update({
              where: { id: employee.user.id },
              data: { role: "ADMIN" },
            }),
          ).rejects.toThrow();
        },
      );
    });
  });
  it.each(
    (
      ["EXTEND", "REJECT", "BAN", "BLOCK", "FUTURE_DESTINATION"] as const
    ).flatMap((operation) =>
      ([0, 1] as const).map((winner) => ({ operation, winner })),
    ),
  )(
    "forces winner $winner when $operation races an admitted protected claim",
    async ({ operation, winner }) => {
      await withClockedWithdrawalDatabase(
        new Date("2026-10-16T09:00:00Z"),
        async (database, databaseUrl) => {
          const acceptedAt = new Date(Date.now() - 7 * 86400000);
          const employee = await reservationEmployee(database, {
            paid: true,
            nonReferral: "70",
            referral: "30",
            now: acceptedAt,
          });
          const admin = await createIdentityFixture(database, {
            role: "ADMIN",
          });
          const identity = {
            userId: admin.user.id,
            sessionId: admin.session.id,
          };
          const services = reservationServices(database, () => acceptedAt);
          const quote = await services.quotes.create(employee.identity, {
            gross: "80",
          });
          const accepted = await services.reservations.accept(
            employee.identity,
            {
              quoteId: quote.quoteId,
              confirmed: true,
            },
          );
          await withWithdrawalRole(
            { database, databaseUrl, role: "p06_api" },
            async (api) =>
              withWithdrawalRole(
                { database, databaseUrl, role: "p06_signer" },
                async (signer) => {
                  const apiAdmission = await admitWithdrawalRuntimeFixture(
                    database,
                    api,
                    "API",
                  );
                  const signerAdmission = await admitWithdrawalRuntimeFixture(
                    database,
                    signer,
                    "SIGNER",
                  );
                  const action = async () => {
                    const reads = new WithdrawalsService(
                      api,
                      () => new Date(),
                      apiAdmission,
                    );
                    const command = {
                      expectedVersion: 1,
                      confirmed: true as const,
                      reason: "Controlled competing command",
                    };
                    if (operation === "EXTEND")
                      return reads.extend(
                        identity,
                        accepted.withdrawal.id,
                        { ...command, countedHours: "240" },
                        "race-extension",
                      );
                    if (operation === "REJECT")
                      return reads.reject(
                        identity,
                        accepted.withdrawal.id,
                        command,
                        "race-rejection",
                      );
                    if (operation === "BAN" || operation === "BLOCK")
                      return new EmployeeRestrictionsService(
                        api,
                        apiAdmission,
                      ).updateRestrictions(identity, employee.user.id, {
                        ...command,
                        expectedVersion: 0,
                        ...(operation === "BAN"
                          ? { status: "BANNED" as const }
                          : { withdrawalsBlocked: true }),
                      });
                    const reference =
                      await api.withdrawalRequest.findUniqueOrThrow({
                        where: { id: accepted.withdrawal.id },
                      });
                    const ledger = new LedgerService(
                      api,
                      {
                        businessNamespaces: ["p08.withdrawal.release"],
                        processIds: [],
                      },
                      apiAdmission,
                    );
                    let eventTime: Date | undefined;
                    return ledger.runInTransaction(
                      withdrawalReleaseContext(
                        identity.userId,
                        reference.walletId,
                        () => {
                          if (eventTime === undefined)
                            throw new Error("Missing locked event time");
                          return eventTime;
                        },
                      ),
                      async (transaction, transactionLedger) => {
                        await new AuthSessionService().lockSessions(
                          transaction,
                          identity.userId,
                        );
                        const request = await lockWithdrawalRequest(
                          transaction,
                          reference,
                        );
                        const now = new Date();
                        eventTime = now;
                        await readSessionAuthority(
                          transaction,
                          identity,
                          now,
                          "ADMIN",
                        );
                        return cancelScheduledWithdrawal(
                          transaction,
                          transactionLedger,
                          request,
                          {
                            actorUserId: identity.userId,
                            kind: "FUTURE_DESTINATION_CANCEL",
                            intentHash: withdrawalTermsHash([
                              request.id,
                              "future-address",
                            ]),
                            reason: command.reason,
                            now,
                          },
                        );
                      },
                    );
                  };
                  const outcomes = await controlledWithdrawalRace(
                    database,
                    accepted.withdrawal.id,
                    [
                      action,
                      async () => {
                        return claimWithdrawalFixture(
                          { runtime: signer, owner: database },
                          signerAdmission,
                          accepted.withdrawal.id,
                          1,
                        );
                      },
                    ],
                    winner,
                  );
                  const claimed = outcomes[1];
                  if (claimed.status === "rejected") throw claimed.reason;
                  expect(claimed.status).toBe("fulfilled");
                  expect(claimed.value).toBe(winner === 1);
                  if (
                    ["BAN", "BLOCK", "FUTURE_DESTINATION"].includes(
                      operation,
                    ) &&
                    outcomes[0].status === "rejected"
                  )
                    throw outcomes[0].reason;
                  if (outcomes[0].status === "rejected")
                    expect(outcomes[0].reason).toMatchObject({
                      code: "WITHDRAWAL_VERSION_CONFLICT",
                    });
                  const saved =
                    await database.withdrawalRequest.findUniqueOrThrow({
                      where: { id: accepted.withdrawal.id },
                    });
                  const allocation =
                    await database.reservationAllocation.findUniqueOrThrow({
                      where: { id: saved.reservationId },
                    });
                  const releaseCount = await database.financialOperation.count({
                    where: { kind: "RELEASE" },
                  });
                  const wallet = await database.wallet.findUniqueOrThrow({
                    where: { id: saved.walletId },
                  });
                  expect(saved.recipient).toBe(accepted.withdrawal.recipient);
                  const reads = new WithdrawalsService(
                    api,
                    () => new Date(),
                    apiAdmission,
                  );
                  expect(
                    await reads.detail(identity, saved.id, true),
                  ).toMatchObject({
                    employee: {
                      id: employee.user.id,
                      email: employee.user.email,
                    },
                    canExtend: saved.state === "SCHEDULED",
                    canReject: saved.state === "SCHEDULED",
                  });
                  if (operation === "EXTEND" || operation === "REJECT") {
                    expect(
                      await reads.adminActionOutcome(identity, saved.id, {
                        kind: operation,
                        requestKey:
                          operation === "EXTEND"
                            ? "race-extension"
                            : "race-rejection",
                        expectedVersion: 1,
                      }),
                    ).toMatchObject({
                      status: claimed.value ? "SUPERSEDED" : "COMMITTED",
                    });
                  }
                  if (claimed.value) {
                    expect(saved.state).toBe("SIGNING");
                    expect(allocation.state).toBe("ACTIVE");
                    expect(releaseCount).toBe(0);
                    expect(wallet).toMatchObject({
                      reservedNonReferralUnits: 70000000n,
                      reservedReferralUnits: 10000000n,
                    });
                    expect(
                      await database.withdrawalAction.count({
                        where: { kind: "CLAIM" },
                      }),
                    ).toBe(1);
                  } else {
                    expect(outcomes[0].status).toBe("fulfilled");
                    if (operation === "EXTEND") {
                      expect(saved.scheduleVersion).toBe(2);
                      expect(releaseCount).toBe(0);
                      expect(allocation.state).toBe("ACTIVE");
                    } else {
                      expect(["REJECTED", "CANCELLED"]).toContain(saved.state);
                      expect(releaseCount).toBe(1);
                      expect(allocation.state).toBe("RELEASED");
                      expect(wallet).toMatchObject({
                        reservedNonReferralUnits: 0n,
                        reservedReferralUnits: 0n,
                        availableNonReferralUnits: 70000000n,
                        availableReferralUnits: 30000000n,
                      });
                    }
                  }
                  expect(await database.transferAttempt.count()).toBe(0);
                  await expect(
                    api.withdrawalRequest.update({
                      where: { id: saved.id },
                      data: { state: "SIGNING", version: { increment: 1 } },
                    }),
                  ).rejects.toThrow();
                },
              ),
          );
        },
      );
    },
  );
  it.each(["2026-10-17T09:00:00Z", "2026-10-18T09:00:00Z"])(
    "denies a protected claim on Baghdad weekend %s without releasing funds",
    async (instant) => {
      await withClockedWithdrawalDatabase(
        new Date(instant),
        async (database, databaseUrl) => {
          const acceptedAt = new Date(Date.now() - 7 * 86400000);
          const employee = await reservationEmployee(database, {
            nonReferral: "100",
            now: acceptedAt,
          });
          const services = reservationServices(database, () => acceptedAt);
          const quote = await services.quotes.create(employee.identity, {
            gross: "100",
          });
          const accepted = await services.reservations.accept(
            employee.identity,
            { quoteId: quote.quoteId, confirmed: true },
          );
          await withWithdrawalRole(
            { database, databaseUrl, role: "p06_signer" },
            async (signer) => {
              const admission = await admitWithdrawalRuntimeFixture(
                database,
                signer,
                "SIGNER",
              );
              expect(
                await claimWithdrawalFixture(
                  { runtime: signer, owner: database },
                  admission,
                  accepted.withdrawal.id,
                  1,
                ),
              ).toBe(false);
              await expect(
                signer.$transaction(async (transaction) => {
                  await admission.assertDispatchAdmission(transaction);
                  return transaction.withdrawalRequest.update({
                    where: { id: accepted.withdrawal.id },
                    data: { state: "SIGNING", version: { increment: 1 } },
                  });
                }),
              ).rejects.toThrow("Protected claim preconditions are not met");
            },
          );
          const saved = await database.withdrawalRequest.findUniqueOrThrow({
            where: { id: accepted.withdrawal.id },
          });
          expect(saved).toMatchObject({ state: "SCHEDULED", version: 1 });
          expect(
            await database.reservationAllocation.findUniqueOrThrow({
              where: { id: saved.reservationId },
            }),
          ).toMatchObject({ state: "ACTIVE", releaseOperationId: null });
          expect(await database.withdrawalAttempt.count()).toBe(0);
          expect(
            await database.financialOperation.count({
              where: { kind: "RELEASE" },
            }),
          ).toBe(0);
        },
      );
    },
  );
  it("extends the current deadline once, preserves original terms and rejects stale/conflicting intent", async () => {
    await withWithdrawalDatabase(async (database) => {
      const employee = await reservationEmployee(database, {
        paid: true,
        nonReferral: "70",
        referral: "30",
      });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const identity = { userId: admin.user.id, sessionId: admin.session.id };
      const services = reservationServices(database);
      const quote = await services.quotes.create(employee.identity, {
        gross: "80",
      });
      const accepted = await services.reservations.accept(employee.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      const reads = new WithdrawalsService(
        database,
        () => RESERVATION_NOW,
        financialFixtureAdmission(database),
      );
      const command = {
        expectedVersion: 1,
        countedHours: "0.500005",
        confirmed: true,
        reason: "Extra counted time",
      };
      const extended = await reads.extend(
        identity,
        accepted.withdrawal.id,
        command,
        "extension-1",
      );
      expect(extended.withdrawal).toMatchObject({
        version: 2,
        scheduleVersion: 2,
        originalDueAt: accepted.withdrawal.originalDueAt,
        gross: "80",
        sourceAllocation: accepted.withdrawal.sourceAllocation,
      });
      expect(
        new Date(extended.withdrawal.dueAt).getTime() -
          new Date(accepted.withdrawal.dueAt).getTime(),
      ).toBe(1800018);
      expect(
        (
          await reads.extend(
            identity,
            accepted.withdrawal.id,
            command,
            "extension-1",
          )
        ).replayed,
      ).toBe(true);
      await expect(
        reads.extend(
          identity,
          accepted.withdrawal.id,
          { ...command, countedHours: "1" },
          "extension-1",
        ),
      ).rejects.toMatchObject({ code: "LEDGER_IDENTITY_CONFLICT" });
      await expect(
        reads.extend(
          identity,
          accepted.withdrawal.id,
          command,
          "extension-new",
        ),
      ).rejects.toMatchObject({ code: "WITHDRAWAL_VERSION_CONFLICT" });
      expect(
        await database.withdrawalAction.count({ where: { kind: "EXTEND" } }),
      ).toBe(1);
      expect(
        await database.financialOperation.count({ where: { kind: "RELEASE" } }),
      ).toBe(0);
    });
  });
  it("rejection releases original sources once, including after paid expiry", async () => {
    await withWithdrawalDatabase(async (database) => {
      const employee = await reservationEmployee(database, {
        paid: true,
        nonReferral: "70",
        referral: "30",
      });
      const admin = await createIdentityFixture(database, {
        role: "ADMIN",
        now: RESERVATION_NOW,
      });
      const services = reservationServices(database);
      const quote = await services.quotes.create(employee.identity, {
        gross: "80",
      });
      const accepted = await services.reservations.accept(employee.identity, {
        quoteId: quote.quoteId,
        confirmed: true,
      });
      const subscription = await database.subscription.findFirstOrThrow({
        where: { ownerUserId: employee.user.id, state: "CURRENT" },
      });
      await database.authSession.update({
        where: { id: admin.session.id },
        data: {
          expiresAt: new Date(subscription.expiresAt.getTime() + 86400000),
        },
      });
      const reads = new WithdrawalsService(
        database,
        () => subscription.expiresAt,
        financialFixtureAdmission(database),
      );
      const identity = { userId: admin.user.id, sessionId: admin.session.id };
      const command = {
        expectedVersion: 1,
        confirmed: true,
        reason: "Safe unsent rejection",
      };
      const rejected = await reads.reject(
        identity,
        accepted.withdrawal.id,
        command,
        "reject-1",
      );
      expect(rejected.withdrawal).toMatchObject({
        state: "REJECTED",
        release: { gross: "80", chargedFee: "0" },
      });
      expect(
        (
          await reads.reject(
            identity,
            accepted.withdrawal.id,
            command,
            "reject-1",
          )
        ).replayed,
      ).toBe(true);
      expect(
        await database.wallet.findUniqueOrThrow({
          where: { ownerUserId: employee.user.id },
        }),
      ).toMatchObject({
        availableNonReferralUnits: 70000000n,
        availableReferralUnits: 30000000n,
        reservedNonReferralUnits: 0n,
        reservedReferralUnits: 0n,
      });
      expect(
        await database.financialOperation.count({
          where: { businessNamespace: "p08.withdrawal.release" },
        }),
      ).toBe(1);
      expect(
        await database.withdrawalAction.count({ where: { kind: "REJECT" } }),
      ).toBe(1);
    });
  });
});
