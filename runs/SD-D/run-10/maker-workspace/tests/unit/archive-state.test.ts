import { ArchiveService } from '../../src/server/domain/archive-service';
import type { BookmarkRepository, BookmarkRecord } from '../../src/server/repositories/bookmark-repository';

describe('archive state', () => {
  it('preserves bookmark fields when archiving', () => {
    const current = {
      id: 'bmk_one',
      version: 2,
      archivedAt: null,
      isFavorite: true,
      readingState: 'unread',
      tags: [{ id: 'tag_one', name: 'News' }],
    } as BookmarkRecord;
    const repository = {
      getOwned: vi.fn(() => current),
      updateState: vi.fn(() => ({ ...current, archivedAt: new Date().toISOString(), version: 3 })),
    } as unknown as BookmarkRepository;
    const result = new ArchiveService(repository).archive(1, 'bmk_one', 2);
    expect(result).toMatchObject({ isFavorite: true, readingState: 'unread', tags: current.tags });
  });
});
