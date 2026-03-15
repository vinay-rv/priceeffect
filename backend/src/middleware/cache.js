import NodeCache from "node-cache";

const responseCache = new NodeCache();

export function createCacheMiddleware(ttlSeconds) {
  return (req, res, next) => {
    if (req.method !== "GET") {
      next();
      return;
    }

    const key = req.originalUrl;
    const cached = responseCache.get(key);

    if (cached) {
      res.json(cached);
      return;
    }

    const originalJson = res.json.bind(res);

    res.json = (body) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        responseCache.set(key, body, ttlSeconds);
      }

      return originalJson(body);
    };

    next();
  };
}

export function clearRouteCache(prefix) {
  const keys = responseCache.keys().filter((key) => key.startsWith(prefix));
  if (keys.length > 0) {
    responseCache.del(keys);
  }
}
