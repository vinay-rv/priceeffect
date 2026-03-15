import crypto from "crypto";
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

let dbInstance = null;

function resolveDbPath() {
  if (process.env.DB_PATH) {
    return path.resolve(process.cwd(), process.env.DB_PATH);
  }

  return path.resolve(process.cwd(), "data", "priceeffect.db");
}

function getArticleHash(article) {
  const bodyText = Array.isArray(article.body) ? article.body.join("\n") : "";

  return crypto
    .createHash("sha1")
    .update([article.title, article.summary, bodyText].filter(Boolean).join("|"))
    .digest("hex");
}

export function initDatabase() {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  dbInstance = new Database(dbPath);
  dbInstance.pragma("journal_mode = WAL");

  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS article_stock_links (
      article_id TEXT PRIMARY KEY,
      article_hash TEXT NOT NULL,
      links_json TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'openai',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return dbInstance;
}

export function getStoredArticleLinks(article) {
  const db = initDatabase();
  const row = db
    .prepare(
      `
        SELECT article_hash, links_json
        FROM article_stock_links
        WHERE article_id = ?
      `,
    )
    .get(article.id);

  if (!row || row.article_hash !== getArticleHash(article)) {
    return null;
  }

  try {
    return JSON.parse(row.links_json);
  } catch (error) {
    return null;
  }
}

export function saveArticleLinks(article, links, source = "openai") {
  const db = initDatabase();

  db.prepare(
    `
      INSERT INTO article_stock_links (article_id, article_hash, links_json, source, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(article_id) DO UPDATE SET
        article_hash = excluded.article_hash,
        links_json = excluded.links_json,
        source = excluded.source,
        updated_at = CURRENT_TIMESTAMP
    `,
  ).run(article.id, getArticleHash(article), JSON.stringify(links), source);
}
