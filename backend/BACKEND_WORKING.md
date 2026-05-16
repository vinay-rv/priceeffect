# PriceEffect Backend Working Document

This document explains how the PriceEffect backend works internally: how the API starts, how data is loaded, how filters are applied, how AI analysis is generated, and how the frontend should consume it.

## 1. What The Backend Does

The backend is an Express API for Indian stock research. It:

- Starts an HTTP API on `PORT`, usually `3000`.
- Connects to MongoDB using `MONGODB_URI`.
- Downloads NSE/BSE bhavcopy stock price data.
- Enriches stock rows with fundamentals from Screener.in.
- Stores normalized stock snapshots in MongoDB.
- Tags stocks with filter IDs such as `52-low`, `good-pe`, `high-roe`, etc.
- Optionally runs AI analysis through Gemini or Ollama.
- Exposes stock screen, stock detail, filter metadata, status, and admin job APIs.

All API routes are versioned under `/v1`.

## 2. Main Files

| File | Responsibility |
| --- | --- |
| `src/index.js` | Express app setup, middleware, routes, MongoDB connection, cron startup |
| `src/config/index.js` | Reads environment variables and exposes typed config |
| `src/routes/v1/stocks.js` | Stock screen, stock detail, combined screen APIs |
| `src/routes/v1/filters.js` | Returns filter definitions |
| `src/routes/v1/status.js` | Returns backend health and latest job status |
| `src/routes/v1/admin.js` | Manual admin job trigger |
| `src/jobs/nightlyJob.js` | Full data refresh pipeline |
| `src/services/bhavService.js` | Downloads and parses NSE/BSE bhavcopy data |
| `src/services/fundamentalsService.js` | Scrapes Screener.in fundamentals and current price fields |
| `src/services/filterService.js` | Filter definitions, filter logic, ranking, MongoDB bulk upsert |
| `src/services/aiService.js` | Gemini/Ollama stock analysis and AI cache writes |
| `src/services/cacheService.js` | MongoDB connection and cache helpers |
| `src/models/Stock.js` | Main stock document schema |
| `src/models/FilterRun.js` | Job run history schema |
| `src/models/CacheEntry.js` | TTL cache schema |
| `src/middleware/rateLimit.js` | Standard and AI request rate limits |
| `src/middleware/apiKey.js` | Optional API key auth and admin auth |
| `src/middleware/errorHandler.js` | 404 and error JSON responses |

## 3. Startup Flow

When you run:

```bash
npm start
```

or:

```bash
npm run dev
```

the backend starts from `src/index.js`.

Startup order:

1. Load environment variables through `dotenv`.
2. Create an Express app.
3. Add security middleware:
   - `helmet()`
   - `cors()`
   - `express.json()`
4. Add the standard API rate limiter.
5. Add optional API key authentication.
6. Mount routes:
   - `/v1/stocks`
   - `/v1/filters`
   - `/v1/status`
   - `/v1/admin`
7. Connect to MongoDB.
8. Start the scheduled nightly job.
9. Listen on `config.port`.

If port `3000` is already used, Node throws:

```text
Error: listen EADDRINUSE: address already in use :::3000
```

That means another process is already using the backend port. Check it with:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

Then stop the old process if needed:

```bash
kill <PID>
```

## 4. Environment Variables

Important variables:

| Variable | Purpose |
| --- | --- |
| `PORT` | HTTP server port, default `3000` |
| `MONGODB_URI` | MongoDB connection string |
| `CORS_ORIGIN` | Allowed frontend origin, `*` allows all |
| `DEFAULT_AI_PROVIDER` | `gemini`, `ollama`, or `none` |
| `GEMINI_MODEL` | Gemini model, default `gemini-2.5-flash` |
| `GEMINI_API_KEY` | Server-side Gemini API key |
| `OLLAMA_URL` | Local Ollama URL |
| `REQUIRE_API_KEY` | Enables `X-API-Key` auth when `true` |
| `API_KEYS` | Comma-separated accepted API keys |
| `ADMIN_SECRET` | Required for `/v1/admin/run-job` |
| `NIGHTLY_JOB_CRON` | Cron schedule for data refresh |
| `JOB_TIMEZONE` | Cron timezone, usually `Asia/Kolkata` |
| `BHAVCOPY_DATE_OVERRIDE` | Optional fixed date for bhavcopy testing |
| `JOB_STOCK_LIMIT` | Limits processed stocks for dev/testing; `0` means no limit |

