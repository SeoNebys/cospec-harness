import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import createDOMPurify from 'dompurify'

export interface ReaderResult {
  title: string | null
  excerpt: string | null
  html: string
}

// Extracts the readable article content from a page's HTML (the engine behind
// "reader mode") and sanitizes it so the stored copy can never run scripts when
// viewed later (FR-007, Decision 4/6). Pure and network-free, so it is easy to
// test against fixture HTML. Returns null when there is no article to keep.
export function extractReadable(html: string, url: string): ReaderResult | null {
  try {
    const dom = new JSDOM(html, { url })
    const article = new Readability(dom.window.document).parse()
    if (!article || !article.content) return null
    // DOMPurify needs a DOM window; jsdom's window satisfies it at runtime.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const DOMPurify = createDOMPurify(dom.window as any)
    const clean = DOMPurify.sanitize(article.content)
    if (!clean.trim()) return null
    return { title: article.title ?? null, excerpt: article.excerpt ?? null, html: clean }
  } catch {
    return null
  }
}

// Decides whether a resource is a PDF, from its content type or its address
// (FR-008).
export function isPdf(contentType: string | null, url: string): boolean {
  if (contentType && contentType.toLowerCase().includes('application/pdf')) return true
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.pdf')
  } catch {
    return false
  }
}
