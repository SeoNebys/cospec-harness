import type { BookmarkDetail } from '../../shared/contracts/bookmarks';
import type { SearchCriteria } from '../../shared/contracts/search';
import type { CollectionOption } from '../features/collections/CollectionPicker';
import { BookmarkCard } from '../features/bookmarks/BookmarkCard';
import { SearchBar } from '../features/search/SearchBar';
import { SearchFilters } from '../features/search/SearchFilters';
import { StatePanel } from '../components/StatePanel';

type Props = {
  bookmarks: BookmarkDetail[];
  total: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadError: string;
  title?: string;
  eyebrow?: string;
  emptyTitle?: string;
  emptyDetail?: string;
  criteria: SearchCriteria;
  collections: CollectionOption[];
  tags: Array<{ id: string; name: string }>;
  selected: Set<string>;
  onCriteria(criteria: SearchCriteria): void;
  onToggleSelect(bookmark: BookmarkDetail): void;
  onLoadMore(): void;
  onAdd(): void;
  onSelect(bookmark: BookmarkDetail): void;
  onReading(bookmark: BookmarkDetail): void;
  onFavorite(bookmark: BookmarkDetail): void;
};
export function LibraryPage({
  bookmarks,
  total,
  hasMore,
  loadingMore,
  loadError,
  title = 'Library',
  eyebrow = 'Your collected web',
  emptyTitle = 'Save the page you don’t want to lose.',
  emptyDetail = 'Paste a link and Keepwell will collect its useful details—then make every field your own.',
  criteria,
  collections,
  tags,
  selected,
  onCriteria,
  onToggleSelect,
  onLoadMore,
  onAdd,
  onSelect,
  onReading,
  onFavorite,
}: Props) {
  const filtered = Boolean(
    criteria.query ||
      criteria.includeTagIds.length ||
      criteria.excludeTagIds.length ||
      criteria.collection.mode !== 'any' ||
      criteria.favorite !== 'any' ||
      criteria.reading !== 'any',
  );
  return (
    <main className="library-page" id="library">
      <header className="topbar">
        <div className="mobile-wordmark">
          <span className="wordmark-mark">K</span> Keepwell
        </div>
        <div className="topbar-actions">
          <button className="button button--primary" onClick={onAdd}>
            <span>＋</span> Add bookmark
          </button>
        </div>
      </header>
      <section className="library-intro">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{total === 0 ? 'Nothing here yet.' : `${total} ${total === 1 ? 'bookmark' : 'bookmarks'}`}</p>
        </div>
        <SearchBar
          value={criteria.query}
          error={loadError || undefined}
          onChange={(query) => onCriteria({ ...criteria, query })}
        />
      </section>
      <SearchFilters criteria={criteria} collections={collections} tags={tags} onChange={onCriteria} />
      {bookmarks.length === 0 ? (
        <StatePanel
          eyebrow={filtered ? 'No matches' : eyebrow}
          title={filtered ? 'No bookmark matches those criteria.' : emptyTitle}
          detail={
            filtered
              ? 'Your search is unchanged. Correct the expression, try different words, or remove a filter.'
              : emptyDetail
          }
          action={
            filtered
              ? {
                  label: 'Clear search and filters',
                  run: () =>
                    onCriteria({
                      ...criteria,
                      query: '',
                      includeTagIds: [],
                      excludeTagIds: [],
                      collection: { mode: 'any' },
                      favorite: 'any',
                      reading: 'any',
                    }),
                }
              : { label: '＋ Add bookmark', run: onAdd }
          }
        />
      ) : (
        <>
          <section className="bookmark-grid" aria-label="Saved bookmarks">
            {bookmarks.map((bookmark) => (
              <BookmarkCard
                key={bookmark.id}
                bookmark={bookmark}
                selected={selected.has(bookmark.id)}
                onToggleSelect={() => onToggleSelect(bookmark)}
                onSelect={() => onSelect(bookmark)}
                onReading={() => onReading(bookmark)}
                onFavorite={() => onFavorite(bookmark)}
              />
            ))}
          </section>
          {hasMore && (
            <button className="button button--soft load-more" disabled={loadingMore} onClick={onLoadMore}>
              {loadingMore ? 'Loading…' : `Load more (${bookmarks.length} of ${total})`}
            </button>
          )}
        </>
      )}
    </main>
  );
}
