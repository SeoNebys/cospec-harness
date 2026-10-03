import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createStore } from '../src/store.js';

export function temporaryStore(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'keepwell-test-'));
  const store = createStore(path.join(directory, 'library.sqlite'));
  t.after(() => {
    store.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return store;
}

export function insertBookmark(store, overrides = {}) {
  const sequence = overrides.sequence ?? Math.random().toString(36).slice(2);
  const url = overrides.url ?? `https://example.com/${sequence}`;
  return store.insertBookmark({
    url,
    canonical_url: overrides.canonical_url ?? url,
    title: overrides.title ?? `Bookmark ${sequence}`,
    description: overrides.description ?? 'A useful saved page',
    source_host: overrides.source_host ?? 'example.com',
    site_name: overrides.site_name ?? 'Example',
    author: overrides.author ?? 'Ada Reader',
    published_at: overrides.published_at ?? '2025-01-10',
    preview_image: overrides.preview_image ?? 'data:image/png;base64,AA==',
    content_html: overrides.content_html ?? '<p>Complete saved wording.</p>',
    capture_status: overrides.capture_status ?? 'captured',
    captured_at: overrides.captured_at ?? '2025-01-11T12:00:00.000Z',
    created_at: overrides.created_at,
  });
}
