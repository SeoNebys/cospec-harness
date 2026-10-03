interface BookmarkActionsProps {
  title: string;
  isFavorite: boolean;
  isArchived: boolean;
  pending: boolean;
  onEdit: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export function BookmarkActions({
  title,
  isFavorite,
  isArchived,
  pending,
  onEdit,
  onFavorite,
  onArchive,
  onDelete,
}: BookmarkActionsProps) {
  return (
    <div className="bookmark-actions" aria-label={`Actions for ${title}`}>
      <button
        onClick={onFavorite}
        disabled={pending}
        aria-label={isFavorite ? `Remove ${title} from favorites` : `Favorite ${title}`}
      >
        <span aria-hidden="true">{isFavorite ? '★' : '☆'}</span>
      </button>
      <button onClick={onEdit} disabled={pending} aria-label={`Edit ${title}`}>
        Edit
      </button>
      <button
        onClick={onArchive}
        disabled={pending}
        aria-label={isArchived ? `Restore ${title}` : `Archive ${title}`}
      >
        {isArchived ? 'Restore' : 'Archive'}
      </button>
      <button
        className="danger-action"
        onClick={onDelete}
        disabled={pending}
        aria-label={`Delete ${title}`}
      >
        Delete
      </button>
    </div>
  );
}
