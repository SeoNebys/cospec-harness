import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseNetscape, serializeNetscape } from '../../server/lib/netscape.js';

const SAMPLE = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<DL><p>
  <DT><H3>Work</H3>
  <DL><p>
    <DT><A HREF="https://example.com/report" ADD_DATE="1600000000" TAGS="finance,urgent">Quarterly Report</A>
  </DL><p>
  <DT><A HREF="https://example.org/" ADD_DATE="1610000000">Example Org</A>
</DL><p>`;

test('parse preserves title, tags (folder + TAGS), and ADD_DATE', () => {
  const entries = parseNetscape(SAMPLE);
  const byUrl = Object.fromEntries(entries.map(e => [e.url, e]));

  const rep = byUrl['https://example.com/report'];
  assert.ok(rep);
  assert.equal(rep.title, 'Quarterly Report');
  assert.equal(rep.addDate, 1600000000);
  assert.ok(rep.tags.includes('Work'));     // folder -> tag
  assert.ok(rep.tags.includes('finance'));  // TAGS attr
  assert.ok(rep.tags.includes('urgent'));

  const org = byUrl['https://example.org/'];
  assert.ok(org);
  assert.equal(org.title, 'Example Org');
  assert.equal(org.addDate, 1610000000);
});

test('serialize produces re-parseable output preserving title/tags/date', () => {
  const html = serializeNetscape([
    { url: 'https://a.com/x', title: 'Alpha', tags: ['t1', 't2'], created_at: 1600000000000 }
  ]);
  const entries = parseNetscape(html);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].title, 'Alpha');
  assert.equal(entries[0].addDate, 1600000000);
  assert.deepEqual(entries[0].tags.sort(), ['t1', 't2']);
});
