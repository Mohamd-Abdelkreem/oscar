import { z } from "zod";
import type { TronPayoutConfig } from "../../core/config/tron.config.js";
import type { TronProvider } from "../../infrastructure/tron/tron-provider.js";
import { TreasuryPolicyError } from "../../infrastructure/tron/tron-signer.js";

export type PayoutDispatchProvider = Pick<
  TronProvider,
  | "solidifiedFloor"
  | "tokenBalance"
  | "sweepAccount"
  | "resources"
  | "chainParameters"
  | "estimateTransfer"
  | "buildTransfer"
  | "broadcastTransfer"
>;
const units = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export async function checkPayoutResources(
  provider: PayoutDispatchProvider,
  config: TronPayoutConfig,
  recipient: string,
  netUnits: bigint,
) {
  if (
    netUnits <= 0n ||
    netUnits > config.maximumPayoutUnits ||
    recipient === config.treasury
  )
    throw new TreasuryPolicyError("PAYOUT_POLICY_CONFLICT");
  let coherent:
    Awaited<ReturnType<TronProvider["solidifiedFloor"]>> | undefined;
  for (let retry = 0; retry < 3; retry++) {
    const before = await provider.solidifiedFloor();
    const balance = await provider.tokenBalance(config.treasury);
    const after = await provider.solidifiedFloor();
    if (
      before.number === after.number &&
      before.id === after.id &&
      before.timestamp === after.timestamp
    ) {
      if (balance < netUnits)
        throw new TreasuryPolicyError("LIQUIDITY_SHORTFALL");
      coherent = after;
      break;
    }
  }
  if (coherent === undefined)
    throw new TreasuryPolicyError("PROVIDER_UNAVAILABLE");
  const inputs = await Promise.all([
    provider.sweepAccount(config.treasury),
    provider.resources(config.treasury),
    provider.chainParameters(),
    provider.estimateTransfer(config.treasury, recipient, netUnits),
  ]);
  const account = z
    .object({
      address: z.literal(config.treasury),
      balance: units,
      owner_permission: z.object({
        threshold: z.literal(1),
        keys: z
          .array(
            z.object({
              address: z.literal(config.treasury),
              weight: z.literal(1),
            }),
          )
          .length(1),
      }),
    })
    .parse(inputs[0]);
  const resource = z
    .object({ EnergyLimit: units.default(0), EnergyUsed: units.default(0) })
    .parse(inputs[1]);
  const parameters = z
    .object({
      chainParameter: z
        .array(
          z.object({
            key: z.string(),
            value: z
              .number()
              .int()
              .min(Number.MIN_SAFE_INTEGER)
              .max(Number.MAX_SAFE_INTEGER)
              .optional(),
          }),
        )
        .max(200),
    })
    .parse(inputs[2]).chainParameter;
  const energyPrice = parameters.find((p) => p.key === "getEnergyFee")?.value;
  const bandwidthPrice = parameters.find(
    (p) => p.key === "getTransactionFee",
  )?.value;
  if (
    energyPrice === undefined ||
    bandwidthPrice === undefined ||
    energyPrice <= 0 ||
    bandwidthPrice <= 0
  )
    throw new TreasuryPolicyError("PROVIDER_UNAVAILABLE");
  const paidEnergy =
    BigInt(
      Math.max(
        0,
        units.positive().parse(inputs[3]) -
          Math.max(0, resource.EnergyLimit - resource.EnergyUsed),
      ),
    ) * BigInt(energyPrice);
  const companyBudget =
    config.payoutEnergyFeeLimitSun +
    (8192n + 3n + 65n + 3n + 64n) * BigInt(bandwidthPrice);
  if (
    paidEnergy > config.payoutEnergyFeeLimitSun ||
    companyBudget > config.payoutMaximumCompanyCostSun ||
    BigInt(account.balance) < companyBudget
  )
    throw new TreasuryPolicyError("RESOURCE_SHORTFALL");
  return coherent;
}
