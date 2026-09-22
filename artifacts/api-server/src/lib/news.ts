import { getOpenAI } from "./openai.js";
import { logger } from "./logger.js";
import { createHash, randomUUID } from "node:crypto";

export type NewsSourceStatus = "configured" | "partial" | "unavailable";

export type NewsSource = {
  id: string;
  name: string;
  url: string;
  feedUrl: string;
  status: NewsSourceStatus;
};

export type RawNewsItem = {
  id: string;
  sourceId: string;
  source: string;
  sourceUrl: string;
  articleUrl: string;
  originalTitle: string;
  description: string;
  publishedAt: string | null;
};

export type NewsItem = {
  id: string;
  source: string;
  sourceUrl: string;
  articleUrl: string;
  originalTitle: string;
  translatedTitle: string;
  summary: string;
  company: string;
  ticker: string | null;
  direction: "positive" | "negative" | "mixed";
  pressure: string;
  why: string;
  risks: string;
  confidence: string;
  publishedAt: string | null;
  readTime: string;
};

export type NewsRefreshStatus = "fetching" | "analyzing" | "completed" | "failed";

export type NewsRefreshSnapshot = {
  jobId: string;
  status: NewsRefreshStatus;
  items: NewsItem[];
  startedAt: string;
  refreshedAt: string | null;
  sources: NewsSource[];
  warnings: string[];
  processedSources: number;
  totalSources: number;
  cachedItems: number;
  newItems: number;
  error: string | null;
};

export type LatestNewsSnapshot = {
  items: NewsItem[];
  refreshedAt: string | null;
  sources: NewsSource[];
  warnings: string[];
};

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "yahoo-finance",
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/",
    feedUrl: "https://finance.yahoo.com/rss/topstories",
    status: "configured",
  },
  {
    id: "finviz",
    name: "Finviz",
    url: "https://finviz.com/news",
    feedUrl: "https://finviz.com/news",
    status: "configured",
  },
  {
    id: "bloomberg",
    name: "Bloomberg",
    url: "https://www.bloomberg.com/finance",
    feedUrl: "https://feeds.bloomberg.com/markets/news.rss",
    status: "configured",
  },
  {
    id: "benzinga",
    name: "Benzinga",
    url: "https://www.benzinga.com/",
    feedUrl: "https://www.benzinga.com/feed",
    status: "configured",
  },
  {
    id: "stockanalysis",
    name: "Stock Analysis",
    url: "https://stockanalysis.com/",
    feedUrl: "https://stockanalysis.com/news/press-releases/",
    status: "configured",
  },
  {
    id: "investing",
    name: "Investing.com",
    url: "https://www.investing.com/",
    feedUrl: "https://www.investing.com/rss/news.rss",
    status: "configured",
  },
];

const REQUEST_HEADERS = {
  Accept: "application/rss+xml, application/atom+xml, text/xml, text/html",
  "User-Agent":
    "DioniceSazeto/1.0 (+https://replit.com; news reader for personal use)",
};

type NewsFetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function cleanText(value: string): string {
  return decodeHtmlEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(block: string, tags: string[]): string | null {
  for (const tag of tags) {
    const match = block.match(
      new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"),
    );
    if (match?.[1]) {
      return cleanText(match[1]);
    }
  }
  return null;
}

function extractLink(block: string): string | null {
  const atomLink = block.match(
    /<link\b[^>]*href=["']([^"']+)["'][^>]*\/?>/i,
  );
  if (atomLink?.[1]) {
    return decodeHtmlEntities(atomLink[1]).trim();
  }

  const textLink = extractTag(block, ["link", "origLink", "guid"]);
  return textLink?.startsWith("http") ? textLink : null;
}

function parseFeed(xml: string, source: NewsSource): RawNewsItem[] {
  const blocks = [
    ...Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map(
      (match) => match[0],
    ),
    ...Array.from(xml.matchAll(/<entry\b[\s\S]*?<\/entry>/gi)).map(
      (match) => match[0],
    ),
  ];

  const seenUrls = new Set<string>();
  const results: RawNewsItem[] = [];

  for (const block of blocks) {
    const title = extractTag(block, ["title"]);
    const articleUrl = extractLink(block);
    if (!title || !articleUrl || seenUrls.has(articleUrl)) {
      continue;
    }

    seenUrls.add(articleUrl);
    const id = `${source.id}-${createHash("sha1")
      .update(`${source.id}:${articleUrl}`)
      .digest("hex")
      .slice(0, 16)}`;
    results.push({
      id,
      sourceId: source.id,
      source: source.name,
      sourceUrl: source.url,
      articleUrl,
      originalTitle: title,
      description:
        extractTag(block, ["description", "summary", "content", "content:encoded"]) ??
        "",
      publishedAt: extractTag(block, [
        "pubDate",
        "published",
        "updated",
        "dc:date",
      ]),
    });

    if (results.length === 4) {
      break;
    }
  }

  return results;
}

function parseFinvizHtml(html: string, source: NewsSource): RawNewsItem[] {
  const rows = Array.from(
    html.matchAll(/<tr\b[^>]*news_table-row[^>]*>[\s\S]*?<\/tr>/gi),
  ).map((match) => match[0]);
  const seenUrls = new Set<string>();

  return rows.flatMap((row) => {
    const link = row.match(
      /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i,
    );
    if (!link?.[1] || !link[2]) {
      return [];
    }

    const articleUrl = decodeHtmlEntities(link[1]).trim();
    const originalTitle = cleanText(link[2]);
    if (!articleUrl.startsWith("http") || !originalTitle || seenUrls.has(articleUrl)) {
      return [];
    }

    seenUrls.add(articleUrl);
    const dateMatch = row.match(
      /<td\b[^>]*news_date-cell[^>]*>([\s\S]*?)<\/td>/i,
    );
    const descriptionMatch = row.match(
      /data-boxover-text=["']([^"']+)["']/i,
    );

    return [
      {
        id: `${source.id}-${createHash("sha1")
          .update(`${source.id}:${articleUrl}`)
          .digest("hex")
          .slice(0, 16)}`,
        sourceId: source.id,
        source: source.name,
        sourceUrl: source.url,
        articleUrl,
        originalTitle,
        description: descriptionMatch?.[1]
          ? cleanText(descriptionMatch[1])
          : "",
        publishedAt: dateMatch?.[1] ? cleanText(dateMatch[1]) : null,
      },
    ];
  }).slice(0, 4);
}

function decodeSerializedString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\")
      .trim();
  }
}

function parseStockAnalysisHtml(
  html: string,
  source: NewsSource,
): RawNewsItem[] {
  const articlePattern =
    /\{url:"((?:\\.|[^"\\])*)",img:(?:null|"(?:\\.|[^"\\])*"),title:"((?:\\.|[^"\\])*)",text:"((?:\\.|[^"\\])*)",source:"((?:\\.|[^"\\])*)",type:"Article"(?:,tickers:\[([^\]]*)\])?,time:"((?:\\.|[^"\\])*)",ago:"((?:\\.|[^"\\])*)"\}/g;
  const seenUrls = new Set<string>();
  const results: RawNewsItem[] = [];

  for (const match of html.matchAll(articlePattern)) {
    const articleUrl = decodeSerializedString(match[1] ?? "");
    const originalTitle = decodeSerializedString(match[2] ?? "");
    const description = decodeSerializedString(match[3] ?? "");
    const originalSource = decodeSerializedString(match[4] ?? "");
    const publishedAt = decodeSerializedString(match[6] ?? "");

    if (
      !articleUrl.startsWith("http") ||
      !originalTitle ||
      seenUrls.has(articleUrl)
    ) {
      continue;
    }

    seenUrls.add(articleUrl);
    results.push({
      id: `${source.id}-${createHash("sha1")
        .update(`${source.id}:${articleUrl}`)
        .digest("hex")
        .slice(0, 16)}`,
      sourceId: source.id,
      source: source.name,
      sourceUrl: source.url,
      articleUrl,
      originalTitle,
      description: originalSource
        ? `${description} Izvor priopćenja: ${originalSource}.`
        : description,
      publishedAt: publishedAt || null,
    });

    if (results.length === 4) {
      break;
    }
  }

  return results;
}

async function fetchSource(
  source: NewsSource,
): Promise<{ items: RawNewsItem[]; warning?: string }> {
  const response = (await fetch(source.feedUrl, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(12000),
  })) as unknown as NewsFetchResponse;

  if (!response.ok) {
    return {
      items: [],
      warning: `${source.name}: izvor je vratio HTTP ${response.status}.`,
    };
  }

  const body = await response.text();
  const items =
    source.id === "finviz"
      ? parseFinvizHtml(body, source)
      : source.id === "stockanalysis"
        ? parseStockAnalysisHtml(body, source)
      : parseFeed(body, source);
  if (items.length === 0) {
    return {
      items: [],
      warning: `${source.name}: nije pronađen čitljiv RSS/Atom sadržaj.`,
    };
  }

  return { items };
}

