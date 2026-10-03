import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
beforeEach(async () => {
  agent = await freshAgent();
});

async function make(url) {
  const res = await agent.post('/api/bookmarks').send({ url, title: 'T' });
  return res.body;
}

describe('read-later & archive views', () => {
  it('new bookmarks are unread and appear in the unread view', async () => {
    const bm = await make('https://example.com/a');
    expect(bm.read).toBe(false);
    const unread = await agent.get('/api/bookmarks').query({ view: 'unread' });
    expect(unread.body.total).toBe(1);
  });

  it('marking read removes it from unread but keeps it in the main list', async () => {
    const bm = await make('https://example.com/a');
    await agent.patch(`/api/bookmarks/${bm.id}`).send({ read: true });
    const unread = await agent.get('/api/bookmarks').query({ view: 'unread' });
    expect(unread.body.total).toBe(0);
    const all = await agent.get('/api/bookmarks');
    expect(all.body.total).toBe(1);
  });

  it('archiving hides from normal list/search and shows in archived view; reversible', async () => {
    const bm = await make('https://example.com/a');
    await agent.patch(`/api/bookmarks/${bm.id}`).send({ archived: true });

    const all = await agent.get('/api/bookmarks');
    expect(all.body.total).toBe(0);
    const search = await agent.get('/api/bookmarks').query({ q: 'T' });
    expect(search.body.total).toBe(0);

    const archived = await agent.get('/api/bookmarks').query({ view: 'archived' });
    expect(archived.body.total).toBe(1);
    // searchable within archived view
    const archSearch = await agent.get('/api/bookmarks').query({ view: 'archived', q: 'T' });
    expect(archSearch.body.total).toBe(1);

    // un-archive restores
    await agent.patch(`/api/bookmarks/${bm.id}`).send({ archived: false });
    const back = await agent.get('/api/bookmarks');
    expect(back.body.total).toBe(1);
  });
});
