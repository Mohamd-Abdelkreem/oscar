import { expect, it } from "vitest";
import {
  createPendingWithdrawalDestination,
  createWithdrawalEmployee,
  withWithdrawalDatabase,
  withWithdrawalRaceClients,
  withdrawalRaceBarrier,
} from "./withdrawal-fixtures.js";
import { withWithdrawalRole } from "./withdrawal-authority-fixtures.js";

it("creates admitted minimal withdrawal fixtures and preserves narrow production role grants", async () => {
  await withWithdrawalDatabase(async (database, databaseUrl) => {
    const employee = await createWithdrawalEmployee(database);
    const destination = await createPendingWithdrawalDestination(
      database,
      employee.ownerUserId,
    );
    expect(
      await database.withdrawalDestinationAudit.count({
        where: { destinationId: destination.id },
      }),
    ).toBe(1);
    expect(await database.withdrawalRequest.count()).toBe(0);
    expect(employee.wallet).toMatchObject({
      reservedReferralUnits: 0n,
      reservedNonReferralUnits: 0n,
    });
    await withWithdrawalRole(
      { database, databaseUrl, role: "p06_deposit_worker" },
      async (worker) => {
        expect(await worker.withdrawalRequest.count()).toBe(0);
        await expect(
          worker.withdrawalDestination.count(),
        ).rejects.toMatchObject({
          code: "P2039",
          meta: { driverAdapterError: { cause: { originalCode: "42501" } } },
        });
      },
    );
    const barrier = withdrawalRaceBarrier(2);
    await withWithdrawalRaceClients(databaseUrl, async (first, second) => {
      const read = async (client: typeof first) => {
        await barrier();
        return client.withdrawalDestination.findUnique({
          where: { id: destination.id },
        });
      };
      expect(await Promise.all([read(first), read(second)])).toEqual([
        destination,
        destination,
      ]);
    });
  });
});