function isDirection(value: unknown): value is NewsItem["direction"] {
  return value === "positive" || value === "negative" || value === "mixed";
}

function isAnalysis(value: unknown): value is {
  id: string;
  translatedTitle: string;
  summary: string;
  company: string;
  ticker: string | null;
  direction: NewsItem["direction"];
  pressure: string;
  why: string;
  risks: string;
  confidence: string;
} {
  if (!value || typeof value !== "object") {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.translatedTitle === "string" &&
    typeof item.summary === "string" &&
    typeof item.company === "string" &&
    (typeof item.ticker === "string" || item.ticker === null) &&
    isDirection(item.direction) &&
    typeof item.pressure === "string" &&
    typeof item.why === "string" &&
    typeof item.risks === "string" &&
    typeof item.confidence === "string"
  );
}

function parseAnalysisResponse(content: string): unknown[] {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const objectStart = cleaned.indexOf("{");
  const arrayStart = cleaned.indexOf("[");

  if (arrayStart >= 0 && (objectStart < 0 || arrayStart < objectStart)) {
    const arrayEnd = cleaned.lastIndexOf("]");
    if (arrayEnd >= arrayStart) {
      const parsed: unknown = JSON.parse(cleaned.slice(arrayStart, arrayEnd + 1));
      return Array.isArray(parsed) ? parsed : [];
    }
  }

  if (objectStart >= 0) {
    const objectEnd = cleaned.lastIndexOf("}");
    if (objectEnd >= objectStart) {
      const parsed: unknown = JSON.parse(
        cleaned.slice(objectStart, objectEnd + 1),
      );
      if (
        parsed &&
        typeof parsed === "object" &&
        Array.isArray((parsed as { items?: unknown }).items)
      ) {
        return (parsed as { items: unknown[] }).items;
      }
    }
  }

  return [];
}

async function analyzeWithOpenAI(items: RawNewsItem[]): Promise<NewsItem[]> {
  const response = await getOpenAI().chat.completions.create({
    model: "gpt-5.6-terra",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content:
          "Ti si urednik financijskog portala Dionice sažeto. Obrađuješ engleske naslove vijesti za hrvatske čitatelje. Vrati isključivo JSON polje objekata, bez Markdowna. Za svaki ulaz zadrži isti id. Prevedi naslov i napiši sažetak na hrvatskom. Analiza mora biti oprezna: nikad ne obećavaj rast ili pad cijene, koristi formulacije poput mogućeg katalizatora, mogućeg pritiska ili mješovitog utjecaja. Ako ne možeš pouzdano prepoznati kompaniju ili ticker, koristi prazan naziv kompanije i null za ticker. Polje direction mora biti samo positive, negative ili mixed. confidence treba biti kratka hrvatska procjena.",
      },
      {
        role: "user",
        content: JSON.stringify({
          instruction:
            "Za svaki članak vrati polja: id, translatedTitle, summary, company, ticker, direction, pressure, why, risks, confidence.",
          articles: items.map((item) => ({
            id: item.id,
            source: item.source,
            originalTitle: item.originalTitle,
            description: item.description,
          })),
        }),
      },
    ],
  });

  const content = response.choices[0]?.message.content ?? "";
  let parsed: unknown[];
  try {
    parsed = parseAnalysisResponse(content);
  } catch {
    parsed = [];
  }

  const analyses = new Map(
    parsed.filter(isAnalysis).map((analysis) => [analysis.id, analysis]),
  );

  return items.flatMap((item) => {
    const analysis = analyses.get(item.id);
    if (!analysis) {
      return [];
    }

    const wordCount = analysis.summary.split(/\s+/).filter(Boolean).length;
    return [
      {
        id: item.id,
        source: item.source,
        sourceUrl: item.sourceUrl,
        articleUrl: item.articleUrl,
        originalTitle: item.originalTitle,
        translatedTitle: analysis.translatedTitle,
        summary: analysis.summary,
        company: analysis.company,
        ticker: analysis.ticker,
        direction: analysis.direction,
        pressure: analysis.pressure,
        why: analysis.why,
        risks: analysis.risks,
        confidence: analysis.confidence,
        publishedAt: item.publishedAt,
        readTime: `${Math.max(2, Math.ceil(wordCount / 55))} min`,
      },
    ];
  });
}

