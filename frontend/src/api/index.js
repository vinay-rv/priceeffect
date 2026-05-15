const BASE = import.meta.env.VITE_API_URL || "/api/v1";

const apiKey = import.meta.env.VITE_API_KEY;
const aiProvider = import.meta.env.VITE_AI_PROVIDER;
const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;

const buildHeaders = (extra = {}) => {
  const headers = { ...extra };
  if (apiKey) headers["X-API-Key"] = apiKey;
  if (aiProvider) headers["X-AI-Provider"] = aiProvider;
  if (geminiKey) headers["X-Gemini-Key"] = geminiKey;
  return headers;
};

const buildQuery = (params = {}) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `?${queryString}` : "";
};

const handleResponse = async (res) => {
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.success) {
    throw new Error(data.error || `API error (${res.status})`);
  }

  return data;
};

export const api = {
  getStatus: async () => {
    const res = await fetch(`${BASE}/status`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  getFilters: async () => {
    const res = await fetch(`${BASE}/filters`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  getStocks: async ({ filter = "52-low", exchange = "BOTH", limit = 20, ai = false, params = {} } = {}) => {
    const query = buildQuery({
      filter,
      exchange,
      limit,
      ai,
      ...params,
    });
    const res = await fetch(`${BASE}/stocks${query}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },

  screenStocks: async ({ filters = [], exchange = "BOTH", limit = 20, params = {}, ai = false } = {}) => {
    const res = await fetch(`${BASE}/stocks/screen`, {
      method: "POST",
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ filters, exchange, limit, params, ai }),
    });
    return handleResponse(res);
  },

  getStock: async (symbol, { exchange = "BOTH", ai = true } = {}) => {
    const query = buildQuery({ exchange, ai });
    const res = await fetch(`${BASE}/stocks/${encodeURIComponent(symbol)}${query}`, {
      headers: buildHeaders(),
    });
    return handleResponse(res);
  },
};
