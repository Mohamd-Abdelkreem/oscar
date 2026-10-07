import {
  Prisma,
  type DatabaseClient,
  type TransferAttempt,
} from "@template/database";
import { z } from "zod";
import type { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import { TronProviderError } from "../../infrastructure/tron/tron-provider.js";
import {
  decodeCanonicalReceipt,
  TronReceiptError,
} from "../../infrastructure/tron/tron-receipt.js";
import {
  assertSweepTransaction,
  TreasuryPolicyError,
} from "../../infrastructure/tron/tron-signer.js";
import {
  actualSweepBandwidth,
  sameSweepEvidence,
} from "./treasury-reconciliation.evidence.js";
import { storedIntent, treasuryAuthority } from "./treasury.service.js";
import type { TreasuryConfig, SweepIntent } from "./treasury.intent.js";

type ReconciliationProvider = Pick<
  TronProvider,
  | "solidifiedFloor"
  | "transaction"
  | "transactionInfo"
  | "transactionBlock"
  | "account"
  | "tokenBalance"
>;
const units = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const hash = z.string().regex(/^[0-9a-f]{64}$/u);
const receiptSchema = z.object({
  id: hash,
  blockNumber: units,
  blockID: hash.optional(),
  blockTimeStamp: units,
  fee: units.default(0),
  receipt: z.object({
    result: z.string(),
    energy_usage_total: units.default(0),
    net_usage: units.default(0),
    net_fee: units.default(0),
  }),
  log: z.array(z.unknown()).max(10000),
});
export class TreasuryReconciliation {
  constructor(
    private readonly database: DatabaseClient,
    private readonly provider: ReconciliationProvider,
    private readonly config: TreasuryConfig,
    private readonly role:
      "p06_signer" | "p06_recovery_operator" = "p06_signer",
  ) {}
  async balances(source: string) {
    for (let retry = 0; retry < 3; retry++) {
      const before = await this.provider.solidifiedFloor();
      const [accountInput, tokenUnits] = await Promise.all([
        this.provider.account(source),
        this.provider.tokenBalance(source),
      ]);
      const account = z
        .object({ address: z.literal(source), balance: units.default(0) })
        .parse(accountInput);
      const after = await this.provider.solidifiedFloor();
      if (
        before.id === after.id &&
        before.number === after.number &&
        before.timestamp === after.timestamp
      )
        return { cutoff: after, tokenUnits, trxSun: BigInt(account.balance) };
    }
    throw new TreasuryPolicyError("TREASURY_BALANCE_UNAVAILABLE");
  }
  private async canonicalObservation(
    attempt: TransferAttempt,
    intent: SweepIntent,
    transactionId: string,
  ) {
    const solidified = await this.provider.solidifiedFloor();
    const [transaction, infoInput] = await Promise.all([
      this.provider.transaction(transactionId),
      this.provider.transactionInfo(transactionId),
    ]);
    const info = receiptSchema.parse(infoInput);
    const signed = assertSweepTransaction(
      {
        txID: transaction["txID"],
        raw_data_hex: transaction["raw_data_hex"],
        raw_data: transaction["raw_data"],
        visible: transaction["visible"],
        signature: transaction["signature"],
      },
      {
        source: attempt.source,
        treasury: attempt.treasury,
        tokenContract: attempt.tokenContract,
        amountUnits: attempt.amountUnits,
      },
      {
        now: Date.now(),
        maximumFeeSun: BigInt(intent.policySnapshot.energyFeeLimitSun),
        signed: true,
        historical: true,
      },
    );
    const block = await this.provider.transactionBlock(info.blockNumber);
    if (
      transaction["txID"] !== transactionId ||
      info.id !== transactionId ||
      block.number !== info.blockNumber ||
      (info.blockID !== undefined && info.blockID !== block.id) ||
      info.blockTimeStamp !== block.timestamp ||
      !block.transactionIds.includes(transactionId) ||
      (block.number === solidified.number &&
        (block.id !== solidified.id ||
          block.timestamp !== solidified.timestamp))
    )
      throw new TreasuryPolicyError();
    // A later lookup can observe finality advancing beyond the previously sampled floor.
    if (
      block.number > solidified.number ||
      block.timestamp > solidified.timestamp
    )
      throw new TronProviderError("TRON_UNFINALIZED");
    return { transaction, infoInput, info, signed, block, solidified };
  }
  private executionState(
    attempt: TransferAttempt,
    observation: Awaited<
      ReturnType<TreasuryReconciliation["canonicalObservation"]>
    >,
  ) {
    const { transaction, infoInput, info, block, solidified } = observation;
    const execution = z
      .object({
        ret: z.array(z.object({ contractRet: z.string() })).length(1),
      })
      .parse(transaction).ret[0]?.contractRet;
    let state: "CONFIRMED" | "CHAIN_FAILED";
    if (info.receipt.result === "SUCCESS" && execution === "SUCCESS") {
      const movements = decodeCanonicalReceipt({
        transactionId: info.id,
        transaction,
        info: infoInput,
        block,
        solidified,
        network: attempt.network,
        tokenContract: attempt.tokenContract,
        verifiedAt: new Date(),
      });
      const sourceMovements = movements.filter(
        (movement) => movement.sender === attempt.source,
      );
      if (
        sourceMovements.length !== 1 ||
        sourceMovements[0]?.recipient !== attempt.treasury ||
        sourceMovements[0].amountUnits !== attempt.amountUnits
      )
        throw new TreasuryPolicyError();
      state = "CONFIRMED";
    } else {
      if (
        !["REVERT", "OUT_OF_ENERGY", "OUT_OF_TIME", "FAILED"].includes(
          info.receipt.result,
        ) ||
        execution !== info.receipt.result ||
        info.log.length !== 0
      )
        throw new TreasuryPolicyError();
      state = "CHAIN_FAILED";
    }
    return state;
  }
  private async canonicalOutcome(
    attempt: TransferAttempt,
    intent: SweepIntent,
    transactionId: string,
  ) {
    const observation = await this.canonicalObservation(
      attempt,
      intent,
      transactionId,
    );
    const state = this.executionState(attempt, observation);
    const { info, signed, block } = observation;
    if (info.receipt.net_fee > info.fee) throw new TreasuryPolicyError();
    const bandwidthUnits = actualSweepBandwidth(signed, info.receipt);
    const evidence = {
      transactionId: info.id,
      blockId: block.id,
      blockNumber: String(block.number),
      blockTimestamp: String(block.timestamp),
      result: info.receipt.result,
      tokenContract: attempt.tokenContract,
      source: attempt.source,
      treasury: attempt.treasury,
      amountUnits: String(attempt.amountUnits),
      feeSun: String(info.fee),
      energyUnits: String(info.receipt.energy_usage_total),
      bandwidthUnits: String(bandwidthUnits),
    };
    return { state, evidence, bandwidthUnits, info };
  }
  private async retainOutcome(
    attempt: TransferAttempt,
    outcome: Awaited<ReturnType<TreasuryReconciliation["canonicalOutcome"]>>,
  ) {
    const { state, evidence, bandwidthUnits, info } = outcome;
    return await this.database.$transaction(async (tx) => {
      await treasuryAuthority(tx, this.role);
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM transfer_attempts WHERE id=${attempt.id}::uuid FOR UPDATE`,
      );
      const current = await tx.transferAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      if (current.finalEvidence !== null) {
        if (!sameSweepEvidence(current.finalEvidence, evidence))
          throw new TreasuryPolicyError();
        return current;
      }
      const updated = await tx.transferAttempt.update({
        where: { id: current.id },
        data: {
          state,
          finalEvidence: evidence,
          feeSun: BigInt(info.fee),
          energyUnits: BigInt(info.receipt.energy_usage_total),
          bandwidthUnits,
          version: { increment: 1 },
        },
      });
      await tx.treasurySweep.update({
        where: { id: attempt.sweepId },
        data: { state, finalizedAt: new Date(), version: { increment: 1 } },
      });
      return updated;
    });
  }
  private async retainUnknown(
    attempt: TransferAttempt,
    failure: TronProviderError,
  ) {
    // Expiration and absence never prove nonexecution. Retain the active source claim.
    return await this.database.$transaction(async (tx) => {
      await treasuryAuthority(tx, this.role);
      await tx.transferAttempt.updateMany({
        where: { id: attempt.id, finalEvidence: { equals: Prisma.DbNull } },
        data: {
          state: "UNKNOWN",
          nextAttemptAt: new Date(Date.now() + 300000),
          lastErrorCode: failure.code,
          version: { increment: 1 },
        },
      });
      const current = await tx.transferAttempt.findUniqueOrThrow({
        where: { id: attempt.id },
      });
      if (current.state === "UNKNOWN")
        await tx.treasurySweep.update({
          where: { id: attempt.sweepId },
          data: { state: "UNKNOWN", version: { increment: 1 } },
        });
      return current;
    });
  }
  async reconcile(id: string) {
    const attempt = await this.database.transferAttempt.findUnique({
      where: { sweepId: id },
    });
    if (
      attempt === null ||
      attempt.transactionId === null ||
      [
        "CONFIRMED",
        "CHAIN_FAILED",
        "SAFE_FAILED",
        "EXPIRED_PROVEN_UNSENT",
      ].includes(attempt.state)
    )
      return attempt;
    const sweep = await this.database.treasurySweep.findUniqueOrThrow({
      where: { id },
    });
    const intent = storedIntent(sweep);
    if (
      intent.network !== this.config.network ||
      intent.tokenContract !== this.config.token.contract ||
      intent.treasury !== this.config.treasury
    )
      throw new TreasuryPolicyError();
    try {
      const outcome = await this.canonicalOutcome(
        attempt,
        intent,
        attempt.transactionId,
      );
      return await this.retainOutcome(attempt, outcome);
    } catch (failure) {
      if (failure instanceof z.ZodError || failure instanceof TronReceiptError)
        throw new TreasuryPolicyError();
      if (
        !(failure instanceof TronProviderError) ||
        !["TRON_UNFINALIZED", "TRON_UNAVAILABLE", "TRON_THROTTLED"].includes(
          failure.code,
        )
      )
        throw failure;
      return this.retainUnknown(attempt, failure);
    }
  }
}
