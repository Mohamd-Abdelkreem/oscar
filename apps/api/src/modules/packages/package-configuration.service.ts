import { z } from "zod";
import {
  configurationOutcomeSchema,
  configurationResultSchema,
  packageCodeSchema,
  packageEditSchema,
  referralEditSchema,
  type PackageCode,
  type PackageEdit,
  type ReferralEdit,
  type ConfigurationResult,
} from "@template/contracts";
import { Prisma, type DatabaseClient, type Package } from "@template/database";
import { BusinessClock } from "../../core/business-calendar/business-clock.js";
import { AppError } from "../../core/errors/app.error.js";
import { ValidationException } from "../../core/errors/index.js";
import { parseUsdtAmount } from "../../core/financial/money.js";
import { sha256 } from "../../infrastructure/security/token-hasher.js";
import { AuthSessionService } from "../auth/auth-session.service.js";
import {
  readSessionAuthority,
  runIdentityTransaction,
} from "../auth/session-authority.js";
import { LedgerError } from "../ledger/ledger.errors.js";
import type { SubscriptionIdentity } from "../subscriptions/subscriptions.service.js";
import {
  mapConfigurationChange,
  mapPackageTerms,
  mapReferralSettings,
} from "./packages.mapper.js";

function configurationConflict(
  code: "CONFIGURATION_STALE" | "CONFIGURATION_SUPERSEDED",
) {
  return new AppError(
    "The reviewed configuration version has changed.",
    409,
    code,
  );
}

type ReviewedEdit =
  | { packageCode: PackageCode; body: PackageEdit }
  | { packageCode: null; body: ReferralEdit };

