import fs from 'fs';
import path from 'path';
import { parse } from 'node-html-parser';
import { CAPTURES_DIR } from '../config';

export interface PageMetadata {
  title: string | null;
  description: string | null;
  iconRemoteUrl: string | null;
  previewRemoteUrl: string | null;
  isPdf: boolean;
}

const UA =
  'Mozilla/5.0 (compatible; BookmarkManager/1.0; +http://localhost) AppleWebKit/537.36';

/** Best-effort metadata fetch. Never throws; returns nulls on failure. */
export async function fetchMetadata(rawUrl: string): Promise<PageMetadata> {
  const result: PageMetadata = {
    title: null,
    description: null,
    iconRemoteUrl: null,
    previewRemoteUrl: null,
    isPdf: false,
  };
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*' },
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/pdf') || new URL(rawUrl).pathname.toLowerCase().endsWith('.pdf')) {
      result.isPdf = true;
      result.title = decodeURIComponent(new URL(rawUrl).pathname.split('/').pop() || rawUrl);
      return result;
    }
    if (!contentType.includes('html')) return result;

    const html = await res.text();
    const root = parse(html);

    result.title =
      meta(root, 'property', 'og:title') ||
      root.querySelector('title')?.text?.trim() ||
      null;
    result.description =
      meta(root, 'name', 'description') || meta(root, 'property', 'og:description') || null;

    const preview = meta(root, 'property', 'og:image') || meta(root, 'name', 'twitter:image');
    result.previewRemoteUrl = preview ? absolute(rawUrl, preview) : null;

    const iconHref =
      root.querySelector('link[rel~="icon"]')?.getAttribute('href') ||
      root.querySelector('link[rel="shortcut icon"]')?.getAttribute('href') ||
      null;
    result.iconRemoteUrl = iconHref
      ? absolute(rawUrl, iconHref)
      : absolute(rawUrl, '/favicon.ico');
  } catch {
    // best-effort: leave nulls
  }
  return result;
}

function meta(root: ReturnType<typeof parse>, attr: string, value: string): string | null {
  const el = root.querySelector(`meta[${attr}="${value}"]`);
  const content = el?.getAttribute('content');
  return content && content.trim() ? content.trim() : null;
}

function absolute(base: string, href: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

/** Download an image to the captures dir. Returns the local path, or null on failure. */
export async function downloadImage(
  remoteUrl: string,
  destBase: string
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(remoteUrl, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const type = res.headers.get('content-type') || '';
    if (!type.startsWith('image/')) return null;
    const ext = type.includes('png')
      ? '.png'
      : type.includes('svg')
        ? '.svg'
        : type.includes('gif')
          ? '.gif'
          : type.includes('x-icon') || type.includes('vnd.microsoft.icon')
            ? '.ico'
            : '.jpg';
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > 5 * 1024 * 1024) return null;
    const dest = path.join(CAPTURES_DIR, destBase + ext);
    fs.writeFileSync(dest, buf);
    return dest;
  } catch {
    return null;
  }
}
