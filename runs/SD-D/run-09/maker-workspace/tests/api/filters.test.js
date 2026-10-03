import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
beforeEach(async () => {
  agent = await freshAgent();
});

describe('saved filters', () => {
  it('creates, lists, applies, edits and deletes filters', async () => {
    // seed bookmarks
    await agent.post('/api/bookmarks').send({ url: 'https://a.example/1', title: 'React news', tags: ['frontend'] });
    await agent.post('/api/bookmarks').send({ url: 'https://b.example/2', title: 'React archive tips', tags: ['frontend', 'old'] });
    await agent.post('/api/bookmarks').send({ url: 'https://c.example/3', title: 'Backend', tags: ['backend'] });

    const created = await agent.post('/api/filters').send({
      name: 'Fresh frontend',
      query: 'react',
      includeTags: ['frontend'],
      excludeTags: ['old'],
    });
    expect(created.status).toBe(201);

    const list = await agent.get('/api/filters');
    expect(list.body.length).toBe(1);

    // apply the filter's criteria against the list endpoint
    const f = created.body;
    const applied = await agent.get('/api/bookmarks').query({
      q: f.query,
      includeTags: f.includeTags,
      excludeTags: f.excludeTags,
    });
    expect(applied.body.total).toBe(1);
    expect(applied.body.items[0].title).toBe('React news');

    // edit
    const edited = await agent.patch(`/api/filters/${f.id}`).send({ name: 'Renamed' });
    expect(edited.body.name).toBe('Renamed');

    // delete
    const del = await agent.delete(`/api/filters/${f.id}`);
    expect(del.status).toBe(204);
    const after = await agent.get('/api/filters');
    expect(after.body.length).toBe(0);

    // bookmarks untouched
    const all = await agent.get('/api/bookmarks');
    expect(all.body.total).toBe(3);
  });

  it('rejects a filter without a name', async () => {
    const res = await agent.post('/api/filters').send({ query: 'x' });
    expect(res.status).toBe(400);
  });
});
