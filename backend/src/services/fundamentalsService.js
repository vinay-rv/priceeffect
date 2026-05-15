import axios from "axios";
import * as cheerio from "cheerio";
import pLimit from "p-limit";
import { getCache, setCache } from "./cacheService.js";
import { logger } from "../utils/logger.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cleanNumber = (value) => {
  if (!value) return null;
  const normalized = String(value)
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/₹/g, "")
    .replace(/Cr\.?/gi, "")
    .trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const ratioText = ($, label) => $(`#top-ratios li:contains("${label}") .number`).first().text();

function extractHighLow($) {
  const numbers = $(`#top-ratios li:contains("High / Low") .number`)
    .toArray()
    .map((node) => cleanNumber($(node).text()))
    .filter((value) => value !== null);

  return {
    fiftyTwoWeekHigh: numbers[0] ?? null,
    fiftyTwoWeekLow: numbers[1] ?? null,
  };
}

function extractDebtToEquity($) {
  const candidates = $("li, tr")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .find((text) => /Debt\s*\/?\s*Equity/i.test(text));
  return cleanNumber(candidates?.match(/-?\d[\d,.]*/)?.[0]);
}

function extractPromoterHolding($) {
  const row = $("section:contains('Shareholding Pattern') tr, table:contains('Promoters') tr")
    .toArray()
    .map((node) => $(node).text().replace(/\s+/g, " ").trim())
    .find((text) => /Promoters/i.test(text));
  const matches = row?.match(/-?\d[\d,.]*%?/g) || [];
  return cleanNumber(matches.at(-1));
}

function extractQuarters($) {
  const rows = $("table#quarters tbody tr")
    .toArray()
    .map((row) => {
      const cells = $(row)
        .find("td")
        .toArray()
        .map((cell) => $(cell).text().replace(/\s+/g, " ").trim());
      return cells;
    })
    .filter((cells) => cells.length >= 4)
    .slice(-4);

  return rows.map((cells, index, allRows) => {
    const revenue = cleanNumber(cells[1]);
    const netProfit = cleanNumber(cells.at(-1));
    const previousProfit = index > 0 ? cleanNumber(allRows[index - 1].at(-1)) : null;
    const profitGrowth =
      previousProfit && netProfit !== null ? ((netProfit - previousProfit) / Math.abs(previousProfit)) * 100 : null;
    return { period: cells[0], revenue, netProfit, profitGrowth };
  });
}

function calculateProfitTrend(quarters) {
  const profits = quarters.map((quarter) => quarter.netProfit).filter((value) => typeof value === "number");
  const isProfitable = profits.length === 4 && profits.every((profit) => profit > 0);
  let profitTrend = "mixed";
  if (profits.length >= 2 && profits.at(-1) > profits[0]) profitTrend = "growing";
  if (profits.length >= 2 && profits.at(-1) < profits[0]) profitTrend = "declining";
  return { isProfitable, profitTrend };
}

/**
 * Scrapes Screener.in fundamentals for a single symbol and caches them for 24 hours.
 *
 * @param {string} symbol NSE/BSE symbol.
 * @returns {Promise<object|null>}
 */
export async function scrapeFundamentals(symbol) {
  const cacheKey = `fundamentals:v2:${symbol}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  try {
    await delay(1200);
    const url = `https://www.screener.in/company/${encodeURIComponent(symbol)}/consolidated/`;
    const response = await axios.get(url, {
      timeout: 10000,
      headers: { "User-Agent": "PriceEffect API open-source bot; respectful 500ms delay" },
    });
    const $ = cheerio.load(response.data);
    const quarters = extractQuarters($);
    const trend = calculateProfitTrend(quarters);
    const highLow = extractHighLow($);
    const fundamentals = {
      currentPrice: cleanNumber(ratioText($, "Current Price")),
      ...highLow,
      pe: cleanNumber(ratioText($, "Stock P/E")),
      marketCap: cleanNumber(ratioText($, "Market Cap")),
      roe: cleanNumber(ratioText($, "ROE")),
      debtToEquity: extractDebtToEquity($),
      promoterHolding: extractPromoterHolding($),
      eps: cleanNumber(ratioText($, "EPS")),
      bookValue: cleanNumber(ratioText($, "Book Value")),
      dividendYield: cleanNumber(ratioText($, "Dividend Yield")),
      quarters,
      ...trend,
      fundamentalsUpdatedAt: new Date(),
    };

    await setCache(cacheKey, fundamentals, 24 * 60 * 60);
    return fundamentals;
  } catch (error) {
    logger.error("Fundamentals scrape failed", { symbol, error: error.message });
    return null;
  }
}

/**
 * Enriches stock rows with fundamentals using bounded concurrency.
 *
 * @param {object[]} stocks normalized bhavcopy stocks.
 * @returns {Promise<object[]>}
 */
export async function enrichStocks(stocks) {
  const limit = pLimit(1);
  let processed = 0;

  const enriched = await Promise.all(
    stocks.map((stock) =>
      limit(async () => {
        const fundamentals = await scrapeFundamentals(stock.symbol);
        processed += 1;
        if (processed % 100 === 0 || processed === stocks.length) {
          logger.info(`Enriched ${processed}/${stocks.length} stocks...`);
        }
        if (!fundamentals) return stock;

        const close = fundamentals.currentPrice ?? stock.close;
        const fiftyTwoWeekHigh = fundamentals.fiftyTwoWeekHigh ?? stock.fiftyTwoWeekHigh;
        const fiftyTwoWeekLow = fundamentals.fiftyTwoWeekLow ?? stock.fiftyTwoWeekLow;
        const distanceFrom52Low =
          close && fiftyTwoWeekLow ? ((close - fiftyTwoWeekLow) / fiftyTwoWeekLow) * 100 : stock.distanceFrom52Low;
        const distanceFrom52High =
          close && fiftyTwoWeekHigh ? ((fiftyTwoWeekHigh - close) / fiftyTwoWeekHigh) * 100 : stock.distanceFrom52High;

        return {
          ...stock,
          ...fundamentals,
          close,
          fiftyTwoWeekHigh,
          fiftyTwoWeekLow,
          distanceFrom52Low,
          distanceFrom52High,
        };
      }),
    ),
  );

  return enriched;
}
