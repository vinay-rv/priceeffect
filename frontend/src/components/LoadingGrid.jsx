const skeletonLayout = ["featured", "wide", "mid", "mid", "small", "small"];

export default function LoadingGrid() {
  return (
    <div className="news-grid">
      {skeletonLayout.map((layout, index) => (
        <article key={`${layout}-${index}`} className={`news-card ${layout} skeleton-card`}>
          <div>
            {layout === "featured" ? <div className="illustration-box skeleton-block"></div> : null}
            <div className="skeleton-line skeleton-tag"></div>
            <div className="skeleton-line skeleton-title"></div>
            <div className="skeleton-line skeleton-title short"></div>
            {layout !== "small" ? (
              <>
                <div className="skeleton-line skeleton-copy"></div>
                <div className="skeleton-line skeleton-copy short"></div>
              </>
            ) : null}
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
