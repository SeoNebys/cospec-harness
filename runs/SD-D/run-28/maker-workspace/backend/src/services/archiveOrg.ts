import { upstream } from '../lib/errors.ts';

/**
 * Best-effort submission to the Internet Archive "Save Page Now" (FR-023).
 * On success returns the archived snapshot URL. On any failure throws a 502 so
 * the caller can report it WITHOUT touching the bookmark or its local copy.
 */
export async function submitToArchiveOrg(targetUrl: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const res = await fetch(`https://web.archive.org/save/${targetUrl}`, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'BookmarkManager/1.0' },
    });
    // Save Page Now returns the archived location either in a header or the URL.
    const contentLocation = res.headers.get('content-location');
    if (contentLocation) {
      return `https://web.archive.org${contentLocation}`;
    }
    if (res.url && res.url.includes('/web/')) {
      return res.url;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    // Fall back to a timestamped snapshot reference.
    return `https://web.archive.org/web/*/${targetUrl}`;
  } catch (err) {
    throw upstream(
      'Could not reach the Internet Archive. Your bookmark and local copy are unchanged.',
      { cause: err instanceof Error ? err.message : String(err) },
    );
  } finally {
    clearTimeout(timer);
  }
}
