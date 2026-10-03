export function bookmarkInput(overrides: Record<string, unknown> = {}) {
  return {
    url: 'https://example.com/article',
    title: 'A useful article',
    notes: 'Keep this for later',
    tags: ['Reading', 'Ideas'],
    isFavorite: false,
    ...overrides,
  };
}
