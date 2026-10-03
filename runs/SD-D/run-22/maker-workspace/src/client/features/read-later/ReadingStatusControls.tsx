import { useState } from 'react';
import type { Bookmark } from '../bookmarks/types';

interface Props {
  bookmark: Bookmark;
  onChange: (readLater: boolean, isRead: boolean) => Promise<void>;
}
export function ReadingStatusControls({ bookmark, onChange }: Props) {
  const [pending, setPending] = useState(false);
  async function update(readLater: boolean, isRead: boolean) {
    setPending(true);
    try {
      await onChange(readLater, isRead);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="reading-controls" aria-label={`Reading status for ${bookmark.title}`}>
      {!bookmark.readLater ? (
        <button
          className="button subtle compact"
          disabled={pending}
          onClick={() => void update(true, false)}
        >
          ＋ Read later
        </button>
      ) : (
        <>
          <button
            className="button subtle compact"
            disabled={pending}
            onClick={() => void update(true, !bookmark.isRead)}
          >
            {bookmark.isRead ? 'Mark unread' : '✓ Mark read'}
          </button>
          <button
            className="text-button"
            disabled={pending}
            onClick={() => void update(false, false)}
          >
            Remove from list
          </button>
        </>
      )}
    </div>
  );
}
