import { useMemo, useState } from "react";
import ErrorBanner from "./components/ErrorBanner.jsx";
import LoadingGrid from "./components/LoadingGrid.jsx";
import StockSkeleton from "./components/StockSkeleton.jsx";
import { useArticle } from "./hooks/useArticle.js";
import { useNews } from "./hooks/useNews.js";
import { useStocks } from "./hooks/useStocks.js";
import { normalizeArticle, normalizeStock } from "./utils/normalize.js";

const filters = [
  { label: "All", category: "" },
  { label: "🔴 Breaking", category: "Breaking" },
  { label: "📈 Bullish", category: "Bullish" },
  { label: "📉 Bearish", category: "Bearish" },
  { label: "🤖 Tech", category: "Tech" },
  { label: "🏦 Finance", category: "Finance" },
  { label: "⚡ Energy", category: "Energy" },
  { label: "💊 Health", category: "Health" },
];

const placeholderTickers = [
  { ticker: "RELIANCE.NS", price: "2,948.55", change: "+0.86%", dir: "up" },
  { ticker: "TCS.NS", price: "4,176.20", change: "+2.34%", dir: "up" },
  { ticker: "HDFCBANK.NS", price: "1,612.40", change: "+1.28%", dir: "up" },
  { ticker: "INFY.NS", price: "1,721.65", change: "-0.62%", dir: "down" },
];

const formatDisplayDate = () =>
  new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());

