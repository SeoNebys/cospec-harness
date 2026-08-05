import { parse } from "node-html-parser";
import { config } from "../config.js";

/**
 * Best-effort derivation of a page title (research R4).
 * Fetches the page with a timeout and a byte cap, parses <title> then
 * og:title. Returns null on any failure so the caller can fall back to the URL.
 * Never throws.
 */
export async function fetchTitle(
  url: string,
  opts: { timeoutMs?: number; maxBytes?: number } = {},
): Promise<string | null> {
  const timeoutMs = opts.timeoutMs ?? config.titleFetchTimeoutMs;
  const maxBytes = opts.maxBytes ?? config.titleFetchMaxBytes;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { Accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok || !res.body) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("html")) return null;

    const html = await readCapped(res.body, maxBytes);
    return extractTitle(html);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse a title out of an HTML string: <title> first, then og:title. */
export function extractTitle(html: string): string | null {
  const root = parse(html);

  const titleEl = root.querySelector("title");
  const title = titleEl?.text?.trim();
  if (title) return collapseWhitespace(title);

  const og = root
    .querySelector('meta[property="og:title"]')
    ?.getAttribute("content")
    ?.trim();
  if (og) return collapseWhitespace(og);

  return null;
}

function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

async function readCapped(
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
): Promise<string> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        total += value.length;
      }
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks.map((c) => Buffer.from(c))).toString("utf8");
}
