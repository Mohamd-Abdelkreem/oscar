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
  AdminsController,
  adminsRoutes,
  AdminInvitationsService,
  AdminLifecycleService,
  AdminsService,
} from "./modules/index.js";
import { EmployeeRestrictionsService } from "./modules/users/employee-restrictions.service.js";

export const createApiRouter = (
  database: DatabaseClient,
  emailService: EmailService,
): Router => {
  const router = Router();

  const healthService = new HealthService(database);
  const healthController = new HealthController(healthService);
  const authenticationMiddleware = createAuthenticationMiddleware(database);
  const invitations = new AdminInvitationsService(database, emailService);
  const authController = new AuthController(
    new AuthService(database, emailService),
    invitations,
  );
  const usersController = new UsersController(new UsersService(database));
  const adminsController = new AdminsController(
    new EmployeeRestrictionsService(database),
    new AdminsService(database),
    new AdminLifecycleService(database),
    invitations,
  );

  router.use(openApiRoutes());
  router.use("/auth", authRoutes(authController, authenticationMiddleware));
  router.use("/users", usersRoutes(usersController, authenticationMiddleware));
  router.use(
    "/admin",
    adminsRoutes(adminsController, authenticationMiddleware),
  );
  router.use("/health", healthRoutes(healthController));

  return router;
};
