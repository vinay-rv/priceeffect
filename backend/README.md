# PriceEffect API

Open source stock research API for Indian markets (NSE + BSE). PriceEffect scans listed stocks, applies predefined financial filters, runs optional AI analysis, and returns the top candidates per screen.

## Quick Start

```bash
git clone https://github.com/yourusername/priceeffect-api
cd priceeffect-api/backend
cp .env.example .env
docker-compose up
```

Set `MONGODB_URI` in `.env` to your MongoDB Atlas connection string before starting. The API runs at `http://localhost:3000`.

## Environment Variables

| Name | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Express port |
| `NODE_ENV` | `development` | Runtime environment |
| `MONGODB_URI` | Atlas URI | MongoDB Atlas connection string |
| `DEFAULT_AI_PROVIDER` | `gemini` | `gemini`, `ollama`, or `none` |
| `GEMINI_API_KEY` | empty | Default Gemini key |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama host |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window |
| `RATE_LIMIT_MAX` | `100` | Requests per window |
| `REQUIRE_API_KEY` | `false` | Enables `X-API-Key` auth |
| `API_KEYS` | empty | Comma-separated API keys |
| `ADMIN_SECRET` | empty | Required for admin job trigger |
| `NIGHTLY_JOB_CRON` | `0 18 * * 1-5` | Job schedule, 6PM weekdays |
| `JOB_TIMEZONE` | `Asia/Kolkata` | Cron timezone |

## API Reference

Every endpoint returns `success: true` or `success: false`. All API routes are versioned under `/v1`.

### `GET /v1/status`

Returns health, last job, data date, total stocks, and latest filter counts.

```bash
curl http://localhost:3000/v1/status
```

```json
{
  "success": true,
  "status": "healthy",
  "lastJobRun": "2026-05-12T18:30:00.000Z",
  "lastDataDate": "12052026",
  "totalStocks": 5847,
  "filterCounts": {
    "52-low": 47,
    "good-pe": 312
  },
  "aiProvider": "gemini",
  "nextJobRun": null
}
```

### `GET /v1/filters`

Returns available screens and accepted custom parameters.

```bash
curl http://localhost:3000/v1/filters
```

```json
{
  "success": true,
  "data": [
    {
      "id": "52-low",
      "name": "52 Week Low",
      "description": "Stocks within 5% of their 52-week low with positive profit history",
      "params": [
        {
          "name": "threshold",
          "type": "number",
          "default": 0.05,
          "description": "% distance from 52W low"
        }
      ]
    }
  ]
}
```

### `GET /v1/stocks`

Returns top stocks for one filter.

| Query param | Required | Default | Description |
| --- | --- | --- | --- |
| `filter` | yes | none | Filter id, including `custom` |
| `exchange` | no | `BOTH` | `NSE`, `BSE`, or `BOTH` |
| `limit` | no | `20` | 1 to 50 |
| `ai` | no | `true` | Set `false` to skip AI |
| `minPe` | custom | none | Minimum P/E |
| `maxPe` | custom | none | Maximum P/E |
| `minRoe` | custom | none | Minimum ROE |
| `maxDebt` | custom | none | Maximum debt-to-equity |
| `minPromoter` | custom | none | Minimum promoter holding |
| `profitable` | custom | none | Require profitable quarters |
| `minMarketCap` | custom | none | Minimum market cap in crore |
| `maxMarketCap` | custom | none | Maximum market cap in crore |

```bash
curl "http://localhost:3000/v1/stocks?filter=52-low&exchange=BOTH&limit=20&ai=false"
```

```json
{
  "success": true,
  "filter": "52-low",
  "exchange": "BOTH",
  "count": 20,
  "dataDate": "12052026",
  "lastUpdated": "2026-05-12T18:30:00.000Z",
  "aiProvider": "none",
  "data": [
    {
      "symbol": "RELIANCE",
      "exchange": "NSE",
      "companyName": "Reliance Industries Ltd",
      "price": {
        "current": 2341.5,
        "fiftyTwoWeekHigh": 3024.9,
        "fiftyTwoWeekLow": 2298.1,
        "distanceFrom52Low": 1.89,
        "distanceFrom52High": 22.59,
        "change30d": -4.2
      },
      "fundamentals": {
        "pe": 18.4,
        "roe": 14.2,
        "debtToEquity": 0.44,
        "marketCap": 1584920,
        "promoterHolding": 50.3,
        "profitTrend": "growing",
        "quarters": []
      },
      "analysis": null
    }
  ]
}
```

### `GET /v1/stocks/:symbol`

Returns a single-stock deep dive. AI is enabled by default and uses cached analysis when fresh. Pass `ai=false` to skip AI, or `refreshAi=true` to force a new analysis.

| Query param | Required | Default | Description |
| --- | --- | --- | --- |
| `exchange` | no | any | `NSE`, `BSE`, or `BOTH` |
| `ai` | no | `true` | Set `false` to skip AI |
| `refreshAi` | no | `false` | Set `true` to force a new AI analysis |

