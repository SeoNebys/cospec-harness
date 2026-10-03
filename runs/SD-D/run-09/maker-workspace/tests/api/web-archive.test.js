import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
const realFetch = globalThis.fetch;
beforeEach(async () => {
  agent = await freshAgent();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

async function make() {
  const r = await agent.post('/api/bookmarks').send({ url: 'https://example.com/a', title: 'T' });
  return r.body;
}

describe('internet archive preservation', () => {
  it('stores the archived link on success', async () => {
    globalThis.fetch = async () => ({
      ok: true,
      url: 'https://web.archive.org/web/20260101000000/https://example.com/a',
      headers: { get: () => null },
    });
    const bm = await make();
    const res = await agent.post(`/api/bookmarks/${bm.id}/web-archive`).send({});
    expect(res.status).toBe(200);
    expect(res.body.webArchiveUrl).toContain('web.archive.org/web/');
    const got = await agent.get(`/api/bookmarks/${bm.id}`);
    expect(got.body.webArchiveUrl).toBe(res.body.webArchiveUrl);
  });

  it('returns 502 and leaves the bookmark unchanged when unreachable', async () => {
    globalThis.fetch = async () => {
      throw new Error('offline');
    };
    const bm = await make();
    const res = await agent.post(`/api/bookmarks/${bm.id}/web-archive`).send({});
    expect(res.status).toBe(502);
    const got = await agent.get(`/api/bookmarks/${bm.id}`);
    expect(got.body.webArchiveUrl).toBeNull();
  });
});
