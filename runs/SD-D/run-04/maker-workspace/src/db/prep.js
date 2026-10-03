// Cache prepared statements per database connection. Reusing statements is the
// better-sqlite3 best practice (much faster) and keeps the number of native
// Statement wrappers tiny, avoiding teardown finalization issues.
const caches = new WeakMap();

export function prep(db, sql) {
  let cache = caches.get(db);
  if (!cache) {
    cache = new Map();
    caches.set(db, cache);
  }
  let stmt = cache.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    cache.set(sql, stmt);
  }
  return stmt;
}
