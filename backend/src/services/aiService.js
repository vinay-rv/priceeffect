import NodeCache from "node-cache";
import OpenAI from "openai";
import { getStoredArticleLinks, saveArticleLinks } from "./dbService.js";
import { getStockByTicker } from "./stockService.js";

const aiCache = new NodeCache({ stdTTL: 1800, checkperiod: 120, useClones: false });
let openAiClient = null;
const structuredOutputSchema = {
  type: "json_schema",
  name: "affected_stocks",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      stocks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            ticker: { type: "string" },
            name: { type: "string" },
            impact: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            direction: {
              type: "string",
              enum: ["up", "down", "neutral"],
            },
            reason: { type: "string" },
          },
          required: ["ticker", "name", "impact", "direction", "reason"],
        },
      },
    },
    required: ["stocks"],
  },
};

const heuristicRules = [
  {
    pattern: /(lpg|cylinder|cooking gas|gas shortage|fuel shortage|hormuz|oil shipment|petroleum|energy imports)/i,
    stocks: [
      {
        ticker: "IOC.NS",
        name: "Indian Oil Corporation",
        impact: "high",
        direction: "neutral",
        reason: "India's largest fuel and LPG supplier is sensitive to import and shipping disruption risk.",
      },
      {
        ticker: "BPCL.NS",
        name: "Bharat Petroleum",
        impact: "medium",
        direction: "neutral",
        reason: "LPG and fuel supply constraints can affect sourcing costs and marketing margins.",
      },
      {
        ticker: "HPCL.NS",
        name: "Hindustan Petroleum",
        impact: "medium",
        direction: "neutral",
        reason: "Any disruption in crude or LPG routes can influence refinery and distribution economics.",
      },
      {
        ticker: "GAIL.NS",
        name: "GAIL India",
        impact: "medium",
        direction: "neutral",
        reason: "Gas supply themes can spill into sentiment around India's major gas transmission and marketing player.",
      },
    ],
  },
  {
    pattern: /(shipping|port|cargo|freight|container|vessel|logistics)/i,
    stocks: [
      {
        ticker: "ADANIPORTS.NS",
        name: "Adani Ports",
        impact: "medium",
        direction: "neutral",
        reason: "Shipping and cargo route disruptions can influence port throughput expectations and logistics sentiment.",
      },
    ],
  },
  {
    pattern: /(bank|loan|rbi|lender|credit|deposit|finance)/i,
    stocks: [
      {
        ticker: "HDFCBANK.NS",
        name: "HDFC Bank",
        impact: "medium",
        direction: "neutral",
        reason: "Large banking names tend to react to major financial system and credit-related news flow.",
      },
      {
        ticker: "ICICIBANK.NS",
        name: "ICICI Bank",
        impact: "medium",
        direction: "neutral",
        reason: "Systemically important banks are often repriced on sector-wide finance and lending developments.",
      },
    ],
  },
  {
    pattern: /(ai|software|semiconductor|cloud|digital|technology|chip)/i,
    stocks: [
      {
        ticker: "TCS.NS",
        name: "Tata Consultancy Services",
        impact: "medium",
        direction: "neutral",
        reason: "Large-cap IT services firms often reflect shifts in enterprise technology spending and AI demand.",
      },
      {
        ticker: "INFY.NS",
        name: "Infosys",
        impact: "medium",
        direction: "neutral",
        reason: "IT exporters are sensitive to global technology capex and software transformation themes.",
      },
    ],
  },
];

function getOpenAiClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return openAiClient;
}

const SYSTEM_PROMPT =
  "You are a financial analyst specializing in Indian stock markets (NSE/BSE). Return only directly affected listed Indian stocks when the impact is plausible and concrete.";

function buildArticleContext(article) {
  const bodyText = Array.isArray(article.body) ? article.body.join("\n") : "";
  return [article.title, article.summary, bodyText].filter(Boolean).join("\n");
}

