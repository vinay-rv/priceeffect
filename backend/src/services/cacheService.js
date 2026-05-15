import mongoose from "mongoose";
import { CacheEntry } from "../models/CacheEntry.js";
import { Stock } from "../models/Stock.js";

/**
 * Connects to MongoDB when not already connected.
 *
 * @param {string} uri MongoDB connection string.
 * @returns {Promise<typeof mongoose>}
 */
export async function connectDatabase(uri) {
  if (mongoose.connection.readyState === 1) return mongoose;
  await mongoose.connect(uri);
  return mongoose;
}

/**
 * Reads a cached value from MongoDB.
 *
 * @param {string} key cache key.
 * @returns {Promise<unknown|null>}
 */
export async function getCache(key) {
  const entry = await CacheEntry.findOne({ key, expiresAt: { $gt: new Date() } }).lean();
  return entry?.value ?? null;
}

/**
 * Writes a cached value to MongoDB with TTL.
 *
 * @param {string} key cache key.
 * @param {unknown} value serializable value.
 * @param {number} ttlSeconds time to live in seconds.
 * @returns {Promise<void>}
 */
export async function setCache(key, value, ttlSeconds) {
  await CacheEntry.updateOne(
    { key },
    { $set: { value, expiresAt: new Date(Date.now() + ttlSeconds * 1000) } },
    { upsert: true },
  );
}

/**
 * Returns the latest stock snapshot date available in MongoDB.
 *
 * @returns {Promise<string|null>}
 */
export async function getLatestDataDate() {
  const stock = await Stock.findOne({ dataDate: { $exists: true } }).sort({ dataDate: -1 }).lean();
  return stock?.dataDate ?? null;
}
