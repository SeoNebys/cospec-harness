import { useEffect, useRef, useState } from "react";
import { StatusRegion } from "./ui/status-region";
import { TagInput } from "./tag-input";
import type { BookmarkView } from "~/features/bookmarks/bookmark.repository.server";

type Preview = {
  requestId: string;
  url: string;
  title: string;
  description: string | null;
  status: "retrieved" | "fallback";
  warningCode: string | null;
  duplicate: { id: string; title: string } | null;
};

export function BookmarkEditor({ onSaved, tagSuggestions = [] }: { onSaved: () => void | Promise<void>; tagSuggestions?: string[] }) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [pendingPreview, setPendingPreview] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);
  const [duplicate, setDuplicate] = useState<Preview["duplicate"]>(null);
  const titleDirty = useRef(false);
  const descriptionDirty = useRef(false);
  const latestRequest = useRef("");
  const urlRef = useRef<HTMLInputElement>(null);

  async function retrieveDetails() {
    if (!url.trim() || pendingPreview) return;
    const requestId = crypto.randomUUID();
    latestRequest.current = requestId;
    setPendingPreview(true);
    setStatus("Retrieving page details…");
    setDuplicate(null);
    try {
      const response = await fetch("/api/metadata/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, requestId }),
      });
      const result = await response.json() as Preview & { message?: string };
      if (latestRequest.current !== requestId) return;
      if (!response.ok) {
        setStatus(result.message ?? "Enter a valid web address.");
        urlRef.current?.focus();
        return;
      }
      setUrl(result.url);
      if (!titleDirty.current) setTitle(result.title);
      if (!descriptionDirty.current) setDescription(result.description ?? "");
      setDuplicate(result.duplicate);
      setStatus(result.duplicate
        ? "This page is already in your library."
        : result.status === "retrieved"
          ? "Page details added. You can edit them before saving."
          : "Page details weren’t available, so we made a title from the address. You can edit it.");
    } catch {
      setStatus("We couldn’t retrieve page details. Please try again.");
    } finally {
      if (latestRequest.current === requestId) setPendingPreview(false);
    }
  }

  useEffect(() => {
    if (!url.trim() || titleDirty.current) return;
    const timer = window.setTimeout(() => void retrieveDetails(), 700);
    return () => window.clearTimeout(timer);
    // URL changes intentionally schedule a fresh preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <section className="capture-card" aria-labelledby="save-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Quick save</p>
          <h2 id="save-heading">What caught your eye?</h2>
        </div>
        <span className="capture-mark" aria-hidden="true">＋</span>
      </div>
      <form onSubmit={async (event) => {
        event.preventDefault();
        if (!title.trim()) {
          await retrieveDetails();
          return;
        }
        setPendingSave(true);
        setStatus("Saving bookmark…");
        const response = await fetch("/api/bookmarks", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ url, title, description: description || null, tags }),
        });
        const result = await response.json().catch(() => ({})) as { message?: string; existingBookmark?: Preview["duplicate"] };
        setPendingSave(false);
        if (!response.ok) {
          setDuplicate(result.existingBookmark ?? null);
          setStatus(result.message ?? "The bookmark could not be saved.");
          return;
        }
        setUrl("");
        setTitle("");
        setDescription("");
        setTags([]);
        titleDirty.current = false;
        descriptionDirty.current = false;
        setDuplicate(null);
        setStatus("Bookmark saved.");
        await onSaved();
        urlRef.current?.focus();
      }}>
        <div className="url-row">
          <label className="field grow" htmlFor="bookmark-url">
            <span>Web address</span>
            <input ref={urlRef} id="bookmark-url" type="text" inputMode="url" maxLength={2048} placeholder="Paste a link — example.com/article" value={url} onChange={(event) => {
              latestRequest.current = "";
              setUrl(event.target.value);
              setDuplicate(null);
              if (!event.target.value) {
                setTitle("");
                setDescription("");
                titleDirty.current = false;
                descriptionDirty.current = false;
              }
            }} required />
          </label>
          <button className="button button-secondary details-button" type="button" disabled={!url.trim() || pendingPreview} onClick={() => void retrieveDetails()}>
            {pendingPreview ? "Getting details…" : "Get page details"}
          </button>
        </div>
        <div className="details-grid">
          <label className="field">
            <span>Title</span>
            <input aria-label="Title" maxLength={300} value={title} onChange={(event) => { titleDirty.current = true; setTitle(event.target.value); }} required />
          </label>
          <label className="field">
            <span>Description <small>Optional</small></span>
            <textarea aria-label="Description" maxLength={1000} rows={3} value={description} onChange={(event) => { descriptionDirty.current = true; setDescription(event.target.value); }} />
          </label>
        </div>
        <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
        <div className="capture-footer">
          <StatusRegion message={status} />
          {duplicate ? <a className="duplicate-link" href={`#bookmark-${duplicate.id}`}>View “{duplicate.title}”</a> : null}
          <button className="button button-primary" type="submit" disabled={pendingSave || pendingPreview || !url.trim() || !title.trim() || Boolean(duplicate)}>
            {pendingSave ? "Saving…" : "Save bookmark"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function BookmarkEditForm({ bookmark, tagSuggestions = [], onSaved, onCancel }: {
  bookmark: BookmarkView;
  tagSuggestions?: string[];
  onSaved: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const [url, setUrl] = useState(bookmark.url);
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description ?? "");
  const [tags, setTags] = useState(bookmark.tags.map((tag) => tag.name));
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  async function refreshDetails() {
    setPreviewing(true);
    setStatus("Retrieving page details…");
    const requestId = crypto.randomUUID();
    const response = await fetch("/api/metadata/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url, requestId }) });
    const result = await response.json().catch(() => ({})) as Partial<Preview> & { message?: string };
    setPreviewing(false);
    if (!response.ok || !result.title) { setStatus(result.message ?? "Page details could not be retrieved."); return; }
    setUrl(result.url ?? url);
    setTitle(result.title);
    setDescription(result.description ?? "");
    setStatus(result.status === "retrieved" ? "Page details refreshed. You can edit them before saving." : "A fallback title was added. You can edit it before saving.");
  }
  return (
    <form className="edit-form" onSubmit={async (event) => {
      event.preventDefault();
      setPending(true);
      setStatus("Saving changes…");
      const response = await fetch(`/api/bookmarks/${bookmark.id}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, title, description: description || null, tags }),
      });
      const result = await response.json().catch(() => ({})) as { message?: string };
      setPending(false);
      if (!response.ok) { setStatus(result.message ?? "Changes could not be saved."); return; }
      setStatus("Changes saved.");
      await onSaved();
    }}>
      <div className="edit-url-row"><label className="field grow"><span>Web address</span><input aria-label="Edit web address" maxLength={2048} value={url} onChange={(event) => setUrl(event.target.value)} required /></label><button className="button button-secondary" type="button" disabled={previewing || pending || !url.trim()} onClick={() => void refreshDetails()}>{previewing ? "Refreshing…" : "Refresh page details"}</button></div>
      <label className="field"><span>Title</span><input aria-label="Edit title" maxLength={300} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
      <label className="field"><span>Description <small>Optional</small></span><textarea aria-label="Edit description" maxLength={1000} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} /></label>
      <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} id={`edit-tags-${bookmark.id}`} label="Edit tags" />
      <StatusRegion message={status} />
      <div className="edit-actions"><button className="button button-secondary" type="button" disabled={pending || previewing} onClick={onCancel}>Cancel</button><button className="button button-primary" type="submit" disabled={pending || previewing}>{pending ? "Saving…" : "Save changes"}</button></div>
    </form>
  );
}
