// Shared network helpers with a short timeout and a basic SSRF guard.
// The app fetches user-supplied URLs server-side (for page details and
// preserved copies); block obviously-internal targets.

import { ensureScheme } from "./normalize.js";

const TIMEOUT_MS = Number(process.env.BM_FETCH_TIMEOUT || 5000);

export function isBlockedHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return true;
  // Tests may point the fetcher at a local sample server.
  if (process.env.BM_ALLOW_LOCAL === "1" && (h === "127.0.0.1" || h === "localhost")) return false;
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h === "127.0.0.1" || h === "::1" || h === "0.0.0.0") return true;
  if (/^10\./.test(h) || /^192\.168\./.test(h) || /^169\.254\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h.endsWith(".internal") || h === "maker") return true;
  return false;
}

export async function safeFetch(rawUrl, { method = "GET" } = {}) {
  const url = ensureScheme(rawUrl);
  let u;
  try { u = new URL(url); } catch { throw new Error("bad-url"); }
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("bad-scheme");
  if (isBlockedHost(u.hostname)) throw new Error("blocked-host");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(u, {
      method,
      redirect: "follow",
      signal: ctrl.signal,
      headers: { "user-agent": "MyBookmarks/1.0 (+personal bookmark manager)" },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
