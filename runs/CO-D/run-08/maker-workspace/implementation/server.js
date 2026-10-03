import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { BookmarkStore } from './lib/store.js';
import { capturePage } from './lib/capture.js';
import { duplicateKey, parseWebUrl } from './lib/urls.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const store = new BookmarkStore(process.env.DATA_FILE || path.join(here, 'data', 'bookmarks.json'));
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(here, 'public')));

const publicItem = ({ snapshot, ...item }) => item;
const sourceOf = url => new URL(url).hostname.replace(/^www\./, '');
const findDuplicate = (items, url, except) => items.find(x => x.id !== except && duplicateKey(x.url) === duplicateKey(url));

app.get('/api/bookmarks', async (_req, res) => res.json((await store.all()).map(publicItem)));

app.post('/api/bookmarks', async (req, res) => {
  let parsed;
  try { parsed = parseWebUrl(req.body.url); } catch (error) { return res.status(400).json({ error: error.message }); }
  const items = await store.all();
  const duplicate = findDuplicate(items, parsed.href);
  if (duplicate) return res.status(409).json({ error: 'You already saved this link. Here it is.', existing: publicItem(duplicate) });
  let details = null;
  try { details = await capturePage(parsed.href); } catch {}
  const now = new Date().toISOString();
  const item = {
    id: crypto.randomUUID(), url: parsed.href, title: details?.title || sourceOf(parsed.href),
    description: details?.description || 'Page details could not be loaded. You can add them from Edit bookmark.',
    source: sourceOf(parsed.href), note: '', labels: [], status: 'read', createdAt: now, updatedAt: now,
    snapshotStatus: details?.snapshot ? 'ready' : 'failed', snapshot: details?.snapshot || '', snapshotCapturedAt: details?.snapshot ? now : null
  };
  await store.commit([item, ...items]);
  res.status(201).json({ bookmark: publicItem(item), detailsLoaded: Boolean(details?.title || details?.description) });
});

app.put('/api/bookmarks/:id', async (req, res) => {
  let parsed;
  try { parsed = parseWebUrl(req.body.url); } catch (error) { return res.status(400).json({ error: `${error.message} Nothing has been saved yet.` }); }
  const items = await store.all(), index = items.findIndex(x => x.id === req.params.id);
  if (index < 0) return res.status(404).json({ error: 'Bookmark not found.' });
  const duplicate = findDuplicate(items, parsed.href, req.params.id);
  if (duplicate) return res.status(409).json({ error: 'Another bookmark already uses this address.', existing: publicItem(duplicate) });
  const existing = items[index];
  const knownLabels = items.flatMap(x => x.labels);
  const labels = [...new Map((req.body.labels || []).map(value => {
    const entered = String(value).trim();
    const established = knownLabels.find(x => x.toLocaleLowerCase() === entered.toLocaleLowerCase());
    return [entered.toLocaleLowerCase(), established || entered];
  })).values()].filter(Boolean);
  items[index] = { ...existing, url: parsed.href, source: sourceOf(parsed.href), title: String(req.body.title || '').trim() || sourceOf(parsed.href), description: String(req.body.description || '').trim(), note: String(req.body.note || '').trim(), labels, updatedAt: new Date().toISOString() };
  await store.commit(items); res.json(publicItem(items[index]));
});

app.patch('/api/bookmarks/:id/status', async (req, res) => {
  if (!['read','done'].includes(req.body.status)) return res.status(400).json({ error: 'Unknown status.' });
  const items = await store.all(), item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Bookmark not found.' });
  item.status = req.body.status; item.updatedAt = new Date().toISOString(); await store.commit(items); res.json(publicItem(item));
});

app.post('/api/bookmarks/:id/labels', async (req, res) => {
  const items = await store.all(), item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Bookmark not found.' });
  const entered = String(req.body.label || '').trim(); if (!entered) return res.status(400).json({ error: 'Enter a label.' });
  const established = items.flatMap(x => x.labels).find(x => x.toLocaleLowerCase() === entered.toLocaleLowerCase());
  const label = established || entered;
  if (!item.labels.some(x => x.toLocaleLowerCase() === label.toLocaleLowerCase())) item.labels.push(label);
  item.updatedAt = new Date().toISOString(); await store.commit(items); res.json({ bookmark: publicItem(item), reused: Boolean(established), label });
});

app.get('/api/bookmarks/:id/snapshot', async (req, res) => {
  const item = (await store.all()).find(x => x.id === req.params.id);
  if (!item || item.snapshotStatus !== 'ready') return res.status(404).send('Saved copy unavailable.');
  res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>body{max-width:760px;margin:40px auto;padding:0 20px;font:18px/1.65 Georgia,serif;color:#17201d}img{max-width:100%;height:auto}a{color:#236b4b}.stamp{font:700 13px system-ui;color:#236b4b;margin-bottom:25px}</style><div class="stamp">Captured when bookmarked · ${new Date(item.snapshotCapturedAt).toLocaleString()}</div>${item.snapshot}`);
});

app.post('/api/bookmarks/:id/snapshot/retry', async (req, res) => {
  const items = await store.all(), item = items.find(x => x.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Bookmark not found.' });
  try { const details = await capturePage(item.url); if (!details.snapshot) throw new Error('No readable copy'); item.snapshot = details.snapshot; item.snapshotStatus = 'ready'; item.snapshotCapturedAt = new Date().toISOString(); await store.commit(items); res.json(publicItem(item)); }
  catch { res.status(422).json({ error: 'The bookmark is safe, but Link Home still could not capture a readable copy.' }); }
});

const port = Number(process.env.PORT || 4000);
app.listen(port, '0.0.0.0', () => console.log(`Link Home listening on ${port}`));
