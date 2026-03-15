import axios from "axios";
import NodeCache from "node-cache";

const STOCK_API_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const stockCache = new NodeCache({ stdTTL: 300, checkperiod: 120, useClones: false });

export const DEFAULT_TICKERS = [
  "RELIANCE.NS",
  "TCS.NS",
  "HDFCBANK.NS",
  "INFY.NS",
  "WIPRO.NS",
  "ADANIPORTS.NS",
  "BAJFINANCE.NS",
  "ICICIBANK.NS",
  "SBIN.NS",
  "HINDUNILVR.NS",
];

function mapChartToStock(ticker, payload) {
  const result = payload?.chart?.result?.[0];
  const meta = result?.meta;
  const quotes = result?.indicators?.quote?.[0];
  const closes = result?.indicators?.adjclose?.[0]?.adjclose || quotes?.close || [];
  const sparks = closes.filter((value) => typeof value === "number").slice(-7);

  if (!meta) {
    const error = new Error(`Stock ${ticker} was not found`);
    error.status = 404;
    throw error;
  }

  return {
    ticker,
    name: meta.longName || meta.shortName || ticker,
    price: meta.regularMarketPrice ?? null,
    change: meta.regularMarketChange ?? 0,
    changePercent: meta.regularMarketChangePercent ?? 0,
    direction: (meta.regularMarketChangePercent ?? 0) >= 0 ? "up" : "down",
    high: quotes?.high?.filter((value) => typeof value === "number").at(-1) ?? null,
    low: quotes?.low?.filter((value) => typeof value === "number").at(-1) ?? null,
    volume: quotes?.volume?.filter((value) => typeof value === "number").at(-1) ?? null,
    sparks,
  };
}

async function fetchTicker(ticker) {
  const cacheKey = `stock:${ticker}`;
  const cached = stockCache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const url = `${STOCK_API_BASE_URL}/${encodeURIComponent(ticker)}`;
  const response = await axios.get(url, {
    params: {
      interval: "1d",
      range: "7d",
    },
    timeout: 10000,
  });

  const stock = mapChartToStock(ticker, response.data);
  stockCache.set(cacheKey, stock);
  return stock;
}

export async function getStocks(tickers = DEFAULT_TICKERS) {
  const settled = await Promise.all(
    tickers.map(async (ticker) => {
      try {
        return await fetchTicker(ticker);
      } catch (error) {
        console.error(`Failed to fetch stock ${ticker}: ${error.message}`);
        return null;
      }
    }),
  );

  const stocks = settled.filter(Boolean);

  if (stocks.length > 0) {
    stockCache.set("stocks:default", stocks);
    return stocks;
  }

  const cachedStocks = stockCache.get("stocks:default");
  if (cachedStocks) {
    return cachedStocks;
  }

  const serviceError = new Error("Stock price service is currently unavailable");
  serviceError.status = 503;
  throw serviceError;
}

export async function getStockByTicker(ticker) {
  try {
    return await fetchTicker(ticker);
  } catch (error) {
    console.error(`Failed to fetch stock ${ticker}: ${error.message}`);
    if (error.status === 404) {
      throw error;
    }

    const cachedStock = stockCache.get(`stock:${ticker}`);
    if (cachedStock) {
      return cachedStock;
    }

    const serviceError = new Error(`Stock ${ticker} is currently unavailable`);
    serviceError.status = 503;
    throw serviceError;
  }
}
