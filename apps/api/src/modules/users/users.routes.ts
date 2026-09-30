import { Router, type RequestHandler } from "express";

import {
  csrfMiddleware,
  validationMiddleware,
} from "../../middlewares/index.js";
import { updateProfileBodyDtoSchema } from "./dto/update-profile.dto.js";
import type { UsersController } from "./users.controller.js";

export const usersRoutes = (
  controller: UsersController,
  authenticationMiddleware: RequestHandler,
): Router => {
  const router = Router();

  router.get("/me", authenticationMiddleware, controller.getMe);
  router.patch(
    "/me",
    authenticationMiddleware,
    csrfMiddleware,
    validationMiddleware({ body: updateProfileBodyDtoSchema }),
    controller.updateMe,
  );
  return router;
};
