const DEFAULT_TIMEOUT_MS = 5000;
const MAX_BYTES = 512 * 1024; // cap download at 512 KB — titles live in <head>

/**
 * Extract the text of the first <title> element from an HTML string.
 * Returns null if none is found or it is empty.
 */
export function extractTitle(html) {
  if (!html) return null;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) return null;
  const title = decodeBasicEntities(match[1]).replace(/\s+/g, " ").trim();
  return title || null;
}

function decodeBasicEntities(text) {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/**
 * Best-effort fetch of a page's <title>. Bounded by a timeout and a byte cap;
 * follows redirects (default fetch behaviour). Returns the title string, or
 * null on any failure (network error, timeout, non-OK status, no title).
 *
 * @param {string} url
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} [opts]
 */
export async function fetchTitle(url, opts = {}) {
  const fetchImpl = opts.fetchImpl || fetch;
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "BookmarkManager/0.1 (+local)" },
    });
    if (!res || !res.ok) return null;

    // Read up to MAX_BYTES so a huge page can't exhaust memory.
    const html = await readCapped(res, MAX_BYTES);
    return extractTitle(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readCapped(res, maxBytes) {
  // Prefer streaming so we can stop early once we have enough bytes.
  if (res.body && typeof res.body.getReader === "function") {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let out = "";
    let received = 0;
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.length;
      out += decoder.decode(value, { stream: true });
    }
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    return out;
  }
  // Fallback for fetch implementations without a streaming body (e.g. stubs).
  const text = await res.text();
  return text.slice(0, maxBytes);
}