type SourceResult = {
  source: NewsSource;
  items: RawNewsItem[];
  warning?: string;
  cacheHit: boolean;
};

type SourceCacheEntry = {
  expiresAt: number;
  items: RawNewsItem[];
  warning?: string;
};

const SOURCE_CACHE_TTL_MS = 5 * 60 * 1000;
const JOB_RETENTION_MS = 30 * 60 * 1000;
const AI_BATCH_CONCURRENCY = 2;
const sourceCache = new Map<string, SourceCacheEntry>();
const analysisCache = new Map<string, NewsItem>();
const refreshJobs = new Map<string, NewsRefreshSnapshot>();
let activeJobId: string | null = null;
let latestNews: LatestNewsSnapshot = {
  items: [],
  refreshedAt: null,
  sources: NEWS_SOURCES,
  warnings: [],
};

function analysisKey(item: RawNewsItem): string {
  return createHash("sha256")
    .update(`${item.articleUrl}\n${item.originalTitle}\n${item.description}`)
    .digest("hex");
}

function snapshotJob(job: NewsRefreshSnapshot): NewsRefreshSnapshot {
  return {
    ...job,
    items: [...job.items],
    sources: job.sources.map((source) => ({ ...source })),
    warnings: [...job.warnings],
  };
}

function mergeItems(preferred: NewsItem[], existing: NewsItem[]): NewsItem[] {
  const merged = new Map<string, NewsItem>();
  for (const item of [...preferred, ...existing]) {
    if (!merged.has(item.id)) {
      merged.set(item.id, item);
    }
  }
  return Array.from(merged.values()).slice(0, 24);
}

function cleanOldJobs(now = Date.now()): void {
  for (const [jobId, job] of refreshJobs) {
    if (
      job.status !== "fetching" &&
      job.status !== "analyzing" &&
      now - new Date(job.startedAt).getTime() > JOB_RETENTION_MS
    ) {
      refreshJobs.delete(jobId);
    }
  }
}

async function fetchSourceCached(source: NewsSource): Promise<SourceResult> {
  const cached = sourceCache.get(source.id);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      source,
      items: cached.items,
      warning: cached.warning,
      cacheHit: true,
    };
  }

  try {
    const result = await fetchSource(source);
    sourceCache.set(source.id, {
      expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
      items: result.items,
      warning: result.warning,
    });
    return { source, ...result, cacheHit: false };
  } catch (error) {
    const message = error instanceof Error ? error.message : "nepoznata greška";
    return {
      source,
      items: [],
      warning: `${source.name}: dohvat nije uspio (${message}).`,
      cacheHit: false,
    };
  }
}

async function runWithConcurrency<T>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<void>,
): Promise<void> {
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const value = values[nextIndex];
        nextIndex += 1;
        if (value !== undefined) {
          await worker(value);
        }
      }
    },
  );
  await Promise.all(runners);
}

function publishJobItems(job: NewsRefreshSnapshot, items: NewsItem[]): void {
  job.items = mergeItems(items, job.items);
  latestNews = {
    items: [...job.items],
    refreshedAt: latestNews.refreshedAt,
    sources: job.sources.map((source) => ({ ...source })),
    warnings: [...job.warnings],
  };
}

