"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { useState } from "react";
import { jsonRequest } from "./types";

export function DeleteBookmarkDialog({ id, title, onDeleted }: { id: string; title: string; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function remove() { setBusy(true); setError(""); try { await jsonRequest<void>(`/api/bookmarks/${id}`, { method: "DELETE" }); onDeleted(); } catch (e) { setError(e instanceof Error ? e.message : "Could not delete bookmark."); setBusy(false); } }
  return <AlertDialog.Root><AlertDialog.Trigger asChild><button className="text-button danger">Delete</button></AlertDialog.Trigger><AlertDialog.Portal><AlertDialog.Overlay className="dialog-overlay" /><AlertDialog.Content className="dialog" aria-describedby="delete-description"><span className="eyebrow">Delete bookmark</span><AlertDialog.Title>Remove “{title}”?</AlertDialog.Title><AlertDialog.Description id="delete-description">This removes the bookmark from your library. This action cannot be undone.</AlertDialog.Description>{error && <p role="alert" className="notice error">{error}</p>}<div className="dialog-actions"><AlertDialog.Cancel asChild><button className="button secondary" autoFocus disabled={busy}>Cancel</button></AlertDialog.Cancel><button className="button destructive" onClick={remove} disabled={busy}>{busy ? "Deleting…" : "Delete bookmark"}</button></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>;
}
