import { useEffect, useState } from "react";
import { api } from "../api";

export function useNews(category = "") {
  const [news, setNews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getNews(category)
      .then((data) => {
        if (!cancelled) {
          setNews(data.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setNews([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category, reloadKey]);

  return {
    news,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
