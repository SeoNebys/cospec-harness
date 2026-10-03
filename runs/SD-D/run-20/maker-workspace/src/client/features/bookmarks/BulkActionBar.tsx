import { useState } from 'react';
import { Button } from '../../components/Button';
import { api } from '../../lib/api';

type Result = {
  requestedCount: number;
  changedIds: string[];
  unchangedIds: string[];
  failures: Array<{ bookmarkId: string; message: string }>;
};
export function BulkActionBar({
  ids,
  archived,
  onComplete,
  onDelete,
}: {
  ids: string[];
  archived: boolean;
  onComplete: (message: string) => void;
  onDelete: () => void;
}) {
  const [tags, setTags] = useState('');
  const [pending, setPending] = useState(false);
  const run = async (action: string) => {
    setPending(true);
    try {
      const tagLabels = tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const result = await api<Result>('/api/bookmarks/bulk-actions', {
        method: 'POST',
        body: JSON.stringify({
          bookmarkIds: ids,
          action,
          ...(['addTags', 'removeTags'].includes(action) ? { tagLabels } : {}),
        }),
      });
      onComplete(
        `${result.changedIds.length} changed, ${result.unchangedIds.length} already set, ${result.failures.length} failed.`,
      );
    } catch (caught) {
      onComplete(caught instanceof Error ? caught.message : 'The bulk action failed.');
    } finally {
      setPending(false);
    }
  };
  return (
    <div className="bulk-bar" role="region" aria-label="Bulk actions">
      <strong>{ids.length} selected</strong>
      <input
        aria-label="Tags for bulk action, separated by commas"
        placeholder="tag, another"
        value={tags}
        onChange={(event) => setTags(event.target.value)}
      />
      <Button variant="secondary" disabled={pending || !tags.trim()} onClick={() => void run('addTags')}>
        Add tags
      </Button>
      <Button variant="secondary" disabled={pending || !tags.trim()} onClick={() => void run('removeTags')}>
        Remove tags
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => void run('markUnread')}>
        Mark unread
      </Button>
      <Button variant="secondary" disabled={pending} onClick={() => void run('markRead')}>
        Mark read
      </Button>
      {archived ? (
        <>
          <Button variant="secondary" disabled={pending} onClick={() => void run('restore')}>
            Restore
          </Button>
          <Button variant="danger" disabled={pending} onClick={onDelete}>
            Delete
          </Button>
        </>
      ) : (
        <Button variant="secondary" disabled={pending} onClick={() => void run('archive')}>
          Archive
        </Button>
      )}
    </div>
  );
}
