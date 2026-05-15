import mongoose from "mongoose";

const cacheEntrySchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: mongoose.Schema.Types.Mixed,
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

cacheEntrySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const CacheEntry = mongoose.model("CacheEntry", cacheEntrySchema);
