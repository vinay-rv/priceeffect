# Price Effect Backend

Node.js + Express backend for Price Effect, a news and Indian stock market app that links market-moving stories to affected NSE/BSE stocks.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
cp .env.example .env
```

3. Fill in your API keys inside `.env`.

4. Start the server in development:

```bash
npm run dev
```

The API starts on `PORT` and logs `Price Effect API running on port XXXX`.

## Environment Variables

- `PORT`: Express server port. Default is `3001`.
- `OPENAI_API_KEY`: OpenAI API key used to link articles to affected stocks.
- `NEWS_API_KEY`: NewsAPI.org key for Indian business headlines.
- `CORS_ORIGIN`: Frontend origin allowed by CORS, for example `http://localhost:3000`.
- `DB_PATH`: Optional SQLite file path for persisted article-to-stock links. Default is `./data/priceeffect.db`.

## API Keys

- NewsAPI: Create a free developer key at [newsapi.org](https://newsapi.org/).
- OpenAI: Create an API key from [platform.openai.com](https://platform.openai.com/).

## Project Structure

```text
backend/
├── src/
│   ├── index.js
│   ├── routes/
│   │   ├── news.js
│   │   └── stocks.js
│   ├── services/
│   │   ├── newsService.js
│   │   ├── stockService.js
│   │   └── aiService.js
│   └── middleware/
│       └── cache.js
├── .env.example
├── package.json
└── README.md
```

## Endpoints

### `GET /health`

Health check.

Example response:

```json
{
  "success": true,
  "status": "ok"
}
```

### `GET /api/news`

Returns merged news from NewsAPI and Google News RSS.

Query params:

- `category` optional, filters by normalized category.
- `limit` optional, defaults to `20`.

Example response:

```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "4c197d5c4c5c9c2d7a6d0f0d86c1c2345b2ce111",
      "title": "Sensex rises on bank gains",
      "summary": "Indian equities advanced after strong lender commentary...",
      "source": "NewsAPI",
      "url": "https://example.com/article",
      "publishedAt": "2026-03-14T10:30:00.000Z",
      "category": "Markets"
    }
  ]
}
```

### `GET /api/news/search?q=query`

Searches cached articles by title or summary.

Example response:

```json
{
  "success": true,
  "count": 1,
  "data": [
    {
      "id": "4c197d5c4c5c9c2d7a6d0f0d86c1c2345b2ce111",
      "title": "Sensex rises on bank gains",
      "summary": "Indian equities advanced after strong lender commentary...",
      "source": "NewsAPI",
      "url": "https://example.com/article",
      "publishedAt": "2026-03-14T10:30:00.000Z",
      "category": "Markets"
    }
  ]
}
```

### `GET /api/news/:id`

Returns one article plus AI-linked affected stocks.

Example response:

```json
{
  "success": true,
  "data": {
    "article": {
      "id": "4c197d5c4c5c9c2d7a6d0f0d86c1c2345b2ce111",
      "title": "Sensex rises on bank gains",
      "summary": "Indian equities advanced after strong lender commentary...",
      "source": "NewsAPI",
      "url": "https://example.com/article",
      "publishedAt": "2026-03-14T10:30:00.000Z",
      "category": "Markets"
    },
    "affectedStocks": [
      {
        "ticker": "HDFCBANK.NS",
        "name": "HDFC Bank",
        "impact": "high",
        "direction": "up",
        "reason": "Improving rate expectations can support treasury and lending sentiment.",
        "livePrice": 1612.4,
        "change": 20.4,
        "changePercent": 1.28,
        "marketDirection": "up",
        "high": 1620.1,
        "low": 1588.3,
        "volume": 8212301,
        "sparks": [1560.2, 1572.4, 1580.1, 1599.5, 1602.3, 1608.7, 1612.4]
      }
    ]
  }
}
```

### `GET /api/stocks`

Returns default Indian market tickers with live pricing data.

Example response:

```json
{
  "success": true,
  "count": 10,
  "data": [
    {
      "ticker": "RELIANCE.NS",
      "name": "Reliance Industries Limited",
      "price": 2948.55,
      "change": 25.35,
      "changePercent": 0.86,
      "direction": "up",
      "high": 2962.8,
      "low": 2910.4,
      "volume": 3891200,
      "sparks": [2894.1, 2902.2, 2910.7, 2928.1, 2930.4, 2941.6, 2948.55]
    }
  ]
}
```

### `GET /api/stocks/:ticker`

Returns a single stock by ticker.

Example:

```text
/api/stocks/RELIANCE.NS
```

### `GET /api/stocks/ticker?symbols=RELIANCE.NS,TCS.NS,INFY.NS`

Returns multiple symbols in one request.

## Caching and Resilience

- `/api/news` responses are cached for 15 minutes.
- `/api/stocks` responses are cached for 5 minutes.
- AI article-to-stock linking is cached per article title for 30 minutes.
- Article-to-stock links are also persisted in SQLite, so repeat visits do not call OpenAI again unless the article content changes.
- If upstream providers fail, the backend returns cached data when available.
- External API failures return `503` when no cached fallback exists.

## Development Notes

- News data merges NewsAPI business headlines and Google News RSS.
- Stocks are pulled from Yahoo Finance chart data in parallel.
- AI linking uses OpenAI and enriches linked stocks with live market data.
- OpenAI is only used the first time an article is analyzed; saved link results are reused from SQLite on future visits.
- Security headers are provided by Helmet and traffic is rate-limited to 100 requests per 15 minutes per IP.
