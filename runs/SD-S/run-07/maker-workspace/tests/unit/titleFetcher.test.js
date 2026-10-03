import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { deriveTitle } from '../../src/services/titleFetcher.js';

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

test('deriveTitle extracts the page <title>', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'text/html; charset=utf-8' },
    text: async () => '<html><head><title>  Hello   World </title></head></html>',
  });
  const title = await deriveTitle('https://example.com');
  assert.equal(title, 'Hello World');
});

test('deriveTitle falls back to the address when fetch fails', async () => {
  globalThis.fetch = async () => {
    throw new Error('network down');
  };
  const title = await deriveTitle('https://example.com/page');
  assert.equal(title, 'https://example.com/page');
});

test('deriveTitle falls back when there is no title element', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'text/html' },
    text: async () => '<html><head></head><body>no title</body></html>',
  });
  const title = await deriveTitle('https://example.com/x');
  assert.equal(title, 'https://example.com/x');
});

test('deriveTitle falls back for non-HTML responses', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    headers: { get: () => 'application/pdf' },
    text: async () => '%PDF-1.4',
  });
  const title = await deriveTitle('https://example.com/file.pdf');
  assert.equal(title, 'https://example.com/file.pdf');
});
