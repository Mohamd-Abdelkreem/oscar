import { randomUUID } from "node:crypto";
import { GenericContainer, Wait } from "testcontainers";

export const WITHDRAWAL_REDIS_IMAGE =
  "redis:7.4.11-alpine@sha256:858f009f9709ce576febc734aa78b8f6d624b82571f9ddb6bda4377c833b3499";
export async function withWithdrawalRedis<T>(
  work: (redis: {
    url: string;
    prefix: string;
    restart: () => Promise<void>;
    flush: () => Promise<void>;
    stop: () => Promise<void>;
  }) => Promise<T>,
): Promise<T> {
  const container = await new GenericContainer(WITHDRAWAL_REDIS_IMAGE)
    .withExposedPorts(6379)
    .withCommand(["redis-server", "--maxmemory-policy", "noeviction"])
    .withWaitStrategy(Wait.forSuccessfulCommand("redis-cli ping"))
    .start();
  try {
    return await work({
      get url() {
        return `redis://${container.getHost()}:${String(container.getMappedPort(6379))}/0`;
      },
      prefix: `p08-${randomUUID()}`,
      restart: () => container.restart(),
      stop: async () => {
        await container.stop();
      },
      flush: async () => {
        const outcome = await container.exec(["redis-cli", "FLUSHALL"]);
        if (outcome.exitCode !== 0)
          throw new Error("Disposable Redis loss simulation failed.");
      },
    });
  } finally {
    await container.stop();
  }
}
