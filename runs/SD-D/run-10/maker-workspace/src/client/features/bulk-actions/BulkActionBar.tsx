import type { BulkAction } from '../../../shared/contracts/bulk';
export function BulkActionBar({
  count,
  context,
  tags,
  onAction,
}: {
  count: number;
  context: 'active' | 'archive';
  tags: Array<{ id: string; name: string }>;
  onAction(action: BulkAction): void;
}) {
  if (!count) return null;
  return (
    <div className="bulk-bar" aria-label="Bulk actions">
      <strong>{count} selected</strong>
      <select
        aria-label="Add tag to selection"
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) onAction({ type: 'tags.add', tagIds: [event.target.value] });
          event.target.value = '';
        }}
      >
        <option value="">＋ Tag</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            #{tag.name}
          </option>
        ))}
      </select>
      <select
        aria-label="Remove tag from selection"
        defaultValue=""
        onChange={(event) => {
          if (event.target.value) onAction({ type: 'tags.remove', tagIds: [event.target.value] });
          event.target.value = '';
        }}
      >
        <option value="">− Tag</option>
        {tags.map((tag) => (
          <option key={tag.id} value={tag.id}>
            #{tag.name}
          </option>
        ))}
      </select>
      <button onClick={() => onAction({ type: 'reading.set', value: 'unread' })}>Unread</button>
      <button onClick={() => onAction({ type: 'reading.set', value: 'read' })}>Read</button>
      <button onClick={() => onAction({ type: 'favorite.set', value: true })}>Favorite</button>
      <button onClick={() => onAction({ type: 'favorite.set', value: false })}>Unfavorite</button>
      <button onClick={() => onAction({ type: context === 'archive' ? 'restore' : 'archive' })}>
        {context === 'archive' ? 'Restore' : 'Archive'}
      </button>
      <button className="danger" onClick={() => onAction({ type: 'delete_permanently' })}>
        Delete
      </button>
    </div>
  );
}
