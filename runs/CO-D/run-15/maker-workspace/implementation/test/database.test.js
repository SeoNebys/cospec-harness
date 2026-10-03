import test from 'node:test';
import assert from 'node:assert/strict';
import { StowDatabase } from '../lib/database.js';

function bookmark(url, title, description = '') {
  return { url, canonicalUrl: url, title, description, siteName: new URL(url).hostname, siteIcon: '', previewImage: '', metadataStatus: 'available' };
}

test('SCN-003 to SCN-007, SCN-014 to SCN-016, and SCN-020 to SCN-021: collection operations retain their boundaries', () => {
  const db = new StowDatabase(':memory:', { email: 'owner@example.com', password: 'secret' });
  try {
    const pasta = db.createBookmark(bookmark('https://example.com/pasta', 'Roman pasta', 'A Rome dinner'));
    const travel = db.createBookmark(bookmark('https://example.com/travel', 'Rome on foot'));
    const hidden = db.createBookmark(bookmark('https://example.com/hidden', 'Hidden pecorino tip'));
    db.addTag(pasta.id, 'Cooking');
    db.addTag(pasta.id, 'Italian');
    db.addTag(travel.id, 'Travel');
    db.addTag(travel.id, 'italian');
    assert.deepEqual(db.getBookmark(travel.id).tags.map((tag) => tag.name), ['Italian', 'Travel']);

    db.updateBookmark(pasta.id, {
      noteHtml: '<ul><li>Make this for Sunday</li><li>Buy pecorino</li></ul>',
      notePlain: 'Make this for Sunday\nBuy pecorino',
      readLater: true
    });
    assert.deepEqual(db.listBookmarks({ query: 'sUNDAY', view: 'active' }).items.map((item) => item.id), [pasta.id]);
    assert.deepEqual(db.listBookmarks({ query: 'rome', tag: 'Cooking', view: 'active' }).items.map((item) => item.id), [pasta.id]);
    assert.equal(db.listBookmarks({ query: 'absent', view: 'active' }).total, 0);
    assert.equal(db.listBookmarks({ view: 'later' }).total, 1);
    db.updateBookmark(pasta.id, { readLater: false });
    assert.equal(db.listBookmarks({ view: 'later' }).total, 0);

    const italian = db.getBookmark(pasta.id).tags.find((tag) => tag.name === 'Italian');
    db.removeTag(pasta.id, italian.id);
    assert.deepEqual(db.getBookmark(pasta.id).tags.map((tag) => tag.name), ['Cooking']);
    assert.equal(db.listTags('ita')[0].name, 'Italian');

    db.updateBookmark(hidden.id, { archived: true });
    assert.equal(db.listBookmarks({ query: 'pecorino', view: 'active' }).total, 1);
    assert.equal(db.listBookmarks({ query: 'Hidden', view: 'active' }).total, 0);
    assert.equal(db.listBookmarks({ query: 'Hidden', view: 'aside' }).total, 1);
    db.updateBookmark(hidden.id, { archived: false });
    assert.equal(db.listBookmarks({ query: 'Hidden', view: 'active' }).total, 1);

    for (let index = 0; index < 15; index += 1) db.createBookmark(bookmark(`https://example.com/item-${index}`, `Item ${index}`));
    const firstBatch = db.listBookmarks({ view: 'active', limit: 5, offset: 0 });
    const secondBatch = db.listBookmarks({ view: 'active', limit: 5, offset: 5 });
    assert.equal(firstBatch.items.length, 5);
    assert.equal(secondBatch.items.length, 5);
    assert.equal(new Set([...firstBatch.items, ...secondBatch.items].map((item) => item.id)).size, 10);
    assert.equal(db.listBookmarks({ query: 'Item 14', view: 'active', limit: 5 }).total, 1);
  } finally { db.close(); }
});

test('SCN-010 and SCN-018: authentication uses one seeded account and generic failure data', () => {
  const db = new StowDatabase(':memory:', { email: 'owner@example.com', password: 'secret' });
  try {
    assert.equal(db.authenticate('OWNER@example.com', 'secret').email, 'owner@example.com');
    assert.equal(db.authenticate('owner@example.com', 'wrong'), null);
    assert.equal(db.authenticate('absent@example.com', 'secret'), null);
  } finally { db.close(); }
});
