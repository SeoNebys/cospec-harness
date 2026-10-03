import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
beforeEach(async () => {
  agent = await freshAgent();
});

describe('display preferences', () => {
  it('returns defaults', async () => {
    const res = await agent.get('/api/preferences');
    expect(res.body).toEqual({ defaultSort: 'dateAdded_desc', itemsPerPage: 25, fontSize: 'medium' });
  });

  it('updates valid preferences', async () => {
    const res = await agent
      .put('/api/preferences')
      .send({ defaultSort: 'title_asc', itemsPerPage: 50, fontSize: 'large' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ defaultSort: 'title_asc', itemsPerPage: 50, fontSize: 'large' });
  });

  it('rejects out-of-range itemsPerPage', async () => {
    const low = await agent.put('/api/preferences').send({ itemsPerPage: 5 });
    expect(low.status).toBe(400);
    const high = await agent.put('/api/preferences').send({ itemsPerPage: 1000 });
    expect(high.status).toBe(400);
  });

  it('rejects invalid sort/font', async () => {
    expect((await agent.put('/api/preferences').send({ defaultSort: 'nope' })).status).toBe(400);
    expect((await agent.put('/api/preferences').send({ fontSize: 'huge' })).status).toBe(400);
  });
});
