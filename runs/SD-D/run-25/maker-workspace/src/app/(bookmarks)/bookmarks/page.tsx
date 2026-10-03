import { BookmarkEditor } from "@/components/bookmarks/bookmark-editor";
import { SelectionController } from "@/components/bookmarks/selection-controller";
import { CollectionControls } from "@/components/bookmarks/collection-controls";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { listBookmarks } from "@/lib/db/repositories/bookmark-repository";
import type { SortOrder } from "@/features/bookmarks/types";
import type { Bookmark } from "@/features/bookmarks/types";

export default async function BookmarksPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; sort?: string; focus?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  let items: Bookmark[] = [];
  let searchError = "";
  try { items = listBookmarks(session.user.id, { view: "active", q: params.q, tag: params.tag, sort: (params.sort ?? "newest") as SortOrder }); } catch (error) { searchError = error instanceof Error ? error.message : "Check the search and try again."; }
  return (
    <div data-harness-ready="true">
      <header className="page-heading"><div><p className="muted">Your library</p><h1>Bookmarks</h1></div><BookmarkEditor /></header>
      <CollectionControls view="active" q={params.q} tag={params.tag} sort={(params.sort ?? "newest") as SortOrder} />
      {searchError ? <div className="form-message error" role="alert">{searchError}</div> : items.length ? <SelectionController items={items} focus={params.focus} signature={JSON.stringify(params)} /> : <div className="empty-panel"><EmptyState title={params.q || params.tag ? "No bookmarks found" : "A fresh place to begin"} description={params.q || params.tag ? "Try a broader search, remove a filter, or clear your search to see everything again." : "Save your first link and Safekeep will collect its title and description for you."} action={<BookmarkEditor />} /></div>}
    </div>
  );
}
