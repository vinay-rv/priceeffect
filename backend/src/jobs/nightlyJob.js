import cron from "node-cron";
import { config } from "../config/index.js";
import { FilterRun } from "../models/FilterRun.js";
import { Stock } from "../models/Stock.js";
import { analyseStock } from "../services/aiService.js";
import { getAllStocks, getPreviousStocksFromDb } from "../services/bhavService.js";
import { enrichStocks } from "../services/fundamentalsService.js";
import { applyFilter, FILTERS, runAllFilters } from "../services/filterService.js";
import { logger } from "../utils/logger.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let isRunning = false;

async function enrichInBatches(stocks) {
  const enriched = [];
  for (let index = 0; index < stocks.length; index += 50) {
    const batch = stocks.slice(index, index + 50);
    enriched.push(...(await enrichStocks(batch)));
    logger.info(`Fundamentals batch complete`, { processed: Math.min(index + batch.length, stocks.length), total: stocks.length });
    if (index + 50 < stocks.length) await delay(1000);
  }
  return enriched;
}

async function runAiForTopCandidates() {
  if (config.defaultAiProvider === "none") return;
  for (const filterName of Object.keys(FILTERS).filter((name) => name !== "custom")) {
    const candidates = await applyFilter(filterName, {}, 30);
    for (const stock of candidates) {
      await analyseStock(stock, filterName, config.defaultAiProvider);
    }
    logger.info(`AI analysis complete for filter: ${filterName}`);
  }
}

/**
 * Runs the full idempotent nightly stock research pipeline immediately.
 *
 * @returns {Promise<{runId: string, status: string, totalStocksProcessed: number, filterCounts: object}>}
 */
export async function runJobNow() {
  if (isRunning) {
    const error = new Error("Nightly job is already running");
    error.status = 409;
    throw error;
  }

  isRunning = true;
  const run = await FilterRun.create({ runAt: new Date(), status: "running", exchange: "BOTH" });

  try {
    logger.info("Step 1 - Download bhavcopy");
    let bhavResult;
    try {
      bhavResult = await getAllStocks("BOTH");
      logger.info(`Downloaded NSE: ${bhavResult.counts.NSE} stocks, BSE: ${bhavResult.counts.BSE} stocks`);
    } catch (error) {
      logger.error("Bhavcopy download failed, using previous DB snapshot", { error: error.message });
      const fallbackStocks = await getPreviousStocksFromDb();
      if (fallbackStocks.length === 0) throw error;
      bhavResult = { dataDate: fallbackStocks[0].dataDate, stocks: fallbackStocks, counts: { NSE: 0, BSE: 0 } };
    }
    if (config.jobStockLimit > 0) {
      bhavResult.stocks = bhavResult.stocks.slice(0, config.jobStockLimit);
      logger.info("Applied job stock limit", { limit: config.jobStockLimit });
    }

    logger.info("Step 2 - Enrich with fundamentals");
    const enrichedStocks = await enrichInBatches(bhavResult.stocks);

    logger.info("Step 3 - Apply all filters");
    const filterCounts = await runAllFilters(enrichedStocks);
    for (const [filterName, count] of Object.entries(filterCounts)) {
      logger.info(`Filter ${filterName}: ${count}`);
    }

    logger.info("Step 4 - Run AI analysis");
    await runAiForTopCandidates();

    logger.info("Step 5 - Save FilterRun record");
    run.status = "complete";
    run.dataDate = bhavResult.dataDate;
    run.totalStocksProcessed = enrichedStocks.length;
    run.filterCounts = filterCounts;
    await run.save();

    logger.info(`Nightly job complete. Processed ${enrichedStocks.length} stocks.`);
    return {
      runId: run.id,
      status: run.status,
      totalStocksProcessed: enrichedStocks.length,
      filterCounts,
    };
  } catch (error) {
    run.status = "failed";
    run.error = error.message;
    await run.save();
    logger.error("Nightly job failed", { error: error.message, stack: error.stack });
    throw error;
  } finally {
    isRunning = false;
  }
}

/**
 * Starts the scheduled nightly job.
 *
 * @returns {import("node-cron").ScheduledTask}
 */
export function scheduleNightlyJob() {
  return cron.schedule(
    config.nightlyJobCron,
    () => {
      runJobNow().catch((error) => logger.error("Scheduled nightly job failed", { error: error.message }));
    },
    { timezone: config.timezone },
  );
}
