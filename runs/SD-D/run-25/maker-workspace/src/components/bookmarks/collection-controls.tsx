import type { CollectionView, SortOrder } from "@/features/bookmarks/types";

export function CollectionControls({ view, q = "", tag = "", sort = "newest" }: { view: CollectionView; q?: string; tag?: string; sort?: SortOrder }) {
  return (
    <form className="collection-controls" action={view === "archive" ? "/archive" : view === "unread" ? "/unread" : "/bookmarks"}>
      <div className="search-field"><label className="sr-only" htmlFor="collection-search">Search bookmarks</label><input className="input" id="collection-search" name="q" defaultValue={q} placeholder='Search, try tag:research or "exact phrase"' /></div>
      <label className="sr-only" htmlFor="tag-filter">Filter by tag</label><input className="input short-control" id="tag-filter" name="tag" defaultValue={tag} placeholder="Tag" />
      <label className="sr-only" htmlFor="sort">Sort</label><select className="select short-control" id="sort" name="sort" defaultValue={sort}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option></select>
      <button className="button secondary" type="submit">Apply</button>
      {q || tag || sort !== "newest" ? <a className="button ghost" href={view === "archive" ? "/archive" : view === "unread" ? "/unread" : "/bookmarks"}>Clear</a> : null}
    </form>
  );
}
