import { useEffect, useState } from "react";
import { api } from "../api";

export function useStockDetail(stock) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(Boolean(stock?.symbol));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!stock?.symbol) {
      setDetail(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getStock(stock.symbol, { exchange: stock.exchange || "BOTH", ai: true })
      .then((data) => {
        if (!cancelled) {
          setDetail(data.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setDetail(null);
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
  }, [stock?.exchange, stock?.symbol, reloadKey]);

  return {
    detail,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
