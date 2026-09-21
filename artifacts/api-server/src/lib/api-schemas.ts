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
  refreshedAt: z.coerce.date(),
  sources: z.array(newsSource),
  warnings: z.array(z.string()),
});