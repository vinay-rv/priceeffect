import { useEffect, useState } from "react";
import { api } from "../api";

export function useStocks(options = {}) {
  const { filter = "52-low", exchange = "BOTH", limit = 20, params = {} } = options;
  const [stocks, setStocks] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadStocks = async (preserveError = false) => {
      try {
        const data = await api.getStocks({ filter, exchange, limit, ai: false, params });
        if (!cancelled) {
          setStocks(data.data || []);
          setMeta(data);
          if (!preserveError) {
            setError(null);
          }
        }
      } catch (err) {
        if (!cancelled && !preserveError) {
          setError(err.message);
        }
      } finally {
        if (!cancelled && !preserveError) {
          setLoading(false);
        }
      }
    };

    setLoading(true);
    setError(null);
    loadStocks();

    const interval = setInterval(() => {
      loadStocks(true);
    }, 60000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [exchange, filter, limit, params, reloadKey]);

  return {
    stocks,
    meta,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
