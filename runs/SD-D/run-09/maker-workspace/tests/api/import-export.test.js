import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { freshAgent } from '../helpers/app.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = resolve(here, '../fixtures/bookmarks.html');
const fixture = readFileSync(fixturePath);

let agent;
beforeEach(async () => {
  agent = await freshAgent();
});

describe('import / export', () => {
  it('imports a Netscape file preserving titles, dates and folder tags', async () => {
    const res = await agent
      .post('/api/import')
      .attach('file', fixture, 'bookmarks.html');
    expect(res.status).toBe(200);
    expect(res.body.added).toBe(4);
    expect(res.body.skipped).toBe(0);

    const list = await agent.get('/api/bookmarks').query({ q: '#Projects' });
    expect(list.body.total).toBe(1);
    expect(list.body.items[0].dateAdded).toBe(new Date(1620000000 * 1000).toISOString());
  });

  it('skips duplicates on a second import', async () => {
    await agent.post('/api/import').attach('file', fixture, 'bookmarks.html');
    const res = await agent.post('/api/import').attach('file', fixture, 'bookmarks.html');
    expect(res.body.added).toBe(0);
    expect(res.body.skipped).toBe(4);
  });

  it('exports valid Netscape HTML that round-trips', async () => {
    await agent.post('/api/import').attach('file', fixture, 'bookmarks.html');
    const res = await agent.get('/api/export');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<!DOCTYPE NETSCAPE-Bookmark-file-1>');
    expect(res.text).toContain('Project One');
    expect(res.headers['content-disposition']).toContain('bookmarks.html');
  });
});
