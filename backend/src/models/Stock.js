import mongoose from "mongoose";

const quarterSchema = new mongoose.Schema(
  {
    period: String,
    revenue: Number,
    netProfit: Number,
    profitGrowth: Number,
  },
  { _id: false },
);

const analysisSchema = new mongoose.Schema(
  {
    verdict: String,
    reason: String,
    risks: [String],
    opportunity: String,
    confidence: String,
    verdictReason: String,
    priceTarget: String,
    keyMetric: String,
    analysedAt: Date,
  },
  { _id: false },
);

const stockSchema = new mongoose.Schema(
  {
    symbol: { type: String, required: true, uppercase: true, trim: true },
    exchange: { type: String, enum: ["NSE", "BSE"], required: true },
    companyName: String,
    open: Number,
    high: Number,
    low: Number,
    close: Number,
    volume: Number,
    fiftyTwoWeekHigh: Number,
    fiftyTwoWeekLow: Number,
    distanceFrom52Low: Number,
    distanceFrom52High: Number,
    priceChange30d: Number,
    volumeSpike: Boolean,
    pe: Number,
    marketCap: Number,
    roe: Number,
    debtToEquity: Number,
    promoterHolding: Number,
    eps: Number,
    bookValue: Number,
    dividendYield: Number,
    quarters: [quarterSchema],
    isProfitable: Boolean,
    profitTrend: { type: String, enum: ["growing", "declining", "mixed"] },
    filters: { type: [String], default: [] },
    aiAnalysis: {
      type: Map,
      of: analysisSchema,
      default: {},
    },
    fundamentalsUpdatedAt: Date,
    lastUpdated: Date,
    dataDate: String,
  },
  { timestamps: true },
);

stockSchema.index({ filters: 1, exchange: 1, pe: 1, roe: 1 });
stockSchema.index({ symbol: 1, exchange: 1 }, { unique: true });
stockSchema.index({ dataDate: 1 });

export const Stock = mongoose.model("Stock", stockSchema);
