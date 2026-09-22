import pg from "pg";
import type {
  LatestNewsSnapshot,
  NewsItem,
  RawNewsItem,
} from "./news.js";

const { Pool } = pg;

export type PersistedSourceCacheEntry = {
  expiresAt: number;
  items: RawNewsItem[];
  warning?: string;
};

export type PersistedNewsCache = {
  sources: Map<string, PersistedSourceCacheEntry>;
  analyses: Map<string, NewsItem>;
  latest: LatestNewsSnapshot | null;
};

type CacheRow = {
  key: string;
  value: unknown;
};

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
});

function requireDatabaseUrl(): void {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for persistent news caching.");
  }
}

export async function loadPersistedNewsCache(): Promise<PersistedNewsCache> {
  requireDatabaseUrl();
  const result = await pool.query<CacheRow>(
    "SELECT key, value FROM news_cache WHERE key = 'latest' OR key LIKE 'source:%' OR key LIKE 'analysis:%'",
  );
  const cache: PersistedNewsCache = {
    sources: new Map(),
    analyses: new Map(),
    latest: null,
  };

  for (const row of result.rows) {
    if (row.key === "latest") {
      cache.latest = row.value as LatestNewsSnapshot;
    } else if (row.key.startsWith("source:")) {
      cache.sources.set(
        row.key.slice("source:".length),
        row.value as PersistedSourceCacheEntry,
      );
    } else if (row.key.startsWith("analysis:")) {
      cache.analyses.set(
        row.key.slice("analysis:".length),
        row.value as NewsItem,
      );
    }
  }

  return cache;
}

export async function persistNewsCacheValue(
  key: string,
  value: unknown,
): Promise<void> {
  requireDatabaseUrl();
  await pool.query(
    `INSERT INTO news_cache (key, value, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (key) DO UPDATE
     SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
    [key, JSON.stringify(value)],
  );
}