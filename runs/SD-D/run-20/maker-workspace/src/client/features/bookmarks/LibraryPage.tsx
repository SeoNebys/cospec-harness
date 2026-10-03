import { useCallback, useState } from 'react';
import type { BookmarkDto } from '../../../shared/schemas/api';
import { Button } from '../../components/Button';
import { StatusMessage } from '../../components/StatusMessage';
import { api } from '../../lib/api';
import type { ReturnTypeLibrary } from './libraryTypes';
import { SearchControls } from '../search/SearchControls';
import { BookmarkCard } from './BookmarkCard';
import { BookmarkForm } from './BookmarkForm';
import { BulkActionBar } from './BulkActionBar';
import { DeleteBookmarksDialog } from './DeleteBookmarksDialog';
import { useBookmarkSelection } from './useBookmarkSelection';

export function LibraryPage({
  library,
  creating,
  setCreating,
  announce,
}: {
  library: ReturnTypeLibrary;
  creating: boolean;
  setCreating: (value: boolean) => void;
  announce: (message: string) => void;
}) {
  const [editing, setEditing] = useState<BookmarkDto | null>(null);
  const [deleteIds, setDeleteIds] = useState<string[]>([]);
  const selection = useBookmarkSelection(library.contextKey, announce);
  const { update } = library;
  const updateQuery = useCallback((query: string) => update({ query }), [update]);
  const refresh = async (message?: string) => {
    await library.refresh();
    selection.clear();
    if (message) announce(message);
  };
  const bulkComplete = (message: string) => void refresh(message);
  const deleteSelected = async () => {
    const result = await api<{ changedIds: string[] }>('/api/bookmarks/bulk-actions', {
      method: 'POST',
      body: JSON.stringify({ bookmarkIds: deleteIds, action: 'delete', confirmed: true }),
    });
    await refresh(
      `${result.changedIds.length} bookmark${result.changedIds.length === 1 ? '' : 's'} permanently deleted.`,
    );
  };
  const viewName =
    library.params.view === 'active'
      ? 'Library'
      : library.params.view === 'unread'
        ? 'Read later'
        : 'Archive';
  const empty =
    library.params.view === 'unread'
      ? 'Nothing waiting to be read. Mark any bookmark “Read later” to put it here.'
      : library.params.view === 'archived'
        ? 'Your archive is empty. Archived bookmarks stay safe here until you restore or permanently delete them.'
        : 'No bookmarks yet. Save a link and its page details will appear here.';
  return (
    <div data-harness-ready={!library.loading && !library.error ? 'true' : undefined}>
      {(creating || editing) && (
        <BookmarkForm
          initial={editing ?? undefined}
          onCancel={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            void refresh('Bookmark saved.');
          }}
        />
      )}
      <div className="section-heading">
        <div>
          <p className="eyebrow">{viewName}</p>
          <h2>
            {library.params.view === 'active'
              ? 'Things you want to find again'
              : library.params.view === 'unread'
                ? 'Your reading queue'
                : 'Out of sight, not gone'}
          </h2>
        </div>
        <span>
          {library.page.total} result{library.page.total === 1 ? '' : 's'}
        </span>
      </div>
      <SearchControls
        query={library.params.query}
        tags={library.params.tags}
        sort={library.params.sort}
        direction={library.params.direction}
        onQuery={updateQuery}
        onRemoveTag={(tag) => library.update({ tags: library.params.tags.filter((item) => item !== tag) })}
        onSort={(sort, direction) => library.update({ sort, direction })}
        onClear={() => library.update({ query: '', tags: [] })}
      />
      {library.error && <StatusMessage error>{library.error}</StatusMessage>}
      {library.loading ? (
        <div className="bookmark-grid" aria-label="Loading bookmarks">
          <div className="bookmark-card skeleton" />
          <div className="bookmark-card skeleton" />
        </div>
      ) : library.page.items.length === 0 ? (
        <div className="empty">
          <h3>{library.params.query || library.params.tags.length ? 'No matches' : 'A quiet corner'}</h3>
          <p>
            {library.params.query || library.params.tags.length
              ? 'Try a broader search or clear a filter.'
              : empty}
          </p>
          {library.params.view === 'active' && !creating && (
            <Button onClick={() => setCreating(true)}>Save your first link</Button>
          )}
        </div>
      ) : (
        <div className="bookmark-grid">
          {library.page.items.map((bookmark) => (
            <BookmarkCard
              key={bookmark.id}
              bookmark={bookmark}
              selected={selection.ids.has(bookmark.id)}
              onSelect={() => selection.toggle(bookmark.id)}
              onTag={(tag) =>
                library.update({
                  tags: library.params.tags.includes(tag)
                    ? library.params.tags
                    : [...library.params.tags, tag],
                })
              }
              onEdit={() => setEditing(bookmark)}
              onChanged={() => void refresh('Bookmark updated.')}
              onDelete={() => setDeleteIds([bookmark.id])}
            />
          ))}
        </div>
      )}
      {library.page.total > library.page.pageSize && (
        <nav className="pagination" aria-label="Bookmark pages">
          <Button
            variant="secondary"
            disabled={library.params.page === 1}
            onClick={() => library.update({ page: library.params.page - 1 })}
          >
            Previous
          </Button>
          <span>
            Page {library.params.page} of {Math.ceil(library.page.total / library.page.pageSize)}
          </span>
          <Button
            variant="secondary"
            disabled={library.params.page >= Math.ceil(library.page.total / library.page.pageSize)}
            onClick={() => library.update({ page: library.params.page + 1 })}
          >
            Next
          </Button>
        </nav>
      )}
      {selection.ids.size > 0 && (
        <BulkActionBar
          ids={[...selection.ids]}
          archived={library.params.view === 'archived'}
          onComplete={bulkComplete}
          onDelete={() => setDeleteIds([...selection.ids])}
        />
      )}
      <DeleteBookmarksDialog
        ids={deleteIds}
        open={deleteIds.length > 0}
        onClose={() => setDeleteIds([])}
        onConfirm={deleteSelected}
      />
    </div>
  );
}