function buildUserPrompt(article) {
  return `Given this news article:
Title: ${article.title}
Summary: ${article.summary}
Body:
${Array.isArray(article.body) ? article.body.join("\n") : ""}

Identify which Indian stocks listed on NSE/BSE would be directly affected.

Respond ONLY with a valid JSON array, no markdown, no explanation:
[
  {
    "ticker": "RELIANCE.NS",
    "name": "Reliance Industries",
    "impact": "high" | "medium" | "low",
    "direction": "up" | "down" | "neutral",
    "reason": "one sentence explanation"
  }
]

Rules:
- Only include stocks genuinely affected, not tangentially
- Maximum 6 stocks per article
- Only NSE/BSE listed stocks with .NS or .BO suffix
- If no Indian stocks are clearly affected return empty array []`;
}

function parseStructuredStocks(content) {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed?.stocks) ? parsed.stocks : [];
  } catch (error) {
    return [];
  }
}

function dedupeStocks(stocks) {
  const seen = new Set();
  return stocks.filter((stock) => {
    if (!stock?.ticker || seen.has(stock.ticker)) {
      return false;
    }

    seen.add(stock.ticker);
    return true;
  });
}

function getHeuristicStocks(article) {
  const context = buildArticleContext(article);
  const matches = heuristicRules
    .filter((rule) => rule.pattern.test(context))
    .flatMap((rule) => rule.stocks);

  return dedupeStocks(matches).slice(0, 6);
}

async function enrichLinkedStock(stock) {
  try {
    const liveData = await getStockByTicker(stock.ticker);
    return {
      ...stock,
      livePrice: liveData.price,
      change: liveData.change,
      changePercent: liveData.changePercent,
      marketDirection: liveData.direction,
      high: liveData.high,
      low: liveData.low,
      volume: liveData.volume,
      sparks: liveData.sparks,
    };
  } catch (error) {
    return stock;
  }
}

async function enrichLinkedStocks(stocks) {
  return Promise.all(dedupeStocks(stocks).map(enrichLinkedStock));
}

export async function linkNewsToStocks(article) {
  const cacheKey = `article:${article.title}`;
  const cached = aiCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const storedLinks = getStoredArticleLinks(article);
  if (storedLinks) {
    const enrichedStored = await enrichLinkedStocks(storedLinks);
    aiCache.set(cacheKey, enrichedStored);
    return enrichedStored;
  }

  const client = getOpenAiClient();

  if (!client) {
    const heuristicLinks = getHeuristicStocks(article);
    const enrichedHeuristic = await enrichLinkedStocks(heuristicLinks);
    if (heuristicLinks.length > 0) {
      saveArticleLinks(article, heuristicLinks, "heuristic");
    }
    aiCache.set(cacheKey, enrichedHeuristic);
    return enrichedHeuristic;
  }

  try {
    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildUserPrompt(article),
        },
      ],
      text: {
        format: structuredOutputSchema,
      },
    });

    const textContent = response.output_text?.trim() || '{"stocks":[]}';
    const parsedStocks = parseStructuredStocks(textContent);
    const candidateStocks =
      parsedStocks.length > 0 ? parsedStocks.slice(0, 6) : getHeuristicStocks(article);
    const dedupedCandidateStocks = dedupeStocks(candidateStocks);
    const enriched = await enrichLinkedStocks(dedupedCandidateStocks);
    saveArticleLinks(
      article,
      dedupedCandidateStocks,
      parsedStocks.length > 0 ? "openai" : "heuristic",
    );
    aiCache.set(cacheKey, enriched);
    return enriched;
  } catch (error) {
    const cachedFallback = aiCache.get(cacheKey);
    if (cachedFallback) {
      return cachedFallback;
    }

    console.error(`OpenAI stock-linking failed for "${article.title}": ${error.message}`);
    const heuristicLinks = getHeuristicStocks(article);
    const enrichedHeuristic = await enrichLinkedStocks(heuristicLinks);
    if (heuristicLinks.length > 0) {
      saveArticleLinks(article, heuristicLinks, "heuristic");
    }
    aiCache.set(cacheKey, enrichedHeuristic);
    return enrichedHeuristic;
  }
}
