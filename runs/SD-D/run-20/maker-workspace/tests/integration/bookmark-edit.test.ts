import { expect, it } from 'vitest';
import { buildApp } from '../../src/server/app';
import { temporaryDatabase } from '../fixtures/database';
it('transactionally updates fields, formatted notes, tags and search text', async () => {
  const fixture = temporaryDatabase();
  const app = await buildApp({ db: fixture.db });
  const created = (
    await app.inject({ method: 'POST', url: '/api/bookmarks', payload: { url: 'https://example.com/edit' } })
  ).json();
  const note = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Unique searchable note', marks: [{ type: 'italic' }] }],
      },
    ],
  };
  const updated = await app.inject({
    method: 'PATCH',
    url: `/api/bookmarks/${created.id}`,
    payload: { title: 'Changed', description: 'Context', tagLabels: ['Useful'], noteDocument: note },
  });
  expect(updated.json()).toMatchObject({ title: 'Changed', description: 'Context' });
  expect((await app.inject('/api/bookmarks?q=unique')).json().total).toBe(1);
  await app.close();
  fixture.close();
});
