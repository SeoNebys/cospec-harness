"use client";

import { useState } from "react";
import type { BulkOperation } from "@/features/bookmarks/bulk-service";

export function BulkToolbar({ count, onApply, onClear }: { count: number; onApply: (operation: BulkOperation, tags?: string[]) => Promise<void>; onClear: () => void }) {
  const [operation, setOperation] = useState<BulkOperation>("mark_unread");
  const [tags, setTags] = useState("");
  const [pending, setPending] = useState(false);
  const tagAction = operation === "add_tags" || operation === "remove_tags";
  return (
    <div className="bulk-toolbar" role="region" aria-label="Bulk actions">
      <strong>{count} selected</strong>
      <select className="select" value={operation} onChange={(event) => setOperation(event.target.value as BulkOperation)} aria-label="Bulk action">
        <option value="mark_unread">Mark unread</option><option value="mark_read">Mark read</option><option value="add_tags">Add tags</option><option value="remove_tags">Remove tags</option><option value="archive">Archive</option><option value="restore">Restore</option><option value="permanent_delete">Delete permanently</option>
      </select>
      {tagAction ? <input className="input" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="tag one, tag two" aria-label="Tags" /> : null}
      <button className={`button${operation === "permanent_delete" ? " danger" : ""}`} type="button" disabled={pending || (tagAction && !tags.trim())} onClick={async () => { setPending(true); try { await onApply(operation, tags.split(",").map((tag) => tag.trim()).filter(Boolean)); } finally { setPending(false); } }}>{pending ? "Applying…" : "Apply"}</button>
      <button className="button ghost" type="button" onClick={onClear}>Clear</button>
    </div>
  );
}
