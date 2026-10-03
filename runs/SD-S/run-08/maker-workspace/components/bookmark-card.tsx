"use client";

import Link from "next/link";
import type { Bookmark } from "./types";
import { DeleteBookmarkDialog } from "./delete-bookmark-dialog";

export function BookmarkCard({ bookmark, onDeleted, onTag }: { bookmark: Bookmark; onDeleted: () => void; onTag: (tag: string) => void }) {
  let host = bookmark.url; try { host = new URL(bookmark.url).hostname.replace(/^www\./, ""); } catch {}
  return <article className="bookmark-card">
    <div className="card-main">{/* Dynamic app-controlled icon assets do not need image optimization. */}<img className="site-icon" src={bookmark.iconPath || "/generic-site-icon.svg"} alt="" width="38" height="38" onError={(e) => { e.currentTarget.src = "/generic-site-icon.svg"; }} /><div className="card-copy"><a className="bookmark-title" href={bookmark.url} target="_blank" rel="noopener noreferrer">{bookmark.title}<span className="external" aria-hidden="true">↗</span><span className="sr-only"> (opens in a new tab)</span></a><p className="bookmark-host">{host}</p>{bookmark.note && <p className="bookmark-note">{bookmark.note}</p>}{bookmark.tags.length > 0 && <ul className="tag-list card-tags" aria-label="Tags">{bookmark.tags.map((tag) => <li key={tag}><button className="tag static" onClick={() => onTag(tag)}>{tag}</button></li>)}</ul>}</div></div>
    <div className="card-actions"><Link className="text-button" href={`/bookmarks/${bookmark.id}/edit`}>Edit</Link><DeleteBookmarkDialog id={bookmark.id} title={bookmark.title} onDeleted={onDeleted} /></div>
  </article>;
}