Do not commit real `.env` secrets. Keep real keys only in local `.env` or deployment secrets.

## 5. MongoDB Collections

### `stocks`

Defined in `src/models/Stock.js`.

Each document represents one stock for one exchange.

Important fields:

- `symbol`
- `exchange`
- `companyName`
- `open`, `high`, `low`, `close`, `volume`
- `fiftyTwoWeekHigh`, `fiftyTwoWeekLow`
- `distanceFrom52Low`, `distanceFrom52High`
- `pe`, `roe`, `debtToEquity`, `marketCap`, `promoterHolding`
- `profitTrend`, `isProfitable`, `quarters`
- `filters`
- `aiAnalysis`
- `dataDate`
- `lastUpdated`

Unique index:

```js
{ symbol: 1, exchange: 1 }
```

This means one stock symbol can exist once per exchange.

### `filterruns`

Defined in `src/models/FilterRun.js`.

Stores every job execution:

- `runAt`
- `dataDate`
- `totalStocksProcessed`
- `exchange`
- `status`: `running`, `complete`, or `failed`
- `filterCounts`
- `error`

The `/v1/status` endpoint reads the latest `FilterRun`.

### `cacheentries`

Defined in `src/models/CacheEntry.js`.

Used for cached external data such as Screener fundamentals. It has:

- `key`
- `value`
- `expiresAt`

MongoDB TTL automatically removes expired cache entries.

## 6. Data Refresh Job

The refresh pipeline lives in `src/jobs/nightlyJob.js`.

It runs in two ways:

1. Automatically by cron:

```js
scheduleNightlyJob()
```

