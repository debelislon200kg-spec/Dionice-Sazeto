import {
  Router,
  type Request as ExpressRequest,
  type Response as ExpressResponse,
} from "express";
import {
  ListNewsSourcesResponse,
  RefreshNewsResponse,
} from "../lib/api-schemas.js";
import { NEWS_SOURCES, refreshNews } from "../lib/news.js";

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
  async (
    req: ExpressRequest,
    res: ExpressResponse,
  ): Promise<void> => {
    try {
      const result = await refreshNews();
      if (result.items.length === 0) {
        res.status(502).json({
          error: "Nijedan izvor nije vratio čitljivu vijest.",
          warnings: result.warnings,
        });
        return;
      }

      res.json(
        RefreshNewsResponse.parse({
          ...result,
          refreshedAt: new Date(),
          sources: result.sources.map(({ id, name, url, status }) => ({
            id,
            name,
            url,
            status,
          })),
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "News refresh failed");
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

export default router;