import test from 'node:test';
import assert from 'node:assert/strict';
import { request, startTestApp } from './helpers.mjs';

test('approved API flows preserve bookmark identity, context, lists, and readable copies', async t => {
  const env = await startTestApp();
  t.after(env.close);
  const base = env.app.baseUrl;
  const article = `${env.fixture.baseUrl}/article`;

  let result = await request(base, '/api/preview', { method: 'POST', body: JSON.stringify({ url: 'not a link' }) });
  assert.equal(result.response.status, 400, 'SCN-010 malformed text is rejected');

  result = await request(base, '/api/preview', { method: 'POST', body: JSON.stringify({ url: article }) });
  assert.equal(result.body.kind, 'preview', 'SCN-001 available page is enriched');
  assert.equal(result.body.preview.title, 'Designing for Readers');
  assert.ok(result.body.preview.archive.body.length >= 2, 'SCN-009 readable body is captured');

  const preview = result.body.preview;
  result = await request(base, '/api/bookmarks', { method: 'POST', body: JSON.stringify({ ...preview, note: 'Use this for the typography workshop', tags: ['design'] }) });
  assert.equal(result.response.status, 201, 'SCN-001 bookmark saves');
  const saved = result.body.bookmark;

  result = await request(base, '/api/preview', { method: 'POST', body: JSON.stringify({ url: `${article}/?utm_source=newsletter` }) });
  assert.equal(result.body.kind, 'duplicate', 'SCN-012 referral variation finds existing bookmark');
  assert.equal(result.body.bookmark.id, saved.id);

  result = await request(base, `/api/bookmarks/${saved.id}`, {
    method: 'PUT', body: JSON.stringify({ title: 'Designing for Focused Reading', note: 'Use this for the typography workshop', tags: ['design', 'Design', 'reading'] })
  });
  assert.equal(result.body.bookmark.title, 'Designing for Focused Reading', 'SCN-002 original bookmark updates');
  assert.deepEqual(result.body.bookmark.tags, ['design', 'reading'], 'SCN-014 duplicate tags collapse');

  result = await request(base, '/api/bookmarks?search=workshop');
  assert.equal(result.body.total, 1, 'SCN-003 personal note is searchable');
  result = await request(base, '/api/bookmarks?search=rewarding');
  assert.equal(result.body.total, 1, 'SCN-003 description is searchable');
  result = await request(base, '/api/bookmarks?search=focused');
  assert.equal(result.body.total, 1, 'SCN-003 title is searchable');
  result = await request(base, '/api/bookmarks?search=volcano');
  assert.equal(result.body.total, 0, 'SCN-011 no-match search stays empty');
  result = await request(base, '/api/bookmarks?tag=design');
  assert.equal(result.body.total, 1, 'SCN-007 tag filtering returns tagged item');

  result = await request(base, `/api/bookmarks/${saved.id}/read-later`, { method: 'POST' });
  assert.equal(result.body.bookmark.readLater, true, 'SCN-006 bookmark is marked for later');
  result = await request(base, '/api/bookmarks?readLater=true');
  assert.equal(result.body.total, 1, 'SCN-006 shortlist contains marked bookmark');
  result = await request(base, `/api/bookmarks/${saved.id}/read-later`, { method: 'POST' });
  assert.equal(result.body.bookmark.readLater, false, 'SCN-006 bookmark leaves shortlist without deletion');

  result = await request(base, `/api/bookmarks/${saved.id}/archive`);
  assert.ok(result.body.archive.body.length >= 2, 'SCN-009 saved copy contains readable content');
  env.fixture.status.article = false;
  result = await request(base, `/api/bookmarks/${saved.id}/availability`, { method: 'POST' });
  assert.equal(result.body.bookmark.originalAvailable, false, 'SCN-009 availability refresh marks the original unavailable before opening');
  result = await request(base, `/api/bookmarks/${saved.id}/resolve`, { method: 'POST' });
  assert.equal(result.body.target, 'archive', 'SCN-009 unavailable original falls back to saved copy');
  env.fixture.status.article = true;

  const flaky = `${env.fixture.baseUrl}/flaky`;
  result = await request(base, '/api/preview', { method: 'POST', body: JSON.stringify({ url: flaky }) });
  assert.equal(result.body.kind, 'unreachable', 'SCN-010 unreachable valid link is retained');
  result = await request(base, '/api/bookmarks', {
    method: 'POST', body: JSON.stringify({ url: flaky, source: 'fixture', title: 'My offline title', description: 'My description', note: 'My note', manualContext: true, archive: { status: 'pending' }, originalAvailable: false })
  });
  const manual = result.body.bookmark;
  assert.equal(manual.archive.status, 'pending');
  env.fixture.status.flaky = true;
  result = await request(base, `/api/bookmarks/${manual.id}/retry`, { method: 'POST' });
  assert.equal(result.body.bookmark.archive.status, 'ready', 'SCN-010 later capture becomes ready');
  assert.equal(result.body.bookmark.title, 'My offline title', 'SCN-010 manual title is preserved');
  assert.equal(result.body.bookmark.description, 'My description');
  assert.equal(result.body.bookmark.note, 'My note');

  result = await request(base, `/api/bookmarks/${manual.id}`, { method: 'DELETE' });
  assert.equal(result.body.deleted, true, 'SCN-008 deletion succeeds after confirmation at UI');
  result = await request(base, '/api/bookmarks');
  assert.equal(result.body.total, 1, 'SCN-006 shortlist removal and unrelated deletion do not remove original bookmark');
});
