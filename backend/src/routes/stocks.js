import express from "express";
import { createCacheMiddleware } from "../middleware/cache.js";
import { getStockByTicker, getStocks } from "../services/stockService.js";

const router = express.Router();

router.get("/ticker", async (req, res, next) => {
  try {
    const symbols = String(req.query.symbols || "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);

    if (symbols.length === 0) {
      res.status(400).json({
        success: false,
        error: "Query parameter symbols is required",
        code: 400,
      });
      return;
    }

    const stocks = await getStocks(symbols);

    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", createCacheMiddleware(300), async (req, res, next) => {
  try {
    const stocks = await getStocks();

    res.json({
      success: true,
      count: stocks.length,
      data: stocks,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:ticker", async (req, res, next) => {
  try {
    const stock = await getStockByTicker(req.params.ticker.toUpperCase());

    res.json({
      success: true,
      data: stock,
    });
  } catch (error) {
    if (error.status === 503) {
      next(error);
      return;
    }

    res.status(404).json({
      success: false,
      error: "Stock not found",
      code: 404,
    });
  }
});

export default router;
