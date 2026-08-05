function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  /** HTTP port for the API server. */
  port: num("PORT", 3001),
  /** SQLite file path. Use ":memory:" for ephemeral/test databases. */
  dbPath: process.env.DB_PATH ?? "data/bookmarks.db",
  /** How long a soft-deleted bookmark can still be restored (undo window). */
  undoWindowMs: num("UNDO_WINDOW_MS", 30_000),
  /** Timeout for the best-effort title fetch. */
  titleFetchTimeoutMs: num("TITLE_FETCH_TIMEOUT_MS", 5_000),
  /** Cap on bytes read while deriving a title. */
  titleFetchMaxBytes: num("TITLE_FETCH_MAX_BYTES", 512_000),
};

export type Config = typeof config;
