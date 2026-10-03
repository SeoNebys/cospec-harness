export const queryKeys = {
  bookmarks: (params: string) => ['bookmarks', params] as const,
  bookmark: (id: string) => ['bookmark', id] as const,
  tags: (prefix: string) => ['tags', prefix] as const,
  preferences: ['preferences'] as const,
};
