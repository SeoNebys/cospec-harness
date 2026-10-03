export const bookmarkInput = (suffix = '') => ({
  url: `https://example.com/article${suffix}`,
  title: `Article ${suffix || 'one'}`,
  description: 'Fixture description',
  tagLabels: ['Research'],
  readingState: 'unread' as const,
});
