import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
async function seed() {
  await agent.post('/api/bookmarks').send({ url: 'https://a.example/react', title: 'React Guide', tags: ['frontend'] });
  await agent.post('/api/bookmarks').send({ url: 'https://b.example/vue', title: 'Vue Guide', tags: ['frontend'] });
  await agent.post('/api/bookmarks').send({ url: 'https://c.example/invoice', title: 'Invoices', description: 'invoice tips', tags: ['work'] });
}

beforeEach(async () => {
  agent = await freshAgent();
  await seed();
});

describe('list, search, sort, paginate', () => {
  it('lists all with total', async () => {
    const res = await agent.get('/api/bookmarks');
    expect(res.body.total).toBe(3);
  });

  it('searches with #tag', async () => {
    const res = await agent.get('/api/bookmarks').query({ q: '#frontend' });
    expect(res.body.total).toBe(2);
  });

  it('text + #tag requires both', async () => {
    const res = await agent.get('/api/bookmarks').query({ q: 'invoice #work' });
    expect(res.body.total).toBe(1);
    const none = await agent.get('/api/bookmarks').query({ q: 'invoice #frontend' });
    expect(none.body.total).toBe(0);
  });

  it('boolean OR and parentheses', async () => {
    const res = await agent.get('/api/bookmarks').query({ q: '(react OR vue) #frontend' });
    expect(res.body.total).toBe(2);
  });

  it('returns 400 on malformed query', async () => {
    const res = await agent.get('/api/bookmarks').query({ q: 'react OR' });
    expect(res.status).toBe(400);
  });

  it('sorts by title', async () => {
    const res = await agent.get('/api/bookmarks').query({ sort: 'title_asc' });
    const titles = res.body.items.map((b) => b.title);
    expect(titles).toEqual(['Invoices', 'React Guide', 'Vue Guide']);
  });

  it('paginates', async () => {
    const res = await agent.get('/api/bookmarks').query({ pageSize: 2, page: 1 });
    expect(res.body.items.length).toBe(2);
    expect(res.body.total).toBe(3);
  });
});
