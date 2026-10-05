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
import { PackagesService } from "./modules/packages/packages.service.js";
import { PackageConfigurationService } from "./modules/packages/package-configuration.service.js";
import { PackagesController } from "./modules/packages/packages.controller.js";
import { packagesRoutes } from "./modules/packages/packages.routes.js";
import {
  WalletsService,
  WalletsController,
  walletsRoutes,
} from "./modules/wallets/index.js";
import {
  ReferralsService,
  ReferralsController,
  referralsRoutes,
} from "./modules/referrals/index.js";
import {
  SubscriptionsController,
  SubscriptionsService,
  SubscriptionPurchaseService,
  PurchaseQuoteService,
  subscriptionsRoutes,
  adminSubscriptionsRoutes,
} from "./modules/subscriptions/index.js";

export const createApiRouter = (
  database: DatabaseClient,
  emailService: EmailService,
  financialClock: () => Date = () => new Date(),
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
  router.use(
    packagesRoutes(
      new PackagesController(
        new PackagesService(database, financialClock),
        new PackageConfigurationService(database, financialClock),
      ),
      authenticationMiddleware,
    ),
  );
  const subscriptionsController = new SubscriptionsController(
    new PurchaseQuoteService(database, financialClock),
    new SubscriptionPurchaseService(database, financialClock),
    new SubscriptionsService(database, financialClock),
  );
  router.use(
    "/subscriptions",
    subscriptionsRoutes(subscriptionsController, authenticationMiddleware),
  );
  router.use(
    "/admin/subscriptions",
    adminSubscriptionsRoutes(subscriptionsController, authenticationMiddleware),
  );

  router.use(
    walletsRoutes(
      new WalletsController(new WalletsService(database, financialClock)),
      authenticationMiddleware,
    ),
  );
  router.use(
    referralsRoutes(
      new ReferralsController(new ReferralsService(database, financialClock)),
      authenticationMiddleware,
    ),
  );
  return router;
};
