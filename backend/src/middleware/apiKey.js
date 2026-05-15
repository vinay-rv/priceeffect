import { config } from "../config/index.js";

/**
 * Optional API key authentication middleware controlled by REQUIRE_API_KEY.
 *
 * @param {import("express").Request} req express request.
 * @param {import("express").Response} res express response.
 * @param {import("express").NextFunction} next next callback.
 * @returns {void}
 */
export function apiKeyAuth(req, res, next) {
  if (!config.requireApiKey) {
    next();
    return;
  }

  const apiKey = req.get("X-API-Key");
  if (!apiKey || !config.apiKeys.includes(apiKey)) {
    res.status(401).json({ success: false, error: "Missing or invalid API key", code: 401 });
    return;
  }

  next();
}

/**
 * Requires ADMIN_SECRET for administrative endpoints.
 *
 * @param {import("express").Request} req express request.
 * @param {import("express").Response} res express response.
 * @param {import("express").NextFunction} next next callback.
 * @returns {void}
 */
export function adminAuth(req, res, next) {
  const provided = req.get("ADMIN_SECRET") || req.get("X-Admin-Secret");
  if (!config.adminSecret || provided !== config.adminSecret) {
    res.status(401).json({ success: false, error: "Admin secret required", code: 401 });
    return;
  }

  next();
}
