import { Router } from "express";
import healthRouter from "./health.js";
import newsRouter from "./news.js";

const router = Router();

router.use(healthRouter);
router.use(newsRouter);

export default router;
