import { Router } from "express";

import type { DatabaseClient } from "@template/database";

import { openApiRoutes } from "./infrastructure/openapi/openapi.routes.js";
import type { EmailService } from "./infrastructure/email/email.service.js";
import { createAuthenticationMiddleware } from "./middlewares/auth.middleware.js";
import type { ProofsRuntime } from "./modules/proofs/proofs.runtime.js";
import type { FinancialRuntimeAdmission } from "./modules/custody/runtime-control.js";
import type { CustodyMetadata } from "./modules/custody/custody.service.js";
import { DepositsService } from "./modules/deposits/deposits.service.js";
import { ManualCreditService } from "./modules/deposits/manual-credit.service.js";
import { DepositsController } from "./modules/deposits/deposits.controller.js";
import {
  depositsRoutes,
  adminDepositsRoutes,
} from "./modules/deposits/deposits.routes.js";
import {
  TasksController,
  EmployeeTasksController,
} from "./modules/tasks/tasks.controller.js";
import { EmployeeTasksService } from "./modules/tasks/employee-tasks.service.js";
import { TaskUnlockService } from "./modules/task-codes/task-unlock.service.js";
import { TaskSubmissionsService } from "./modules/task-submissions/task-submissions.service.js";
import { TaskSubmissionsQueries } from "./modules/task-submissions/task-submissions.queries.js";
import { TaskSubmissionsController } from "./modules/task-submissions/task-submissions.controller.js";
import { SubmissionEvidenceService } from "./modules/task-submissions/submission-evidence.service.js";
import {
  taskSubmissionsRoutes,
  adminTaskSubmissionsRoutes,
} from "./modules/task-submissions/task-submissions.routes.js";
import { TaskReviewService } from "./modules/task-submissions/task-review.service.js";
import { TasksService } from "./modules/tasks/tasks.service.js";
import { TaskPublicationService } from "./modules/tasks/task-publication.service.js";
import { TaskCommandService } from "./modules/tasks/task-command.service.js";
import {
  tasksRoutes,
  taskCommandRoutes,
  employeeTasksRoutes,
} from "./modules/tasks/tasks.routes.js";
import { TaskCodesService } from "./modules/task-codes/task-codes.service.js";
import { TaskCodesQueries } from "./modules/task-codes/task-codes.queries.js";
import { TaskCodesController } from "./modules/task-codes/task-codes.controller.js";
import { taskCodesRoutes } from "./modules/task-codes/task-codes.routes.js";
import {
  ProofsController,
  imageParamsSchema,
} from "./modules/proofs/proofs.controller.js";
import { validationMiddleware } from "./middlewares/validation.middleware.js";
import { proofsRoutes } from "./modules/proofs/proofs.routes.js";
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
  runtime: {
    proofs?: ProofsRuntime;
    financialAdmission?: FinancialRuntimeAdmission;
    depositMetadata?: CustodyMetadata;
  } = {},
): Router => {
  const { proofs, financialAdmission } = runtime;
  const router = Router();

  const healthService = new HealthService(database);
  const healthController = new HealthController(healthService);
  const authenticationMiddleware = createAuthenticationMiddleware(database);
  const depositsController = new DepositsController(
    new DepositsService(
      database,
      financialClock,
      runtime.depositMetadata,
      financialAdmission,
    ),
    new ManualCreditService(database, financialClock, financialAdmission),
  );
  router.use(
    "/deposits",
    depositsRoutes(depositsController, authenticationMiddleware),
  );
  router.use(
    "/admin/deposits",
    adminDepositsRoutes(depositsController, authenticationMiddleware),
  );
  router.use(
    "/admin/task-submissions",
    adminTaskSubmissionsRoutes(
      new TaskSubmissionsController(
        new TaskSubmissionsService(database, financialClock, proofs?.reads),
        new TaskSubmissionsQueries(database, financialClock, proofs?.reads),
        undefined,
        new TaskReviewService(
          database,
          financialClock,
          proofs?.reads,
          financialAdmission,
        ),
      ),
      authenticationMiddleware,
    ),
  );
  router.use(
    "/tasks",
    employeeTasksRoutes(
      new EmployeeTasksController(
        new EmployeeTasksService(database, financialClock, proofs?.reads),
        new TaskUnlockService(database, financialClock, proofs?.reads),
      ),
      authenticationMiddleware,
    ),
  );
  router.use(
    "/task-submissions",
    taskSubmissionsRoutes(
      new TaskSubmissionsController(
        new TaskSubmissionsService(database, financialClock, proofs?.reads),
        new TaskSubmissionsQueries(database, financialClock, proofs?.reads),
        proofs === undefined
          ? undefined
          : new SubmissionEvidenceService(
              database,
              financialClock,
              proofs.reads,
            ),
      ),
      authenticationMiddleware,
    ),
  );
  const tasksController = new TasksController(
    new TasksService(database, financialClock, proofs?.reads),
    new TaskPublicationService(database, financialClock, proofs?.reads),
    new TaskCommandService(database, financialClock, proofs?.reads),
  );
  router.use(
    "/admin/tasks",
    tasksRoutes(tasksController, authenticationMiddleware),
  );
  router.use(
    "/task-commands",
    taskCommandRoutes(tasksController, authenticationMiddleware),
  );
  router.use(
    "/admin/task-codes",
    taskCodesRoutes(
      new TaskCodesController(
        new TaskCodesService(database, financialClock),
        new TaskCodesQueries(database, financialClock),
      ),
      authenticationMiddleware,
    ),
  );
  if (proofs !== undefined) {
    router.use(
      "/proofs",
      proofsRoutes(
        new ProofsController(proofs.uploads, proofs.reads, "PROOF"),
        authenticationMiddleware,
        "USER",
      ),
    );
    const illustrations = new ProofsController(
      proofs.uploads,
      proofs.reads,
      "TASK_ILLUSTRATION",
    );
    router.use(
      "/admin/task-illustrations",
      proofsRoutes(illustrations, authenticationMiddleware, "ADMIN"),
    );
    // Public namespace contains authenticated reads only; admin intake stays purpose-specific.
    const illustrationReads = Router();
    illustrationReads.use(authenticationMiddleware);
    illustrationReads.get(
      "/:assetId",
      validationMiddleware({ params: imageParamsSchema }),
      illustrations.metadata,
    );
    illustrationReads.get(
      "/:assetId/content",
      validationMiddleware({ params: imageParamsSchema }),
      illustrations.content,
    );
    router.use("/task-illustrations", illustrationReads);
  }
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
    new SubscriptionPurchaseService(
      database,
      financialClock,
      financialAdmission,
    ),
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
