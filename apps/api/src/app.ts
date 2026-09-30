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

type AppDependencies = Readonly<{
  database: DatabaseClient;
  logger: Logger;
  emailDelivery?: EmailDelivery;
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
}: AppDependencies): Application => {
  const app = express();

  app.disable("x-powered-by");
  app.set("json escape", true);
  app.set("trust proxy", appConfig.trustProxy);

  const corsOptions: CorsOptions = {
    origin: buildCorsOriginValidator(),
    credentials: corsConfig.credentials,
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
    createApiRouter(database, new EmailService(emailDelivery)),
  );

  // Final middleware
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
