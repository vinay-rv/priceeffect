const BASE = import.meta.env.VITE_API_URL || "/api";

const handleResponse = async (res) => {
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "API error");
  }

  return data;
};

export const api = {
  getNews: async (category = "", limit = 20) => {
    const params = new URLSearchParams();
    if (category) {
      params.append("category", category);
    }
    params.append("limit", String(limit));

    const res = await fetch(`${BASE}/news?${params.toString()}`);
    return handleResponse(res);
  },

  getArticle: async (id) => {
    const res = await fetch(`${BASE}/news/${encodeURIComponent(id)}`);
    return handleResponse(res);
  },

  searchNews: async (query) => {
    const res = await fetch(`${BASE}/news/search?q=${encodeURIComponent(query)}`);
    return handleResponse(res);
  },

  getStocks: async () => {
    const res = await fetch(`${BASE}/stocks`);
    return handleResponse(res);
  },

  getStock: async (ticker) => {
    const res = await fetch(`${BASE}/stocks/${encodeURIComponent(ticker)}`);
    return handleResponse(res);
  },
};
