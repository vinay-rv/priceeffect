import { Stock } from "../models/Stock.js";

const isNumber = (value) => typeof value === "number" && Number.isFinite(value);
const hasProfitSignal = (stock) => stock.isProfitable === true || stock.profitTrend === "growing" || stock.profitTrend === "mixed";
const hasLowDebtSignal = (stock, maxDebt = 1) => !isNumber(stock.debtToEquity) || stock.debtToEquity < maxDebt;

export const FILTER_DEFINITIONS = [
  {
    id: "52-low",
    name: "52 Week Low",
    description: "Stocks within 5% of their 52-week low with positive profit history",
    params: [{ name: "threshold", type: "number", default: 0.05, description: "% distance from 52W low" }],
  },
  {
    id: "52-high",
    name: "52 Week High",
    description: "Profitable stocks trading within 5% of their 52-week high",
    params: [{ name: "threshold", type: "number", default: 0.05, description: "% distance from 52W high" }],
  },
  { id: "good-pe", name: "Good P/E", description: "Profitable stocks with reasonable P/E and ROE above 10%", params: [] },
  { id: "undervalued", name: "Undervalued", description: "Low P/E, healthy ROE, low debt, and growing profits", params: [] },
  { id: "momentum", name: "Momentum", description: "Stocks with strong 30-day price move and volume spike", params: [] },
  { id: "low-debt", name: "Low Debt", description: "Profitable high-ROE companies with debt-to-equity under 0.5", params: [] },
  { id: "high-roe", name: "High ROE", description: "Profitable companies with ROE above 15% and moderate debt", params: [] },
  { id: "promoter-buying", name: "Promoter Holding", description: "Profitable companies with promoter holding above 50%", params: [] },
  { id: "splits", name: "Splits", description: "Stocks tagged with split-related corporate action metadata", params: [] },
  {
    id: "custom",
    name: "Custom",
    description: "Build your own screen using valuation, profitability, debt, promoter, and market-cap fields",
    params: [
      { name: "minPe", type: "number", description: "Minimum P/E" },
      { name: "maxPe", type: "number", description: "Maximum P/E" },
      { name: "minRoe", type: "number", description: "Minimum ROE" },
      { name: "maxDebt", type: "number", description: "Maximum debt-to-equity" },
      { name: "minPromoter", type: "number", description: "Minimum promoter holding" },
      { name: "profitable", type: "boolean", description: "Require profitable last four quarters" },
      { name: "minMarketCap", type: "number", description: "Minimum market cap in crore" },
      { name: "maxMarketCap", type: "number", description: "Maximum market cap in crore" },
    ],
  },
];

export const FILTERS = {
  "52-low": (stock, params = {}) => {
    const threshold = params.threshold || 0.05;
    return (
      isNumber(stock.close) &&
      isNumber(stock.fiftyTwoWeekLow) &&
      stock.close <= stock.fiftyTwoWeekLow * (1 + threshold) &&
      hasProfitSignal(stock)
    );
  },
  "52-high": (stock, params = {}) => {
    const threshold = params.threshold || 0.05;
    return (
      isNumber(stock.close) &&
      isNumber(stock.fiftyTwoWeekHigh) &&
      stock.close >= stock.fiftyTwoWeekHigh * (1 - threshold) &&
      hasProfitSignal(stock)
    );
  },
  "good-pe": (stock, params = {}) => {
    const minPe = params.minPe || 5;
    const maxPe = params.maxPe || 25;
    return (
      isNumber(stock.pe) &&
      isNumber(stock.roe) &&
      stock.pe >= minPe &&
      stock.pe <= maxPe &&
      hasProfitSignal(stock) &&
      stock.roe >= 10
    );
  },
  undervalued: (stock) =>
    isNumber(stock.pe) &&
    isNumber(stock.roe) &&
    stock.pe > 0 &&
    stock.pe < 20 &&
    stock.roe > 12 &&
    hasLowDebtSignal(stock) &&
    hasProfitSignal(stock),
  momentum: (stock) =>
    isNumber(stock.priceChange30d) && stock.priceChange30d > 10 && stock.volumeSpike === true && hasProfitSignal(stock),
  "low-debt": (stock) =>
    hasLowDebtSignal(stock, 0.5) && isNumber(stock.roe) && stock.roe > 12 && hasProfitSignal(stock),
  "high-roe": (stock) =>
    isNumber(stock.roe) && stock.roe > 15 && hasProfitSignal(stock) && hasLowDebtSignal(stock, 1.5),
  "promoter-buying": (stock) => isNumber(stock.promoterHolding) && stock.promoterHolding > 50 && hasProfitSignal(stock),
  splits: (stock) => stock.filters?.includes("splits"),
  custom: (stock, params = {}) => {
    let match = true;
    if (params.minPe) match = match && isNumber(stock.pe) && stock.pe >= params.minPe;
    if (params.maxPe) match = match && isNumber(stock.pe) && stock.pe <= params.maxPe;
    if (params.minRoe) match = match && isNumber(stock.roe) && stock.roe >= params.minRoe;
    if (params.maxDebt) match = match && isNumber(stock.debtToEquity) && stock.debtToEquity <= params.maxDebt;
    if (params.minPromoter) match = match && isNumber(stock.promoterHolding) && stock.promoterHolding >= params.minPromoter;
    if (params.exchange && params.exchange !== "BOTH") match = match && stock.exchange === params.exchange;
    if (params.profitable) match = match && stock.isProfitable === true;
    if (params.minMarketCap) match = match && isNumber(stock.marketCap) && stock.marketCap >= params.minMarketCap;
    if (params.maxMarketCap) match = match && isNumber(stock.marketCap) && stock.marketCap <= params.maxMarketCap;
    return match;
  },
};

