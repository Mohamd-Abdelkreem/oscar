process.env["NODE_ENV"] = "test";
process.env["DATABASE_URL"] =
  process.env["DATABASE_URL"] ??
  "postgresql://template_test:template_test@127.0.0.1:5432/template_test";
process.env["AUTH_JWT_SECRET"] =
  "test-only-access-secret-000000000000000000000000";
process.env["AUTH_REFRESH_JWT_SECRET"] =
  "test-only-refresh-secret-00000000000000000000000";
process.env["AUTH_VERIFICATION_JWT_SECRET"] =
  "test-only-verify-secret-000000000000000000000000";
process.env["AUTH_RESET_JWT_SECRET"] =
  "test-only-reset-secret-0000000000000000000000000";
process.env["AUTH_ARGON2_MEMORY_KIB"] = "1944";
process.env["AUTH_ARGON2_TIME_COST"] = "1";
process.env["AUTH_ARGON2_PARALLELISM"] = "1";
process.env["LOG_LEVEL"] = "silent";
process.env["EMAIL_PROVIDER"] = "console";
process.env["WEB_APP_URL"] = "http://localhost:3000";
process.env["MAIL_FROM_ADDRESS"] = "no-reply@example.com";
process.env["AUTH_LIMIT_LOGIN_PER_15_MIN"] = "100";
process.env["AUTH_LIMIT_LOGIN_PER_15_MIN_ACCOUNT"] = "100";
process.env["AUTH_LIMIT_REGISTER_PER_HOUR"] = "100";
process.env["AUTH_LIMIT_VERIFY_PER_15_MIN"] = "100";
process.env["AUTH_LIMIT_FORGOT_PER_HOUR_SOURCE"] = "100";
process.env["AUTH_LIMIT_RESET_PER_15_MIN"] = "100";
