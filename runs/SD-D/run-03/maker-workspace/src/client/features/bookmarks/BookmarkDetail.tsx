import { Button, Dialog, IconPlaceholder } from "../../components";
import type { Bookmark, BookmarkApiClient, Scope } from "../../lib/api";
import { BookmarkActions } from "./BookmarkActions";
import { BookmarkEditor } from "./BookmarkEditor";
import { FormattedNote } from "./FormattedNote";

export interface BookmarkDetailProps {
  bookmark: Bookmark;
  onClose: () => void;
  editing?: boolean;
  client?: BookmarkApiClient | undefined;
  onEdit?: () => void;
  onCancelEdit?: () => void;
  onUpdated?: (bookmark: Bookmark, outcome?: string) => void;
  onDuplicate?: (bookmarkId: number, scope?: Scope) => void;
  onRequestDelete?: ((bookmark: Bookmark) => void) | undefined;
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function BookmarkDetail({
  bookmark,
  onClose,
  editing = false,
  client,
  onEdit,
  onCancelEdit,
  onUpdated,
  onDuplicate,
  onRequestDelete,
}: BookmarkDetailProps) {
  const update = onUpdated ?? (() => undefined);

  if (editing) {
    return (
      <Dialog
        key="bookmark-editor"
        open
        title={`Edit ${bookmark.title}`}
        description="Your changes are saved only when you choose Save changes."
        onClose={onCancelEdit ?? onClose}
      >
        <BookmarkEditor
          bookmark={bookmark}
          client={client}
          onSaved={(updated) => update(updated, "Bookmark changes saved.")}
          onCancel={onCancelEdit ?? onClose}
          onDuplicate={onDuplicate ?? (() => undefined)}
          onRequestDelete={onRequestDelete}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      key="bookmark-detail"
      open
      title={bookmark.title}
      description={bookmark.description || "No description has been added."}
      onClose={onClose}
      footer={
        <>
          <Button variant="quiet" onClick={onClose}>
            Close
          </Button>
          {onEdit ? <Button onClick={onEdit}>Edit bookmark</Button> : null}
          <a
            className="button button--primary button--medium"
            href={bookmark.address}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span>Open destination ↗</span>
          </a>
        </>
      }
    >
      <div className="bookmark-detail">
        <div className="bookmark-detail__identity">
          {bookmark.iconUrl ? (
            <img
              src={bookmark.iconUrl}
              alt={`Site icon for ${bookmark.title}`}
              width="48"
              height="48"
            />
          ) : (
            <IconPlaceholder label={`No site icon for ${bookmark.title}`} size="large" />
          )}
          <p>{bookmark.address}</p>
        </div>
        <dl className="bookmark-detail__facts">
          <div>
            <dt>Reading</dt>
            <dd>{bookmark.unread ? "Read Later" : "Read"}</dd>
          </div>
          <div>
            <dt>Favorite</dt>
            <dd>{bookmark.favorite ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt>Created</dt>
            <dd>{displayDate(bookmark.createdAt)}</dd>
          </div>
          <div>
            <dt>Updated</dt>
            <dd>{displayDate(bookmark.updatedAt)}</dd>
          </div>
        </dl>
        {bookmark.tags.length ? (
          <ul className="tag-list" aria-label="Tags">
            {bookmark.tags.map((tag) => (
              <li key={tag.id}>{tag.name}</li>
            ))}
          </ul>
        ) : null}
        {bookmark.noteMarkdown.trim() ? (
          <section className="bookmark-detail__note" aria-labelledby="bookmark-note-title">
            <h2 id="bookmark-note-title">Notes</h2>
            <FormattedNote markdown={bookmark.noteMarkdown} />
          </section>
        ) : null}
        <BookmarkActions bookmark={bookmark} client={client} onUpdated={update} />
      </div>
    </Dialog>
  );
}