export class PackageConfigurationService {
  private readonly sessions = new AuthSessionService();
  constructor(
    private readonly database: DatabaseClient,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async editPackage(
    identity: SubscriptionIdentity,
    rawCode: unknown,
    rawBody: unknown,
  ) {
    return this.save(identity, {
      packageCode: packageCodeSchema.parse(rawCode),
      body: packageEditSchema.parse(rawBody),
    });
  }

  async editReferrals(identity: SubscriptionIdentity, rawBody: unknown) {
    return this.save(identity, {
      packageCode: null,
      body: referralEditSchema.parse(rawBody),
    });
  }

  async outcome(identity: SubscriptionIdentity, rawCommandId: unknown) {
    const commandId = z.uuid().parse(rawCommandId);
    return this.authorizedTransaction(identity, async (transaction) => {
      const now = this.clock();
      await readSessionAuthority(transaction, identity, now, "ADMIN");
      const saved = await transaction.configurationChange.findUnique({
        where: {
          actorUserId_commandId: { actorUserId: identity.userId, commandId },
        },
      });
      // Absence has no target/version barrier and cannot release an uncertain intent.
      return configurationOutcomeSchema.parse(
        saved === null
          ? { status: "NOT_OBSERVED", commandId, serverNow: now.toISOString() }
          : {
              status: "COMMITTED",
              commandId,
              change: mapConfigurationChange(saved),
              serverNow: now.toISOString(),
            },
      );
    });
  }

  private authorizedTransaction<T>(
    identity: SubscriptionIdentity,
    work: (transaction: Prisma.TransactionClient) => Promise<T>,
  ) {
    return runIdentityTransaction(
      this.database,
      {
        userIds: [identity.userId],
        adminPopulation: false,
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
      async (transaction) => {
        await this.sessions.lockSessions(transaction, identity.userId);
        return work(transaction);
      },
    );
  }

  private save(identity: SubscriptionIdentity, reviewed: ReviewedEdit) {
    const intentHash = sha256(JSON.stringify(reviewed));
    return this.authorizedTransaction(identity, async (transaction) => {
      // Purchase uses users -> sessions -> package -> referral settings in this order.
      if (reviewed.packageCode === null)
        await transaction.$queryRaw`SELECT id FROM referral_settings WHERE id=1 FOR UPDATE`;
      else
        await transaction.$queryRaw`SELECT code FROM packages WHERE code=${reviewed.packageCode} FOR UPDATE`;
      const now = this.clock();
      await readSessionAuthority(transaction, identity, now, "ADMIN");
      const saved = await transaction.configurationChange.findUnique({
        where: {
          actorUserId_commandId: {
            actorUserId: identity.userId,
            commandId: reviewed.body.commandId,
          },
        },
      });
      if (saved !== null) {
        if (saved.intentHash !== intentHash)
          throw new LedgerError("LEDGER_IDENTITY_CONFLICT");
        return mapConfigurationChange(saved);
      }
      const change =
        reviewed.packageCode === null
          ? await this.updateReferrals(
              transaction,
              reviewed.body,
              identity.userId,
              now,
            )
          : await this.updatePackage(
              transaction,
              reviewed,
              identity.userId,
              now,
            );
      return this.recordChange(
        transaction,
        { identity, reviewed, intentHash, now },
        change,
      );
    });
  }

  private async recordChange(
    transaction: Prisma.TransactionClient,
    command: {
      identity: SubscriptionIdentity;
      reviewed: ReviewedEdit;
      intentHash: string;
      now: Date;
    },
    change: {
      before: ConfigurationResult["before"];
      after: ConfigurationResult["after"];
    },
  ) {
    const { identity, reviewed, intentHash, now } = command;
    const audit = await transaction.configurationChange.create({
      data: {
        actorUserId: identity.userId,
        commandId: reviewed.body.commandId,
        intentHash,
        targetKind:
          reviewed.packageCode === null ? "REFERRAL_SETTINGS" : "PACKAGE",
        packageCode: reviewed.packageCode,
        expectedVersion: reviewed.body.expectedVersion,
        committedVersion: reviewed.body.expectedVersion + 1,
        reason: reviewed.body.reason,
        occurredAt: now,
        beforeSnapshot: change.before,
        afterSnapshot: change.after,
      },
    });
    return configurationResultSchema.parse({
      ...mapConfigurationChange(audit),
      replayed: false,
    });
  }

  private assertVersion(current: number, expected: number) {
    if (current > expected)
      throw configurationConflict("CONFIGURATION_SUPERSEDED");
    if (current < expected) throw configurationConflict("CONFIGURATION_STALE");
  }

  private async updatePackage(
    transaction: Prisma.TransactionClient,
    reviewed: Extract<ReviewedEdit, { packageCode: PackageCode }>,
    actorUserId: string,
    now: Date,
  ) {
    const configured = await transaction.package.findUniqueOrThrow({
      where: { code: reviewed.packageCode },
    });
    this.assertVersion(configured.version, reviewed.body.expectedVersion);
    const proposed = this.proposedPackage(configured, reviewed.body);
    const after = this.validatedPackageTerms(proposed, now);
    const updated = await transaction.package.updateMany({
      where: { code: configured.code, version: configured.version },
      data: {
        priceUnits: proposed.priceUnits,
        dailyRewardUnits: proposed.dailyRewardUnits,
        countedWorkDates: proposed.countedWorkDates,
        withdrawalFeeBps: proposed.withdrawalFeeBps,
        version: proposed.version,
        updatedAt: now,
        updatedByUserId: actorUserId,
      },
    });
    if (updated.count !== 1) throw configurationConflict("CONFIGURATION_STALE");
    return { before: mapPackageTerms(configured), after };
  }

  private proposedPackage(configured: Package, body: PackageEdit): Package {
    return {
      ...configured,
      priceUnits:
        body.price === undefined
          ? configured.priceUnits
          : parseUsdtAmount(body.price),
      dailyRewardUnits:
        body.dailyReward === undefined
          ? configured.dailyRewardUnits
          : parseUsdtAmount(body.dailyReward),
      countedWorkDates: body.countedWorkDates ?? configured.countedWorkDates,
      withdrawalFeeBps: body.withdrawalFeeBps ?? configured.withdrawalFeeBps,
      version: configured.version + 1,
    };
  }

  private validatedPackageTerms(proposed: Package, now: Date) {
    try {
      const after = mapPackageTerms(proposed);
      new BusinessClock(this.clock).subscriptionTerm(
        now.toISOString(),
        proposed.countedWorkDates,
      );
      return after;
    } catch (failure) {
      if (!(failure instanceof RangeError || failure instanceof z.ZodError))
        throw failure;
      throw new ValidationException([
        {
          field: "body",
          message:
            "Resulting package terms exceed supported money or calendar bounds.",
        },
      ]);
    }
  }

  private async updateReferrals(
    transaction: Prisma.TransactionClient,
    body: ReferralEdit,
    actorUserId: string,
    now: Date,
  ) {
    const configured = await transaction.referralSettings.findUniqueOrThrow({
      where: { id: 1 },
    });
    this.assertVersion(configured.version, body.expectedVersion);
    const [level1Bps, level2Bps, level3Bps, level4Bps, level5Bps] =
      body.ratesBps;
    const proposed = {
      ...configured,
      level1Bps,
      level2Bps,
      level3Bps,
      level4Bps,
      level5Bps,
      version: configured.version + 1,
    };
    const updated = await transaction.referralSettings.updateMany({
      where: { id: 1, version: configured.version },
      data: {
        level1Bps,
        level2Bps,
        level3Bps,
        level4Bps,
        level5Bps,
        version: proposed.version,
        updatedAt: now,
        updatedByUserId: actorUserId,
      },
    });
    if (updated.count !== 1) throw configurationConflict("CONFIGURATION_STALE");
    return {
      before: mapReferralSettings(configured),
      after: mapReferralSettings(proposed),
    };
  }
}
