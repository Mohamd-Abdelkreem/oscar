import type { DatabaseClient } from "@template/database";
import type { FinancialRuntimeAdmission } from "../../src/modules/custody/runtime-control.js";
import { createIdentityFixture } from "../../src/modules/auth/testing/identity-fixtures.js";
import {
  fundSubscriptionFixture,
  activateSubscriptionFixture,
} from "../../src/modules/subscriptions/testing/subscription-fixtures.js";
import { formatUsdtAmount } from "../../src/core/financial/money.js";
import { p05StateSchema, p05FixturesSchema } from "./control.js";

export class P05TaskScenario {
  private upgradeEmployee: Awaited<
    ReturnType<typeof createIdentityFixture>
  > | null = null;
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date,
    private readonly admission: FinancialRuntimeAdmission,
  ) {}
  async fixtures() {
    const admin = await this.database.user.findUniqueOrThrow({
      where: { email: "admin@p03.test" },
    });
    const accounts = [];
    for (const email of ["employee@p05.test", "other@p05.test"]) {
      const account = await createIdentityFixture(this.database, {
        passwordHash: admin.passwordHash,
        now: this.clock(),
      });
      if (email === "employee@p05.test") this.upgradeEmployee = account;
      await this.database.user.update({
        where: { id: account.user.id },
        data: {
          email,
          fullName: email.startsWith("employee") ? "موظف المهام" : "موظف آخر",
        },
      });
      await fundSubscriptionFixture(
        this.database,
        account,
        { referral: "0", nonReferral: "60" },
        { now: this.clock(), admission: this.admission },
      );
      await activateSubscriptionFixture(this.database, account, "S1", {
        now: this.clock(),
        admission: this.admission,
      });
      accounts.push(account.user.id);
    }
    const [employeeId, otherId] = accounts;
    if (!employeeId || !otherId) throw new Error("P05_FIXTURES_MISSING");
    return p05FixturesSchema.parse({
      employeeId,
      otherId,
      publicationDate: this.clock().toISOString().slice(0, 10),
    });
  }
  async fundUpgrade() {
    if (!this.upgradeEmployee) throw new Error("P05_FIXTURES_REQUIRED");
    await fundSubscriptionFixture(
      this.database,
      this.upgradeEmployee,
      { referral: "0", nonReferral: "120" },
      { now: this.clock(), admission: this.admission },
    );
    return null;
  }
  async state(email: string) {
    const employee = await this.database.user.findUniqueOrThrow({
      where: { email },
      include: { wallet: true },
    });
    if (!employee.wallet) throw new Error("P05_WALLET_REQUIRED");
    const assets = await this.database.imageAsset.findMany({
      where: {
        evidence: { some: { submission: { employeeId: employee.id } } },
      },
      orderBy: { id: "asc" },
      take: 100,
      select: { id: true, uploadedAt: true, state: true },
    });
    return p05StateSchema.parse({
      employeeId: employee.id,
      submissions: await this.database.taskSubmission.count({
        where: { employeeId: employee.id },
      }),
      evidence: await this.database.submissionEvidence.count({
        where: { submission: { employeeId: employee.id } },
      }),
      rewardPostings: await this.database.financialOperation.count({
        where: { walletId: employee.wallet.id, origin: "TASK_REWARD" },
      }),
      available: formatUsdtAmount(
        employee.wallet.availableReferralUnits +
          employee.wallet.availableNonReferralUnits,
      ),
      assets: assets.map((asset) => ({
        ...asset,
        uploadedAt: asset.uploadedAt?.toISOString(),
      })),
    });
  }
  async seedPages(adminId: string) {
    const task = await this.database.task.findFirstOrThrow({
      orderBy: { createdAt: "asc" },
    });
    for (let i = 0; i < 260; i++)
      await this.database.taskCode.create({
        data: {
          taskId: task.id,
          normalizedText: "PAGED-" + String(i),
          state: "ENABLED",
          createdByUserId: adminId,
          updatedByUserId: adminId,
          createdAt: this.clock(),
          updatedAt: this.clock(),
        },
      });
    return null;
  }
}
