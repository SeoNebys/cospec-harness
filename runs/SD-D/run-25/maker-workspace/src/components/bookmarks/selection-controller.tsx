"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Bookmark } from "@/features/bookmarks/types";
import type { BulkOperation } from "@/features/bookmarks/bulk-service";
import { apiMutation } from "@/lib/http/client";
import { BookmarkCard } from "./bookmark-card";
import { BulkToolbar } from "./bulk-toolbar";
import { DeleteConfirmation } from "./delete-confirmation";

export function SelectionController({ items, focus, signature }: { items: Bookmark[]; focus?: string; signature: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const timeout = window.setTimeout(() => setSelected(new Set()), 0);
    return () => window.clearTimeout(timeout);
  }, [signature]);
  const ids = [...selected];
  async function apply(operation: BulkOperation, tags?: string[]) {
    if (operation === "permanent_delete") { setConfirmDelete(true); return; }
    try {
      const result = await apiMutation<{ succeededIds: string[]; failures: unknown[] }>("/api/bookmarks/bulk", "POST", { ids, operation, tagNames: tags });
      setMessage(`${result.succeededIds.length} ${result.succeededIds.length === 1 ? "bookmark" : "bookmarks"} updated.${result.failures.length ? ` ${result.failures.length} could not be updated.` : ""}`);
      setSelected(new Set()); router.refresh();
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Nothing changed. Please try again."); }
  }
  return (
    <>
      <div className="selection-row"><label><input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={(event) => setSelected(event.target.checked ? new Set(items.slice(0, 100).map((item) => item.id)) : new Set())} /> Select all visible</label><span className="muted">Up to 100 at a time</span></div>
      {message ? <div className="form-message" role="status">{message}</div> : null}
      <div className="bookmark-list">{items.map((item) => <BookmarkCard key={item.id} bookmark={item} focused={focus === item.id} selected={selected.has(item.id)} onSelect={(checked) => setSelected((current) => { const next = new Set(current); if (checked && next.size < 100) next.add(item.id); else next.delete(item.id); return next; })} />)}</div>
      {selected.size ? <BulkToolbar count={selected.size} onApply={apply} onClear={() => setSelected(new Set())} /> : null}
      <DeleteConfirmation ids={ids} open={confirmDelete} onClose={() => { setConfirmDelete(false); setSelected(new Set()); }} />
    </>
  );
}
