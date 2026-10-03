import type { CreateBookmarkInput } from '../../src/shared/bookmark-types.js';

let sequence = 0;

export function bookmarkInput(overrides: Partial<CreateBookmarkInput> = {}): CreateBookmarkInput {
  sequence += 1;
  return {
    title: `Example ${sequence}`,
    url: `https://example.com/item-${sequence}`,
    notes: '',
    tags: [],
    ...overrides,
  };
}

export const fixedClock = () => '2026-09-25T12:00:00.000Z';
