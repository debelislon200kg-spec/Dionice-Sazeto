import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import {
  ListNewsSourcesResponse,
  NewsRefreshJobResponse,
  RefreshNewsResponse,
} from "../lib/api-schemas.js";
import {
  NEWS_SOURCES,
  getLatestNews,
  getNewsRefreshJob,
  startNewsRefresh,
} from "../lib/news.js";

const router = Router();

router.get(
  "/news/sources",
  (_req: ExpressRequest, res: ExpressResponse): void => {
  res.json(
    ListNewsSourcesResponse.parse(
      NEWS_SOURCES.map(({ id, name, url, status }) => ({
        id,
        name,
        url,
        status,
      })),
    ),
  );
  },
);

router.post(
  "/news/refresh",
  (
    req: ExpressRequest,
    res: ExpressResponse,
  ): void => {
    try {
      res.json(NewsRefreshJobResponse.parse(startNewsRefresh()));
    } catch (error) {
      req.log.error({ err: error }, "News refresh could not be started");
      res.status(502).json({
        error:
          error instanceof Error
            ? error.message
            : "Osvježavanje vijesti nije uspjelo.",
        warnings: [],
      });
    }
  },
);

router.get(
  "/news/latest",
  (_req: ExpressRequest, res: ExpressResponse): void => {
    res.json(RefreshNewsResponse.parse(getLatestNews()));
  },
);

router.get(
  "/news/refresh/:jobId",
  (req: ExpressRequest, res: ExpressResponse): void => {
    const jobId = req.params.jobId;
    if (typeof jobId !== "string") {
      res.status(400).json({
        error: "Neispravan identifikator osvježavanja.",
        warnings: [],
      });
      return;
    }
    const job = getNewsRefreshJob(jobId);
    if (!job) {
      res.status(404).json({
        error: "Osvježavanje nije pronađeno ili je isteklo.",
        warnings: [],
      });
      return;
    }
    res.json(NewsRefreshJobResponse.parse(job));
  },
);

export default router;