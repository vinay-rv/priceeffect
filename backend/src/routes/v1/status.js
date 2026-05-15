import express from "express";
import { config } from "../../config/index.js";
import { FilterRun } from "../../models/FilterRun.js";
import { Stock } from "../../models/Stock.js";

const router = express.Router();

function mapToObject(value) {
  if (!value) return {};
  if (value instanceof Map) return Object.fromEntries(value);
  return value;
}

function getTimeZoneParts(date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: config.timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: false,
      weekday: "short",
    })
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
}

function getNextJobRun() {
  const match = config.nightlyJobCron.match(/^(\d+) (\d+) \* \* 1-5$/);
  if (!match || config.timezone !== "Asia/Kolkata") return null;

  const minute = Number(match[1]);
  const hour = Number(match[2]);
  const nowParts = getTimeZoneParts(new Date());
  const nowLocal = {
    year: Number(nowParts.year),
    month: Number(nowParts.month),
    day: Number(nowParts.day),
    hour: Number(nowParts.hour),
    minute: Number(nowParts.minute),
  };

  for (let offset = 0; offset < 8; offset += 1) {
    const candidateUtcNoon = new Date(Date.UTC(nowLocal.year, nowLocal.month - 1, nowLocal.day + offset, 6, 30));
    const parts = getTimeZoneParts(candidateUtcNoon);
    const weekday = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day))).getUTCDay();
    const isWeekday = weekday >= 1 && weekday <= 5;
    const isLaterToday = offset > 0 || hour > nowLocal.hour || (hour === nowLocal.hour && minute > nowLocal.minute);

    if (isWeekday && isLaterToday) {
      return new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), hour - 5, minute - 30)).toISOString();
    }
  }

  return null;
}

router.get("/", async (_req, res, next) => {
  try {
    const [lastRun, totalStocks] = await Promise.all([
      FilterRun.findOne().sort({ runAt: -1 }).lean(),
      Stock.countDocuments(),
    ]);

    res.json({
      success: true,
      status: "healthy",
      lastJobRun: lastRun?.runAt ?? null,
      lastDataDate: lastRun?.dataDate ?? null,
      totalStocks,
      filterCounts: mapToObject(lastRun?.filterCounts),
      aiProvider: config.defaultAiProvider,
      nextJobRun: getNextJobRun(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
