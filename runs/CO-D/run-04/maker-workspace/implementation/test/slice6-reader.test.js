import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractReadable } from '../extension/src/reader.js';

const article = `<!DOCTYPE html><html><head><title>The Best Pizza Dough — Serious Eats</title>
  <script>tracker()</script><style>.x{}</style></head>
  <body><nav>menu menu menu</nav>
    <article><h1>The Best Pizza Dough</h1>
      <p>A cold-ferment dough gives you a blistered, airy crust. Rest it 24 hours in the fridge for real flavour development and better browning in a hot oven.</p>
      <p>Use <b>00 flour</b> for a tender chew, and don't skimp on salt.</p>
      <img src="/img/crust.jpg" alt="crust">
      <a href="/recipe/full">Full recipe</a>
    </article>
    <footer>© 2026 lots of footer junk here</footer></body></html>`;

test('SCN-016: extracts a clean readable copy — title, text, no scripts/nav/footer', () => {
  const r = extractReadable(article, 'https://www.seriouseats.com/pizza');
  assert.equal(r.title, 'The Best Pizza Dough — Serious Eats');
  assert.ok(r.text.includes('cold-ferment dough'));
  assert.ok(r.text.includes('00 flour'));
  assert.ok(!/tracker|menu menu|footer junk/.test(r.text)); // scripts/nav/footer dropped
  assert.equal(r.partial, false);
});

test('SCN-016: relative image and link URLs are made absolute', () => {
  const r = extractReadable(article, 'https://www.seriouseats.com/pizza');
  assert.ok(r.html.includes('https://www.seriouseats.com/img/crust.jpg'));
  assert.ok(r.html.includes('https://www.seriouseats.com/recipe/full'));
});

test('SCN-016: keeps only safe formatting tags', () => {
  const r = extractReadable(article, 'https://x');
  assert.ok(r.html.includes('<b>00 flour</b>'));
  assert.ok(!/<script|<style|<nav|<footer/i.test(r.html));
});

test('SCN-016: a login/near-empty page is flagged partial (honest labelling)', () => {
  const r = extractReadable('<html><head><title>Sign in</title></head><body><form>Please log in</form></body></html>', 'https://x');
  assert.equal(r.partial, true);
});
