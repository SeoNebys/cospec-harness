import type { Bookmark, SortOrder } from "@/features/bookmarks/types";
import { CollectionControls } from "@/components/bookmarks/collection-controls";
import { SelectionController } from "@/components/bookmarks/selection-controller";
import { EmptyState } from "@/components/ui/empty-state";
import { requireSession } from "@/lib/auth/session";
import { listBookmarks } from "@/lib/db/repositories/bookmark-repository";

export default async function ArchivePage({ searchParams }: { searchParams: Promise<{ q?: string; tag?: string; sort?: string; focus?: string }> }) {
  const session = await requireSession();
  const params = await searchParams;
  let items: Bookmark[] = [];
  let error = "";
  try { items = listBookmarks(session.user.id, { view: "archive", q: params.q, tag: params.tag, sort: (params.sort ?? "newest") as SortOrder }); } catch (cause) { error = cause instanceof Error ? cause.message : "Check the search and try again."; }
  return <div data-harness-ready="true"><header className="page-heading"><div><p className="muted">Out of the way, not gone</p><h1>Archive</h1></div></header><CollectionControls view="archive" q={params.q} tag={params.tag} sort={(params.sort ?? "newest") as SortOrder} />{error ? <div className="form-message error" role="alert">{error}</div> : items.length ? <SelectionController items={items} focus={params.focus} signature={JSON.stringify(params)} /> : <div className="empty-panel"><EmptyState title={params.q || params.tag ? "No archived bookmarks found" : "Nothing archived"} description={params.q || params.tag ? "Try clearing a filter or searching for something broader." : "Archived bookmarks stay safe here until you restore or permanently delete them."} /></div>}</div>;
}
