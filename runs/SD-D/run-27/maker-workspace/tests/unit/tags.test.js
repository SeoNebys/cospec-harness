import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let getOrCreateTag, db;

before(async () => {
  process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'bm-tags-'));
  const tags = await import('../../server/api/tags.js');
  ({ getOrCreateTag } = tags);
  ({ db } = await import('../../server/db/db.js'));
});

after(() => { try { db.close(); } catch {} });

test('getOrCreateTag reuses case-insensitive match (no duplicate tag)', () => {
  const a = getOrCreateTag('Work');
  const b = getOrCreateTag('work');
  const c = getOrCreateTag('WORK');
  assert.equal(a.id, b.id);
  assert.equal(a.id, c.id);
  const count = db.prepare("SELECT COUNT(*) c FROM tags WHERE lower(name)='work'").get().c;
  assert.equal(count, 1);
});

test('different names create different tags', () => {
  const a = getOrCreateTag('alpha');
  const b = getOrCreateTag('beta');
  assert.notEqual(a.id, b.id);
});
