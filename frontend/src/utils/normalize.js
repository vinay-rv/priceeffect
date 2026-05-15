import { formatTimeAgo } from "./time";

const categoryTagClassMap = {
  Breaking: "red",
  Bullish: "green",
  Bearish: "red",
  Tech: "default",
  Finance: "default",
  Energy: "default",
  Health: "default",
  Markets: "default",
};

const categoryEmojiMap = {
  Breaking: "🔴",
  Bullish: "📈",
  Bearish: "📉",
  Tech: "🤖",
  Finance: "🏦",
  Energy: "⚡",
  Health: "💊",
  Markets: "📰",
};

const layoutOrder = ["featured", "wide", "mid", "mid", "small", "small"];

function splitBody(summary = "", body = []) {
  if (Array.isArray(body) && body.length > 0) {
    return body;
  }

  if (!summary) {
    return ["Market participants are watching the story develop across sectors and benchmark names."];
  }

  const sentences = summary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (sentences.length > 0) {
    return sentences;
  }

  return [summary];
}

function buildQuote(article) {
  if (article.summary) {
    return article.summary.length > 120
      ? `${article.summary.slice(0, 117).trim()}...`
      : article.summary;
  }

  return "Markets are still pricing the second-order effects of this story.";
}

export function normalizeArticle(article, index = 0) {
  const category = article.category || "Markets";
  return {
    id: article.id,
    tag: category,
    tagClass: categoryTagClassMap[category] || "default",
    headline: article.title,
    summary: article.summary,
    time: formatTimeAgo(article.publishedAt),
    source: article.source,
    url: article.url,
    category: layoutOrder[index] || "mid",
    emoji: categoryEmojiMap[category] || "📰",
    body: splitBody(article.summary, article.body),
    quote: article.quote || buildQuote(article),
  };
}

export function normalizeStock(stock) {
  const priceValue =
    typeof stock.price === "number" ? stock.price : Number(stock.price?.current ?? stock.livePrice ?? stock.close ?? 0);
  const changePercent = Number(stock.price?.change30d ?? stock.changePercent ?? 0);
  const symbol = stock.symbol || stock.ticker || "";
  const distanceFrom52Low = Number(stock.price?.distanceFrom52Low ?? 0);
  const distanceFrom52High = Number(stock.price?.distanceFrom52High ?? 0);
  const roe = Number(stock.fundamentals?.roe ?? 0);
  const pe = Number(stock.fundamentals?.pe ?? 0);
  const dir = stock.direction || stock.marketDirection || (changePercent >= 0 ? "up" : "down");

  return {
    ticker: stock.exchange ? `${symbol}.${stock.exchange}` : symbol,
    symbol,
    exchange: stock.exchange,
    name: stock.companyName || stock.name || symbol,
    price: Number.isFinite(priceValue) ? priceValue.toFixed(2) : "0.00",
    change: `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
    dir,
    impact: stock.impact || (roe >= 15 ? "high" : pe > 0 && pe <= 20 ? "medium" : "low"),
    sparks:
      Array.isArray(stock.sparks) && stock.sparks.length > 0
        ? stock.sparks
        : [distanceFrom52Low + 16, roe + 14, pe + 10, distanceFrom52High + 8, Math.abs(changePercent) + 20],
    fundamentals: stock.fundamentals || {},
    analysis: stock.analysis || null,
  };
}
