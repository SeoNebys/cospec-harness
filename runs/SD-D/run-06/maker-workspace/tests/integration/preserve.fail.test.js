import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync, mkdtempSync } from 'node:fs';

// Deterministic verification of the honest-marking path: a page that references
// an UNREACHABLE external image cannot be made self-contained, so preservation
// must be marked 'failed' rather than presented as a successful self-contained
// copy (FR-026/FR-029). No external network needed — everything is local.

const DB = join(tmpdir(), `bm-preservefail-${process.pid}-${Date.now()}.db`);
const PRESERVE = mkdtempSync(join(tmpdir(), 'bm-preserve-'));
process.env.BOOKMARKS_DB = DB;
process.env.PRESERVE_DIR = PRESERVE;

let migrate, create, getById, preserveLocal, closeBrowser, normalizeUrl;
let pageServer, selfContainedUrl, externalUrl;

before(async () => {
  ({ migrate } = await import('../../src/server/db/migrations.js'));
  ({ create, getById } = await import('../../src/server/db/bookmarks.repo.js'));
  ({ preserveLocal } = await import('../../src/server/services/preserve.js'));
  ({ closeBrowser } = await import('../../src/server/services/browser.js'));
  ({ normalizeUrl } = await import('../../src/server/services/normalizeUrl.js'));
  migrate();

  // A local page that embeds an image from an unreachable host (port 1 refuses).
  pageServer = http.createServer((req, res) => {
    if (req.url === '/external') {
      res.setHeader('content-type', 'text/html');
      res.end('<html><body><h1>Has external image</h1><img src="http://127.0.0.1:1/missing.png"></body></html>');
    } else {
      res.setHeader('content-type', 'text/html');
      res.end('<html><body><h1>Fully self-contained</h1><p>No subresources.</p></body></html>');
    }
  });
  await new Promise((r) => pageServer.listen(0, '127.0.0.1', r));
  const port = pageServer.address().port;
  selfContainedUrl = `http://127.0.0.1:${port}/plain`;
  externalUrl = `http://127.0.0.1:${port}/external`;
});

after(async () => {
  await closeBrowser();
  await new Promise((r) => pageServer.close(r));
  for (const s of ['', '-wal', '-shm']) { try { rmSync(DB + s); } catch { /* ignore */ } }
  try { rmSync(PRESERVE, { recursive: true, force: true }); } catch { /* ignore */ }
});

test('a page with an unreachable external image is marked failed, not ready (FR-026/FR-029)', async () => {
  const n = normalizeUrl(externalUrl);
  const b = create({ url: n.url, normalized: n.normalized, title: 'External' });
  await preserveLocal(b.id, n.url);
  const row = getById(b.id);
  assert.equal(row.preserved_status, 'failed', 'not self-contained -> failed');
  assert.equal(row.preserved_path, null, 'no file is presented as a successful copy');
});

test('a genuinely self-contained page is marked ready with a stored file (FR-026)', async () => {
  const n = normalizeUrl(selfContainedUrl);
  const b = create({ url: n.url, normalized: n.normalized, title: 'Plain' });
  await preserveLocal(b.id, n.url);
  const row = getById(b.id);
  assert.equal(row.preserved_status, 'ready');
  assert.equal(row.preserved_kind, 'html');
  assert.ok(row.preserved_path, 'a self-contained file is stored');
});
