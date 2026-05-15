import express from "express";
import { FILTER_DEFINITIONS } from "../../services/filterService.js";

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({ success: true, data: FILTER_DEFINITIONS });
});

export default router;
