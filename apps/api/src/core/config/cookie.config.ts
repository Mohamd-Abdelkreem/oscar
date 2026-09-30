import { appConfig } from "./app.config.js";
import { authConfig } from "./auth.config.js";
import { getEnvVariable } from "./env.js";

type SameSitePolicy = "lax" | "none";
const rawSameSite = getEnvVariable("AUTH_COOKIE_SAME_SITE", "lax");

if (rawSameSite !== "lax" && rawSameSite !== "none") {
  throw new Error("AUTH_COOKIE_SAME_SITE must be 'lax' or 'none'.");
}
if (appConfig.isProduction && rawSameSite === "none") {
  throw new Error(
    "AUTH_COOKIE_SAME_SITE=none requires an explicit deployment-specific exception.",
  );
}

export const cookieConfig = Object.freeze({
  refreshPath: `${appConfig.apiPrefix}/auth`,
  csrfPath: "/",
  refreshName: "refreshToken",
  csrfName: "csrfToken",
  refreshMaxAgeSeconds: authConfig.refreshRememberedTtlSeconds,
  sameSite: rawSameSite satisfies SameSitePolicy,
  secure: appConfig.isProduction,
});

export type CookieConfig = typeof cookieConfig;
