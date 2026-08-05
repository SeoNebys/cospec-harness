import { parse } from 'node-html-parser'
import type { PageMetadata } from '@shared/types'

// Pure parser: given a page's HTML and its address, extract a title, a short
// description, and a favicon address. Kept pure (no network) so it is easy to
// test against fixture HTML (FR-003).
export function parseMetadata(html: string, baseUrl: string): PageMetadata {
  const root = parse(html)

  const title =
    root.querySelector('meta[property="og:title"]')?.getAttribute('content')?.trim() ||
    root.querySelector('title')?.text?.trim() ||
    null

  const description =
    root.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() ||
    root.querySelector('meta[property="og:description"]')?.getAttribute('content')?.trim() ||
    null

  const iconHref =
    root.querySelector('link[rel="icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
    root.querySelector('link[rel="apple-touch-icon"]')?.getAttribute('href') ||
    '/favicon.ico'

  let faviconUrl: string | null = null
  try {
    faviconUrl = new URL(iconHref, baseUrl).toString()
  } catch {
    faviconUrl = null
  }

  return { title, description, faviconUrl }
}

export type FetchFn = (url: string) => Promise<{ ok: boolean; text: () => Promise<string> }>

// Fetches a page and parses its metadata. Network errors resolve to empty
// metadata (the caller applies a fallback label — FR-005) rather than throwing.
export async function fetchMetadata(
  url: string,
  fetchFn: FetchFn = globalThis.fetch as unknown as FetchFn
): Promise<PageMetadata> {
  try {
    const res = await fetchFn(url)
    if (!res.ok) return { title: null, description: null, faviconUrl: null }
    const html = await res.text()
    return parseMetadata(html, url)
  } catch {
    return { title: null, description: null, faviconUrl: null }
  }
}

// A human-friendly fallback label derived from the address when no title is
// available, so no bookmark is ever shown unlabeled (FR-005, SC-011).
export function fallbackTitle(url: string): string {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '') + (u.pathname !== '/' ? u.pathname : '')
  } catch {
    return url
  }
}
