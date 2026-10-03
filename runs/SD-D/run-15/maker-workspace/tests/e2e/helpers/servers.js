// Shared e2e harness: the app on an isolated temp DB, a local fixture site
// (pages, assets, a PDF, and an Internet Archive stub) — no public internet.
import { spawn } from 'node:child_process';
import http from 'node:http';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

const APP_PORT = 4010;
const FIXTURE_PORT = 4210;
export const FIXTURE_BASE = `http://127.0.0.1:${FIXTURE_PORT}`;
export const ARCHIVE_BASE = `${FIXTURE_BASE}/save/`;

// 1x1 transparent PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const PDF = Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

export function startFixtureSite() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, FIXTURE_BASE);
    const p = url.pathname;

    if (p === '/article') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html><head>
        <title>Fixture Fallback Title</title>
        <meta property="og:title" content="The Fixture Article" />
        <meta property="og:description" content="A predictable fixture description." />
        <meta property="og:image" content="/preview.png" />
        <link rel="icon" href="/favicon.ico" />
      </head><body><h1>Fixture</h1></body></html>`);
    }
    if (p === '/page-with-assets') {
      res.setHeader('content-type', 'text/html; charset=utf-8');
      return res.end(`<!doctype html><html><head>
        <title>Page With Assets</title>
        <link rel="stylesheet" href="/style.css" />
      </head><body><h1>Saved me</h1><img src="/image.png" alt="x" /></body></html>`);
    }
    if (p === '/style.css') {
      res.setHeader('content-type', 'text/css');
      return res.end('h1{color:rebeccapurple}');
    }
    if (p === '/image.png' || p === '/preview.png' || p === '/favicon.ico') {
      res.setHeader('content-type', 'image/png');
      return res.end(PNG);
    }
    if (p === '/doc.pdf') {
      res.setHeader('content-type', 'application/pdf');
      return res.end(PDF);
    }
    // Internet Archive "Save Page Now" stub: 503 for URLs containing 'archive-fail'.
    if (p.startsWith('/save/')) {
      const target = decodeURIComponent(p.slice('/save/'.length));
      if (target.includes('archive-fail')) {
        res.statusCode = 503;
        return res.end('unavailable');
      }
      res.statusCode = 200;
      res.setHeader('content-location', `/web/20240101000000/${target}`);
      return res.end('ok');
    }
    res.statusCode = 404;
    res.end('not found');
  });
  return new Promise((resolve) => {
    server.listen(FIXTURE_PORT, '127.0.0.1', () => resolve({ server, base: FIXTURE_BASE }));
  });
}

function spawnOnce(extraEnv) {
  const dataDir = mkdtempSync(join(tmpdir(), 'bm-e2e-'));
  const child = spawn('node', ['--disable-warning=ExperimentalWarning', 'src/server/index.js'], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PORT: String(APP_PORT),
      HOST: '127.0.0.1',
      BM_DATA_DIR: dataDir,
      BM_ARCHIVE_BASE: ARCHIVE_BASE,
      ...extraEnv,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return new Promise((resolve, reject) => {
    let out = '';
    const onData = (d) => {
      out += d.toString();
      if (out.includes('listening')) resolve({ child, dataDir });
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`app exited early (${code}): ${out}`)));
    setTimeout(() => reject(new Error(`app did not start: ${out}`)), 8000);
  });
}

// Retry a few times in case the previous file's server has not yet released the port.
export async function startApp(extraEnv = {}) {
  let lastErr;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      return await spawnOnce(extraEnv);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw lastErr;
}

// Resolve only once the process has actually exited (port released).
export function stop(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    proc.on('exit', finish);
    proc.kill('SIGTERM');
    setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch { /* ignore */ }
      setTimeout(finish, 300);
    }, 2000);
  });
}
