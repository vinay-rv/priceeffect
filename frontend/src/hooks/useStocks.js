import { useEffect, useState } from "react";
import { api } from "../api";

export function useStocks() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadStocks = async (preserveError = false) => {
      try {
        const data = await api.getStocks();
        if (!cancelled) {
          setStocks(data.data);
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
  }, [reloadKey]);

  return {
    stocks,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
