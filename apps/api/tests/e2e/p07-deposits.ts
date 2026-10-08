import { randomUUID } from "node:crypto";
import { TronWeb } from "tronweb";
import { depositAddressDataSchema } from "@template/contracts";
import type { DatabaseClient } from "@template/database";
import { formatUsdtAmount } from "../../src/core/financial/money.js";
import { createIdentityFixture } from "../../src/modules/auth/testing/identity-fixtures.js";
import type { FinancialRuntimeAdmission } from "../../src/modules/custody/runtime-control.js";
import type { CustodyMetadata } from "../../src/modules/custody/custody.service.js";
import { DepositVerifier } from "../../src/modules/deposits/deposit-verifier.js";
import { DepositCreditService } from "../../src/modules/deposits/deposit-credit.service.js";
import { LedgerService } from "../../src/modules/ledger/ledger.service.js";
import type { LedgerContext } from "../../src/modules/ledger/ledger.types.js";
import {
  depositToken,
  depositRecipient,
  rawDeposit,
  transferLog,
  withDepositProvider,
  type RawDeposit,
} from "../../src/modules/deposits/testing/deposit-fixtures.js";
import {
  p07FixturesSchema,
  p07StateSchema,
  type p07EmailSchema,
} from "./control.js";
import type { z } from "zod";

export const p07Metadata: CustodyMetadata = {
  network: "TRON_NILE",
  token: { symbol: "USDT", contract: depositToken, decimals: 6 },
};
type Email = z.infer<typeof p07EmailSchema>;
type Event = "confirmed" | "two-logs" | "unfinalized" | "wrong-token";
const addresses: Record<Email, string> = {
  "employee@p03.test": depositRecipient,
  "other@p03.test": TronWeb.address.fromHex(`41${"44".repeat(20)}`),
  "first-credit@p07.test": TronWeb.address.fromHex(`41${"55".repeat(20)}`),
};

// Private disposable support only: READY is synthetic and does not claim protected custody acceptance.
export class P07DepositScenario {
  private initialized = false;
  private readonly events = new Map<string, RawDeposit>();
  constructor(
    private readonly database: DatabaseClient,
    private readonly admission: FinancialRuntimeAdmission,
  ) {}

