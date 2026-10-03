import type { BookmarkList, SortOrder } from '../../src/shared/types';

export function largeLibrary(sort: SortOrder = 'newest', count = 10_000): BookmarkList {
  const items = Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    url: `https://example.com/item-${index}`,
    title: `Bookmark ${String(index).padStart(5, '0')}`,
    description: `Description ${index}`,
    notes: null,
    tags: [index % 2 ? 'Reading' : 'Reference'],
    isFavorite: index % 5 === 0,
    createdAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
    updatedAt: new Date(1_700_000_000_000 + index * 1000).toISOString(),
  }));
  if (sort === 'newest') items.reverse();
  return { items, total: count, tags: [{ name: 'Reading', count: count / 2 }, { name: 'Reference', count: count / 2 }] };
}
