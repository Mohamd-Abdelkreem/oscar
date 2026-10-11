import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Application } from "express";
import helmet from "helmet";
import type { CorsOptions } from "cors";
import type { Logger } from "pino";

import type { DatabaseClient } from "@template/database";

import { appConfig } from "./core/config/app.config.js";
import { corsConfig } from "./core/config/cors.config.js";
import { ForbiddenException } from "./core/errors/forbidden.error.js";
import {
  createEmailDelivery,
  EmailService,
  type EmailDelivery,
} from "./infrastructure/email/index.js";
import {
  apiRateLimitMiddleware,
  createRequestLoggerMiddleware,
  errorHandler,
  notFound,
  requestId,
} from "./middlewares/index.js";
import { createApiRouter } from "./router.js";
import type { ProofsRuntime } from "./modules/proofs/proofs.runtime.js";
import type { FinancialRuntimeAdmission } from "./modules/custody/runtime-control.js";
import type { CustodyMetadata } from "./modules/custody/custody.service.js";
import type { WithdrawalWakeupPublisher } from "./infrastructure/queue/withdrawal-wakeups.js";
import type { TronPublicPayoutCapability } from "./core/config/tron.config.js";

type AppDependencies = Readonly<{
  database: DatabaseClient;
  logger: Logger;
  emailDelivery?: EmailDelivery;
  financialClock?: () => Date;
  proofs?: ProofsRuntime;
  financialAdmission?: FinancialRuntimeAdmission;
  depositMetadata?: CustodyMetadata;
  withdrawalWakeups?: WithdrawalWakeupPublisher;
  payoutCapability?: TronPublicPayoutCapability;
}>;

const buildCorsOriginValidator = (): CorsOptions["origin"] => {
  const allowedOrigins = new Set(corsConfig.allowedOrigins);

  return (origin, callback) => {
    if (origin === undefined || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new ForbiddenException("Origin is not allowed by CORS."));
  };
};

export const createApp = ({
  database,
  logger,
  emailDelivery = createEmailDelivery(),
  financialClock = () => new Date(),
  proofs,
  financialAdmission,
  depositMetadata,
  withdrawalWakeups,
  payoutCapability,
}: AppDependencies): Application => {
  const app = express();

  app.disable("x-powered-by");
  app.set("json escape", true);
  app.set("trust proxy", appConfig.trustProxy);

  const corsOptions: CorsOptions = {
    origin: buildCorsOriginValidator(),
    credentials: corsConfig.credentials,
    exposedHeaders: ["Content-Disposition", "X-Content-Type-Options"],
  };

  // Global middleware
  app.use(requestId);
  app.use(createRequestLoggerMiddleware(logger));
  app.use(helmet());
  app.use(cors(corsOptions));
  app.use(cookieParser());
  app.use(compression());
  app.use(express.json({ limit: appConfig.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: appConfig.bodyLimit }));

  // API routes
  app.use(
    appConfig.apiPrefix,
    apiRateLimitMiddleware,
    createApiRouter(database, new EmailService(emailDelivery), financialClock, {
      ...(proofs === undefined ? {} : { proofs }),
      ...(financialAdmission === undefined ? {} : { financialAdmission }),
      ...(depositMetadata === undefined ? {} : { depositMetadata }),
      ...(payoutCapability === undefined ? {} : { payoutCapability }),
      ...(withdrawalWakeups === undefined ? {} : { withdrawalWakeups }),
    }),
  );

  // Final middleware
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
