import express from 'express';
import sanitizeHtml from 'sanitize-html';
import * as cheerio from 'cheerio';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

const here = path.dirname(fileURLToPath(import.meta.url));
const defaultDataFile = path.join(here, 'data', 'bookmarks.json');

export function normalizeUrl(value) {
  const url = new URL(String(value).trim());
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Enter a complete HTTP or HTTPS web address.');
  url.hash = '';
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
  return url.toString();
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  return ip === '::1' || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:') || ip === '::';
}

async function assertPublicDestination(url) {
  const records = await dns.lookup(url.hostname, { all: true });
  if (!records.length || records.some(record => isPrivateIp(record.address))) throw new Error('That address cannot be fetched.');
}

export function cleanNote(html = '') {
  return sanitizeHtml(html, {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'li', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['http', 'https', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) }
  });
}

export async function fetchMetadata(rawUrl, fetchImpl = fetch) {
  const normalizedUrl = normalizeUrl(rawUrl);
  const parsed = new URL(normalizedUrl);
  await assertPublicDestination(parsed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetchImpl(normalizedUrl, { signal: controller.signal, redirect: 'follow', headers: { 'user-agent': 'KeepBookmarks/1.0' } });
    if (!response.ok) throw new Error(`The page returned ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error('The page did not provide readable page details.');
    const body = (await response.text()).slice(0, 2_000_000);
    const $ = cheerio.load(body);
    const pick = (...selectors) => selectors.map(s => $(s).first().attr('content') || $(s).first().text()).find(Boolean)?.trim() || '';
    const title = pick('meta[property="og:title"]', 'meta[name="twitter:title"]', 'title');
    const description = pick('meta[property="og:description"]', 'meta[name="description"]', 'meta[name="twitter:description"]');
    const imageValue = pick('meta[property="og:image"]', 'meta[name="twitter:image"]');
    const iconValue = $('link[rel~="icon"]').first().attr('href') || '/favicon.ico';
    const finalUrl = normalizeUrl(response.url || normalizedUrl);
    return {
      url: finalUrl,
      siteName: pick('meta[property="og:site_name"]') || new URL(finalUrl).hostname.replace(/^www\./, ''),
      title,
      description,
      image: imageValue ? new URL(imageValue, finalUrl).toString() : '',
      icon: iconValue ? new URL(iconValue, finalUrl).toString() : '',
      fetched: Boolean(title)
    };
  } finally {
    clearTimeout(timer);
  }
}

class Store {
  constructor(file) { this.file = file; this.queue = Promise.resolve(); }
  async read() {
    try { return JSON.parse(await fs.readFile(this.file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return { bookmarks: [] }; throw error; }
  }
  async write(data) {
    this.queue = this.queue.then(async () => {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const temp = `${this.file}.${process.pid}.tmp`;
      await fs.writeFile(temp, JSON.stringify(data, null, 2));
      await fs.rename(temp, this.file);
    });
    return this.queue;
  }
}

function preparedBookmark(body) {
  return {
    url: normalizeUrl(body.url),
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    siteName: String(body.siteName || '').trim(),
    icon: String(body.icon || '').trim(),
    image: String(body.image || '').trim(),
    note: cleanNote(body.note || ''),
    labels: [...new Set((body.labels || []).map(x => String(x).trim()).filter(Boolean))],
    readLater: Boolean(body.readLater),
    archived: Boolean(body.archived)
  };
}

export function createApp({ dataFile = process.env.KEEP_DATA_FILE || defaultDataFile, metadataFetcher = fetchMetadata } = {}) {
  const app = express();
  const store = new Store(dataFile);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(path.join(here, 'public')));

  app.get('/api/bookmarks', async (_req, res, next) => { try { res.json(await store.read()); } catch (e) { next(e); } });
  app.post('/api/preview', async (req, res) => {
    let url;
    try { url = normalizeUrl(req.body.url); } catch { return res.status(400).json({ error: 'Enter a complete web address, such as https://example.com' }); }
    const data = await store.read();
    const duplicate = data.bookmarks.find(item => item.url === url);
    if (duplicate) return res.status(409).json({ error: 'You already saved this link.', duplicate });
    try {
      const preview = await metadataFetcher(url);
      const redirectedDuplicate = data.bookmarks.find(item => item.url === normalizeUrl(preview.url));
      if (redirectedDuplicate) return res.status(409).json({ error: 'You already saved this link.', duplicate: redirectedDuplicate });
      res.json(preview);
    }
    catch { res.json({ url, siteName: new URL(url).hostname.replace(/^www\./, ''), title: '', description: '', icon: '', image: '', fetched: false }); }
  });
  app.post('/api/bookmarks', async (req, res) => {
    try {
      const item = preparedBookmark(req.body);
      if (!item.title) return res.status(400).json({ error: 'Add a title before saving.' });
      const data = await store.read();
      const duplicate = data.bookmarks.find(existing => existing.url === item.url);
      if (duplicate) return res.status(409).json({ error: 'You already saved this link.', duplicate });
      Object.assign(item, { id: crypto.randomUUID(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      data.bookmarks.unshift(item); await store.write(data); res.status(201).json(item);
    } catch (error) { res.status(400).json({ error: error.message }); }
  });
  app.patch('/api/bookmarks/:id', async (req, res) => {
    const data = await store.read(); const item = data.bookmarks.find(x => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Bookmark not found.' });
    const allowed = ['title', 'description', 'note', 'labels', 'readLater', 'archived', 'siteName', 'icon', 'image'];
    for (const key of allowed) if (key in req.body) item[key] = key === 'note' ? cleanNote(req.body[key]) : key === 'labels' ? [...new Set(req.body[key].map(x => String(x).trim()).filter(Boolean))] : req.body[key];
    if (!String(item.title).trim()) return res.status(400).json({ error: 'A title is required.' });
    item.updatedAt = new Date().toISOString(); await store.write(data); res.json(item);
  });
  app.post('/api/bookmarks/:id/refresh', async (req, res) => {
    const data = await store.read(); const item = data.bookmarks.find(x => x.id === req.params.id);
    if (!item) return res.status(404).json({ error: 'Bookmark not found.' });
    try { res.json(await metadataFetcher(item.url)); } catch { res.status(502).json({ error: 'We couldn’t collect newer details. Your bookmark is unchanged.' }); }
  });
  app.delete('/api/bookmarks/:id', async (req, res) => {
    const data = await store.read(); const before = data.bookmarks.length;
    data.bookmarks = data.bookmarks.filter(x => x.id !== req.params.id);
    if (data.bookmarks.length === before) return res.status(404).json({ error: 'Bookmark not found.' });
    await store.write(data); res.status(204).end();
  });
  app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Something went wrong. Please try again.' }); });
  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 4000);
  createApp().listen(port, '0.0.0.0', () => console.log(`Keep listening on http://0.0.0.0:${port}`));
}
