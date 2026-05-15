import { useEffect, useState } from "react";
import { api } from "../api";

const fallbackFilters = [
  { id: "52-low", name: "52 Week Low", description: "Stocks trading close to their 52-week low." },
  { id: "good-pe", name: "Good P/E", description: "Profitable stocks with reasonable valuation." },
  { id: "undervalued", name: "Undervalued", description: "Low P/E, healthy ROE, and low debt." },
];

export function useFilters() {
  const [filters, setFilters] = useState(fallbackFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    api
      .getFilters()
      .then((data) => {
        if (!cancelled && Array.isArray(data.data) && data.data.length > 0) {
          setFilters(data.data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
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
  }, [reloadKey]);

  return {
    filters,
    loading,
    error,
    retry: () => setReloadKey((key) => key + 1),
  };
}
