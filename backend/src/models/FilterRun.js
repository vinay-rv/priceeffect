import mongoose from "mongoose";

const filterRunSchema = new mongoose.Schema(
  {
    runAt: { type: Date, default: Date.now },
    dataDate: String,
    totalStocksProcessed: Number,
    exchange: String,
    status: { type: String, enum: ["running", "complete", "failed"], default: "running" },
    filterCounts: { type: Map, of: Number, default: {} },
    error: String,
  },
  { timestamps: true },
);

filterRunSchema.index({ runAt: -1 });
filterRunSchema.index({ status: 1, runAt: -1 });

export const FilterRun = mongoose.model("FilterRun", filterRunSchema);
