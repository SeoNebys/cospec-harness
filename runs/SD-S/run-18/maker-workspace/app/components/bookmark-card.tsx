import type { BookmarkView } from "~/features/bookmarks/bookmark.repository.server";
import { useState } from "react";
import { BookmarkEditForm } from "./bookmark-editor";
import { ConfirmationDialog } from "./ui/confirmation-dialog";
import { StatusRegion } from "./ui/status-region";

function hostname(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); }
  catch { return url; }
}

export function BookmarkCard({ bookmark, tagSuggestions = [], onChanged }: { bookmark: BookmarkView; tagSuggestions?: string[]; onChanged?: (() => void | Promise<void>) | undefined }) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [status, setStatus] = useState("");
  return (
    <article className="bookmark-card" id={`bookmark-${bookmark.id}`}>
      <div className="site-badge" aria-hidden="true">{hostname(bookmark.url).charAt(0).toUpperCase()}</div>
      <div className="bookmark-copy">
        <p className="bookmark-host">{hostname(bookmark.url)}</p>
        <h3><a href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title}<span className="external" aria-hidden="true">↗</span></a></h3>
        {bookmark.description ? <p className="bookmark-description">{bookmark.description}</p> : null}
        {bookmark.tags.length ? <div className="bookmark-tags">{bookmark.tags.map((tag) => <span className="tag-chip static" key={tag.id}>{tag.name}</span>)}</div> : null}
        <footer className="bookmark-footer">
          <time dateTime={bookmark.createdAt}>Saved {new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(new Date(bookmark.createdAt))}</time>
          <span className="card-actions"><button className="text-button" type="button" onClick={() => setEditing((value) => !value)}>{editing ? "Close editor" : "Edit"}</button><button className="text-button danger-text" type="button" onClick={() => setConfirming(true)}>Delete</button></span>
        </footer>
        {editing ? <BookmarkEditForm bookmark={bookmark} tagSuggestions={tagSuggestions} onCancel={() => setEditing(false)} onSaved={async () => { setEditing(false); setStatus("Bookmark updated."); await onChanged?.(); }} /> : null}
        <StatusRegion message={status} />
      </div>
      <ConfirmationDialog open={confirming} title={`Delete “${bookmark.title}”?`} message="This removes the bookmark permanently. This action cannot be undone." pending={deleting} onCancel={() => setConfirming(false)} onConfirm={async () => {
        setDeleting(true);
        const response = await fetch(`/api/bookmarks/${bookmark.id}`, { method: "DELETE" });
        setDeleting(false);
        if (!response.ok) { setConfirming(false); setStatus("The bookmark could not be deleted."); return; }
        setConfirming(false);
        await onChanged?.();
      }} />
    </article>
  );
}
