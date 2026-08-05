import { describe, it, expect } from 'vitest';
import { titleFromHtml, deriveTitle, type Fetcher } from '../../src/server/services/title';

const okFetch = (html: string): Fetcher => async () => ({
  ok: true,
  text: async () => html,
});
const failFetch: Fetcher = async () => {
  throw new Error('network down');
};

describe('titleFromHtml', () => {
  it('extracts and trims the page title', () => {
    expect(titleFromHtml('<html><head><title>  Hello  </title></head></html>')).toBe(
      'Hello',
    );
  });

  it('returns null when there is no title', () => {
    expect(titleFromHtml('<html><body>no title</body></html>')).toBeNull();
  });

  it('returns null for an empty title', () => {
    expect(titleFromHtml('<title>   </title>')).toBeNull();
  });
});

describe('deriveTitle (FR-003)', () => {
  it('prefers an explicitly supplied title', async () => {
    const t = await deriveTitle('https://x.com', '  My Title  ', okFetch('<title>Page</title>'));
    expect(t).toBe('My Title');
  });

  it('uses the fetched page title when none is supplied', async () => {
    const t = await deriveTitle('https://x.com', undefined, okFetch('<title>Page</title>'));
    expect(t).toBe('Page');
  });

  it('falls back to the url when the page is unreachable', async () => {
    const t = await deriveTitle('https://x.com', undefined, failFetch);
    expect(t).toBe('https://x.com');
  });

  it('falls back to the url when the page has no title', async () => {
    const t = await deriveTitle('https://x.com', undefined, okFetch('<html></html>'));
    expect(t).toBe('https://x.com');
  });
});
