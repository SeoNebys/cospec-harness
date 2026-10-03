import type { BookmarkDto } from '../../../shared/schemas/api';
import { NoteRenderer } from '../editor/NoteRenderer';
import { TagChip } from '../tags/TagChip';
import { ReadingStateButton } from './ReadingStateButton';

export function BookmarkCard({
  bookmark,
  selected,
  onSelect,
  onTag,
  onEdit,
  onChanged,
  onDelete,
}: {
  bookmark: BookmarkDto;
  selected: boolean;
  onSelect: () => void;
  onTag: (tag: string) => void;
  onEdit: () => void;
  onChanged: () => void;
  onDelete: () => void;
}) {
  const domain = new URL(bookmark.url).hostname.replace(/^www\./, '');
  const patch = (body: unknown) =>
    void fetch(`/api/bookmarks/${bookmark.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(onChanged);
  return (
    <article className={`bookmark-card ${selected ? 'selected' : ''}`}>
      {bookmark.previewImageUrl ? (
        <img className="preview" src={bookmark.previewImageUrl} alt="" loading="lazy" />
      ) : (
        <div className="preview preview-fallback" aria-hidden="true">
          {bookmark.title.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="card-content">
        <div className="card-top">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            aria-label={`Select ${bookmark.title}`}
          />
          {bookmark.iconUrl && <img className="favicon" src={bookmark.iconUrl} alt="" />}
          <h2 className="card-title">
            <a href={bookmark.url} target="_blank" rel="noopener noreferrer">
              {bookmark.title} <span className="sr-only">(opens in new tab)</span>
            </a>
          </h2>
        </div>
        {bookmark.description && <p className="card-description">{bookmark.description}</p>}
        <NoteRenderer document={bookmark.noteDocument} />
        {bookmark.tags.length > 0 && (
          <div className="tag-list">
            {bookmark.tags.map((tag) => (
              <TagChip key={tag.id} label={tag.label} onClick={() => onTag(tag.label)} />
            ))}
          </div>
        )}
        <div className="card-meta">
          {domain} · Saved{' '}
          {new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(bookmark.createdAt))}
          {bookmark.readingState === 'unread'
            ? ' · To read'
            : bookmark.readingState === 'read'
              ? ' · Read'
              : ''}
        </div>
        <div className="card-actions">
          <ReadingStateButton bookmark={bookmark} onChanged={onChanged} />
          <button className="text-action" type="button" onClick={onEdit}>
            Edit
          </button>
          {bookmark.lifecycleState === 'active' ? (
            <button
              className="text-action"
              type="button"
              onClick={() => patch({ lifecycleState: 'archived' })}
            >
              Archive
            </button>
          ) : (
            <>
              <button
                className="text-action"
                type="button"
                onClick={() => patch({ lifecycleState: 'active' })}
              >
                Restore
              </button>
              <button className="text-action danger-text" type="button" onClick={onDelete}>
                Delete permanently
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
