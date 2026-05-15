import { useMemo, useState } from "react";
import ErrorBanner from "./components/ErrorBanner.jsx";
import LoadingGrid from "./components/LoadingGrid.jsx";
import StockSkeleton from "./components/StockSkeleton.jsx";
import { useFilters } from "./hooks/useFilters.js";
import { useStatus } from "./hooks/useStatus.js";
import { useStockDetail } from "./hooks/useStockDetail.js";
import { useStocks } from "./hooks/useStocks.js";
import { normalizeStock } from "./utils/normalize.js";

const placeholderTickers = [
  { ticker: "RELIANCE.NSE", price: "2,948.55", change: "+0.86%", dir: "up" },
  { ticker: "TCS.NSE", price: "4,176.20", change: "+2.34%", dir: "up" },
  { ticker: "HDFCBANK.NSE", price: "1,612.40", change: "+1.28%", dir: "up" },
  { ticker: "INFY.NSE", price: "1,721.65", change: "-0.62%", dir: "down" },
];

const exchanges = ["BOTH", "NSE", "BSE"];

const getFilterLabel = (filter) => (filter.id === "custom" ? "All Stocks" : filter.name);

const getFilterDescription = (filter) =>
  filter.id === "custom" ? "Showing the latest stocks loaded by the backend job." : filter.description;

const formatDisplayDate = () =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

const formatNumber = (value, suffix = "") => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "n/a";
  return `${numeric.toLocaleString("en-IN", { maximumFractionDigits: 2 })}${suffix}`;
};

