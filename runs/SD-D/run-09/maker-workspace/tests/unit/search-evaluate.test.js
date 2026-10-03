import { describe, it, expect } from 'vitest';
import { parse } from '../../src/server/services/search/parser.js';
import { evaluate, searchableText } from '../../src/server/services/search/evaluate.js';

const bookmark = {
  title: 'Climbing Guide',
  description: 'Outdoor bouldering',
  note: 'no gym here',
  url: 'https://rocks.example.com/climb',
  tags: ['sport', 'outdoors'],
};

describe('evaluate', () => {
  it('is case-insensitive across fields', () => {
    expect(evaluate(parse('CLIMBING'), bookmark)).toBe(true);
    expect(evaluate(parse('bouldering'), bookmark)).toBe(true);
    expect(evaluate(parse('rocks.example.com'), bookmark)).toBe(true);
  });

  it('matches tags via #tag only', () => {
    expect(evaluate(parse('#sport'), bookmark)).toBe(true);
    expect(evaluate(parse('#missing'), bookmark)).toBe(false);
  });

  it('boolean logic', () => {
    expect(evaluate(parse('climbing AND #sport'), bookmark)).toBe(true);
    expect(evaluate(parse('climbing AND gym'), bookmark)).toBe(true); // gym is in note
    expect(evaluate(parse('climbing NOT gym'), bookmark)).toBe(false);
  });

  it('searchableText concatenates fields lowercased', () => {
    const t = searchableText(bookmark);
    expect(t).toContain('climbing guide');
    expect(t).toContain('https://rocks.example.com/climb');
  });
});
