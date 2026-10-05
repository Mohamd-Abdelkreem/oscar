import { getEnvVarAsInteger, getEnvVariable } from "./env.js";

const nodeEnv = getEnvVariable("NODE_ENV", "development");
const isProduction = nodeEnv === "production";

export const parseJwtSecrets = (
  environment: Readonly<Record<string, string | undefined>>,
  environmentName: string,
) => {
  const purposes = [
    "AUTH_JWT_SECRET",
    "AUTH_REFRESH_JWT_SECRET",
    "AUTH_VERIFICATION_JWT_SECRET",
    "AUTH_RESET_JWT_SECRET",
  ] as const;
  const production = environmentName === "production";
  const readSecret = (key: string): string => {
    const secret =
      environment[key] ??
      (production ? undefined : environment["AUTH_JWT_SECRET"]);
    if (
      secret === undefined ||
      secret.length < 32 ||
      /\s/u.test(secret) ||
      secret.includes(String.fromCharCode(0)) ||
      (production &&
        /^(?:replace[-_ ]with|change[-_ ]?me|placeholder|your[-_ ]|test[-_ ]only|local[-_ ]|development[-_ ])/iu.test(
          secret,
        ))
    )
      throw new Error(
        `${key} must contain an explicit valid signing key of at least 32 characters.`,
      );
    return secret;
  };
  const accessSecret = readSecret(purposes[0]);
  const refreshSecret = readSecret(purposes[1]);
  const verificationSecret = readSecret(purposes[2]);
  const resetSecret = readSecret(purposes[3]);
  if (
    production &&
    new Set([accessSecret, refreshSecret, verificationSecret, resetSecret])
      .size !== 4
  )
    throw new Error("Signing purposes must have distinct keys.");
  return Object.freeze({
    accessSecret,
    refreshSecret,
    verificationSecret,
    resetSecret,
  });
};
export const authConfig = Object.freeze({
  nodeEnv,
  isProduction,
  issuer: getEnvVariable("AUTH_JWT_ISSUER", "full-stack-boilerplate"),
  audience: getEnvVariable("AUTH_JWT_AUDIENCE", "full-stack-boilerplate-web"),
  clockToleranceSeconds: getEnvVarAsInteger(
    "AUTH_JWT_CLOCK_TOLERANCE_SECONDS",
    5,
    0,
    60,
  ),
  accessTokenTtlSeconds: getEnvVarAsInteger(
    "AUTH_ACCESS_TOKEN_TTL_SECONDS",
    15 * 60,
    60,
    86_400,
  ),
  refreshFamilyTtlSeconds: getEnvVarAsInteger(
    "AUTH_REFRESH_FAMILY_TTL_SECONDS",
    24 * 60 * 60,
    3_600,
    60 * 60 * 24 * 90,
  ),
  refreshRememberedTtlSeconds: getEnvVarAsInteger(
    "AUTH_REFRESH_REMEMBERED_TTL_SECONDS",
    30 * 24 * 60 * 60,
    3_600,
    60 * 60 * 24 * 180,
  ),
  verifyTokenTtlSeconds: getEnvVarAsInteger(
    "AUTH_VERIFY_TOKEN_TTL_SECONDS",
    24 * 60 * 60,
    60,
    60 * 60 * 24 * 7,
  ),
  resetTokenTtlSeconds: getEnvVarAsInteger(
    "AUTH_RESET_TOKEN_TTL_SECONDS",
    30 * 60,
    60,
    3_600,
  ),
  verifyResendCooldownSeconds: getEnvVarAsInteger(
    "AUTH_VERIFY_RESEND_COOLDOWN_SECONDS",
    60,
    1,
    3_600,
  ),
  argon2: Object.freeze({
    memoryKib: getEnvVarAsInteger(
      "AUTH_ARGON2_MEMORY_KIB",
      19_456,
      1_944,
      1_048_576,
    ),
    timeCost: getEnvVarAsInteger("AUTH_ARGON2_TIME_COST", 2, 1, 10),
    parallelism: getEnvVarAsInteger("AUTH_ARGON2_PARALLELISM", 1, 1, 16),
  }),
});

export const jwtConfig = parseJwtSecrets(process.env, nodeEnv);
