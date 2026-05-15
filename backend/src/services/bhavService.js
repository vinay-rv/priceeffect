import AdmZip from "adm-zip";
import axios from "axios";
import { parse } from "csv-parse/sync";
import { config } from "../config/index.js";
import { Stock } from "../models/Stock.js";
import { logger } from "../utils/logger.js";
import { retry } from "../utils/retry.js";

const NSE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  Referer: "https://www.nseindia.com",
  Accept: "text/html,application/xhtml+xml",
};

const toNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}${month}${year}`;
};

const formatArchiveDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${year}${month}${day}`;
};

const formatShortDate = (date) => {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}${month}${year}`;
};

const previousDate = (date, daysBack) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - daysBack);
  return copy;
};

const rowsFromCsv = (content) =>
  parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  });

function csvTextFromPayload(payload) {
  const buffer = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (buffer.slice(0, 2).toString("hex") === "504b") {
    const zip = new AdmZip(buffer);
    const entry = zip.getEntries().find((item) => item.entryName.toLowerCase().endsWith(".csv"));
    if (!entry) throw new Error("ZIP did not contain a CSV file");
    return entry.getData().toString("utf8");
  }
  return buffer.toString("utf8");
}

function buildNseUrls(date) {
  const ddmmyyyy = formatDate(date);
  const yyyymmdd = formatArchiveDate(date);
  const configured = config.nseBhavcopyUrl.replace("{DATE}", ddmmyyyy);
  const archiveBase = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${yyyymmdd}_F_0000.csv`;
  return [...new Set([configured, archiveBase, `${archiveBase}.zip`])];
}

function buildBseUrls(date) {
  const ddmmyyyy = formatDate(date);
  const ddmmyy = formatShortDate(date);
  return [...new Set([config.bseBhavcopyUrl.replace("{DATE}", ddmmyyyy), config.bseBhavcopyUrl.replace("{DATE}", ddmmyy)])];
}

function calculateDerived(stock) {
  const distanceFrom52Low =
    stock.close && stock.fiftyTwoWeekLow
      ? ((stock.close - stock.fiftyTwoWeekLow) / stock.fiftyTwoWeekLow) * 100
      : null;
  const distanceFrom52High =
    stock.close && stock.fiftyTwoWeekHigh
      ? ((stock.fiftyTwoWeekHigh - stock.close) / stock.fiftyTwoWeekHigh) * 100
      : null;

  return {
    ...stock,
    distanceFrom52Low,
    distanceFrom52High,
    priceChange30d: stock.priceChange30d ?? null,
    volumeSpike: stock.volumeSpike ?? false,
  };
}

/**
 * Downloads and normalizes NSE bhavcopy data for the given date, falling back three days.
 *
 * @param {Date} date target date.
 * @returns {Promise<{dataDate: string, stocks: object[]}>}
 */
export async function downloadNSEBhav(date = new Date()) {
  for (let daysBack = 0; daysBack <= 3; daysBack += 1) {
    const candidate = previousDate(date, daysBack);
    const dataDate = formatDate(candidate);

    for (const url of buildNseUrls(candidate)) {
      try {
        const response = await retry(
          () => axios.get(url, { headers: NSE_HEADERS, timeout: 20000, responseType: "arraybuffer" }),
          { retries: 3, delayMs: 2000 },
        );
        const rows = rowsFromCsv(csvTextFromPayload(response.data));
        const stocks = rows
          .filter((row) => (row.SERIES || row.SctySrs) === "EQ")
          .map((row) =>
            calculateDerived({
              symbol: row.SYMBOL || row.TckrSymb,
              exchange: "NSE",
              companyName: row.SECURITY_NAME || row.FinInstrmNm || row.SYMBOL || row.TckrSymb,
              open: toNumber(row.OPEN_PRICE || row.OPEN || row.OpnPric),
              high: toNumber(row.HIGH_PRICE || row.HIGH || row.HghPric),
              low: toNumber(row.LOW_PRICE || row.LOW || row.LwPric),
              close: toNumber(row.CLOSE_PRICE || row.CLOSE || row.ClsPric),
              volume: toNumber(row.TTL_TRD_QNTY || row.TOTTRDQTY || row.VOLUME || row.TtlTradgVol),
              fiftyTwoWeekHigh: toNumber(row["52W_H"] || row.FIFTY_TWO_WEEK_HIGH),
              fiftyTwoWeekLow: toNumber(row["52W_L"] || row.FIFTY_TWO_WEEK_LOW),
              dataDate,
            }),
          )
          .filter((stock) => stock.symbol && stock.close);

        return { dataDate, stocks };
      } catch (error) {
        logger.error("NSE bhavcopy download failed", { dataDate, url, error: error.message });
      }
    }
  }

  throw new Error("NSE bhavcopy unavailable for the last 4 calendar days");
}

