import { describe, it, expect, beforeEach } from 'vitest';
import { freshAgent } from '../helpers/app.js';

let agent;
beforeEach(async () => {
  agent = await freshAgent();
});

describe('duplicate address opens existing (US2)', () => {
  it('commit of a duplicate returns the existing bookmark, no new row', async () => {
    const first = await agent.post('/api/bookmarks').send({ url: 'https://example.com/page', title: 'First' });
    expect(first.status).toBe(201);
    const id = first.body.id;

    const variants = [
      'https://example.com/page',
      'http://example.com/page',
      'HTTPS://Example.COM/page',
    ];
    for (const url of variants) {
      // preview should report the existing bookmark
      const prev = await agent.post('/api/bookmarks/preview').send({ url });
      expect(prev.body.existing).toBeTruthy();
      expect(prev.body.existing.id).toBe(id);
      // commit should not create a duplicate
      const again = await agent.post('/api/bookmarks').send({ url });
      expect(again.body.existing).toBe(true);
      expect(again.body.id).toBe(id);
    }

    const list = await agent.get('/api/bookmarks');
    expect(list.body.total).toBe(1);
  });
});