async function processRefreshJob(job: NewsRefreshSnapshot): Promise<void> {
  const refreshStartedAt = Date.now();
  try {
    const results = await Promise.all(
      NEWS_SOURCES.map(async (source) => {
        const sourceStartedAt = Date.now();
        const result = await fetchSourceCached(source);
        job.processedSources += 1;
        logger.info(
          {
            jobId: job.jobId,
            source: source.id,
            items: result.items.length,
            cacheHit: result.cacheHit,
            durationMs: Date.now() - sourceStartedAt,
          },
          "News source refresh completed",
        );
        return result;
      }),
    );

    job.sources = results.map(({ source, warning }) => ({
      ...source,
      status: warning ? "partial" : "configured",
    }));
    job.warnings = results.flatMap((result) =>
      result.warning ? [result.warning] : [],
    );

    const rawItems = results.flatMap((result) => result.items).slice(0, 24);
    if (rawItems.length === 0) {
      throw new Error("Nijedan izvor nije vratio čitljivu vijest.");
    }

    job.status = "analyzing";
    const uncachedBatches = new Map<string, RawNewsItem[]>();
    const cachedItems: NewsItem[] = [];

    for (const rawItem of rawItems) {
      const cached = analysisCache.get(analysisKey(rawItem));
      if (cached) {
        cachedItems.push({
          ...cached,
          publishedAt: rawItem.publishedAt ?? cached.publishedAt,
        });
        continue;
      }

      const batch = uncachedBatches.get(rawItem.sourceId) ?? [];
      batch.push(rawItem);
      uncachedBatches.set(rawItem.sourceId, batch);
    }

    job.cachedItems = cachedItems.length;
    if (cachedItems.length > 0) {
      publishJobItems(job, cachedItems);
    }

    await runWithConcurrency(
      Array.from(uncachedBatches.entries()),
      AI_BATCH_CONCURRENCY,
      async ([sourceId, batch]) => {
        const batchStartedAt = Date.now();
        try {
          const analyzed = await analyzeWithOpenAI(batch);
          for (const item of analyzed) {
            const rawItem = batch.find((candidate) => candidate.id === item.id);
            if (rawItem) {
              analysisCache.set(analysisKey(rawItem), item);
            }
          }
          job.newItems += analyzed.length;
          publishJobItems(job, analyzed);
          logger.info(
            {
              jobId: job.jobId,
              source: sourceId,
              requestedItems: batch.length,
              analyzedItems: analyzed.length,
              durationMs: Date.now() - batchStartedAt,
            },
            "News AI batch completed",
          );
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "nepoznata greška";
          job.warnings.push(`${sourceId}: AI obrada nije uspjela (${message}).`);
          logger.warn(
            {
              jobId: job.jobId,
              source: sourceId,
              durationMs: Date.now() - batchStartedAt,
              err: error,
            },
            "News AI batch failed",
          );
        }
      },
    );

    if (job.cachedItems + job.newItems === 0) {
      throw new Error(
        "Vijesti su dohvaćene, ali AI obrada nije vratila valjan rezultat.",
      );
    }

    job.status = "completed";
    job.refreshedAt = new Date().toISOString();
    latestNews = {
      items: [...job.items],
      refreshedAt: job.refreshedAt,
      sources: job.sources.map((source) => ({ ...source })),
      warnings: [...job.warnings],
    };
    logger.info(
      {
        jobId: job.jobId,
        items: job.items.length,
        cachedItems: job.cachedItems,
        newItems: job.newItems,
        durationMs: Date.now() - refreshStartedAt,
      },
      "News refresh job completed",
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Osvježavanje vijesti nije uspjelo.";
    job.status = "failed";
    job.error = message;
    job.refreshedAt = new Date().toISOString();
    logger.error(
      {
        jobId: job.jobId,
        durationMs: Date.now() - refreshStartedAt,
        err: error,
      },
      "News refresh job failed",
    );
  } finally {
    if (activeJobId === job.jobId) {
      activeJobId = null;
    }
  }
}

export function startNewsRefresh(): NewsRefreshSnapshot {
  cleanOldJobs();
  if (activeJobId) {
    const activeJob = refreshJobs.get(activeJobId);
    if (
      activeJob &&
      (activeJob.status === "fetching" || activeJob.status === "analyzing")
    ) {
      return snapshotJob(activeJob);
    }
  }

  const job: NewsRefreshSnapshot = {
    jobId: randomUUID(),
    status: "fetching",
    items: [...latestNews.items],
    startedAt: new Date().toISOString(),
    refreshedAt: latestNews.refreshedAt,
    sources: latestNews.sources.map((source) => ({ ...source })),
    warnings: [],
    processedSources: 0,
    totalSources: NEWS_SOURCES.length,
    cachedItems: 0,
    newItems: 0,
    error: null,
  };
  refreshJobs.set(job.jobId, job);
  activeJobId = job.jobId;
  void processRefreshJob(job);
  return snapshotJob(job);
}

export function getNewsRefreshJob(jobId: string): NewsRefreshSnapshot | null {
  cleanOldJobs();
  const job = refreshJobs.get(jobId);
  return job ? snapshotJob(job) : null;
}

export function getLatestNews(): LatestNewsSnapshot {
  return {
    items: [...latestNews.items],
    refreshedAt: latestNews.refreshedAt,
    sources: latestNews.sources.map((source) => ({ ...source })),
    warnings: [...latestNews.warnings],
  };
}