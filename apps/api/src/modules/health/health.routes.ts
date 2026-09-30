import { Router } from "express";

import type { HealthController } from "./health.controller.js";

export const healthRoutes = (controller: HealthController): Router => {
  const router = Router();

  router.get("/live", controller.live);
  router.get("/ready", controller.ready);

  return router;
};
