import { openai } from "@workspace/integrations-openai-ai-server";
import { createHash } from "node:crypto";

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

export const NEWS_SOURCES: NewsSource[] = [
  {
    id: "yahoo-finance",
    name: "Yahoo Finance",
    url: "https://finance.yahoo.com/",
    feedUrl: "https://finance.yahoo.com/rss/topstories",
    status: "configured",
  },
  {
    id: "investopedia",
    name: "Investopedia",
    url: "https://www.investopedia.com/news-4427706",
    feedUrl:
      "https://www.investopedia.com/feedbuilder/feed/getfeed?feedName=rss_articles",
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
    feedUrl: "https://stockanalysis.com/feed/",
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

    if (results.length === 3) {
      break;
    }
  }

  return results;
}

async function fetchSource(
  source: NewsSource,
): Promise<{ items: RawNewsItem[]; warning?: string }> {
  const response = await fetch(source.feedUrl, {
    headers: REQUEST_HEADERS,
    signal: AbortSignal.timeout(12000),
  });

  if (!response.ok) {
    return {
      items: [],
      warning: `${source.name}: izvor je vratio HTTP ${response.status}.`,
    };
  }

  const body = await response.text();
  const items = parseFeed(body, source);
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
  const response = await openai.chat.completions.create({
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

export async function refreshNews(): Promise<{
  items: NewsItem[];
  sources: NewsSource[];
  warnings: string[];
}> {
  const results = await Promise.all(
    NEWS_SOURCES.map(async (source) => {
      try {
        return { source, ...(await fetchSource(source)) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "nepoznata greška";
        return {
          source,
          items: [],
          warning: `${source.name}: dohvat nije uspio (${message}).`,
        };
      }
    }),
  );

  const rawItems = results.flatMap((result) => result.items).slice(0, 15);
  const warnings = results.flatMap((result) =>
    result.warning ? [result.warning] : [],
  );

  if (rawItems.length === 0) {
    return {
      items: [],
      sources: results.map(({ source, warning }) => ({
        ...source,
        status: warning ? "unavailable" : "configured",
      })),
      warnings,
    };
  }

  const items = await analyzeWithOpenAI(rawItems);
  if (items.length === 0) {
    throw new Error(
      "Vijesti su dohvaćene, ali AI obrada nije vratila valjan rezultat.",
    );
  }

  return {
    items,
    sources: results.map(({ source, warning }) => ({
      ...source,
      status: warning ? "partial" : "configured",
    })),
    warnings,
  };
}