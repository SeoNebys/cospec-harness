import type { Bookmark, SortOrder } from "@/features/bookmarks/types";
import { CollectionControls } from "@/components/bookmarks/collection-controls";
import { SelectionController } from "@/components/bookmarks/selection-controller";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { listBookmarks } from "@/lib/db/repositories/bookmark-repository";

export default async function UnreadPage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; sort?: string; focus?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  let items: Bookmark[] = [];
  let error = "";
  try { items = listBookmarks(session.user.id, { view: "unread", q: params.q, tag: params.tag, sort: (params.sort ?? "newest") as SortOrder }); } catch (cause) { error = cause instanceof Error ? cause.message : "Check the search and try again."; }
  return <div data-harness-ready="true"><header className="page-heading"><div><p className="muted">Your reading queue</p><h1>Unread</h1></div></header><CollectionControls view="unread" q={params.q} tag={params.tag} sort={(params.sort ?? "newest") as SortOrder} />{error ? <div className="form-message error" role="alert">{error}</div> : items.length ? <SelectionController items={items} focus={params.focus} signature={JSON.stringify(params)} /> : <div className="empty-panel"><EmptyState title={params.q || params.tag ? "No unread bookmarks found" : "You're all caught up"} description={params.q || params.tag ? "Try clearing a filter or searching for something broader." : "Flag a bookmark to read later and it will wait for you here."} /></div>}</div>;
}
