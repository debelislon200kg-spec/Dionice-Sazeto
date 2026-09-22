import { z } from "zod";

const newsSourceStatus = z.enum(["configured", "partial", "unavailable"]);

const newsSource = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().url(),
  status: newsSourceStatus,
});

const newsItem = z.object({
  id: z.string(),
  source: z.string(),
  sourceUrl: z.string().url(),
  articleUrl: z.string().url(),
  originalTitle: z.string(),
  translatedTitle: z.string(),
  summary: z.string(),
  company: z.string(),
  ticker: z.string().nullable(),
  direction: z.enum(["positive", "negative", "mixed"]),
  pressure: z.string(),
  why: z.string(),
  risks: z.string(),
  confidence: z.string(),
  publishedAt: z.string().nullable(),
  readTime: z.string(),
});

export const HealthCheckResponse = z.object({
  status: z.string(),
});

export const ListNewsSourcesResponse = z.array(newsSource);

export const RefreshNewsResponse = z.object({
  items: z.array(newsItem),
  refreshedAt: z.string().datetime().nullable(),
  sources: z.array(newsSource),
  warnings: z.array(z.string()),
});

export const NewsRefreshJobResponse = z.object({
  jobId: z.string(),
  status: z.enum(["fetching", "analyzing", "completed", "failed"]),
  items: z.array(newsItem),
  startedAt: z.string().datetime(),
  refreshedAt: z.string().datetime().nullable(),
  sources: z.array(newsSource),
  warnings: z.array(z.string()),
  processedSources: z.number().int().nonnegative(),
  totalSources: z.number().int().positive(),
  cachedItems: z.number().int().nonnegative(),
  newItems: z.number().int().nonnegative(),
  error: z.string().nullable(),
});