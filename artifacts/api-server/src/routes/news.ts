import { Router, type IRouter } from "express";
import {
  ListNewsSourcesResponse,
  RefreshNewsResponse,
} from "@workspace/api-zod";
import { NEWS_SOURCES, refreshNews } from "../lib/news";

const router: IRouter = Router();

router.get("/news/sources", (_req, res): void => {
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
});

router.post("/news/refresh", async (req, res): Promise<void> => {
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
});

export default router;