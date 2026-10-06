import type { Prisma, ImageAssetPurpose } from "@template/database";
import { AppError } from "../../core/errors/app.error.js";
import { currentSubscription } from "../subscriptions/subscriptions.service.js";
import { isEffectiveSubscription } from "../subscriptions/subscriptions.mapper.js";
import {
  authorizeTaskActor,
  type TaskActorIdentity,
  type TaskClock,
} from "../tasks/task-transaction.js";

export const uploadRole = (purpose: ImageAssetPurpose) =>
  purpose === "PROOF" ? "USER" : "ADMIN";

export async function authorizeImageIntake(
  transaction: Prisma.TransactionClient,
  identity: TaskActorIdentity,
  purpose: ImageAssetPurpose,
  clock: TaskClock,
) {
  const authority = await authorizeTaskActor(transaction, identity, {
    role: uploadRole(purpose),
    clock,
  });
  if (purpose === "PROOF") {
    const subscription = await currentSubscription(
      transaction,
      identity.userId,
    );
    if (
      authority.actor.tasksBlocked ||
      !isEffectiveSubscription(subscription, authority.now)
    )
      throw new AppError(
        "Task work is unavailable.",
        403,
        "TASK_WORK_UNAVAILABLE",
      );
  }
  return authority;
}

export async function lockImageAsset(
  transaction: Prisma.TransactionClient,
  id: string,
) {
  await transaction.$queryRaw`SELECT id FROM image_assets WHERE id=${id}::uuid FOR UPDATE`;
}
