import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshAgent, stubHtmlFetch } from '../helpers/app.js';

const HTML = `<html><head><title>T</title>
  <meta property="og:title" content="Example Site">
  <meta name="description" content="An example">
  <meta property="og:image" content="/prev.png">
  <link rel="icon" href="/fav.ico"></head></html>`;

let agent;
const realFetch = globalThis.fetch;
beforeEach(async () => {
  agent = await freshAgent();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

describe('preview + commit', () => {
  it('preview collects details before commit', async () => {
    stubHtmlFetch(HTML);
    const res = await agent.post('/api/bookmarks/preview').send({ url: 'example.com' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Example Site');
    expect(res.body.description).toBe('An example');
    expect(res.body.previewImagePath).toBe('https://example.com/prev.png');
    expect(res.body.faviconPath).toBe('https://example.com/fav.ico');
    expect(res.body.metadataStatus).toBe('collected');
  });

  it('preview returns fallback when the page is unreachable', async () => {
    globalThis.fetch = async () => {
      throw new Error('down');
    };
    const res = await agent.post('/api/bookmarks/preview').send({ url: 'https://nope.example' });
    expect(res.status).toBe(200);
    expect(res.body.metadataStatus).toBe('fallback');
    expect(res.body.title).toBe('nope.example');
  });

  it('rejects an invalid address', async () => {
    const res = await agent.post('/api/bookmarks/preview').send({ url: 'not a url' });
    expect(res.status).toBe(400);
  });

  it('commit persists reviewed title, description, favicon and preview', async () => {
    const res = await agent.post('/api/bookmarks').send({
      url: 'https://example.com/a',
      title: 'Reviewed Title',
      description: 'Reviewed Desc',
      faviconPath: 'https://example.com/fav.ico',
      previewImagePath: 'https://example.com/prev.png',
      tags: ['x'],
    });
    expect(res.status).toBe(201);
    const id = res.body.id;
    const got = await agent.get(`/api/bookmarks/${id}`);
    expect(got.body.title).toBe('Reviewed Title');
    expect(got.body.description).toBe('Reviewed Desc');
    expect(got.body.faviconPath).toBe('https://example.com/fav.ico');
    expect(got.body.previewImagePath).toBe('https://example.com/prev.png');
    expect(got.body.tags).toEqual(['x']);
    expect(got.body.read).toBe(false); // new = unread
    expect(got.body.snapshotStatus).toBe('pending');
  });

  it('applies a fallback title when none provided', async () => {
    const res = await agent.post('/api/bookmarks').send({ url: 'https://example.com/nofoo' });
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('example.com/nofoo');
  });
});
