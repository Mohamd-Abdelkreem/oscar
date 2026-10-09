type Environment = Readonly<Record<string, string | undefined>>;

function duration(
  environment: Environment,
  key: string,
  minimum: number,
  initial: number,
): number {
  const configured = environment[key];
  if (configured === undefined) return initial;
  if (!/^[1-9]\d*$/u.test(configured))
    throw new Error(`${key} must be a bounded integer.`);
  const seconds = Number(configured);
  if (!Number.isSafeInteger(seconds) || seconds < minimum || seconds > 3600)
    throw new Error(`${key} exceeds its approved bounds.`);
  return seconds;
}

export const parseWithdrawalEnvironment = (environment: Environment) =>
  Object.freeze({
    addressTokenTtlSeconds: duration(
      environment,
      "WITHDRAWAL_ADDRESS_TOKEN_TTL_SECONDS",
      60,
      1800,
    ),
    addressResendCooldownSeconds: duration(
      environment,
      "WITHDRAWAL_ADDRESS_RESEND_COOLDOWN_SECONDS",
      1,
      60,
    ),
    quoteTtlSeconds: duration(
      environment,
      "WITHDRAWAL_QUOTE_TTL_SECONDS",
      60,
      600,
    ),
  });

export type WithdrawalConfig = ReturnType<typeof parseWithdrawalEnvironment>;
export const withdrawalConfig = parseWithdrawalEnvironment(process.env);

function queueInteger(
  environment: Environment,
  key: string,
  initial: number,
  maximum: number,
) {
  const raw = environment[key];
  if (raw === undefined) return initial;
  if (!/^[1-9]\d*$/u.test(raw))
    throw new Error(`${key} must be a bounded integer.`);
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed > maximum)
    throw new Error(`${key} exceeds its bounds.`);
  return parsed;
}

export function parseWithdrawalQueueEnvironment(environment: Environment) {
  const rawUrl = environment["WITHDRAWAL_REDIS_URL"];
  let url: URL;
  try {
    url = new URL(rawUrl ?? "");
  } catch {
    throw new Error("WITHDRAWAL_REDIS_URL is required.");
  }
  if (
    !["redis:", "rediss:"].includes(url.protocol) ||
    url.hostname === "" ||
    url.hash !== "" ||
    url.search !== "" ||
    (!/^\/(?:\d+)?$/u.test(url.pathname) && url.pathname !== "")
  )
    throw new Error("WITHDRAWAL_REDIS_URL is invalid.");
  const prefix = environment["WITHDRAWAL_QUEUE_PREFIX"] ?? "oscar-withdrawals";
  if (!/^[A-Za-z0-9_-]{1,64}$/u.test(prefix))
    throw new Error("WITHDRAWAL_QUEUE_PREFIX is invalid.");
  const scanIntervalMs = queueInteger(
    environment,
    "WITHDRAWAL_SCAN_INTERVAL_MS",
    1000,
    60000,
  );
  if (scanIntervalMs < 100)
    throw new Error("WITHDRAWAL_SCAN_INTERVAL_MS exceeds its bounds.");
  return Object.freeze({
    redisUrl: url.toString(),
    prefix,
    batchSize: queueInteger(environment, "WITHDRAWAL_SCAN_BATCH_SIZE", 20, 200),
    scanIntervalMs,
    producerTimeoutMs: queueInteger(
      environment,
      "WITHDRAWAL_PRODUCER_TIMEOUT_MS",
      2000,
      10000,
    ),
    jobAttempts: queueInteger(environment, "WITHDRAWAL_JOB_ATTEMPTS", 3, 10),
    retryDelayMs: queueInteger(
      environment,
      "WITHDRAWAL_JOB_RETRY_DELAY_MS",
      1000,
      60000,
    ),
    retainedJobs: queueInteger(
      environment,
      "WITHDRAWAL_RETAINED_JOBS",
      1000,
      10000,
    ),
  });
}
export type WithdrawalQueueConfig = ReturnType<
  typeof parseWithdrawalQueueEnvironment
>;

export function parseWithdrawalSignerEnvironment(environment: Environment) {
  const scanIntervalMs = queueInteger(
    environment,
    "WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS",
    1000,
    60000,
  );
  const repairIntervalMs = queueInteger(
    environment,
    "WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS",
    30000,
    300000,
  );
  if (scanIntervalMs < 100)
    throw new Error("WITHDRAWAL_PAYOUT_SCAN_INTERVAL_MS exceeds its bounds.");
  if (repairIntervalMs < 1000 || repairIntervalMs < scanIntervalMs)
    throw new Error("WITHDRAWAL_PAYOUT_REPAIR_INTERVAL_MS exceeds its bounds.");
  const pendingAlertAfterMs = queueInteger(
    environment,
    "WITHDRAWAL_PENDING_ALERT_AFTER_MS",
    300000,
    86400000,
  );
  if (pendingAlertAfterMs < 1000)
    throw new Error("WITHDRAWAL_PENDING_ALERT_AFTER_MS exceeds its bounds.");
  return Object.freeze({
    scanIntervalMs,
    repairIntervalMs,
    pendingAlertAfterMs,
    batchSize: queueInteger(
      environment,
      "WITHDRAWAL_PAYOUT_SCAN_BATCH_SIZE",
      20,
      100,
    ),
  });
}
export type WithdrawalSignerConfig = ReturnType<
  typeof parseWithdrawalSignerEnvironment
>;
