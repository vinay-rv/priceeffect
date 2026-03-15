import crypto from "crypto";
import axios from "axios";
import NodeCache from "node-cache";
import Parser from "rss-parser";

const NEWS_API_URL = "https://newsapi.org/v2/top-headlines";
const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en";

const parser = new Parser();
const newsCache = new NodeCache({ stdTTL: 900, checkperiod: 120, useClones: false });
const cacheKey = "merged-news";

function stripHtml(text = "") {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function createNewsId(title, url) {
  return crypto.createHash("sha1").update(`${title}:${url}`).digest("hex");
}

function normalizeSummary(text = "") {
  const stripped = stripHtml(text);
  return stripped.slice(0, 200);
}

function buildBody(text = "") {
  const cleaned = stripHtml(text).replace(/\[\+\d+\schars\]$/i, "").trim();

  if (!cleaned) {
    return [];
  }

  const sentences = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length === 0) {
    return [cleaned];
  }

  const paragraphs = [];
  for (let index = 0; index < sentences.length; index += 2) {
    paragraphs.push(sentences.slice(index, index + 2).join(" "));
  }

  return paragraphs.slice(0, 4);
}

function inferCategory(...parts) {
  const content = parts.join(" ").toLowerCase();

  if (/(breaking|just in|alert|urgent)/.test(content)) {
    return "Breaking";
  }

  if (/(nvidia|ai|tech|software|semiconductor|cloud|digital)/.test(content)) {
    return "Tech";
  }

  if (/(bank|finance|financial|lender|rbi|loan|credit)/.test(content)) {
    return "Finance";
  }

  if (/(crude|oil|gas|energy|power|refiner|shipping)/.test(content)) {
    return "Energy";
  }

  if (/(biotech|pharma|health|healthcare|drug|hospital)/.test(content)) {
    return "Health";
  }

  if (/(surge|jump|rally|gain|bullish|beats|upgrade|rise)/.test(content)) {
    return "Bullish";
  }

  if (/(drop|fall|slump|cuts|bearish|selloff|weak|downturn)/.test(content)) {
    return "Bearish";
  }

  return "Markets";
}

function normalizeNewsApiArticle(article) {
  const content = article.content || article.description || "";
  return {
    id: createNewsId(article.title || "newsapi", article.url || ""),
    title: article.title || "Untitled article",
    summary: normalizeSummary(content),
    source: article.source?.name || "NewsAPI",
    url: article.url || "",
    publishedAt: new Date(article.publishedAt || Date.now()).toISOString(),
    category: inferCategory(article.title || "", article.description || "", content),
    body: buildBody(content),
  };
}

function normalizeRssItem(item) {
  const content = item.contentSnippet || item.content || item.title || "";
  return {
    id: createNewsId(item.title || "google-news", item.link || ""),
    title: item.title || "Untitled article",
    summary: normalizeSummary(content),
    source: item.source?.title || item.creator || "Google News",
    url: item.link || "",
    publishedAt: new Date(item.pubDate || Date.now()).toISOString(),
    category: inferCategory(item.title || "", content),
    body: buildBody(content),
  };
}

function isDuplicateTitle(candidateTitle, seenTitles) {
  const normalizedCandidate = candidateTitle.toLowerCase().trim();

  return seenTitles.some((seenTitle) => {
    const normalizedSeen = seenTitle.toLowerCase().trim();
    return (
      normalizedSeen.includes(normalizedCandidate) ||
      normalizedCandidate.includes(normalizedSeen)
    );
  });
}

function deduplicateArticles(articles) {
  const seenTitles = [];
  const uniqueArticles = [];

  for (const article of articles) {
    if (!article.title || isDuplicateTitle(article.title, seenTitles)) {
      continue;
    }

    seenTitles.push(article.title);
    uniqueArticles.push(article);
  }

  return uniqueArticles.sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime(),
  );
}

async function fetchNewsApiArticles() {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    return [];
  }

  const response = await axios.get(NEWS_API_URL, {
    params: {
      country: "in",
      pageSize: 30,
      apiKey,
    },
    timeout: 10000,
  });

  return (response.data?.articles || []).map(normalizeNewsApiArticle);
}

async function fetchGoogleRssArticles() {
  const feed = await parser.parseURL(GOOGLE_NEWS_RSS_URL);
  return (feed.items || []).map(normalizeRssItem);
}

export async function getNews({ forceRefresh = false } = {}) {
  const cachedNews = newsCache.get(cacheKey);

  if (cachedNews && !forceRefresh) {
    return cachedNews;
  }

  try {
    const [newsApiArticles, rssArticles] = await Promise.all([
      fetchNewsApiArticles(),
      fetchGoogleRssArticles(),
    ]);

    const mergedArticles = deduplicateArticles([...newsApiArticles, ...rssArticles]);
    newsCache.set(cacheKey, mergedArticles);
    return mergedArticles;
  } catch (error) {
    if (cachedNews) {
      return cachedNews;
    }

    const serviceError = new Error("News sources are currently unavailable");
    serviceError.status = 503;
    throw serviceError;
  }
}

export async function getNewsById(id) {
  const articles = await getNews();
  return articles.find((article) => article.id === id) || null;
}

export async function searchNews(query) {
  const articles = await getNews();
  const normalizedQuery = query.toLowerCase();

  return articles.filter(
    (article) =>
      article.title.toLowerCase().includes(normalizedQuery) ||
      article.summary.toLowerCase().includes(normalizedQuery),
  );
}

export function getCachedNews() {
  return newsCache.get(cacheKey) || [];
}
