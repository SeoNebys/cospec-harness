import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
beforeEach(async () => {
  agent = await freshAgent();
});

async function make(url = 'https://example.com/a', over = {}) {
  const res = await agent.post('/api/bookmarks').send({ url, title: 'T', ...over });
  return res.body;
}

describe('edit / delete / tags', () => {
  it('edits address, title, description, note and tags', async () => {
    const bm = await make();
    const res = await agent.patch(`/api/bookmarks/${bm.id}`).send({
      url: 'https://example.com/b',
      title: 'New',
      description: 'Desc',
      note: '# note',
      tags: ['alpha', 'beta'],
    });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://example.com/b');
    expect(res.body.title).toBe('New');
    expect(res.body.note).toBe('# note');
    expect(res.body.tags.sort()).toEqual(['alpha', 'beta']);
  });

  it('rejects an address that collides with another bookmark', async () => {
    await make('https://example.com/one');
    const b = await make('https://example.com/two');
    const res = await agent.patch(`/api/bookmarks/${b.id}`).send({ url: 'https://example.com/one' });
    expect(res.status).toBe(400);
  });

  it('deletes a bookmark', async () => {
    const bm = await make();
    const del = await agent.delete(`/api/bookmarks/${bm.id}`);
    expect(del.status).toBe(204);
    const got = await agent.get(`/api/bookmarks/${bm.id}`);
    expect(got.status).toBe(404);
  });

  it('suggests existing tags by prefix', async () => {
    await make('https://example.com/x', { tags: ['frontend', 'framework', 'backend'] });
    const res = await agent.get('/api/tags').query({ prefix: 'fr' });
    const names = res.body.map((t) => t.name).sort();
    expect(names).toEqual(['framework', 'frontend']);
  });
});