/**
 * Downloads and normalizes BSE bhavcopy data for the given date, falling back three days.
 *
 * @param {Date} date target date.
 * @returns {Promise<{dataDate: string, stocks: object[]}>}
 */
export async function downloadBSEBhav(date = new Date()) {
  for (let daysBack = 0; daysBack <= 3; daysBack += 1) {
    const candidate = previousDate(date, daysBack);
    const dataDate = formatDate(candidate);

    for (const url of buildBseUrls(candidate)) {
      try {
        const response = await retry(
          () => axios.get(url, { timeout: 20000, responseType: "arraybuffer" }),
          { retries: 3, delayMs: 2000 },
        );
        const rows = rowsFromCsv(csvTextFromPayload(response.data));
        const stocks = rows
          .map((row) =>
            calculateDerived({
              symbol: String(row.SC_CODE || row.FinInstrmId || row.TckrSymb || "").trim(),
              exchange: "BSE",
              companyName: String(row.SC_NAME || row.FinInstrmNm || row.TckrSymb || "").trim(),
              open: toNumber(row.OPEN || row.OpnPric),
              high: toNumber(row.HIGH || row.HghPric),
              low: toNumber(row.LOW || row.LwPric),
              close: toNumber(row.CLOSE || row.ClsPric),
              volume: toNumber(row.NO_OF_SHRS || row.TtlTradgVol),
              fiftyTwoWeekHigh: toNumber(row.FIFTY_TWO_WK_H),
              fiftyTwoWeekLow: toNumber(row.FIFTY_TWO_WK_L),
              dataDate,
            }),
          )
          .filter((stock) => stock.symbol && stock.close);

        return { dataDate, stocks };
      } catch (error) {
        logger.error("BSE bhavcopy download failed", { dataDate, url, error: error.message });
      }
    }
  }

  throw new Error("BSE bhavcopy unavailable for the last 4 calendar days");
}

/**
 * Downloads all requested exchange bhavcopy rows and deduplicates by symbol, preferring NSE.
 *
 * @param {"NSE"|"BSE"|"BOTH"} exchange exchange selection.
 * @returns {Promise<{dataDate: string|null, stocks: object[], counts: {NSE: number, BSE: number}}>}
 */
export async function getAllStocks(exchange = "BOTH") {
  const results = [];
  const counts = { NSE: 0, BSE: 0 };
  const targetDate = config.bhavcopyDateOverride ? new Date(`${config.bhavcopyDateOverride}T00:00:00`) : new Date();

  if (exchange === "NSE" || exchange === "BOTH") {
    try {
      const nse = await downloadNSEBhav(targetDate);
      counts.NSE = nse.stocks.length;
      results.push(nse);
    } catch (error) {
      logger.error("NSE download skipped", { error: error.message });
    }
  }

  if (exchange === "BSE" || exchange === "BOTH") {
    try {
      const bse = await downloadBSEBhav(targetDate);
      counts.BSE = bse.stocks.length;
      results.push(bse);
    } catch (error) {
      logger.error("BSE download skipped", { error: error.message });
    }
  }

  if (results.length === 0) throw new Error("No bhavcopy source was available");

  const bySymbol = new Map();
  for (const stock of results.flatMap((result) => result.stocks)) {
    const existing = bySymbol.get(stock.symbol);
    if (!existing || (existing.exchange === "BSE" && stock.exchange === "NSE")) {
      bySymbol.set(stock.symbol, stock);
    }
  }

  return {
    dataDate: results[0]?.dataDate ?? null,
    stocks: Array.from(bySymbol.values()),
    counts,
  };
}

/**
 * Returns the previous persisted stock snapshot when upstream bhavcopy data is unavailable.
 *
 * @returns {Promise<object[]>}
 */
export async function getPreviousStocksFromDb() {
  const latest = await Stock.findOne({ dataDate: { $exists: true } }).sort({ lastUpdated: -1 }).lean();
  if (!latest?.dataDate) return [];
  return Stock.find({ dataDate: latest.dataDate }).lean();
}
