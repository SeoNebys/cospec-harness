"use client";

import type { Bookmark } from "./types";
import { BookmarkCard } from "./bookmark-card";

export function BookmarkList({ items, loading, filtered, nextCursor, onMore, onDeleted, onTag }: { items: Bookmark[]; loading: boolean; filtered: boolean; nextCursor: string | null; onMore: () => void; onDeleted: (id: string) => void; onTag: (tag: string) => void }) {
  if (loading && !items.length) return <div className="loading-block" role="status">Loading your bookmarks…</div>;
  if (!items.length) return <div className="empty-state"><div className="empty-glyph" aria-hidden="true">⌑</div><h2>{filtered ? "No bookmarks match" : "Your collection starts here"}</h2><p>{filtered ? "Try another search, choose a different tag, or clear your filters." : "Paste your first link above. We’ll fetch its title so saving it takes only a moment."}</p></div>;
  return <><div className="bookmark-grid">{items.map((bookmark) => <BookmarkCard key={bookmark.id} bookmark={bookmark} onDeleted={() => onDeleted(bookmark.id)} onTag={onTag} />)}</div>{nextCursor && <div className="load-more"><button className="button secondary" onClick={onMore} disabled={loading}>{loading ? "Loading…" : "Load more"}</button></div>}</>;
}
