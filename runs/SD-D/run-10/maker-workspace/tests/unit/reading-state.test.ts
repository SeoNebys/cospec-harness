import { BookmarkStateService } from '../../src/server/domain/bookmark-state-service';
import type { BookmarkRepository, BookmarkRecord } from '../../src/server/repositories/bookmark-repository';

const record = { id: 'bmk_one', version: 1, readingState: 'none', isFavorite: true } as BookmarkRecord;

describe('reading state', () => {
  it('changes reading state without changing favorite state', () => {
    const repository = {
      getOwned: vi.fn(() => record),
      updateState: vi.fn((_user, _id, _version, changes) => ({ ...record, ...changes, version: 2 })),
    } as unknown as BookmarkRepository;
    const result = new BookmarkStateService(repository).setReading(1, 'bmk_one', 1, 'unread');
    expect(result.readingState).toBe('unread');
    expect(result.isFavorite).toBe(true);
    expect(repository.updateState).toHaveBeenCalledWith(1, 'bmk_one', 1, { readingState: 'unread' });
  });
});
