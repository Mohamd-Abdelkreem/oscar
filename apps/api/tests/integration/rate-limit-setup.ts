import { beforeEach } from "vitest";
import { ipKeyGenerator } from "express-rate-limit";
import { apiRateLimitMiddleware } from "../../src/middlewares/rate-limit.middleware.js";

// createApp shares this store in the nonisolated integration worker. Each
// independent scenario gets its own loopback budget; limits within it stay real.
beforeEach(() => {
  for (const address of ["127.0.0.1", "::1"]) {
    apiRateLimitMiddleware.resetKey(ipKeyGenerator(address));
  }
});