  async fixtures(pagedTargets = false) {
    if (this.initialized) throw new Error("P07_FIXTURES_ALREADY_CREATED");
    const employee = await this.database.user.findUniqueOrThrow({
      where: { email: "employee@p03.test" },
    });
    const other = await this.database.user.findUniqueOrThrow({
      where: { email: "other@p03.test" },
    });
    const first = await createIdentityFixture(this.database, {
      passwordHash: employee.passwordHash,
    });
    await this.database.user.update({
      where: { id: first.user.id },
      data: { email: "first-credit@p07.test", fullName: employee.fullName },
    });
    if (pagedTargets) {
      for (let index = 0; index < 26; index++) {
        const target = await createIdentityFixture(this.database, {
          passwordHash: employee.passwordHash,
        });
        await this.database.user.update({
          where: { id: target.user.id },
          data: {
            email: `paged-target-${String(index)}@p07.test`,
            fullName: employee.fullName,
          },
        });
      }
      await this.sourceReservationFixture(other.id);
    }
    this.initialized = true;
    return p07FixturesSchema.parse({
      employeeId: employee.id,
      otherId: other.id,
      firstCreditId: first.user.id,
    });
  }
  private async sourceReservationFixture(employeeId: string) {
    const wallet = await this.database.wallet.findUniqueOrThrow({
      where: { ownerUserId: employeeId },
    });
    const ledger = new LedgerService(
      this.database,
      { businessNamespaces: ["p07.e2e.sources"], processIds: ["p07-e2e"] },
      this.admission,
    );
    const guard = () => Promise.resolve();
    const context: LedgerContext = {
      actor: { type: "PROCESS", processId: "p07-e2e" },
      walletIds: [wallet.id],
      clock: () => new Date(),
      observe: guard,
      mutate: guard,
      eligibleSources: () => Promise.resolve(["NON_REFERRAL", "REFERRAL"]),
    };
    for (const [source, amount] of [
      ["REFERRAL", "7"],
      ["NON_REFERRAL", "11"],
    ] as const) {
      await ledger.execute(
        {
          kind: "CREDIT",
          walletId: wallet.id,
          businessNamespace: "p07.e2e.sources",
          businessKey: randomUUID(),
          source,
          amount,
          origin: source === "REFERRAL" ? "REFERRAL_COMMISSION" : "TASK_REWARD",
        },
        context,
      );
    }
    await ledger.execute(
      {
        kind: "RESERVE",
        walletId: wallet.id,
        businessNamespace: "p07.e2e.sources",
        businessKey: randomUUID(),
        reservationId: randomUUID(),
        amount: "13",
      },
      context,
    );
  }
  private async employee(email: Email) {
    if (!this.initialized) throw new Error("P07_FIXTURES_REQUIRED");
    return this.database.user.findUniqueOrThrow({
      where: { email },
      include: { wallet: true },
    });
  }
  async ready(email: Email) {
    const employee = await this.employee(email);
    const assignment =
      await this.database.depositAddressAssignment.findUniqueOrThrow({
        where: {
          employeeId_network: { employeeId: employee.id, network: "TRON_NILE" },
        },
      });
    // HTTP provisioning must create REQUESTED; this control never manufactures an assignment.
    if (assignment.state !== "REQUESTED" || assignment.address !== null)
      throw new Error("P07_HTTP_PROVISIONING_REQUIRED");
    const now = new Date();
    await this.database.depositAddressAssignment.update({
      where: { id: assignment.id },
      data: {
        state: "READY",
        address: addresses[email],
        readyAt: now,
        keyEnvelopeDigest: "a".repeat(64),
        keyVersion: 1,
        recoveryAckId: randomUUID(),
        recoveryDigest: "a".repeat(64),
        recoveryAcknowledgedAt: now,
        scanBoundaryBlockNumber: 100n,
        scanBoundaryBlockId: "a".repeat(64),
        scanBoundaryTimestamp: 1n,
      },
    });
    depositAddressDataSchema.parse({
      ...p07Metadata,
      serverNow: now.toISOString(),
      state: "READY",
      assignmentId: assignment.id,
      address: addresses[email],
      readyAt: now.toISOString(),
      activationState: "UNKNOWN",
      detection: {
        status: "NOT_STARTED",
        lastSuccessfulScanAt: null,
        serverNow: now.toISOString(),
      },
    });
    return null;
  }
  async credit(
    email: Email,
    event: Event,
    day: "SATURDAY" | "SUNDAY" = "SATURDAY",
  ) {
    await this.employee(email);
    const key = `${email}:${event}`;
    let raw = this.events.get(key);
    if (!raw) {
      const logs =
        event === "two-logs"
          ? [
              transferLog(addresses[email]),
              transferLog(addresses[email], 2000001n),
            ]
          : [transferLog(addresses[email])];
      if (event === "wrong-token" && logs[0]) logs[0].address = "66".repeat(20);
      raw = rawDeposit(logs);
      if (event === "unfinalized")
        raw.solidified.block_header.raw_data.number = 122;
      this.events.set(key, raw);
    }
    const snapshot = raw;
    await withDepositProvider(snapshot, async (provider, config) => {
      const clock = () =>
        new Date(
          day === "SATURDAY"
            ? "2026-10-10T20:00:00.000Z"
            : "2026-10-11T20:00:00.000Z",
        );
      const verifier = new DepositVerifier(
        this.database,
        provider,
        config,
        clock,
      );
      const credited = await new DepositCreditService(
        this.database,
        verifier,
        this.admission,
        clock,
      ).process(snapshot.transactionId);
      if (
        credited.state !==
        (event === "unfinalized"
          ? "UNFINALIZED"
          : event === "wrong-token"
            ? "INELIGIBLE"
            : "ACCOUNTED")
      )
        throw new Error("P07_DETERMINISTIC_EVENT_FAILED");
    });
    return null;
  }
  async state(email: Email) {
    const employee = await this.employee(email);
    const wallet = employee.wallet;
    if (!wallet) throw new Error("P07_WALLET_REQUIRED");
    const assignment = await this.database.depositAddressAssignment.findUnique({
      where: {
        employeeId_network: { employeeId: employee.id, network: "TRON_NILE" },
      },
      select: { id: true, state: true, address: true },
    });
    const receipts = await this.database.depositReceipt.findMany({
      where: { walletId: wallet.id },
      select: { transactionId: true, logIndex: true, amountUnits: true },
      orderBy: [{ transactionId: "asc" }, { logIndex: "asc" }],
      take: 100,
    });
    const reservations = await this.database.reservationAllocation.findMany({
      where: { walletId: wallet.id },
      select: {
        id: true,
        state: true,
        referralUnits: true,
        nonReferralUnits: true,
      },
      orderBy: { id: "asc" },
      take: 100,
    });
    return p07StateSchema.parse({
      employeeId: employee.id,
      assignment,
      wallet: {
        availableReferral: formatUsdtAmount(wallet.availableReferralUnits),
        availableNonReferral: formatUsdtAmount(
          wallet.availableNonReferralUnits,
        ),
        reservedReferral: formatUsdtAmount(wallet.reservedReferralUnits),
        reservedNonReferral: formatUsdtAmount(wallet.reservedNonReferralUnits),
        total: formatUsdtAmount(
          wallet.availableReferralUnits +
            wallet.availableNonReferralUnits +
            wallet.reservedReferralUnits +
            wallet.reservedNonReferralUnits,
        ),
      },
      receipts: receipts.map((receipt) => ({
        transactionId: receipt.transactionId,
        logIndex: receipt.logIndex,
        amount: formatUsdtAmount(receipt.amountUnits),
      })),
      manualCredits: await this.database.manualCredit.count({
        where: { walletId: wallet.id },
      }),
      operations: await this.database.financialOperation.count({
        where: { walletId: wallet.id },
      }),
      postings: await this.database.ledgerPosting.count({
        where: { walletId: wallet.id },
      }),
      auditCount: await this.database.auditRecord.count({
        where: { operation: { walletId: wallet.id } },
      }),
      reservations: reservations.map((reservation) => ({
        id: reservation.id,
        state: reservation.state,
        referral: formatUsdtAmount(reservation.referralUnits),
        nonReferral: formatUsdtAmount(reservation.nonReferralUnits),
      })),
    });
  }
}
