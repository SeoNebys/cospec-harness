import type { Bookmark } from '../../../shared/api-types';
import { ArchiveCard } from './ArchiveCard';

export function ArchiveView({ bookmarks, pendingId, onRestore, onDelete }: { bookmarks: Bookmark[]; pendingId: string | null; onRestore: (bookmark: Bookmark) => void; onDelete: (bookmark: Bookmark) => void }) {
  return <div className="bookmark-grid archive-grid" aria-label="Archived bookmarks">{bookmarks.map((bookmark) => <ArchiveCard key={bookmark.id} bookmark={bookmark} pending={pendingId === bookmark.id} onRestore={onRestore} onDelete={onDelete} />)}</div>;
}