2. Manually through:

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "X-Admin-Secret: change_me"
```

The manual HTTP endpoint is preferred because the server has already connected to MongoDB.

Pipeline steps:

1. Create a `FilterRun` record with status `running`.
2. Download bhavcopy rows from NSE/BSE.
3. If the upstream download fails, fall back to the latest MongoDB snapshot.
4. Apply `JOB_STOCK_LIMIT` if configured.
5. Enrich stocks with Screener.in fundamentals and current price/high-low fields.
6. Apply all filters and write stock documents to MongoDB using `bulkWrite`.
7. Run AI analysis for top candidates when `DEFAULT_AI_PROVIDER` is not `none`.
8. Mark the `FilterRun` as `complete`.
9. If any fatal error happens, mark the run as `failed`.

## 7. Bhavcopy Data

Bhavcopy logic is in `src/services/bhavService.js`.

The service:

- Downloads NSE bhavcopy CSV.
- Downloads BSE bhavcopy ZIP/CSV.
- Tries the target date first.
- Falls back up to three previous calendar days.
- Parses rows into normalized stock objects.
- Deduplicates by symbol, preferring NSE over BSE.

The backend stores the bhavcopy date as `dataDate`, for example:

```text
15052026
```

Important: bhavcopy data is end-of-day/snapshot data, not true streaming live market data.

## 8. Fundamentals Enrichment

Fundamentals logic is in `src/services/fundamentalsService.js`.

For each stock, the backend scrapes Screener.in and extracts:

- Current price
- 52-week high and low
- Stock P/E
- ROE
- Market cap
- Book value
- Dividend yield
- Promoter holding
- Quarterly profit data when available

The enrichment step then updates:

- `close`
- `fiftyTwoWeekHigh`
- `fiftyTwoWeekLow`
- `distanceFrom52Low`
- `distanceFrom52High`

The scraper is intentionally slow and low-concurrency because Screener can return `429 Too Many Requests` when hit too aggressively.

If Screener fails for a symbol, the job keeps the stock using bhavcopy data instead of dropping it.

## 9. Filters

Filter logic is in `src/services/filterService.js`.

Current filters:

| Filter ID | Meaning |
| --- | --- |
| `52-low` | Near 52-week low |
| `52-high` | Near 52-week high |
| `good-pe` | Reasonable P/E and ROE |
| `undervalued` | Low P/E, healthy ROE, low debt signal |
| `momentum` | Strong 30-day move and volume spike |
| `low-debt` | Low debt and good ROE |
| `high-roe` | High ROE with acceptable debt signal |
| `promoter-buying` | High promoter holding |
| `splits` | Split metadata |
| `custom` | User-defined query params |

The job tags every stock with matching filter IDs:

```js
filters: ["good-pe", "low-debt", "high-roe"]
```

Screen APIs later query this `filters` field for fast results.

### Custom Filter

The `custom` filter lets callers pass values such as:

- `minPe`
- `maxPe`
- `minRoe`
- `maxDebt`
- `minPromoter`
- `profitable`
- `minMarketCap`
- `maxMarketCap`

Example:

```bash
curl "http://localhost:3000/v1/stocks?filter=custom&minRoe=15&maxPe=25&exchange=NSE&ai=false"
```

## 10. AI Analysis

AI logic is in `src/services/aiService.js`.

Supported providers:

- `gemini`
- `ollama`
- `none`

Provider is resolved from request headers first, then environment defaults:

```http
X-AI-Provider: gemini
X-Gemini-Key: optional-per-request-key
```

If no request header is provided, the backend uses:

```env
DEFAULT_AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_KEY=...
```

AI output is normalized into:

```json
{
  "verdict": "BUY | WATCH | AVOID",
  "verdictReason": "short reason",
  "opportunity": "opportunity text",
  "risks": ["risk 1", "risk 2"],
  "confidence": "high | medium | low",
  "priceTarget": null,
  "keyMetric": "important metric",
  "analysedAt": "date"
}
```

The result is stored on the stock document under:

```js
aiAnalysis[filterContext]
```

For stock detail calls, the filter context is:

```text
deep-dive
```

AI analysis is cached for six hours unless forced.

## 11. API Endpoints

### `GET /v1/status`

Returns health and latest job state.

```bash
curl http://localhost:3000/v1/status
```

Response includes:

- `status`
- `lastJobRun`
- `lastDataDate`
- `totalStocks`
- `filterCounts`
- `aiProvider`
- `nextJobRun`

### `GET /v1/filters`

Returns available screen definitions.

```bash
curl http://localhost:3000/v1/filters
```

### `GET /v1/stocks`

Returns stocks for one filter.

```bash
curl "http://localhost:3000/v1/stocks?filter=good-pe&exchange=NSE&limit=20&ai=false"
```

Important query params:

- `filter`: required
- `exchange`: `NSE`, `BSE`, or `BOTH`
- `limit`: max `50`
- `ai`: set `false` to skip AI

### `GET /v1/stocks/:symbol`

Returns one stock detail. AI is enabled by default, but the backend reuses cached analysis when it is still fresh.

```bash
curl "http://localhost:3000/v1/stocks/AARTIPHARM?exchange=NSE&ai=true"
```

Set `ai=false` to avoid the AI call:

```bash
curl "http://localhost:3000/v1/stocks/AARTIPHARM?exchange=NSE&ai=false"
```

Force a new AI analysis with:

```bash
curl "http://localhost:3000/v1/stocks/AARTIPHARM?exchange=NSE&ai=true&refreshAi=true"
```

### `POST /v1/stocks/screen`

Combines multiple filters with AND logic.

```bash
curl -X POST http://localhost:3000/v1/stocks/screen \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["good-pe", "high-roe"],
    "exchange": "NSE",
    "limit": 20,
    "params": {}
  }'
```

### `POST /v1/admin/run-job`

Manually triggers the refresh pipeline.

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "X-Admin-Secret: change_me"
```

This endpoint requires `ADMIN_SECRET`.

## 12. Rate Limiting

Rate limit logic is in `src/middleware/rateLimit.js`.

