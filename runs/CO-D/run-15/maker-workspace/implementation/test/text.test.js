import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText, stripTags } from '../lib/text.js';

test('SCN-008 and SCN-016: note formatting is retained while unsafe markup is removed', () => {
  const safe = sanitizeRichText('<ul class="bad"><li>Make this <strong>Sunday</strong></li><li>Buy pecorino</li></ul><img src=x onerror=alert(1)>');
  assert.equal(safe, '<ul><li>Make this <strong>Sunday</strong></li><li>Buy pecorino</li></ul>');
  assert.match(stripTags(safe), /Sunday/);
  assert.match(stripTags(safe), /pecorino/);
});
