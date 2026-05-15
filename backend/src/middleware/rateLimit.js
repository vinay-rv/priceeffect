import rateLimit from "express-rate-limit";
import { config } from "../config/index.js";

const handler = (req, res) => {
  res.status(429).json({
    success: false,
    error: "Rate limit exceeded",
    retryAfter: Number(req.rateLimit?.resetTime ? Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000) : 0),
  });
};

export const standardRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

export const aiRateLimit = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: 20,
  skip: (req) => req.query.ai === "false" || req.query.ai === false,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});
