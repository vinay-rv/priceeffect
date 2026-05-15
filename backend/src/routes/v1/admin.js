import express from "express";
import { adminAuth } from "../../middleware/apiKey.js";
import { runJobNow } from "../../jobs/nightlyJob.js";

const router = express.Router();

router.post("/run-job", adminAuth, async (_req, res, next) => {
  try {
    const result = await runJobNow();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
