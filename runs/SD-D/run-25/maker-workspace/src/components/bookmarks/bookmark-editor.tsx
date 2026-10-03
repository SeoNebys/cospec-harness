"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { Bookmark } from "@/features/bookmarks/types";
import { apiMutation } from "@/lib/http/client";
import { NoteEditor } from "./note-editor";

type Preview = {
  requestedUrl: string;
  title: string;
  pageDescription: string | null;
  iconPreviewKey: string | null;
  status: "complete" | "partial" | "failed";
  warnings: string[];
};

function fallbackPreview(url: string, warning: string): Preview {
  let title = url;
  try { const parsed = new URL(/^https?:/i.test(url) ? url : `https://${url}`); title = parsed.hostname.replace(/^www\./, ""); } catch { /* keep input */ }
  return { requestedUrl: url, title, pageDescription: null, iconPreviewKey: null, status: "failed", warnings: [warning] };
}

export function BookmarkEditor({ existing }: { existing?: Bookmark }) {
  const router = useRouter();
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(existing?.url ?? "");
  const [preview, setPreview] = useState<Preview | null>(existing ? {
    requestedUrl: existing.url, title: existing.title, pageDescription: existing.pageDescription,
    iconPreviewKey: existing.iconKey, status: existing.metadataStatus === "not_requested" ? "partial" : existing.metadataStatus,
    warnings: [],
  } : null);
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.pageDescription ?? "");
  const [tags, setTags] = useState(existing?.tags.join(", ") ?? "");
  const [readLater, setReadLater] = useState(existing?.readingState === "unread");
  const [note, setNote] = useState(existing?.noteMarkdown ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function fetchDetails() {
    setPending(true); setMessage("");
    try {
      const result = await apiMutation<Preview>("/api/metadata/preview", "POST", { url });
      setPreview(result); setUrl(result.requestedUrl); setTitle(result.title); setDescription(result.pageDescription ?? "");
    } catch (cause) {
      const error = cause as Error & { status?: number; data?: Record<string, unknown> };
      if (error.status === 409 && error.data?.existingBookmarkId) {
        setOpen(false);
        router.push(`${error.data.existingView === "archive" ? "/archive" : "/bookmarks"}?focus=${String(error.data.existingBookmarkId)}`);
        return;
      }
      const fallback = fallbackPreview(url, `${error.message} You can still save this link.`);
      setPreview(fallback); setTitle(fallback.title); setMessage(fallback.warnings[0]!);
    } finally { setPending(false); }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setMessage("");
    const body = {
      url,
      title,
      pageDescription: description || null,
      iconPreviewKey: preview?.iconPreviewKey ?? null,
      metadataStatus: preview?.status ?? "not_requested",
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      readingState: readLater ? "unread" : existing?.readingState ?? "none",
      noteMarkdown: note || null,
    };
    try {
      if (existing) await apiMutation(`/api/bookmarks/${existing.id}`, "PATCH", body);
      else await apiMutation("/api/bookmarks", "POST", body);
      setOpen(false); router.refresh();
      if (!existing) { setUrl(""); setTitle(""); setDescription(""); setTags(""); setPreview(null); setReadLater(false); setNote(""); }
    } catch (cause) {
      const error = cause as Error & { status?: number; data?: Record<string, unknown> };
      if (error.status === 409 && error.data?.existingBookmarkId) {
        setOpen(false);
        router.push(`${error.data.existingView === "archive" ? "/archive" : "/bookmarks"}?focus=${String(error.data.existingBookmarkId)}`);
      } else setMessage(error.message);
    } finally { setPending(false); }
  }

  return (
    <>
      <button className={existing ? "icon-button" : "button"} type="button" onClick={() => { setMessage(""); setOpen(true); }} aria-label={existing ? `Edit ${existing.title}` : undefined}>{existing ? "Edit" : "+ Save a link"}</button>
      {open ? (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}>
          <section className="editor-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="dialog-heading"><div><p className="eyebrow">{existing ? "Update bookmark" : "New bookmark"}</p><h2 id={titleId}>{existing ? "Edit the details" : preview ? "Make it yours" : "Paste a link"}</h2></div><button className="close-button" type="button" onClick={() => setOpen(false)} aria-label="Close">×</button></div>
            {!preview && !existing ? (
              <div className="stack">
                <div className="field"><label htmlFor="capture-url">Web address</label><input className="input url-input" id="capture-url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com/article" autoFocus /></div>
                <p className="muted small">We’ll fill in the title, description, and site icon. If the page is slow or blocks us, you can still save it.</p>
                {message ? <div className="form-message error" role="alert">{message}</div> : null}
                <button className="button" type="button" disabled={pending || !url.trim()} onClick={fetchDetails}>{pending ? "Looking up the page…" : "Fetch page details"}</button>
              </div>
            ) : (
              <form className="stack" onSubmit={save}>
                <div className="field"><label htmlFor="edit-url">Web address</label><div className="inline-field"><input className="input" id="edit-url" value={url} onChange={(event) => setUrl(event.target.value)} required maxLength={4096} />{!existing ? <button className="button secondary" type="button" onClick={fetchDetails} disabled={pending}>Refresh</button> : null}</div></div>
                <div className="field"><label htmlFor="edit-title">Title</label><input className="input" id="edit-title" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={500} /></div>
                <div className="field"><label htmlFor="edit-description">Page description</label><textarea className="textarea compact" id="edit-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} placeholder="Optional" /></div>
                <div className="field"><label htmlFor="edit-tags">Tags</label><input className="input" id="edit-tags" value={tags} onChange={(event) => setTags(event.target.value)} placeholder="design, research, recipes" /><small className="muted">Separate tags with commas.</small></div>
                <div className="field"><span className="field-label">Personal notes</span><NoteEditor value={note} onChange={setNote} /></div>
                <label className="check-row"><input type="checkbox" checked={readLater} onChange={(event) => setReadLater(event.target.checked)} /> Add to read later</label>
                {preview?.warnings.map((warning) => <div className="form-message" key={warning}>{warning}</div>)}
                {message ? <div className="form-message error" role="alert">{message}</div> : null}
                <div className="dialog-actions"><button className="button secondary" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="button" type="submit" disabled={pending || !title.trim()}>{pending ? "Saving…" : existing ? "Save changes" : "Save bookmark"}</button></div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
