import type { Bookmark } from '../bookmarks/types';
import { BookmarkLibrary } from '../bookmarks/BookmarkLibrary';
import type { ComponentProps } from 'react';

type LibraryProps = Omit<
  ComponentProps<typeof BookmarkLibrary>,
  'bookmarks' | 'scope' | 'hasCriteria'
>;
export function ReadLaterView({ bookmarks, ...props }: { bookmarks: Bookmark[] } & LibraryProps) {
  const unread = bookmarks.filter((bookmark) => bookmark.readLater && !bookmark.isRead);
  return (
    <section aria-labelledby="read-later-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Focused queue</p>
          <h2 id="read-later-heading">Read later</h2>
          <p>Unread pieces you set aside, all in one place.</p>
        </div>
        <span className="count-badge" aria-label={`${unread.length} unread bookmarks`}>
          {unread.length}
        </span>
      </div>
      <BookmarkLibrary bookmarks={unread} scope="unread-read-later" {...props} />
    </section>
  );
}
