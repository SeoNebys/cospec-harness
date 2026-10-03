import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createBookmarkServer } from '../server.js';

test('approved bookmark flows work through the application API', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'bookmarks-acceptance-'));
  const dataFile = join(directory, 'bookmarks.json');
  const metadataFetcher = async address => {
    if (address.includes('unavailable.example')) throw new Error('unavailable');
    const url = new URL(address);
    return {
      title: url.searchParams.get('edition') === 'weekend' ? 'A Perfect Day in Rome — Weekend Edition' : 'A Perfect Day in Rome',
      description: 'Morning espresso and a sunset stroll through Trastevere.',
      siteName: 'AFAR',
      iconUrl: 'https://afar.com/favicon.ico',
      previewUrl: 'https://afar.com/rome.jpg'
    };
  };
  const { server, store } = await createBookmarkServer({ dataFile, metadataFetcher });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });

  await t.test('SCN-001: a shortened address saves with retrieved editable details', async () => {
    const response = await request(base, 'POST', '/api/bookmarks', { address: 'afar.com/magazine/a-perfect-day-in-rome' });
    assert.equal(response.status, 201);
    assert.equal(response.body.outcome, 'created');
    assert.equal(response.body.bookmark.title, 'A Perfect Day in Rome');
    assert.equal(response.body.bookmark.address, 'https://afar.com/magazine/a-perfect-day-in-rome');
    assert.ok(response.body.bookmark.previewUrl);
  });

  let primary = (await store.all())[0];
  await t.test('SCN-002/003/004/008: later edits retain address, tags, and formatted notes', async () => {
    const response = await request(base, 'PUT', `/api/bookmarks/${primary.id}`, {
      title: 'My Perfect Day in Rome',
      description: 'My corrected description',
      address: 'https://afar.com/magazine/rome-in-a-day',
      tags: ['travel', 'TRAVEL', 'article'],
      notes: '## Before we go\n- Reserve the **rooftop tour**'
    });
    assert.equal(response.status, 200);
    primary = response.body.bookmark;
    assert.equal(primary.title, 'My Perfect Day in Rome');
    assert.deepEqual(primary.tags, ['travel', 'article']);
    assert.match(primary.notes, /\*\*rooftop tour\*\*/);
    assert.equal(primary.previewUrl, 'https://afar.com/rome.jpg');
  });

  await t.test('SCN-006/007: edited details, notes, tags, and expressions are searchable', async () => {
    assert.equal((await get(base, '/api/bookmarks?q=ROOFTOP')).body.results[0].id, primary.id);
    assert.match((await get(base, '/api/bookmarks?q=ROOFTOP')).body.results[0].matchExcerpt, /rooftop/);
    assert.equal((await get(base, '/api/bookmarks?q=%23TRAVEL')).body.results[0].id, primary.id);
    assert.equal((await get(base, '/api/bookmarks?q=Rome%20AND%20NOT%20%23book')).body.results[0].id, primary.id);
  });

  await t.test('SCN-009: cluttered duplicate opens the existing record without a copy', async () => {
    const messy = 'https://www.afar.com/magazine/rome-in-a-day/?utm_source=email#top';
    const response = await request(base, 'POST', '/api/bookmarks', { address: messy });
    assert.equal(response.body.outcome, 'existing');
    assert.equal(response.body.bookmark.id, primary.id);
    assert.equal((await store.all()).length, 1);
  });

  await t.test('SCN-009: meaningful address values create a separate bookmark', async () => {
    const response = await request(base, 'POST', '/api/bookmarks', { address: 'https://afar.com/magazine/rome-in-a-day?edition=weekend' });
    assert.equal(response.status, 201);
    assert.equal(response.body.outcome, 'created');
    assert.match(response.body.bookmark.address, /edition=weekend/);
    assert.equal((await store.all()).length, 2);
  });

  await t.test('SCN-010: unavailable pages are saved immediately with basic details', async () => {
    const response = await request(base, 'POST', '/api/bookmarks', { address: 'https://unavailable.example/field-notes' });
    assert.equal(response.status, 201);
    assert.equal(response.body.outcome, 'created-basic');
    assert.equal(response.body.bookmark.title, 'unavailable.example/field-notes');
    assert.equal(response.body.bookmark.detailsAvailable, false);
  });

  await t.test('SCN-011: malformed words create nothing', async () => {
    const count = (await store.all()).length;
    const response = await request(base, 'POST', '/api/bookmarks', { address: 'rome travel ideas' });
    assert.equal(response.status, 400);
    assert.match(response.body.error, /complete web address/i);
    assert.equal((await store.all()).length, count);
  });

  await t.test('SCN-012: no-match and incomplete searches remain distinct', async () => {
    assert.deepEqual((await get(base, '/api/bookmarks?q=volcano')).body.results, []);
    assert.equal((await get(base, '/api/bookmarks?q=Rome%20AND%20(')).body.status, 'incomplete');
  });

  await t.test('SCN-013/015: long and externally unavailable records remain intact', async () => {
    const longTitle = 'A'.repeat(450);
    const response = await request(base, 'PUT', `/api/bookmarks/${primary.id}`, {
      ...primary,
      title: longTitle,
      tags: ['one', 'two', 'three', 'four', 'five', 'six'],
      notes: primary.notes
    });
    assert.equal(response.body.bookmark.title, longTitle);
    assert.equal(response.body.bookmark.tags.length, 6);
    assert.equal((await store.findById(primary.id)).previewUrl, 'https://afar.com/rome.jpg');
  });

  await t.test('the prepared web application is served', async () => {
    const response = await fetch(base);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Your collection starts here/);
  });
});

async function get(base, path) {
  const response = await fetch(`${base}${path}`);
  return { status: response.status, body: await response.json() };
}

async function request(base, method, path, body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { status: response.status, body: await response.json() };
}