function Sparkline({ values, dir }) {
  const points = values
    .map((value, index) => {
      const x = (index / Math.max(1, values.length - 1)) * 60;
      const y = 28 - ((value - 15) / 45) * 24;
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

function App() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [selectedArticleId, setSelectedArticleId] = useState(null);
  const [selectedPreview, setSelectedPreview] = useState(null);

  const selectedFilter = filters.find((filter) => filter.label === activeFilter) || filters[0];
  const { news, loading: newsLoading, error: newsError, retry: retryNews } = useNews(
    selectedFilter.category,
  );
  const {
    stocks,
    loading: stocksLoading,
    error: stocksError,
    retry: retryStocks,
  } = useStocks();
  const {
    article: fetchedArticle,
    affectedStocks,
    loading: articleLoading,
    error: articleError,
    retry: retryArticle,
  } = useArticle(selectedArticleId);

  const normalizedNews = useMemo(
    () => news.map((article, index) => normalizeArticle(article, index)),
    [news],
  );

  const currentArticle = useMemo(() => {
    if (fetchedArticle) {
      return normalizeArticle(fetchedArticle, 0);
    }

    return selectedPreview;
  }, [fetchedArticle, selectedPreview]);

  const normalizedTickerStocks = useMemo(() => {
    if (stocksLoading || stocks.length === 0) {
      return placeholderTickers;
    }

    return stocks.map(normalizeStock);
  }, [stocks, stocksLoading]);

  const normalizedAffectedStocks = useMemo(
    () => affectedStocks.map(normalizeStock),
    [affectedStocks],
  );

  const relatedStories = useMemo(() => {
    if (!currentArticle) {
      return [];
    }

    return normalizedNews.filter((item) => item.id !== currentArticle.id).slice(0, 3);
  }, [currentArticle, normalizedNews]);

  const showDetail = (article) => {
    setSelectedPreview(article);
    setSelectedArticleId(article.id);
  };

  const hideDetail = () => {
    setSelectedArticleId(null);
    setSelectedPreview(null);
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

        * {
          box-sizing: border-box;
        }

        html {
          background: var(--bg);
          color: var(--text);
        }

        body {
          margin: 0;
          font-family: 'DM Sans', sans-serif;
          background: var(--bg);
          color: var(--text);
        }

        a {
          color: inherit;
          text-decoration: none;
        }

        button {
          font: inherit;
        }

        #root {
          min-height: 100vh;
        }

        .app-shell {
          min-height: 100vh;
          background:
            radial-gradient(circle at top right, rgba(232, 255, 0, 0.08), transparent 24%),
            linear-gradient(180deg, rgba(17, 17, 17, 0.4) 0%, rgba(10, 10, 10, 1) 18%);
        }

        .page {
          animation: fadeUp 0.3s ease;
        }

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

        .ticker-symbol {
          font-weight: 500;
        }

        .ticker-change.up {
          color: #005d2f;
        }

        .ticker-change.down {
          color: #7a1010;
        }

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

        .logo-accent {
          color: var(--accent);
        }

        .nav {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .nav-link {
          color: var(--muted);
          transition: color 0.2s ease;
          font-size: 14px;
        }

        .nav-link:hover {
          color: var(--text);
        }

        .live-pill {
          border: 0;
          border-radius: 999px;
          background: var(--accent);
          color: #000;
          padding: 10px 16px;
          font-weight: 500;
          cursor: pointer;
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

        .chip-row {
          display: flex;
          gap: 12px;
          overflow-x: auto;
          padding: 24px 48px 18px;
          scrollbar-width: none;
        }

        .chip-row::-webkit-scrollbar {
          display: none;
        }

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

        .grid-wrap {
          padding: 0 48px 48px;
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

        .news-card:hover {
          background: var(--surface);
        }

        .news-card:hover .card-arrow {
          opacity: 1;
          transform: translate(0, 0);
        }

        .featured {
          grid-column: span 5;
          grid-row: span 2;
          min-height: 100%;
        }

        .wide {
          grid-column: span 7;
        }

        .mid {
          grid-column: span 4;
        }

        .small {
          grid-column: span 3;
        }

        .illustration-box {
          height: 180px;
          border: 1px solid rgba(232, 255, 0, 0.12);
          background:
            radial-gradient(circle at 30% 20%, rgba(232, 255, 0, 0.2), transparent 35%),
            linear-gradient(135deg, rgba(26, 26, 26, 1), rgba(17, 17, 17, 1));
          display: grid;
          place-items: center;
          font-size: 64px;
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

        .tag-dot.red {
          background: var(--red);
        }

        .tag-dot.green {
          background: var(--green);
        }

        .news-card h2,
        .news-card h3 {
          margin: 0 0 16px;
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          line-height: 1.06;
        }

        .featured h2 {
          font-size: 40px;
        }

        .wide h3 {
          font-size: 34px;
        }

        .mid h3 {
          font-size: 28px;
        }

        .small h3 {
          font-size: 22px;
        }

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

        .skeleton-card {
          background: var(--surface);
        }

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

        .skeleton-title.short {
          width: 70%;
        }

        .skeleton-copy {
          width: 100%;
          height: 12px;
          margin-bottom: 10px;
        }

        .skeleton-copy.short {
          width: 76%;
        }

        .skeleton-meta {
          width: 90px;
          height: 10px;
        }

        .skeleton-meta.short {
          width: 60px;
        }

        .skeleton-pill {
          display: inline-block;
          width: 88px;
          height: 26px;
          border-radius: 999px;
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

        .detail-view {
          padding: 36px 48px 56px;
        }

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

        .article-link {
          display: inline-block;
          margin: -6px 0 24px;
          color: var(--accent);
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .article-body {
          max-width: 680px;
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

        .sidebar-header span {
          color: var(--accent);
        }

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

        .price-box .change.up {
          color: var(--green);
        }

        .price-box .change.down {
          color: var(--red);
        }

        .stock-skeleton-row {
          cursor: default;
        }

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

        .stock-skeleton-note {
          padding: 16px 20px 20px;
          color: var(--muted);
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.06em;
          text-transform: uppercase;
        }

        .related {
          margin-top: 54px;
        }

        .related h2 {
          margin: 0 0 18px;
          font-family: 'Playfair Display', serif;
          font-size: 20px;
          font-weight: 700;
        }

        .related-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1px;
          background: var(--border);
        }

        .related-card {
          background: #000;
          padding: 24px;
          cursor: pointer;
        }

        .related-card h3 {
          font-family: 'Playfair Display', serif;
          margin: 0 0 14px;
          font-size: 24px;
          line-height: 1.08;
        }

        @keyframes scrollTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes shimmer {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @media (max-width: 900px) {
          .header {
            padding: 0 20px;
          }

          .nav {
            gap: 14px;
          }

          .nav-link:nth-child(n + 3) {
            display: none;
          }

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

          .detail-layout {
            grid-template-columns: 1fr;
          }

          .sidebar {
            position: static;
          }

          .related-grid {
            grid-template-columns: 1fr;
          }

          .ticker-live {
            margin-left: 12px;
          }
        }
      `}</style>

      <div className="app-shell">
        <div className="ticker-bar">
          <div className="ticker-live">LIVE</div>
          <div className="ticker-track">
            {[...normalizedTickerStocks, ...normalizedTickerStocks].map((item, index) => (
              <div className="ticker-item" key={`${item.ticker}-${index}`}>
                <span className="ticker-symbol">{item.ticker}</span>
                <span>{item.price}</span>
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
            <span className="logo-accent">Affect</span>
          </div>

          <nav className="nav">
            <a className="nav-link" href="#markets">Markets</a>
            <a className="nav-link" href="#tech">Tech</a>
            <a className="nav-link" href="#economy">Economy</a>
            <a className="nav-link" href="#commodities">Commodities</a>
            <button className="live-pill" type="button">⚡ Live</button>
          </nav>
        </header>

        {!selectedArticleId ? (
          <main className="page">
            <section className="hero">
              <div className="eyebrow">{formatDisplayDate()} • Markets Open</div>
              <h1>
                Markets move on
                <br />
                <em>stories.</em>
              </h1>
            </section>

            <div className="chip-row">
              {filters.map((filter) => (
                <button
                  key={filter.label}
                  className={`chip ${activeFilter === filter.label ? "active" : ""}`}
                  type="button"
                  onClick={() => setActiveFilter(filter.label)}
                >
                  {filter.label}
                </button>
              ))}
            </div>

            {newsError ? <ErrorBanner message={newsError} onRetry={retryNews} /> : null}
            {stocksError ? <ErrorBanner message={stocksError} onRetry={retryStocks} /> : null}

            <section className="grid-wrap">
              {newsLoading ? (
                <LoadingGrid />
              ) : normalizedNews.length > 0 ? (
                <div className="news-grid">
                  {normalizedNews.map((item) => (
                    <article
                      key={item.id}
                      className={`news-card ${item.category}`}
                      onClick={() => showDetail(item)}
                    >
                      <div className="card-arrow">↗</div>

                      <div>
                        {item.category === "featured" ? (
                          <div className="illustration-box">{item.emoji}</div>
                        ) : null}

                        <div className="tag-row">
                          <span className={`tag-dot ${item.tagClass}`}></span>
                          <span>{item.tag}</span>
                        </div>

                        {item.category === "featured" ? (
                          <h2>{item.headline}</h2>
                        ) : (
                          <h3>{item.headline}</h3>
                        )}

                        {item.category !== "small" ? (
                          <p className="summary">{item.summary}</p>
                        ) : null}
                      </div>

                      <div>
                        <div className="badges">
                          {normalizedTickerStocks.slice(0, item.category === "featured" ? 3 : 2).map((stock) => (
                            <span
                              key={`${item.id}-${stock.ticker}`}
                              className={`stock-badge ${stock.dir === "up" ? "up" : "down"}`}
                            >
                              {stock.ticker} {stock.change}
                            </span>
                          ))}
                        </div>

                        <div className="meta">
                          <span>{item.source}</span>
                          <span>{item.time}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No stories matched this filter.</div>
              )}
            </section>
          </main>
        ) : (
          <main className="page detail-view">
            <button className="back-button" type="button" onClick={hideDetail}>
              ← Back to News Feed
            </button>

            {articleError ? <ErrorBanner message={articleError} onRetry={retryArticle} /> : null}
            {stocksError ? <ErrorBanner message={stocksError} onRetry={retryStocks} /> : null}

            {currentArticle ? (
              <div className="detail-layout">
                <article className="article">
                  <div className="article-tag">{currentArticle.tag}</div>
                  <h1>{currentArticle.headline}</h1>
                  <div className="byline">
                    {currentArticle.source} · {formatDisplayDate()} · 6 min read
                  </div>

                  {currentArticle.url ? (
                    <a
                      className="article-link"
                      href={currentArticle.url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Read full article →
                    </a>
                  ) : null}

                  <div className="article-body">
                    {currentArticle.body.map((paragraph, index) => (
                      <p key={`${currentArticle.id}-p-${index}`}>{paragraph}</p>
                    ))}

                    <div className="pull-quote">{currentArticle.quote}</div>
                  </div>
                </article>

                {articleLoading ? (
                  <StockSkeleton />
                ) : (
                  <aside className="sidebar">
                    <div className="sidebar-header">
                      Stocks Affected <span>{normalizedAffectedStocks.length}</span>
                    </div>

                    {normalizedAffectedStocks.length > 0 ? (
                      normalizedAffectedStocks.map((stock) => (
                        <div className="stock-row" key={`${currentArticle.id}-${stock.ticker}-detail`}>
                          <div>
                            <div className="stock-id">{stock.ticker}</div>
                            <div className="stock-name">{stock.name}</div>
                            <div className={`impact ${stock.impact}`}>{stock.impact}</div>
                          </div>

                          <Sparkline values={stock.sparks} dir={stock.dir} />

                          <div className="price-box">
                            <div className="price">{stock.price}</div>
                            <div className={`change ${stock.dir === "up" ? "up" : "down"}`}>
                              {stock.dir === "up" ? "▲" : "▼"} {stock.change}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="stock-skeleton-note">No directly affected stocks identified yet.</div>
                    )}
                  </aside>
                )}
              </div>
            ) : (
              <section className="grid-wrap">
                <LoadingGrid />
              </section>
            )}

            {currentArticle ? (
              <section className="related">
                <h2>Related Stories</h2>
                <div className="related-grid">
                  {relatedStories.map((item) => (
                    <article
                      key={`related-${item.id}`}
                      className="related-card"
                      onClick={() => showDetail(item)}
                    >
                      <div className="tag-row">
                        <span className={`tag-dot ${item.tagClass}`}></span>
                        <span>{item.tag}</span>
                      </div>
                      <h3>{item.headline}</h3>
                      <p className="summary">{item.summary}</p>
                      <div className="meta">
                        <span>{item.source}</span>
                        <span>{item.time}</span>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </main>
        )}
      </div>
    </>
  );
}

export default App;
