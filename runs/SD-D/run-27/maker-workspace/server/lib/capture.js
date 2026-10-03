// Preserve a local copy of a page (spec FR-029/FR-030, research §4).
// Web page -> single self-contained HTML file with resources inlined as data URIs.
// PDF destination -> saved as a .pdf file.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

let chromiumPromise = null;
async function getBrowser() {
  if (!chromiumPromise) {
    chromiumPromise = (async () => {
      try {
        const { chromium } = await import('playwright');
        return await chromium.launch({ headless: true });
      } catch {
        return null;
      }
    })();
  }
  return chromiumPromise;
}

async function toDataUri(url) {
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return null;
    const ct = resp.headers.get('content-type') || 'application/octet-stream';
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length > 3_000_000) return null; // skip very large resources
    return `data:${ct};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

// Inline <img src>, <link rel=stylesheet>, and background CSS best-effort.
async function inlineResources(html, baseUrl) {
  const root = (await import('node-html-parser')).parse(html);

  // Inline stylesheets
  for (const link of root.querySelectorAll('link[rel="stylesheet"]')) {
    const href = link.getAttribute('href');
    if (!href) continue;
    try {
      const abs = new URL(href, baseUrl).href;
      const resp = await fetch(abs, { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const css = await resp.text();
        const style = `<style>${css}</style>`;
        link.replaceWith(style);
      }
    } catch { /* leave as-is */ }
  }

  // Inline images
  for (const img of root.querySelectorAll('img')) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;
    try {
      const abs = new URL(src, baseUrl).href;
      const dataUri = await toDataUri(abs);
      if (dataUri) img.setAttribute('src', dataUri);
    } catch { /* leave as-is */ }
  }

  // Add a <base> so remaining relative links resolve.
  const head = root.querySelector('head');
  if (head && !head.querySelector('base')) {
    head.insertAdjacentHTML('afterbegin', `<base href="${baseUrl}">`);
  }
  return root.toString();
}

// Returns { kind: 'html'|'pdf', filePath }
export async function preserveLocal(url, destDir) {
  mkdirSync(destDir, { recursive: true });

  // Detect PDF via HEAD/GET content-type.
  let isPdf = false;
  try {
    const head = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(12000) });
    const ct = head.headers.get('content-type') || '';
    if (ct.includes('application/pdf') || url.toLowerCase().endsWith('.pdf')) {
      isPdf = true;
      const buf = Buffer.from(await head.arrayBuffer());
      const filePath = join(destDir, 'page.pdf');
      writeFileSync(filePath, buf);
      return { kind: 'pdf', filePath };
    }
  } catch {
    if (url.toLowerCase().endsWith('.pdf')) isPdf = true;
  }

  if (isPdf) {
    // Retry raw download for pdf.
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    const buf = Buffer.from(await resp.arrayBuffer());
    const filePath = join(destDir, 'page.pdf');
    writeFileSync(filePath, buf);
    return { kind: 'pdf', filePath };
  }

  // Web page: render + inline into self-contained HTML.
  const browser = await getBrowser();
  let html;
  if (browser) {
    let context;
    try {
      context = await browser.newContext();
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
      html = await page.content();
      await context.close();
    } catch {
      if (context) { try { await context.close(); } catch {} }
    }
  }
  if (!html) {
    const resp = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(15000) });
    html = await resp.text();
  }
  const selfContained = await inlineResources(html, url);
  const filePath = join(destDir, 'page.html');
  writeFileSync(filePath, selfContained, 'utf8');
  return { kind: 'html', filePath };
}

export async function closeCaptureBrowser() {
  if (chromiumPromise) {
    const b = await chromiumPromise;
    if (b) { try { await b.close(); } catch {} }
    chromiumPromise = null;
  }
}
