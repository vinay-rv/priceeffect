import dotenv from "dotenv";

dotenv.config();

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  env: process.env.NODE_ENV || "development",
  port: toInt(process.env.PORT, 3000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/priceeffect",
  corsOrigin: process.env.CORS_ORIGIN || "*",
  defaultAiProvider: process.env.DEFAULT_AI_PROVIDER || "gemini",
  geminiModel: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  ollamaUrl: process.env.OLLAMA_URL || "http://localhost:11434",
  rateLimitWindowMs: toInt(process.env.RATE_LIMIT_WINDOW_MS, 900000),
  rateLimitMax: toInt(process.env.RATE_LIMIT_MAX, 100),
  requireApiKey: toBool(process.env.REQUIRE_API_KEY, false),
  apiKeys: (process.env.API_KEYS || "").split(",").map((key) => key.trim()).filter(Boolean),
  adminSecret: process.env.ADMIN_SECRET || "",
  nightlyJobCron: process.env.NIGHTLY_JOB_CRON || "0 18 * * 1-5",
  timezone: process.env.JOB_TIMEZONE || "Asia/Kolkata",
  bhavcopyDateOverride: process.env.BHAVCOPY_DATE_OVERRIDE || "",
  jobStockLimit: toInt(process.env.JOB_STOCK_LIMIT, 0),
  nseBhavcopyUrl:
    process.env.NSE_BHAVCOPY_URL ||
    "https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_{DATE}_F_0000.csv",
  bseBhavcopyUrl:
    process.env.BSE_BHAVCOPY_URL ||
    "https://www.bseindia.com/download/BhavCopy/Equity/EQ{DATE}_CSV.ZIP",
};

/**
 * Returns true when the current process is running in production mode.
 *
 * @returns {boolean}
 */
export function isProduction() {
  return config.env === "production";
}
