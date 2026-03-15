export default function StockSkeleton() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        Stocks Affected <span>...</span>
      </div>

      {[0, 1, 2, 3, 4].map((item) => (
        <div className="stock-row stock-skeleton-row" key={item}>
          <div>
            <div className="skeleton-line skeleton-stock-id"></div>
            <div className="skeleton-line skeleton-stock-name"></div>
            <div className="skeleton-pill skeleton-impact"></div>
          </div>
          <div className="skeleton-chart"></div>
          <div className="price-box">
            <div className="skeleton-line skeleton-price"></div>
            <div className="skeleton-line skeleton-change"></div>
          </div>
        </div>
      ))}

      <div className="stock-skeleton-note">Analysing article with AI...</div>
    </div>
  );
}
