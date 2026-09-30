import { Router } from "express";

import type { DatabaseClient } from "@template/database";

import { openApiRoutes } from "./infrastructure/openapi/openapi.routes.js";
import type { EmailService } from "./infrastructure/email/email.service.js";
import { createAuthenticationMiddleware } from "./middlewares/auth.middleware.js";
import {
  AuthController,
  authRoutes,
  AuthService,
  HealthController,
  healthRoutes,
  HealthService,
  UsersController,
  usersRoutes,
  UsersService,
} from "./modules/index.js";

export const createApiRouter = (
  database: DatabaseClient,
  emailService: EmailService,
): Router => {
  const router = Router();

  const healthService = new HealthService(database);
  const healthController = new HealthController(healthService);
  const authenticationMiddleware = createAuthenticationMiddleware(database);
  const authController = new AuthController(
    new AuthService(database, emailService),
  );
  const usersController = new UsersController(new UsersService(database));

  router.use(openApiRoutes());
  router.use("/auth", authRoutes(authController, authenticationMiddleware));
  router.use("/users", usersRoutes(usersController, authenticationMiddleware));
  router.use("/health", healthRoutes(healthController));

  return router;
};
