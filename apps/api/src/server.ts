import type { Server } from "node:http";

import { createDatabaseClient } from "@template/database";

import { createApp } from "./app.js";
import { appConfig } from "./core/config/app.config.js";
import { databaseConfig } from "./core/config/database.config.js";
import { logger } from "./infrastructure/logger/logger.js";

const database = createDatabaseClient(databaseConfig.url);
const app = createApp({ database, logger });

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
    if (server !== undefined) {
      await new Promise<void>((resolve, reject) => {
        server?.close((error) => {
          if (error !== undefined) reject(error);
          else resolve();
        });
        server?.closeIdleConnections();
      });
    }

    await database.$disconnect();
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
    await database.$disconnect();
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
