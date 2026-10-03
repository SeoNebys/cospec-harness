// Test helper: create an isolated app instance with a temp database, and seed data.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Configure an isolated data dir BEFORE importing modules that read config.
export function useTempData() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bm-test-'));
  process.env.DATA_DIR = dir;
  process.env.DB_FILE = path.join(dir, 'test.db');
  return {
    dir,
    cleanup() {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    },
  };
}

// Insert N bookmarks directly via the bookmarks service (bypassing network metadata).
export async function seedBookmarks(n, prefix = 'seed') {
  const svc = await import('../../src/server/services/bookmarks.js');
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(
      svc.createBookmark({
        address: `https://example.com/${prefix}/${i}`,
        title: `${prefix} title ${i}`,
        description: `${prefix} description ${i}`,
        tags: i % 2 === 0 ? ['even'] : ['odd'],
        skipMetadata: true,
      })
    );
  }
  return out;
}
