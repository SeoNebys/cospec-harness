import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createTestApp, type TestApp } from '../helpers/app.js';

describe('GET /api/bookmarks search', () => {
  let testApp: TestApp;

  beforeEach(async () => {
    testApp = await createTestApp();
    const db = testApp.storage.database.raw;
    const insert = db.prepare(`INSERT INTO bookmarks
      (id,url,normalized_url,title,description,icon_path,notes,read_later,is_read,created_at,updated_at)
      VALUES(?,?,?,?,?,NULL,?,?,?, ?,?)`);
    insert.run('00000000-0000-4000-8000-000000000011','https://rome.test','https://rome.test/','Ancient Rome guide','A city history','travel notes',0,0,'2026-01-03T00:00:00.000Z','2026-01-03T00:00:00.000Z');
    insert.run('00000000-0000-4000-8000-000000000012','https://book.test','https://book.test/','Rome reading list','Ancient cities','later',1,0,'2026-01-02T00:00:00.000Z','2026-01-02T00:00:00.000Z');
    insert.run('00000000-0000-4000-8000-000000000013','https://other.test','https://other.test/','Zebras',null,null,0,0,'2026-01-01T00:00:00.000Z','2026-01-01T00:00:00.000Z');
    db.exec(`INSERT INTO tags(id,display_name,normalized_name) VALUES
      (1,'Article','article'),(2,'Book','book'),(3,'Science Fiction','science fiction');
      INSERT INTO bookmark_tags(bookmark_id,tag_id) VALUES
      ('00000000-0000-4000-8000-000000000011',1),
      ('00000000-0000-4000-8000-000000000012',2),
      ('00000000-0000-4000-8000-000000000012',3);`);
  });

  afterEach(async () => testApp.close());

  it('returns authoritative AST and labels for combined search', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?q=Rome%20tag%3A(article%7Cbook)' });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.items.map((item: { title: string }) => item.title)).toEqual([
      'Ancient Rome guide', 'Rome reading list',
    ]);
    expect(body.data.query).toMatchObject({ raw: 'Rome tag:(article|book)' });
    expect(body.data.query.ast.clauses).toHaveLength(2);
    expect(body.data.query.labels).toEqual(['Contains: rome', 'Tag is any of: article, book']);
  });

  it('keeps quoted phrases within one field and supports exact tags', async () => {
    const phrase = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?q=%22ancient%20rome%22' });
    expect(phrase.json().data.items).toHaveLength(1);
    const tag = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?q=tag%3A%22science%20fiction%22' });
    expect(tag.json().data.items.map((item: { title: string }) => item.title)).toEqual(['Rome reading list']);
  });

  it('ANDs multiple selected tags and applies each allowed sort direction', async () => {
    const filtered = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?tag=book&tag=science%20fiction' });
    expect(filtered.json().data.items).toHaveLength(1);
    const ascending = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?sort=title&order=asc' });
    expect(ascending.json().data.items.map((item: { title: string }) => item.title)).toEqual([
      'Ancient Rome guide', 'Rome reading list', 'Zebras',
    ]);
    const descending = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?sort=createdAt&order=desc' });
    expect(descending.json().data.items.map((item: { title: string }) => item.title)).toEqual([
      'Ancient Rome guide', 'Rome reading list', 'Zebras',
    ]);
  });

  it('lists available tags with bookmark counts', async () => {
    const response = await testApp.app.inject({ method: 'GET', url: '/api/tags' });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toEqual([
      { name: 'Article', bookmarkCount: 1 },
      { name: 'Book', bookmarkCount: 1 },
      { name: 'Science Fiction', bookmarkCount: 1 },
    ]);
  });

  it('returns empty results and stable HTTP 400 parse envelopes', async () => {
    const empty = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?q=missing' });
    expect(empty.json().data.items).toEqual([]);
    const invalid = await testApp.app.inject({ method: 'GET', url: '/api/bookmarks?q=%22unclosed' });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error).toMatchObject({ code: 'UNCLOSED_QUOTE', span: { start: 0, end: 9 } });
    const tooLong = await testApp.app.inject({ method: 'GET', url: `/api/bookmarks?q=${'x'.repeat(1_001)}` });
    expect(tooLong.statusCode).toBe(400);
    expect(tooLong.json().error.code).toBe('QUERY_TOO_LONG');
  });
});
