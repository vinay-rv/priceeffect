import { isProduction } from "../config/index.js";
import { logger } from "../utils/logger.js";

/**
 * Handles unmatched routes.
 *
 * @param {import("express").Request} req express request.
 * @param {import("express").Response} res express response.
 * @returns {void}
 */
export function notFoundHandler(req, res) {
  res.status(404).json({ success: false, error: "Route not found", code: 404 });
}

/**
 * Global Express error handler.
 *
 * @param {Error & {status?: number, details?: unknown}} error thrown error.
 * @param {import("express").Request} req express request.
 * @param {import("express").Response} res express response.
 * @param {import("express").NextFunction} _next next callback.
 * @returns {void}
 */
export function errorHandler(error, req, res, _next) {
  const status = error.status || 500;
  logger.error("Request failed", {
    method: req.method,
    path: req.originalUrl,
    status,
    error: error.message,
    stack: error.stack,
  });

  res.status(status).json({
    success: false,
    error: isProduction() && status >= 500 ? "Internal server error" : error.message || "Internal server error",
    code: status,
    ...(isProduction() || !error.details ? {} : { details: error.details }),
  });
}
