import { parse } from 'node-html-parser';

// Page-title retrieval with graceful fallback (FR-003).
// The fetcher is injectable so tests can exercise the logic without a network.

export type Fetcher = (url: string) => Promise<{ ok: boolean; text(): Promise<string> }>;

// Extracts a usable <title> from an HTML document, or null if none/empty.
export function titleFromHtml(html: string): string | null {
  const el = parse(html).querySelector('title');
  const text = el?.text.trim();
  return text ? text : null;
}

// Fetches the page and returns its title, or null when unreachable / titleless.
export async function fetchTitle(
  url: string,
  fetchImpl: Fetcher = fetch as unknown as Fetcher,
): Promise<string | null> {
  try {
    const res = await fetchImpl(url);
    if (!res.ok) return null;
    return titleFromHtml(await res.text());
  } catch {
    return null;
  }
}

// Resolves the title to store: an explicit title wins; otherwise the fetched
// page title; otherwise the address itself, so a bookmark always has a title
// even for unreachable pages (FR-003, "unreachable page" edge case).
export async function deriveTitle(
  url: string,
  explicit: string | undefined,
  fetchImpl?: Fetcher,
): Promise<string> {
  const provided = explicit?.trim();
  if (provided) return provided;
  const fetched = await fetchTitle(url, fetchImpl);
  return fetched ?? url;
}
