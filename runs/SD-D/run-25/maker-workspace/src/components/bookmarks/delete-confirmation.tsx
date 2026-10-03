"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiMutation } from "@/lib/http/client";

export function DeleteConfirmation({ ids, open, onClose }: { ids: string[]; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!open) return null;
  async function remove() {
    setPending(true); setError("");
    try {
      await apiMutation("/api/bookmarks/bulk", "POST", { ids, operation: "permanent_delete", confirmPermanent: true, expectedCount: ids.length });
      onClose(); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Nothing was deleted. Please try again."); }
    finally { setPending(false); }
  }
  return (
    <div className="dialog-backdrop">
      <section className="confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="delete-title" aria-describedby="delete-copy">
        <p className="eyebrow">Permanent action</p>
        <h2 id="delete-title">Delete {ids.length} {ids.length === 1 ? "bookmark" : "bookmarks"}?</h2>
        <p id="delete-copy">This cannot be undone. Archiving is the safer choice if you may want {ids.length === 1 ? "this link" : "these links"} later.</p>
        {error ? <div className="form-message error" role="alert">{error}</div> : null}
        <div className="dialog-actions"><button className="button secondary" type="button" onClick={onClose} disabled={pending}>Cancel</button><button className="button danger" type="button" onClick={remove} disabled={pending}>{pending ? "Deleting…" : `Delete ${ids.length} permanently`}</button></div>
      </section>
    </div>
  );
}
