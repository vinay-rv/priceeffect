import express from "express";
import { aiRateLimit } from "../../middleware/rateLimit.js";
import { Stock } from "../../models/Stock.js";
import { analyseStock, resolveAiProvider } from "../../services/aiService.js";
import { applyFilter, FILTERS, isValidFilter, normalizeFilterParams, rankStocks } from "../../services/filterService.js";

const router = express.Router();

const toLimit = (value, fallback = 20) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, 50));
};

const wantsAi = (value) => value !== "false" && value !== false;

function stockResponse(stock, analysis = null) {
  return {
    symbol: stock.symbol,
    exchange: stock.exchange,
    companyName: stock.companyName,
    price: {
      current: stock.close,
      fiftyTwoWeekHigh: stock.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: stock.fiftyTwoWeekLow,
      distanceFrom52Low: stock.distanceFrom52Low,
      distanceFrom52High: stock.distanceFrom52High,
      change30d: stock.priceChange30d,
    },
    fundamentals: {
      pe: stock.pe,
      roe: stock.roe,
      debtToEquity: stock.debtToEquity,
      marketCap: stock.marketCap,
      promoterHolding: stock.promoterHolding,
      eps: stock.eps,
      bookValue: stock.bookValue,
      dividendYield: stock.dividendYield,
      profitTrend: stock.profitTrend,
      quarters: stock.quarters || [],
    },
    analysis,
  };
}

async function attachAnalysis(stocks, filterContext, req, force = false) {
  if (!wantsAi(req.query.ai)) return { provider: "none", data: stocks.map((stock) => stockResponse(stock)) };
  const { provider, apiKey } = resolveAiProvider(req);
  const data = await Promise.all(
    stocks.map(async (stock) => stockResponse(stock, await analyseStock(stock, filterContext, provider, apiKey, { force }))),
  );
  return { provider, data };
}

router.get("/", aiRateLimit, async (req, res, next) => {
  try {
    const filter = String(req.query.filter || "");
    if (!filter || !isValidFilter(filter)) {
      res.status(400).json({ success: false, error: "Valid query parameter filter is required", code: 400 });
      return;
    }

    const limit = toLimit(req.query.limit);
    const exchange = String(req.query.exchange || "BOTH").toUpperCase();
    const params = normalizeFilterParams({ ...req.query, exchange });
    const stocks = await applyFilter(filter, params, limit);
    const latest = stocks[0] || {};
    const analysed = await attachAnalysis(stocks, filter, req);

    res.json({
      success: true,
      filter,
      exchange,
      count: analysed.data.length,
      dataDate: latest.dataDate ?? null,
      lastUpdated: latest.lastUpdated ?? null,
      aiProvider: analysed.provider,
      data: analysed.data,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:symbol", aiRateLimit, async (req, res, next) => {
  try {
    const symbol = String(req.params.symbol || "").toUpperCase();
    const exchange = String(req.query.exchange || "").toUpperCase();
    const query = exchange && exchange !== "BOTH" ? { symbol, exchange } : { symbol };
    const stock = await Stock.findOne(query).sort({ exchange: -1, lastUpdated: -1 }).lean();

    if (!stock) {
      res.status(404).json({ success: false, error: "Stock not found", code: 404 });
      return;
    }

    const force = req.query.refreshAi === "true" || req.query.refreshAi === true;
    const analysed = await attachAnalysis([stock], "deep-dive", req, force);
    res.json({ success: true, aiProvider: analysed.provider, data: analysed.data[0] });
  } catch (error) {
    next(error);
  }
});

router.post("/screen", aiRateLimit, async (req, res, next) => {
  try {
    const filters = Array.isArray(req.body.filters) ? req.body.filters : [];
    if (filters.length === 0 || filters.some((filter) => !isValidFilter(filter))) {
      res.status(400).json({ success: false, error: "Body filters must contain valid filter IDs", code: 400 });
      return;
    }

    const exchange = String(req.body.exchange || "BOTH").toUpperCase();
    const limit = toLimit(req.body.limit);
    const params = normalizeFilterParams({ ...(req.body.params || {}), exchange });
    const query = exchange !== "BOTH" ? { exchange } : {};
    const candidates = await Stock.find(query).limit(5000).lean();
    const matches = candidates.filter((stock) =>
      filters.every((filter) => {
        if (filter === "custom") return FILTERS.custom(stock, params);
        return FILTERS[filter](stock, params);
      }),
    );
    const ranked = rankStocks(matches, filters[0]).slice(0, limit);
    const analysed = await attachAnalysis(ranked, filters.join("+"), req);

    res.json({
      success: true,
      filters,
      exchange,
      count: analysed.data.length,
      aiProvider: analysed.provider,
      data: analysed.data,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
