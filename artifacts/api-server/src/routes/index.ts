import { Router } from "express";
import healthRouter from "./health";
import newsRouter from "./news";

const router = Router();

router.use(healthRouter);
router.use(newsRouter);

export default router;