function Sparkline({ values, dir }) {
  const safeValues = values.length > 1 ? values : [20, 24, 22, 26, 25];
  const min = Math.min(...safeValues);
  const max = Math.max(...safeValues);
  const range = Math.max(1, max - min);
  const points = safeValues
    .map((value, index) => {
      const x = (index / Math.max(1, safeValues.length - 1)) * 60;
      const y = 28 - ((value - min) / range) * 24;
      return `${x},${Math.max(2, Math.min(26, y))}`;
    })
    .join(" ");

  return (
    <svg width="60" height="28" viewBox="0 0 60 28" aria-hidden="true">
      <polyline
        fill="none"
        stroke={dir === "up" ? "#00e887" : "#ff4545"}
        strokeWidth="2.2"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function StockCard({ stock, index, onSelect }) {
  const normalized = normalizeStock(stock);
  const fundamentals = normalized.fundamentals;
  const category = index === 0 ? "featured" : index === 1 ? "wide" : index < 4 ? "mid" : "small";
  const verdict = normalized.analysis?.verdict || (normalized.dir === "up" ? "Momentum" : "Watchlist");

  return (
    <article className={`news-card ${category}`} onClick={() => onSelect(stock)}>
      <div className="card-arrow">↗</div>

      <div>
        {category === "featured" ? <div className="illustration-box">{normalized.exchange || "EQ"}</div> : null}

        <div className="tag-row">
          <span className={`tag-dot ${normalized.dir === "up" ? "green" : "red"}`}></span>
          <span>{normalized.exchange || "BOTH"} · {verdict}</span>
        </div>

        {category === "featured" ? (
          <h2>{normalized.name}</h2>
        ) : (
          <h3>{normalized.name}</h3>
        )}

        {category !== "small" ? (
          <p className="summary">
            {normalized.ticker} trades at ₹{normalized.price}. P/E {formatNumber(fundamentals.pe)}, ROE{" "}
            {formatNumber(fundamentals.roe, "%")}, debt/equity {formatNumber(fundamentals.debtToEquity)}.
          </p>
        ) : null}
      </div>

      <div>
        <div className="badges">
          <span className={`stock-badge ${normalized.dir === "up" ? "up" : "down"}`}>
            {normalized.dir === "up" ? "▲" : "▼"} {normalized.change}
          </span>
          <span className="stock-badge up">52L {formatNumber(stock.price?.distanceFrom52Low, "%")}</span>
          <span className="stock-badge down">52H {formatNumber(stock.price?.distanceFrom52High, "%")}</span>
        </div>

        <div className="meta">
          <span>{normalized.ticker}</span>
          <span>₹{normalized.price}</span>
        </div>
      </div>
    </article>
  );
}

function App() {
  const { filters, loading: filtersLoading, error: filtersError, retry: retryFilters } = useFilters();
  const [activeFilterId, setActiveFilterId] = useState("custom");
  const [exchange, setExchange] = useState("BOTH");
  const [selectedStock, setSelectedStock] = useState(null);

  const activeFilter = filters.find((filter) => filter.id === activeFilterId) || filters[0];
  const displayFilters = useMemo(
    () => [...filters].sort((a, b) => (a.id === "custom" ? -1 : b.id === "custom" ? 1 : 0)),
    [filters],
  );
  const stockParams = useMemo(() => ({}), []);
  const {
    stocks,
    meta,
    loading: stocksLoading,
    error: stocksError,
    retry: retryStocks,
  } = useStocks({ filter: activeFilter?.id || "52-low", exchange, limit: 20, params: stockParams });
  const {
    detail: fetchedStock,
    loading: detailLoading,
    error: detailError,
    retry: retryDetail,
  } = useStockDetail(selectedStock);
  const { status, error: statusError } = useStatus();

  const normalizedTickerStocks = useMemo(() => {
    if (stocksLoading || stocks.length === 0) {
      return placeholderTickers;
    }

    return stocks.slice(0, 8).map(normalizeStock);
  }, [stocks, stocksLoading]);

  const currentStock = fetchedStock || selectedStock;
  const normalizedDetail = currentStock ? normalizeStock(currentStock) : null;
  const analysis = currentStock?.analysis;
  const detailRows = normalizedDetail
    ? [
        ["Price", `₹${normalizedDetail.price}`],
        ["P/E", formatNumber(normalizedDetail.fundamentals.pe)],
        ["ROE", formatNumber(normalizedDetail.fundamentals.roe, "%")],
        ["Debt/Equity", formatNumber(normalizedDetail.fundamentals.debtToEquity)],
        ["Market Cap", `₹${formatNumber(normalizedDetail.fundamentals.marketCap)} cr`],
        ["Promoter", formatNumber(normalizedDetail.fundamentals.promoterHolding, "%")],
      ]
    : [];

  const selectFilter = (filterId) => {
    setActiveFilterId(filterId);
    setSelectedStock(null);
  };

  const hideDetail = () => {
    setSelectedStock(null);
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500&family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,900&display=swap');

        :root {
          --bg: #0a0a0a;
          --surface: #111111;
          --surface2: #1a1a1a;
          --border: #222222;
          --accent: #e8ff00;
          --accent2: #00ffb3;
          --red: #ff4545;
          --green: #00e887;
          --text: #f0f0f0;
          --muted: #666666;
        }

        * { box-sizing: border-box; }
        html { background: var(--bg); color: var(--text); }
        body {
          margin: 0;
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
        }
        a { color: inherit; text-decoration: none; }
        button { font: inherit; }
        #root { min-height: 100vh; }

        .app-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(232, 255, 0, 0.08), transparent 24%),
            linear-gradient(180deg, rgba(17, 17, 17, 0.4) 0%, rgba(10, 10, 10, 1) 18%);
        }

        .page { animation: fadeUp 0.3s ease; }
        .ticker-bar {
          background: var(--accent);
          color: #000;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 10px 0;
          overflow: hidden;
          border-bottom: 1px solid rgba(0, 0, 0, 0.18);
        }
        .ticker-live {
          margin-left: 24px;
          padding: 6px 10px;
          border-radius: 999px;
          background: #000;
          color: var(--accent);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ticker-track {
          display: flex;
          gap: 28px;
          min-width: max-content;
          animation: scrollTicker 30s linear infinite;
          padding-right: 28px;
        }
        .ticker-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-family: 'DM Mono', monospace;
          font-size: 13px;
          white-space: nowrap;
        }
        .ticker-symbol { font-weight: 500; }
        .ticker-change.up { color: #005d2f; }
        .ticker-change.down { color: #7a1010; }

        .header {
          position: sticky;
          top: 0;
          z-index: 10;
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 48px;
          background: rgba(10, 10, 10, 0.92);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid var(--border);
        }
        .logo {
          font-family: 'Playfair Display', serif;
          font-size: 32px;
          font-weight: 900;
          letter-spacing: -0.03em;
        }
        .logo-accent { color: var(--accent); }
        .nav {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .nav-link {
          color: var(--muted);
          transition: color 0.2s ease;
          font-size: 14px;
        }
        .nav-link:hover { color: var(--text); }
        .live-pill {
          border: 0;
          border-radius: 999px;
          background: var(--accent);
          color: #000;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
        }
        .exchange-pill {
          border: 1px solid var(--border);
          border-radius: 999px;
          background: transparent;
          color: var(--muted);
          padding: 9px 12px;
          cursor: pointer;
        }
        .exchange-pill.active {
          color: #000;
          background: var(--accent);
          border-color: var(--accent);
        }

        .hero {
          padding: 48px;
          border-bottom: 1px solid var(--border);
        }
        .eyebrow {
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--accent);
          margin-bottom: 20px;
        }
        .hero h1 {
          margin: 0;
          font-family: 'Playfair Display', serif;
          font-size: clamp(48px, 7vw, 64px);
          line-height: 0.95;
          letter-spacing: -0.04em;
          max-width: 760px;
        }
        .hero h1 em {
          color: var(--accent);
          font-style: italic;
          font-weight: 900;
        }
        .hero-stats {
          display: flex;
          gap: 1px;
          background: var(--border);
          margin-top: 34px;
          max-width: 840px;
        }
        .hero-stat {
          background: #000;
          min-width: 160px;
          padding: 16px;
        }
        .hero-stat span {
          display: block;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          margin-bottom: 8px;
        }
        .hero-stat strong {
          font-family: 'DM Mono', monospace;
          font-size: 18px;
          font-weight: 500;
        }

        .chip-row {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 24px 48px 18px;
          scrollbar-width: none;
        }
        .chip-row::-webkit-scrollbar { display: none; }
        .chip {
          border: 1px solid var(--border);
          background: transparent;
          color: var(--muted);
          padding: 10px 16px;
          border-radius: 999px;
          white-space: nowrap;
          cursor: pointer;
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
        }
        .chip:hover,
        .chip.active {
          background: var(--accent);
          color: #000;
          border-color: var(--accent);
        }

        .grid-wrap { padding: 0 48px 48px; }
        .screen-note {
          margin: 0 0 18px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
          max-width: 720px;
        }
        .news-grid {
          display: grid;
          grid-template-columns: repeat(12, minmax(0, 1fr));
          gap: 1px;
          background: var(--border);
        }
        .news-card {
          position: relative;
          background: #000;
          padding: 28px;
          min-height: 240px;
          cursor: pointer;
          transition: background 0.25s ease, transform 0.25s ease;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          overflow: hidden;
        }
        .news-card:hover { background: var(--surface); }
        .news-card:hover .card-arrow {
          opacity: 1;
          transform: translate(0, 0);
        }
        .featured {
          grid-column: span 5;
          grid-row: span 2;
          min-height: 100%;
        }
        .wide { grid-column: span 7; }
        .mid { grid-column: span 4; }
        .small { grid-column: span 3; }
        .illustration-box {
          height: 180px;
          border: 1px solid rgba(232, 255, 0, 0.12);
          background:
            radial-gradient(circle at 30% 20%, rgba(232, 255, 0, 0.2), transparent 35%),
            linear-gradient(135deg, rgba(26, 26, 26, 1), rgba(17, 17, 17, 1));
          display: grid;
          place-items: center;
          font-family: 'DM Mono', monospace;
          font-size: 42px;
          margin-bottom: 24px;
        }
        .card-arrow {
          position: absolute;
          top: 22px;
          right: 22px;
          color: var(--accent);
          font-size: 22px;
          opacity: 0;
          transform: translate(10px, -10px);
          transition: opacity 0.25s ease, transform 0.25s ease;
        }
        .tag-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 16px;
        }
        .tag-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent);
        }
        .tag-dot.red { background: var(--red); }
        .tag-dot.green { background: var(--green); }
        .news-card h2,
        .news-card h3 {
          margin: 0 0 16px;
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          line-height: 1.06;
        }
        .featured h2 { font-size: 40px; }
        .wide h3 { font-size: 34px; }
        .mid h3 { font-size: 28px; }
        .small h3 { font-size: 22px; }
        .summary {
          margin: 0 0 22px;
          color: var(--muted);
          font-size: 13px;
          line-height: 1.6;
          max-width: 96%;
        }
        .badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: auto;
          margin-bottom: 18px;
        }
        .stock-badge {
          border-radius: 999px;
          padding: 7px 10px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .stock-badge.up {
          background: rgba(0, 232, 135, 0.12);
          color: var(--green);
        }
        .stock-badge.down {
          background: rgba(255, 69, 69, 0.12);
          color: var(--red);
        }
        .meta {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.02em;
        }

        .error-banner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: 0 48px 20px;
          padding: 14px 16px;
          background: rgba(255, 69, 69, 0.1);
          border-left: 3px solid var(--red);
          color: #ffb1b1;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
        }
        .error-banner button {
          border: 1px solid rgba(255, 69, 69, 0.25);
          background: transparent;
          color: var(--text);
          border-radius: 999px;
          padding: 8px 12px;
          cursor: pointer;
        }
        .skeleton-card,
        .skeleton-line,
        .skeleton-pill,
        .skeleton-chart,
        .skeleton-block {
          position: relative;
          overflow: hidden;
          background: #1a1a1a;
        }
        .skeleton-card { background: var(--surface); }
        .skeleton-line::after,
        .skeleton-pill::after,
        .skeleton-chart::after,
        .skeleton-block::after {
          content: "";
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #1a1a1a 0%, #222222 50%, #1a1a1a 100%);
          transform: translateX(-100%);
          animation: shimmer 1.6s infinite;
        }
        .skeleton-tag {
          width: 110px;
          height: 10px;
          margin-bottom: 18px;
        }
        .skeleton-title {
          width: 92%;
          height: 30px;
          margin-bottom: 12px;
        }
        .skeleton-title.short { width: 70%; }
        .skeleton-copy {
          width: 100%;
          height: 12px;
          margin-bottom: 10px;
        }
        .skeleton-copy.short { width: 76%; }
        .skeleton-meta {
          width: 90px;
          height: 10px;
        }
        .skeleton-meta.short { width: 60px; }
        .skeleton-pill {
          display: inline-block;
          width: 88px;
          height: 26px;
          border-radius: 999px;
        }
        .stock-skeleton-row { cursor: default; }
        .skeleton-stock-id {
          width: 94px;
          height: 12px;
          margin-bottom: 8px;
        }
        .skeleton-stock-name {
          width: 120px;
          height: 10px;
          margin-bottom: 10px;
        }
        .skeleton-impact {
          width: 66px;
          height: 20px;
        }
        .skeleton-chart {
          width: 60px;
          height: 28px;
        }
        .skeleton-price {
          width: 68px;
          height: 12px;
          margin-left: auto;
          margin-bottom: 8px;
        }
        .skeleton-change {
          width: 52px;
          height: 10px;
          margin-left: auto;
        }
        .empty-state {
          background: #000;
          border: 1px solid var(--border);
          padding: 36px;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .detail-view { padding: 36px 48px 56px; }
        .back-button {
          border: 0;
          background: transparent;
          color: var(--muted);
          padding: 0;
          margin-bottom: 28px;
          cursor: pointer;
          font-size: 15px;
        }
        .detail-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 360px;
          gap: 36px;
          align-items: start;
        }
        .article-tag {
          font-family: 'DM Mono', monospace;
          color: var(--accent);
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          margin-bottom: 18px;
        }
        .article h1 {
          margin: 0 0 24px;
          font-family: 'Playfair Display', serif;
          font-size: clamp(36px, 5vw, 42px);
          line-height: 1;
          letter-spacing: -0.03em;
          max-width: 760px;
        }
        .byline {
          border-top: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          padding: 12px 0;
          margin-bottom: 28px;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .article-body {
          max-width: 720px;
        }
        .article-body p {
          margin: 0 0 20px;
          color: #cccccc;
          font-size: 16px;
          line-height: 1.8;
        }
        .article-body p:first-child {
          color: #ffffff;
          font-size: 18px;
          font-weight: 300;
        }
        .pull-quote {
          border-left: 3px solid var(--accent);
          padding-left: 24px;
          margin: 34px 0;
          font-family: 'Playfair Display', serif;
          font-style: italic;
          font-size: 20px;
          color: var(--text);
        }
        .sidebar {
          position: sticky;
          top: 88px;
          background: var(--surface);
          border: 1px solid var(--border);
        }
        .sidebar-header {
          padding: 20px 20px 14px;
          border-bottom: 1px solid var(--border);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .sidebar-header span { color: var(--accent); }
        .stock-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 72px auto;
          gap: 12px;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
        }
        .stock-id {
          font-family: 'DM Mono', monospace;
          font-size: 14px;
          font-weight: 500;
          margin-bottom: 4px;
        }
        .stock-name {
          color: var(--muted);
          font-size: 11px;
          margin-bottom: 8px;
        }
        .impact {
          display: inline-flex;
          width: fit-content;
          border-radius: 999px;
          padding: 5px 9px;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border: 1px solid transparent;
        }
        .impact.high {
          background: rgba(255, 69, 69, 0.15);
          color: var(--red);
          border-color: rgba(255, 69, 69, 0.28);
        }
        .impact.medium {
          background: rgba(232, 255, 0, 0.1);
          color: var(--accent);
          border-color: rgba(232, 255, 0, 0.18);
        }
        .impact.low {
          background: rgba(0, 232, 135, 0.12);
          color: var(--green);
          border-color: rgba(0, 232, 135, 0.2);
        }
        .price-box {
          text-align: right;
          font-family: 'DM Mono', monospace;
        }
        .price-box .price {
          font-size: 14px;
          margin-bottom: 4px;
        }
        .price-box .change.up { color: var(--green); }
        .price-box .change.down { color: var(--red); }
        .stock-skeleton-note {
          padding: 16px 20px 20px;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }
        .metric-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1px;
          background: var(--border);
          margin-top: 28px;
          max-width: 720px;
        }
        .metric {
          background: #000;
          padding: 18px;
        }
        .metric span {
          display: block;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 8px;
        }
        .metric strong {
          font-family: 'DM Mono', monospace;
          font-size: 17px;
          font-weight: 500;
        }

        @keyframes scrollTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          from { transform: translateX(-100%); }
          to { transform: translateX(100%); }
        }

        @media (max-width: 900px) {
          .header {
            height: auto;
            min-height: 64px;
            padding: 12px 20px;
            gap: 14px;
            align-items: flex-start;
            flex-direction: column;
          }
          .nav {
            flex-wrap: wrap;
            gap: 8px;
          }
          .nav-link { display: none; }
          .hero,
          .chip-row,
          .grid-wrap,
          .detail-view {
            padding-left: 20px;
            padding-right: 20px;
          }
          .error-banner {
            margin-left: 20px;
            margin-right: 20px;
          }
          .hero-stats {
            overflow-x: auto;
          }
          .news-grid {
            grid-template-columns: repeat(6, minmax(0, 1fr));
          }
          .featured,
          .wide,
          .mid,
          .small {
            grid-column: span 6;
            grid-row: auto;
          }
          .detail-layout { grid-template-columns: 1fr; }
          .sidebar { position: static; }
          .metric-list { grid-template-columns: 1fr; }
          .ticker-live { margin-left: 12px; }
        }
      `}</style>

      <div className="app-shell">
        <div className="ticker-bar">
          <div className="ticker-live">LIVE</div>
          <div className="ticker-track">
            {[...normalizedTickerStocks, ...normalizedTickerStocks].map((item, index) => (
              <div className="ticker-item" key={`${item.ticker}-${index}`}>
                <span className="ticker-symbol">{item.ticker}</span>
                <span>₹{item.price}</span>
                <span className={`ticker-change ${item.dir}`}>
                  {item.dir === "up" ? "▲" : "▼"} {item.change}
                </span>
              </div>
            ))}
          </div>
        </div>

        <header className="header">
          <div className="logo">
            <span>Price</span>
            <span className="logo-accent">Effect</span>
          </div>

          <nav className="nav">
            {exchanges.map((item) => (
              <button
                key={item}
                className={`exchange-pill ${exchange === item ? "active" : ""}`}
                type="button"
                onClick={() => setExchange(item)}
              >
                {item}
              </button>
            ))}
            <button className="live-pill" type="button" onClick={retryStocks}>Refresh</button>
          </nav>
        </header>

        {!selectedStock ? (
          <main className="page">
            <section className="hero">
              <div className="eyebrow">{formatDisplayDate()} · Indian Equity Screens</div>
              <h1>
                Markets move on
                <br />
                <em>signals.</em>
              </h1>

              <div className="hero-stats">
                <div className="hero-stat">
                  <span>Total stocks</span>
                  <strong>{formatNumber(status?.totalStocks)}</strong>
                </div>
                <div className="hero-stat">
                  <span>Matched now</span>
                  <strong>{formatNumber(meta?.count ?? stocks.length)}</strong>
                </div>
                <div className="hero-stat">
                  <span>AI provider</span>
                  <strong>{meta?.aiProvider || status?.aiProvider || "none"}</strong>
                </div>
                <div className="hero-stat">
                  <span>Data date</span>
                  <strong>{meta?.dataDate || status?.lastDataDate || "n/a"}</strong>
                </div>
              </div>
            </section>

            <div className="chip-row">
              {displayFilters.map((filter) => (
                <button
                  key={filter.id}
                  className={`chip ${activeFilter?.id === filter.id ? "active" : ""}`}
                  type="button"
                  onClick={() => selectFilter(filter.id)}
                  title={getFilterDescription(filter)}
                >
                  {getFilterLabel(filter)}
                </button>
              ))}
            </div>

            {filtersError ? <ErrorBanner message={filtersError} onRetry={retryFilters} /> : null}
            {stocksError ? <ErrorBanner message={stocksError} onRetry={retryStocks} /> : null}
            {statusError ? <ErrorBanner message={statusError} /> : null}

            <section className="grid-wrap">
              <p className="screen-note">
                {filtersLoading ? "Loading available stock screens..." : getFilterDescription(activeFilter)}
              </p>

              {stocksLoading ? (
                <LoadingGrid />
              ) : stocks.length > 0 ? (
                <div className="news-grid">
                  {stocks.map((stock, index) => (
                    <StockCard
                      key={`${stock.symbol}-${stock.exchange}-${index}`}
                      stock={stock}
                      index={index}
                      onSelect={setSelectedStock}
                    />
                  ))}
                </div>
              ) : (
                <div className="empty-state">No stocks matched this screen. Choose All Stocks to see the loaded universe.</div>
              )}
            </section>
          </main>
        ) : (
          <main className="page detail-view">
            <button className="back-button" type="button" onClick={hideDetail}>
              ← Back to Screens
            </button>

            {detailError ? <ErrorBanner message={detailError} onRetry={retryDetail} /> : null}

            {normalizedDetail ? (
              <div className="detail-layout">
                <article className="article">
                  <div className="article-tag">{normalizedDetail.ticker}</div>
                  <h1>{normalizedDetail.name}</h1>
                  <div className="byline">
                    {normalizedDetail.exchange || "BOTH"} · {activeFilter?.name || "Stock screen"} ·{" "}
                    {detailLoading ? "Refreshing AI analysis" : "Latest backend data"}
                  </div>

                  <div className="article-body">
                    <p>
                    {normalizedDetail.name} is trading at ₹{normalizedDetail.price}, with a 30-day move of{" "}
                      {normalizedDetail.change}. The backend screen currently tags it through {getFilterLabel(activeFilter) || "the selected filter"}.
                    </p>
                    <p>
                      Fundamentals show P/E {formatNumber(normalizedDetail.fundamentals.pe)}, ROE{" "}
                      {formatNumber(normalizedDetail.fundamentals.roe, "%")}, debt/equity{" "}
                      {formatNumber(normalizedDetail.fundamentals.debtToEquity)}, and promoter holding{" "}
                      {formatNumber(normalizedDetail.fundamentals.promoterHolding, "%")}.
                    </p>

                    {analysis?.opportunity ? <p>{analysis.opportunity}</p> : null}
                    {analysis?.risks?.length ? <p>Risks: {analysis.risks.join(", ")}.</p> : null}

                    <div className="pull-quote">
                      {analysis?.verdictReason || analysis?.keyMetric || "AI analysis will appear here when the backend returns it."}
                    </div>

                    <div className="metric-list">
                      {detailRows.map(([label, value]) => (
                        <div className="metric" key={label}>
                          <span>{label}</span>
                          <strong>{value}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>

                {detailLoading ? (
                  <StockSkeleton />
                ) : (
                  <aside className="sidebar">
                    <div className="sidebar-header">
                      Backend Analysis <span>{analysis?.verdict || "Live"}</span>
                    </div>

                    <div className="stock-row">
                      <div>
                        <div className="stock-id">{normalizedDetail.ticker}</div>
                        <div className="stock-name">{analysis?.confidence ? `${analysis.confidence} confidence` : "Current screen match"}</div>
                        <div className={`impact ${normalizedDetail.impact}`}>{normalizedDetail.impact}</div>
                      </div>

                      <Sparkline values={normalizedDetail.sparks} dir={normalizedDetail.dir} />

                      <div className="price-box">
                        <div className="price">₹{normalizedDetail.price}</div>
                        <div className={`change ${normalizedDetail.dir === "up" ? "up" : "down"}`}>
                          {normalizedDetail.dir === "up" ? "▲" : "▼"} {normalizedDetail.change}
                        </div>
                      </div>
                    </div>

                    <div className="stock-skeleton-note">
                      {analysis?.priceTarget ? `Target ${analysis.priceTarget}` : "Open a stock to run the backend deep dive."}
                    </div>
                  </aside>
                )}
              </div>
            ) : (
              <section className="grid-wrap">
                <LoadingGrid />
              </section>
            )}
          </main>
        )}
      </div>
    </>
  );
}

export default App;
