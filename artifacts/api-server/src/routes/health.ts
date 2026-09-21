import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import { HealthCheckResponse } from "../lib/api-schemas.js";

const router = Router();

router.get("/healthz", (_req: ExpressRequest, res: ExpressResponse) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;
