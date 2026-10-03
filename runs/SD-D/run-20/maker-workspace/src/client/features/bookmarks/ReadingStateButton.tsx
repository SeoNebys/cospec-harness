import type { BookmarkDto } from '../../../shared/schemas/api';
import { api } from '../../lib/api';
export function ReadingStateButton({
  bookmark,
  onChanged,
}: {
  bookmark: BookmarkDto;
  onChanged: () => void;
}) {
  const unread = bookmark.readingState === 'unread';
  return (
    <button
      type="button"
      className="text-action"
      onClick={() =>
        void api(`/api/bookmarks/${bookmark.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ readingState: unread ? 'read' : 'unread' }),
        }).then(onChanged)
      }
    >
      {unread ? 'Mark read' : 'Read later'}
    </button>
  );
}
