import { Router } from "express";

import { buildOpenApiDocument } from "./openapi.js";

export const openApiRoutes = (): Router => {
  const router = Router();
  router.get("/openapi.json", (_request, response) => {
    response.json(buildOpenApiDocument());
  });
  return router;
};
