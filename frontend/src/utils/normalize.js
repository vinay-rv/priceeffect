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
  const priceValue = typeof stock.price === "number" ? stock.price : Number(stock.livePrice || 0);
  const changePercent = Number(stock.changePercent ?? 0);

  return {
    ticker: stock.ticker,
    name: stock.name,
    price: Number.isFinite(priceValue) ? priceValue.toFixed(2) : "0.00",
    change: `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(2)}%`,
    dir: stock.direction || stock.marketDirection || "down",
    impact: stock.impact || "medium",
    sparks: Array.isArray(stock.sparks) && stock.sparks.length > 0 ? stock.sparks : [20, 22, 21, 24, 25, 26, 27],
  };
}