There are two limits:

1. Standard API limit:
   - Controlled by `RATE_LIMIT_WINDOW_MS`
   - Controlled by `RATE_LIMIT_MAX`

2. AI route limit:
   - Max `20` requests per window
   - Skipped for requests with `ai=false`

This matters because AI calls can be slower and more expensive than normal stock screen calls.

## 13. Frontend Integration

The frontend should call the backend through Vite proxy:

```text
/api/v1/...
```

Vite rewrites:

```text
/api/v1/stocks
```

to:

```text
http://localhost:3000/v1/stocks
```

Useful frontend URLs:

```text
/api/v1/status
/api/v1/filters
/api/v1/stocks?filter=custom&exchange=BOTH&limit=20&ai=false
/api/v1/stocks/AARTIPHARM?exchange=NSE&ai=true
```

## 14. Common Issues

### Port already in use

Error:

```text
EADDRINUSE: address already in use :::3000
```

Fix:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
kill <PID>
```

### Filters show zero results

Possible reasons:

- The selected filter genuinely has no matches.
- The job has not been run yet.
- `JOB_STOCK_LIMIT` is too low.
- Screener enrichment was rate-limited and some fields are missing.
- The selected exchange has no matching rows.

Check:

```bash
curl http://localhost:3000/v1/status
curl "http://localhost:3000/v1/stocks?filter=custom&exchange=BOTH&limit=20&ai=false"
```

### Prices look stale

Possible reasons:

- Bhavcopy is snapshot/end-of-day data, not live streaming data.
- Screener enrichment failed or was rate-limited.
- `BHAVCOPY_DATE_OVERRIDE` is set to an old date.

Check `.env`:

```env
BHAVCOPY_DATE_OVERRIDE=
```

Then rerun:

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "X-Admin-Secret: change_me"
```

### AI does not appear

Possible reasons:

- Request has `ai=false`.
- `DEFAULT_AI_PROVIDER=none`.
- `GEMINI_API_KEY` is missing.
- `GEMINI_MODEL` is invalid for the key.
- AI route rate limit was reached.

Recommended Gemini settings:

```env
DEFAULT_AI_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
```

### `npm run job` caveat

The current job function expects MongoDB to already be connected. The safest manual workflow is:

1. Start the backend server.
2. Trigger `/v1/admin/run-job`.

Do this:

```bash
npm start
```

Then in another terminal:

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "X-Admin-Secret: change_me"
```

## 15. Recommended Local Workflow

Terminal 1:

```bash
cd backend
npm run dev
```

Terminal 2:

```bash
curl http://localhost:3000/v1/status
```

Run refresh:

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "X-Admin-Secret: change_me"
```

Test filters:

```bash
curl "http://localhost:3000/v1/stocks?filter=good-pe&exchange=NSE&limit=5&ai=false"
curl "http://localhost:3000/v1/stocks?filter=52-high&exchange=NSE&limit=5&ai=false"
```

Test AI detail:

```bash
curl "http://localhost:3000/v1/stocks/AARTIPHARM?exchange=NSE&ai=true"
```

## 16. Deployment Notes

For production:

- Use a real MongoDB Atlas connection string.
- Store API keys in platform secrets, not in git.
- Set `REQUIRE_API_KEY=true` if exposing publicly.
- Use a restricted `CORS_ORIGIN`.
- Keep `JOB_STOCK_LIMIT=0` only if the server can handle full enrichment time.
- Consider using a queue/worker for full market refreshes.
- Monitor Screener failures and rate limits.
- Use the `/v1/status` endpoint for health and data freshness checks.

## 17. Mental Model

Think of the backend as two layers:

1. **Data builder**
   - Cron/admin job
   - Downloads raw market rows
   - Enriches with fundamentals
   - Tags filters
   - Stores everything in MongoDB

2. **Read API**
   - Reads already-built stock snapshots
   - Applies screens quickly
   - Optionally attaches AI
   - Returns normalized JSON to the frontend

The frontend should not calculate filters itself. It should request backend screens and display the returned stocks.
