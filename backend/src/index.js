import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import newsRoutes from "./routes/news.js";
import { initDatabase } from "./services/dbService.js";
import stocksRoutes from "./routes/stocks.js";

dotenv.config();
initDatabase();

const app = express();
const port = process.env.PORT || 5000;

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  }),
);
app.use(express.json());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get("/health", (_req, res) => {
  res.json({ success: true, status: "ok" });
});

app.use("/api/news", newsRoutes);
app.use("/api/stocks", stocksRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    code: 404,
  });
});

app.use((error, _req, res, _next) => {
  const status = error.status || 500;
  const isProduction = process.env.NODE_ENV === "production";

  res.status(status).json({
    success: false,
    error: error.message || "Internal server error",
    code: status,
    ...(isProduction ? {} : error.details ? { details: error.details } : {}),
  });
});

app.listen(port, () => {
  console.log(`Price Effect API running on port ${port}`);
});
