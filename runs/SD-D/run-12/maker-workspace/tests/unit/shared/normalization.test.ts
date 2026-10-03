import { describe, expect, it } from 'vitest';
import { canonicalizeUrl, normalizeSearch, normalizeTag } from '../../../src/shared/normalization/index.js';

describe('normalization', () => {
  it('uses NFKC and Unicode lowercase without folding accents', () => {
    expect(normalizeSearch('  ＣAFÉ  ')).toBe('  café  ');
    expect(normalizeSearch('cafe')).not.toBe(normalizeSearch('café'));
  });

  it('normalizes tag identity whitespace and case', () => {
    expect(normalizeTag('  Machine   LEARNING  ')).toBe('machine learning');
  });

  it('canonicalizes scheme, host, default port, and fragment while preserving query', () => {
    expect(canonicalizeUrl(' HTTPS://Example.COM:443/path?q=One#section ')).toBe('https://example.com/path?q=One');
  });
});
