import { useEffect, useState } from "react";
import { api } from "../api";

export function useArticle(id) {
  const [article, setArticle] = useState(null);
  const [affectedStocks, setAffectedStocks] = useState([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!id) {
      setArticle(null);
      setAffectedStocks([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getArticle(id)
      .then((data) => {
        if (!cancelled) {
          setArticle(data.data.article);
          setAffectedStocks(data.data.affectedStocks);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setAffectedStocks([]);
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
  }, [id, reloadKey]);

  return {
    article,
    affectedStocks,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
