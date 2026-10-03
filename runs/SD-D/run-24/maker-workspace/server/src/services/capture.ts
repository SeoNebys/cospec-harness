import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { CAPTURES_DIR, CAPTURE_MAX_BYTES } from '../config';
import { CopyType } from '../types';

export interface CaptureResult {
  type: CopyType;
  file_path: string;
  byte_size: number;
}

const UA =
  'Mozilla/5.0 (compatible; BookmarkManager/1.0; +http://localhost) AppleWebKit/537.36';

/**
 * Preserve a full-page single-file copy (MHTML) via Chromium CDP, or the
 * original PDF when the link is a PDF. Returns null when capture fails or the
 * result exceeds the size cap (caller marks the copy unavailable).
 */
export async function capturePage(
  rawUrl: string,
  bookmarkId: number,
  isPdf: boolean
): Promise<CaptureResult | null> {
  if (isPdf) return capturePdf(rawUrl, bookmarkId);
  return captureMhtml(rawUrl, bookmarkId);
}

async function capturePdf(rawUrl: string, bookmarkId: number): Promise<CaptureResult | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(rawUrl, { headers: { 'User-Agent': UA }, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > CAPTURE_MAX_BYTES) return null;
    const dest = path.join(CAPTURES_DIR, `bookmark-${bookmarkId}.pdf`);
    fs.writeFileSync(dest, buf);
    return { type: 'pdf', file_path: dest, byte_size: buf.length };
  } catch {
    return null;
  }
}

async function captureMhtml(rawUrl: string, bookmarkId: number): Promise<CaptureResult | null> {
  let browser;
  try {
    browser = await chromium.launch();
    const context = await browser.newContext({ userAgent: UA });
    const page = await context.newPage();
    await page.goto(rawUrl, { waitUntil: 'load', timeout: 25000 });
    const session = await context.newCDPSession(page);
    const { data } = (await session.send('Page.captureSnapshot', { format: 'mhtml' })) as {
      data: string;
    };
    const buf = Buffer.from(data, 'utf-8');
    if (buf.length === 0 || buf.length > CAPTURE_MAX_BYTES) return null;
    const dest = path.join(CAPTURES_DIR, `bookmark-${bookmarkId}.mhtml`);
    fs.writeFileSync(dest, buf);
    return { type: 'mhtml', file_path: dest, byte_size: buf.length };
  } catch {
    return null;
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
