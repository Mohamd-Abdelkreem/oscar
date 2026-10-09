import type { Server } from "node:http";
import { fileURLToPath } from "node:url";

import { createDatabaseClient } from "@template/database";

import { createApp } from "./app.js";
import { appConfig } from "./core/config/app.config.js";
import { databaseConfig } from "./core/config/database.config.js";
import { logger } from "./infrastructure/logger/logger.js";
import { parseProofsEnvironment } from "./core/config/proofs.config.js";
import { ProofsRuntime } from "./modules/proofs/proofs.runtime.js";
import { FinancialRuntimeAdmission } from "./modules/custody/runtime-control.js";
import { parseTronPublicEnvironment } from "./core/config/tron.config.js";
import { assertApiDatabaseAuthority } from "./modules/custody/api-database-authority.js";
import { parseWithdrawalQueueEnvironment } from "./core/config/withdrawal.config.js";
import { WithdrawalWakeups } from "./infrastructure/queue/withdrawal-wakeups.js";

const database = createDatabaseClient(databaseConfig.url);
const financialAdmission = new FinancialRuntimeAdmission(database, "API");
const proofs = new ProofsRuntime(
  database,
  parseProofsEnvironment(
    process.env,
    fileURLToPath(new URL("../../../", import.meta.url)),
  ),
  () => new Date(),
  (code) => {
    logger.warn({ code }, "Private image lifecycle failed.");
  },
);
const depositMetadata = process.env["TRON_NETWORK"]?.trim()
  ? parseTronPublicEnvironment(process.env)
  : undefined;
let withdrawalWakeups: WithdrawalWakeups | undefined;

let server: Server | undefined;
let isShuttingDown = false;

const shutdown = async (reason: string, exitCode = 0): Promise<void> => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info({ reason }, "Starting graceful shutdown.");

  const forceShutdownTimer = setTimeout(() => {
    logger.fatal("Graceful shutdown timed out. Forcing process exit.");
    server?.closeAllConnections();
    process.exit(1);
  }, appConfig.shutdownTimeoutMs);
  forceShutdownTimer.unref();

  try {
    try {
      await proofs.stop();
    } finally {
      try {
        if (server !== undefined) {
          await new Promise<void>((resolve, reject) => {
            server?.close((error) => {
              if (error !== undefined) reject(error);
              else resolve();
            });
            server?.closeIdleConnections();
          });
        }
      } finally {
        try {
          await withdrawalWakeups?.close();
        } finally {
          await database.$disconnect();
        }
      }
    }
    clearTimeout(forceShutdownTimer);
    logger.info("Graceful shutdown completed.");
    process.exit(exitCode);
  } catch (error) {
    clearTimeout(forceShutdownTimer);
    logger.fatal({ err: error }, "Graceful shutdown failed.");
    process.exit(1);
  }
};

const startServer = async (): Promise<void> => {
  try {
    await database.$connect();
    await assertApiDatabaseAuthority(database);
    await financialAdmission.register();
    withdrawalWakeups = new WithdrawalWakeups(
      parseWithdrawalQueueEnvironment(process.env),
    );
    await withdrawalWakeups.ready();
    await proofs.start();

    const app = createApp({
      database,
      logger,
      proofs,
      financialAdmission,
      withdrawalWakeups,
      ...(depositMetadata === undefined ? {} : { depositMetadata }),
    });

    server = app.listen(appConfig.port, appConfig.host, (error?: Error) => {
      if (error !== undefined) {
        logger.fatal({ err: error }, "Failed to start the API server.");
        void shutdown("startup-error", 1);
        return;
      }

      logger.info(
        {
          api: `http://localhost:${String(appConfig.port)}${appConfig.apiPrefix}`,
          environment: appConfig.nodeEnv,
          host: appConfig.host,
          port: appConfig.port,
        },
        "API server is listening.",
      );
    });

    server.requestTimeout = appConfig.requestTimeoutMs;
    server.headersTimeout = appConfig.headersTimeoutMs;
    server.keepAliveTimeout = appConfig.keepAliveTimeoutMs;
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start the API server.");
    try {
      await proofs.stop();
    } finally {
      try {
        await withdrawalWakeups?.close();
      } finally {
        await database.$disconnect();
      }
    }
    process.exit(1);
  }
};

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception.");
  void shutdown("uncaughtException", 1);
});
process.once("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection.");
  void shutdown("unhandledRejection", 1);
});

void startServer();
