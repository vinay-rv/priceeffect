import express from "express";
import { createCacheMiddleware } from "../middleware/cache.js";
import { linkNewsToStocks } from "../services/aiService.js";
import { getNews, getNewsById, searchNews } from "../services/newsService.js";

const router = express.Router();

router.get("/search", async (req, res, next) => {
  try {
    const query = (req.query.q || "").trim();

    if (!query) {
      res.status(400).json({
        success: false,
        error: "Query parameter q is required",
        code: 400,
      });
      return;
    }

    const results = await searchNews(query);

    res.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/", createCacheMiddleware(900), async (req, res, next) => {
  try {
    const { category, limit = "20" } = req.query;
    const parsedLimit = Number.parseInt(limit, 10) || 20;
    const articles = await getNews();

    const filteredArticles = category
      ? articles.filter(
          (article) => article.category.toLowerCase() === String(category).toLowerCase(),
        )
      : articles;

    res.json({
      success: true,
      count: Math.min(filteredArticles.length, parsedLimit),
      data: filteredArticles.slice(0, parsedLimit),
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const article = await getNewsById(req.params.id);

    if (!article) {
      res.status(404).json({
        success: false,
        error: "Article not found",
        code: 404,
      });
      return;
    }

    const affectedStocks = await linkNewsToStocks(article);

    res.json({
      success: true,
      data: {
        article,
        affectedStocks,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
