import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
async function seed() {
  const ids = [];
  for (const [url, tag] of [
    ['https://a.example/1', 'x'],
    ['https://b.example/2', 'x'],
    ['https://c.example/3', 'y'],
  ]) {
    const r = await agent.post('/api/bookmarks').send({ url, title: 'T', tags: [tag] });
    ids.push(r.body.id);
  }
  return ids;
}

beforeEach(async () => {
  agent = await freshAgent();
});

describe('bulk actions', () => {
  it('applies an action to explicit ids', async () => {
    const ids = await seed();
    const res = await agent.post('/api/bookmarks/bulk').send({ ids: ids.slice(0, 2), action: 'markRead' });
    expect(res.body.affected).toBe(2);
    const unread = await agent.get('/api/bookmarks').query({ view: 'unread' });
    expect(unread.body.total).toBe(1);
  });

  it('select-all-matching a search applies to the whole view', async () => {
    await seed();
    const res = await agent
      .post('/api/bookmarks/bulk')
      .send({ match: { view: 'all', q: '#x' }, action: 'archive' });
    expect(res.body.affected).toBe(2);
    const all = await agent.get('/api/bookmarks');
    expect(all.body.total).toBe(1);
    const archived = await agent.get('/api/bookmarks').query({ view: 'archived' });
    expect(archived.body.total).toBe(2);
  });

  it('bulk addTag', async () => {
    const ids = await seed();
    await agent.post('/api/bookmarks/bulk').send({ ids, action: 'addTag', value: 'common' });
    const res = await agent.get('/api/bookmarks').query({ q: '#common' });
    expect(res.body.total).toBe(3);
  });

  it('requires confirmDelete for bulk delete', async () => {
    const ids = await seed();
    const denied = await agent.post('/api/bookmarks/bulk').send({ ids, action: 'delete' });
    expect(denied.status).toBe(400);
    const ok = await agent.post('/api/bookmarks/bulk').send({ ids, action: 'delete', confirmDelete: true });
    expect(ok.body.affected).toBe(3);
    const all = await agent.get('/api/bookmarks');
    expect(all.body.total).toBe(0);
  });

  it('requires a value for tag actions', async () => {
    const ids = await seed();
    const res = await agent.post('/api/bookmarks/bulk').send({ ids, action: 'addTag' });
    expect(res.status).toBe(400);
  });
});
