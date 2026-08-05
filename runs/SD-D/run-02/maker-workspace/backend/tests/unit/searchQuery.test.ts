import { describe, it, expect } from 'vitest';
import { parseSearch } from '../../src/services/search.js';

describe('parseSearch', () => {
  it('AND-joins bare words with prefix matching', () => {
    const { positive, negative } = parseSearch('recipe pasta');
    expect(positive).toBe('recipe* pasta*');
    expect(negative).toBeNull();
  });

  it('keeps exact phrases quoted', () => {
    expect(parseSearch('"slow cooker"').positive).toBe('"slow cooker"');
  });

  it('scopes tag: terms to the tags column', () => {
    expect(parseSearch('tag:recipe').positive).toBe('tags:recipe*');
  });

  it('supports OR and grouping', () => {
    expect(parseSearch('(tag:recipe OR tag:dinner)').positive).toBe('( tags:recipe* OR tags:dinner* )');
  });

  it('extracts exclusions into the negative expression', () => {
    const { positive, negative } = parseSearch('articles -tag:work');
    expect(positive).toBe('articles*');
    expect(negative).toBe('(tags:work*)');
  });

  it('handles the grouped example "(recipe OR dinner) -work"', () => {
    const { positive, negative } = parseSearch('(tag:recipe OR tag:dinner) -work');
    expect(positive).toBe('( tags:recipe* OR tags:dinner* )');
    expect(negative).toBe('(work*)');
  });

  it('supports NOT keyword', () => {
    const { positive, negative } = parseSearch('coffee NOT decaf');
    expect(positive).toBe('coffee*');
    expect(negative).toBe('(decaf*)');
  });
});
