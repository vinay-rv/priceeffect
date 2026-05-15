import express from "express";
import cors from "cors";
import helmet from "helmet";
import { config } from "./config/index.js";
import { apiKeyAuth } from "./middleware/apiKey.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";
import { standardRateLimit } from "./middleware/rateLimit.js";
import adminRoutes from "./routes/v1/admin.js";
import filterRoutes from "./routes/v1/filters.js";
import statusRoutes from "./routes/v1/status.js";
import stockRoutes from "./routes/v1/stocks.js";
import { scheduleNightlyJob } from "./jobs/nightlyJob.js";
import { connectDatabase } from "./services/cacheService.js";
import { logger } from "./utils/logger.js";

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin === "*" ? true : config.corsOrigin,
  }),
);
app.use(express.json());
app.use(standardRateLimit);
app.use(apiKeyAuth);

app.use("/v1/stocks", stockRoutes);
app.use("/v1/filters", filterRoutes);
app.use("/v1/status", statusRoutes);
app.use("/v1/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

connectDatabase(config.mongodbUri)
  .then(() => {
    scheduleNightlyJob();
    app.listen(config.port, () => {
      logger.info(`PriceEffect API running on port ${config.port}`);
    });
  })
  .catch((error) => {
    logger.error("Failed to start PriceEffect API", { error: error.message, stack: error.stack });
    process.exit(1);
  });
