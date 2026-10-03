"use client";

import Image from "next/image";
import type { Bookmark } from "@/features/bookmarks/types";
import { BookmarkEditor } from "./bookmark-editor";
import { NoteRenderer } from "./note-renderer";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMutation } from "@/lib/http/client";
import { DeleteConfirmation } from "./delete-confirmation";

export function BookmarkCard({ bookmark, focused = false, selected, onSelect }: { bookmark: Bookmark; focused?: boolean; selected?: boolean; onSelect?: (selected: boolean) => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState(false);
  async function update(body: Record<string, unknown>) {
    setPending(true);
    try { await apiMutation(`/api/bookmarks/${bookmark.id}`, "PATCH", body); router.refresh(); } finally { setPending(false); }
  }
  return (
    <article className={`bookmark-card${focused ? " focused" : ""}`} id={`bookmark-${bookmark.id}`}>
      {onSelect ? <label className="select-box"><span className="sr-only">Select {bookmark.title}</span><input type="checkbox" checked={selected} onChange={(event) => onSelect(event.target.checked)} /></label> : null}
      <Image className="site-icon" src={bookmark.iconUrl} alt="" width={40} height={40} unoptimized />
      <div className="bookmark-copy">
        <div className="bookmark-meta"><span>{bookmark.domain}</span><span>·</span><time dateTime={bookmark.createdAt}>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(bookmark.createdAt))}</time>{bookmark.readingState !== "none" ? <span className={`status ${bookmark.readingState}`}>{bookmark.readingState === "unread" ? "To read" : "Read"}</span> : null}</div>
        <h2><a href={bookmark.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer">{bookmark.title}</a></h2>
        {bookmark.pageDescription ? <p>{bookmark.pageDescription}</p> : null}
        {bookmark.tags.length ? <div className="tag-list" aria-label="Tags">{bookmark.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div> : null}
        {bookmark.noteMarkdown ? <details className="bookmark-notes"><summary>Personal notes</summary><NoteRenderer>{bookmark.noteMarkdown}</NoteRenderer></details> : null}
      </div>
      <div className="card-actions">
        <button className="icon-button" type="button" disabled={pending} onClick={() => update({ readingState: bookmark.readingState === "unread" ? "read" : "unread" })}>{bookmark.readingState === "unread" ? "Mark read" : "Read later"}</button>
        <button className="icon-button" type="button" disabled={pending} onClick={() => update({ archived: !bookmark.archived })}>{bookmark.archived ? "Restore" : "Archive"}</button>
        <BookmarkEditor existing={bookmark} />
        <button className="icon-button danger-text" type="button" onClick={() => setDeleting(true)}>Delete</button>
      </div>
      <DeleteConfirmation ids={[bookmark.id]} open={deleting} onClose={() => setDeleting(false)} />
    </article>
  );
}
