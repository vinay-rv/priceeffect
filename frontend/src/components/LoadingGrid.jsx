const skeletonItems = Array.from({ length: 8 }, (_, index) => index);

export default function LoadingGrid() {
  return (
    <div className="news-grid">
      {skeletonItems.map((item) => (
        <article key={item} className="news-card skeleton-card">
          <div>
            <div className="skeleton-line skeleton-tag"></div>
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-title short"></div>
            <div className="skeleton-line skeleton-copy"></div>
            <div className="skeleton-line skeleton-copy short"></div>
          </div>

          <div>
            <div className="badges">
              <span className="skeleton-pill"></span>
              <span className="skeleton-pill"></span>
            </div>
            <div className="meta">
              <span className="skeleton-line skeleton-meta"></span>
              <span className="skeleton-line skeleton-meta short"></span>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