```bash
curl "http://localhost:3000/v1/stocks/RELIANCE?exchange=NSE" \
  -H "X-AI-Provider: gemini" \
  -H "X-Gemini-Key: your_key_here"
```

```json
{
  "success": true,
  "aiProvider": "gemini",
  "data": {
    "symbol": "RELIANCE",
    "exchange": "NSE",
    "analysis": {
      "verdict": "BUY",
      "verdictReason": "Near 52W low with strong fundamentals",
      "opportunity": "Valuation reset with resilient earnings base.",
      "risks": ["Commodity margin pressure", "Execution risk"],
      "confidence": "medium",
      "priceTarget": "₹2600",
      "keyMetric": "ROE of 14.2% with low debt"
    }
  }
}
```

### `POST /v1/stocks/screen`

Combines multiple filters with AND logic.

```bash
curl -X POST http://localhost:3000/v1/stocks/screen \
  -H "Content-Type: application/json" \
  -d '{
    "filters": ["52-low", "good-pe"],
    "exchange": "NSE",
    "limit": 20,
    "params": {
      "threshold": 0.03,
      "maxPe": 20
    }
  }'
```

```json
{
  "success": true,
  "filters": ["52-low", "good-pe"],
  "exchange": "NSE",
  "count": 2,
  "aiProvider": "gemini",
  "data": []
}
```

### `POST /v1/admin/run-job`

Manually triggers the nightly job. Requires `ADMIN_SECRET`.

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "ADMIN_SECRET: change_me"
```

```json
{
  "success": true,
  "data": {
    "runId": "66452ad55d661db0c5a6b111",
    "status": "complete",
    "totalStocksProcessed": 5847,
    "filterCounts": {
      "52-low": 47
    }
  }
}
```

## Available Filters

| ID | Description | Custom params |
| --- | --- | --- |
| `52-low` | Profitable stocks within 5% of 52-week low | `threshold` |
| `52-high` | Profitable stocks within 5% of 52-week high | `threshold` |
| `good-pe` | P/E between 5 and 25, profitable, ROE at least 10% | `minPe`, `maxPe` |
| `undervalued` | P/E under 20, ROE above 12%, low debt, growing profits | none |
| `momentum` | 30-day gain above 10%, volume spike, profitable | none |
| `low-debt` | Debt-to-equity under 0.5, ROE above 12%, profitable | none |
| `high-roe` | ROE above 15%, profitable, debt-to-equity under 1.5 | none |
| `promoter-buying` | Promoter holding above 50%, profitable | none |
| `splits` | Stocks tagged with split metadata | none |
| `custom` | User-defined fundamentals screen | `minPe`, `maxPe`, `minRoe`, `maxDebt`, `minPromoter`, `profitable`, `minMarketCap`, `maxMarketCap`, `exchange` |

## AI Providers

PriceEffect works without AI. Set `DEFAULT_AI_PROVIDER=none` or pass `ai=false`.

### Gemini

```bash
DEFAULT_AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_here
```

Bring your own Gemini key per request:

```bash
curl "http://localhost:3000/v1/stocks?filter=good-pe" \
  -H "X-AI-Provider: gemini" \
  -H "X-Gemini-Key: your_key_here"
```

### Ollama

Run Ollama locally and pull `gemma3`.

```bash
ollama pull gemma3
DEFAULT_AI_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
```

Per request:

```bash
curl "http://localhost:3000/v1/stocks?filter=good-pe" \
  -H "X-AI-Provider: ollama"
```

### None

```bash
curl "http://localhost:3000/v1/stocks?filter=good-pe&ai=false"
```

## Self Hosting Guide

1. Install Node.js 20.
2. Install dependencies:

```bash
npm install
```

3. Configure environment:

```bash
cp .env.example .env
```

4. Set `MONGODB_URI` to your MongoDB Atlas connection string.
5. Start the API:

```bash
npm run dev
```

6. Trigger the first data load:

```bash
curl -X POST http://localhost:3000/v1/admin/run-job \
  -H "ADMIN_SECRET: change_me"
```

The scheduled job runs at 6PM IST Monday through Friday by default.

## Data Pipeline

1. Downloads NSE and BSE bhavcopy files.
2. Falls back to previous three calendar days when a file is unavailable.
3. Falls back to the latest MongoDB snapshot if upstream bhavcopy download fails.
4. Scrapes Screener.in fundamentals with bounded concurrency and a 500ms per-request delay.
5. Tags matching filters and bulk upserts stocks into MongoDB.
6. Runs optional AI analysis for top filter candidates and caches it for six hours.

## Contributing

Filters live in `src/services/filterService.js`. To add a filter:

1. Add one pure function to `FILTERS`.
2. Add a human-readable entry to `FILTER_DEFINITIONS`.
3. Add a sort rule in `SORTS` if ranking differs from ROE descending.
4. Run the job and verify `/v1/filters` and `/v1/stocks?filter=your-filter`.

Keep filters deterministic, side-effect free, and easy to audit.
