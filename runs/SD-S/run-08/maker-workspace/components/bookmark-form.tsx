"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { LiveStatus } from "./ui/live-status";
import { MetadataPreview } from "./metadata-preview";
import { TagInput } from "./tag-input";
import { jsonRequest, type Bookmark, type Preview } from "./types";

type Props = { bookmark?: Bookmark; onSaved?: (bookmark: Bookmark) => void; compact?: boolean };

export function BookmarkForm({ bookmark, onSaved, compact = false }: Props) {
  const router = useRouter();
  const [url, setUrl] = useState(bookmark?.url ?? "");
  const [preview, setPreview] = useState<Preview | null>(bookmark ? { normalizedUrl: bookmark.url, title: bookmark.title, titleOrigin: bookmark.titleOrigin === "user" ? "fetched" : bookmark.titleOrigin } : null);
  const [title, setTitle] = useState(bookmark?.title ?? "");
  const [note, setNote] = useState(bookmark?.note ?? "");
  const [tags, setTags] = useState<string[]>(bookmark?.tags ?? []);
  const [titleOrigin, setTitleOrigin] = useState<"fetched" | "fallback" | "user">(bookmark?.titleOrigin ?? "fetched");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function getPreview(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("Fetching page details…");
    try {
      const result = await jsonRequest<Preview>("/api/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) });
      setPreview(result); setUrl(result.normalizedUrl); setTitle(result.title); setTitleOrigin(result.titleOrigin); setMessage("Preview ready. You can edit the details before saving.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not preview this link."); setMessage(""); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage(bookmark ? "Saving changes…" : "Saving bookmark…");
    try {
      const saved = await jsonRequest<Bookmark>(bookmark ? `/api/bookmarks/${bookmark.id}` : "/api/bookmarks", {
        method: bookmark ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: preview?.normalizedUrl ?? url, title: title.trim(), titleOrigin, note: note.trim(), tags, iconToken: preview?.iconToken ?? null }),
      });
      setMessage(bookmark ? "Changes saved." : "Bookmark saved."); onSaved?.(saved);
      if (bookmark) router.push("/"); else { setUrl(""); setPreview(null); setTitle(""); setNote(""); setTags([]); }
      router.refresh();
    } catch (cause) {
      const err = cause as Error & { existingId?: string };
      if (err.existingId) setError(`${err.message} Open the existing bookmark from your collection below.`); else setError(err.message);
      setMessage("");
    } finally { setBusy(false); }
  }

  if (!bookmark && !preview) return (
    <form className={`save-strip ${compact ? "compact" : ""}`} onSubmit={getPreview} aria-label="Save a link">
      <label htmlFor="bookmark-url">Paste a link to keep</label>
      <div className="url-row"><input id="bookmark-url" name="url" type="text" inputMode="url" autoComplete="url" required maxLength={2048} placeholder="https://example.com/article" value={url} onChange={(event) => setUrl(event.target.value)} /><button className="button primary" disabled={busy}>{busy ? "Finding details…" : "Preview link"}</button></div>
      {error && <p className="notice error" role="alert">{error}</p>}<LiveStatus message={message} />
    </form>
  );

  return (
    <form className="bookmark-form" onSubmit={save}>
      {!bookmark && preview && <MetadataPreview preview={preview} />}
      <div className="field"><label htmlFor="edit-url">Web address</label><input id="edit-url" value={url} maxLength={2048} required onChange={(e) => { setUrl(e.target.value); if (bookmark) setPreview(null); }} /></div>
      <div className="field"><label htmlFor="bookmark-title">Title</label><input id="bookmark-title" value={title} maxLength={300} required onChange={(e) => { setTitle(e.target.value); setTitleOrigin("user"); }} /><span className="field-hint">{title.length}/300</span></div>
      <div className="field"><label htmlFor="bookmark-note">Note <span>(optional)</span></label><textarea id="bookmark-note" value={note} maxLength={5000} rows={4} placeholder="Why is this worth keeping?" onChange={(e) => setNote(e.target.value)} /><span className="field-hint">{note.length}/5000</span></div>
      <div className="field"><span className="field-label">Tags <span>(optional)</span></span><TagInput tags={tags} onChange={setTags} /></div>
      {error && <p className="notice error" role="alert">{error}</p>}
      <div className="form-actions"><button className="button primary" disabled={busy}>{busy ? "Saving…" : bookmark ? "Save changes" : "Save bookmark"}</button>{!bookmark && <button className="button ghost" type="button" onClick={() => { setPreview(null); setTitle(""); setMessage(""); }}>Start over</button>}</div>
      <LiveStatus message={message} />
    </form>
  );
}
