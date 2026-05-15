import axios from "axios";
import { config } from "../config/index.js";
import { Stock } from "../models/Stock.js";
import { logger } from "../utils/logger.js";

const cacheFreshMs = 6 * 60 * 60 * 1000;

function extractJson(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return JSON.parse(text.slice(start, end + 1));
}

function fallbackAnalysis() {
  return {
    verdict: "WATCH",
    verdictReason: "Analysis unavailable",
    opportunity: "",
    risks: [],
    confidence: "low",
    priceTarget: null,
    keyMetric: "",
    analysedAt: new Date(),
  };
}

function buildPrompt(stock, filterContext, simple = false) {
  const profits = (stock.quarters || []).map((quarter) => quarter.netProfit ?? "NA").join(", ");
  const instruction = simple
    ? "Return only valid compact JSON with verdict, verdictReason, opportunity, risks, confidence, priceTarget, keyMetric."
    : `Based on this data, provide analysis as JSON only.
No markdown, no explanation outside JSON:
{
  "verdict": "BUY | WATCH | AVOID",
  "verdictReason": "max 15 words",
  "opportunity": "string describing the opportunity",
  "risks": ["risk1", "risk2", "risk3"],
  "confidence": "high | medium | low",
  "priceTarget": "short term price target or null",
  "keyMetric": "the single most important metric here"
}`;

  return `You are a senior stock analyst specializing in Indian equity markets (NSE/BSE). Provide concise, data-driven analysis.

STOCK DATA:
Symbol: ${stock.symbol} | Exchange: ${stock.exchange}
Price: ₹${stock.close} | Market Cap: ₹${stock.marketCap}Cr
52W High: ₹${stock.fiftyTwoWeekHigh} | 52W Low: ₹${stock.fiftyTwoWeekLow}
P/E: ${stock.pe} | ROE: ${stock.roe}% | D/E: ${stock.debtToEquity}
Promoter Holding: ${stock.promoterHolding}%
Profit Trend: ${stock.profitTrend}
Last 4 Quarters Net Profit (Cr): ${profits}
Filter Context: ${filterContext}

${instruction}`;
}

/**
 * Calls Gemini and returns parsed JSON analysis.
 *
 * @param {string} prompt prompt text.
 * @param {string} apiKey Gemini API key.
 * @returns {Promise<object>}
 */
export async function analyseWithGemini(prompt, apiKey) {
  const key = apiKey || config.geminiApiKey;
  if (!key) throw new Error("Gemini API key is not configured");
  const model = String(config.geminiModel || "gemini-2.5-flash").replace(/^models\//, "");
  const response = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    { contents: [{ parts: [{ text: prompt }] }] },
    { params: { key }, timeout: 30000 },
  );
  return extractJson(response.data?.candidates?.[0]?.content?.parts?.[0]?.text);
}

/**
 * Calls Ollama and returns parsed JSON analysis.
 *
 * @param {string} prompt prompt text.
 * @returns {Promise<object>}
 */
export async function analyseWithOllama(prompt) {
  const response = await axios.post(
    `${config.ollamaUrl}/api/generate`,
    { model: "gemma3", stream: false, prompt },
    { timeout: 60000 },
  );
  return extractJson(response.data?.response);
}

async function providerCall(provider, prompt, apiKey) {
  if (provider === "none") return null;
  if (provider === "ollama") return analyseWithOllama(prompt);
  return analyseWithGemini(prompt, apiKey);
}

/**
 * Resolves AI provider settings from request headers and environment defaults.
 *
 * @param {import("express").Request} req express request.
 * @returns {{provider: string, apiKey: string|undefined}}
 */
export function resolveAiProvider(req) {
  return {
    provider: String(req.get("X-AI-Provider") || config.defaultAiProvider || "none").toLowerCase(),
    apiKey: req.get("X-Gemini-Key") || undefined,
  };
}

/**
 * Analyses a stock with the selected AI provider and caches by filter context for six hours.
 *
 * @param {object} stock stock document or plain object.
 * @param {string} filterContext filter id/context.
 * @param {string} provider gemini, ollama, or none.
 * @param {string} apiKey optional Gemini API key.
 * @param {{force?: boolean}} options analysis options.
 * @returns {Promise<object|null>}
 */
export async function analyseStock(stock, filterContext, provider = config.defaultAiProvider, apiKey, options = {}) {
  if (provider === "none") return null;

  const cached = stock.aiAnalysis instanceof Map ? stock.aiAnalysis.get(filterContext) : stock.aiAnalysis?.[filterContext];
  if (!options.force && cached?.analysedAt && Date.now() - new Date(cached.analysedAt).getTime() < cacheFreshMs) {
    return cached;
  }

  let analysis;
  try {
    analysis = await providerCall(provider, buildPrompt(stock, filterContext), apiKey);
  } catch (error) {
    logger.error("AI analysis failed, retrying simple prompt", { symbol: stock.symbol, provider, error: error.message });
  }

  if (!analysis) {
    try {
      analysis = await providerCall(provider, buildPrompt(stock, filterContext, true), apiKey);
    } catch (error) {
      logger.error("AI analysis retry failed", { symbol: stock.symbol, provider, error: error.message });
      analysis = fallbackAnalysis();
    }
  }

  const normalized = { ...fallbackAnalysis(), ...analysis, analysedAt: new Date() };
  await Stock.updateOne(
    { symbol: stock.symbol, exchange: stock.exchange },
    { $set: { [`aiAnalysis.${filterContext}`]: normalized } },
  );
  return normalized;
}