const SORTS = {
  "52-low": { distanceFrom52Low: 1 },
  "52-high": { distanceFrom52High: 1 },
  "good-pe": { roe: -1 },
  undervalued: { pe: 1 },
  momentum: { priceChange30d: -1 },
  "low-debt": { roe: -1 },
  "high-roe": { roe: -1 },
  "promoter-buying": { promoterHolding: -1 },
  splits: { lastUpdated: -1 },
  custom: { roe: -1 },
};

const numericParams = new Set([
  "threshold",
  "minPe",
  "maxPe",
  "minRoe",
  "maxDebt",
  "minPromoter",
  "minMarketCap",
  "maxMarketCap",
]);

/**
 * Normalizes filter query/body params into booleans and numbers.
 *
 * @param {object} params raw params.
 * @returns {object}
 */
export function normalizeFilterParams(params = {}) {
  return Object.fromEntries(
    Object.entries(params).map(([key, value]) => {
      if (numericParams.has(key)) return [key, Number(value)];
      if (key === "profitable") return [key, value === true || value === "true"];
      if (key === "exchange") return [key, String(value).toUpperCase()];
      return [key, value];
    }),
  );
}

/**
 * Returns true when a filter id is supported.
 *
 * @param {string} filterName filter id.
 * @returns {boolean}
 */
export function isValidFilter(filterName) {
  return Boolean(FILTERS[filterName]);
}

/**
 * Applies a predefined or custom filter against persisted stock data.
 *
 * @param {string} filterName filter id.
 * @param {object} params filter params.
 * @param {number} limit maximum rows.
 * @returns {Promise<object[]>}
 */
export async function applyFilter(filterName, params = {}, limit = 20) {
  if (!isValidFilter(filterName)) {
    const error = new Error(`Unknown filter: ${filterName}`);
    error.status = 400;
    throw error;
  }

  const query = {};
  if (params.exchange && params.exchange !== "BOTH") query.exchange = params.exchange;
  if (filterName !== "custom") query.filters = filterName;

  const candidates = await Stock.find(query).sort(SORTS[filterName] || { roe: -1 }).limit(Math.min(limit * 5, 250)).lean();
  const filtered = filterName === "custom" ? candidates.filter((stock) => FILTERS.custom(stock, params)) : candidates;
  return filtered.slice(0, limit);
}

/**
 * Applies all filters, tags each stock, and bulk upserts results into MongoDB.
 *
 * @param {object[]} stocks enriched stock rows.
 * @returns {Promise<Record<string, number>>}
 */
export async function runAllFilters(stocks) {
  const counts = Object.fromEntries(Object.keys(FILTERS).map((filterName) => [filterName, 0]));
  const now = new Date();

  const operations = stocks.map((stock) => {
    const { _id, id, createdAt, updatedAt, __v, ...stockUpdate } = stock;
    const filters = Object.entries(FILTERS)
      .filter(([filterName, filterFn]) => filterName !== "custom" && filterFn(stock))
      .map(([filterName]) => filterName);

    for (const filterName of filters) counts[filterName] += 1;

    return {
      updateOne: {
        filter: { symbol: stock.symbol, exchange: stock.exchange },
        update: {
          $set: {
            ...stockUpdate,
            filters,
            lastUpdated: now,
          },
        },
        upsert: true,
      },
    };
  });

  if (operations.length > 0) await Stock.bulkWrite(operations, { ordered: false });
  return counts;
}

/**
 * Ranks in-memory stocks for a filter.
 *
 * @param {object[]} stocks stocks to rank.
 * @param {string} filterName filter id.
 * @returns {object[]}
 */
export function rankStocks(stocks, filterName) {
  const [field, direction] = Object.entries(SORTS[filterName] || { roe: -1 })[0];
  return [...stocks].sort((a, b) => {
    const av = isNumber(a[field]) ? a[field] : direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    const bv = isNumber(b[field]) ? b[field] : direction === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    return direction === 1 ? av - bv : bv - av;
  });
}
