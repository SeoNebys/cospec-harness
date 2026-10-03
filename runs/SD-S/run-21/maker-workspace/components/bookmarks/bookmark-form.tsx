"use client";
import { useState } from "react";
import type { Bookmark } from "@/lib/bookmarks/types";
type Props = {
  bookmark?: Bookmark | null;
  onClose: () => void;
  onSaved: () => void;
};
const blank = {
  url: "",
  title: "",
  description: "",
  notes: "",
  tags: "",
  favorite: false,
  readingStatus: "to_read",
  siteIconUrl: "",
  previewImageUrl: ""
};
export function BookmarkForm({ bookmark, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() =>
    bookmark
      ? {
          url: bookmark.url,
          title: bookmark.title,
          description: bookmark.description || "",
          notes: bookmark.notes || "",
          tags: bookmark.tags.map((t) => t.name).join(", "),
          favorite: bookmark.favorite,
          readingStatus: bookmark.readingStatus,
          siteIconUrl: bookmark.siteIconUrl || "",
          previewImageUrl: bookmark.previewImageUrl || ""
        }
      : { ...blank }
  );
  const [stage, setStage] = useState<"url" | "details">(
    bookmark ? "details" : "url"
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicate, setDuplicate] = useState<Bookmark | null>(null);
  const change = (name: string, value: string | boolean) =>
    setForm((v) => ({ ...v, [name]: value }));
  async function inspect() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/metadata/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: form.url })
      });
      const data = await r.json();
      if (!r.ok) {
        setMessage(
          data.detail ||
            "We couldn't preview this page. Add the details yourself."
        );
        setStage("details");
        return;
      }
      setForm((v) => ({
        ...v,
        url: data.finalUrl,
        title: data.title || "",
        description: data.description || "",
        siteIconUrl: data.siteIconUrl || "",
        previewImageUrl: data.previewImageUrl || ""
      }));
      if (data.warnings?.length)
        setMessage(
          "Some page details weren't available. You can fill them in yourself."
        );
      setStage("details");
    } catch {
      setMessage("We couldn't preview this page. Add the details yourself.");
      setStage("details");
    } finally {
      setBusy(false);
    }
  }
  async function save(allowDuplicate = false) {
    setBusy(true);
    setMessage("");
    const payload = {
      ...form,
      description: form.description || null,
      notes: form.notes || null,
      siteIconUrl: form.siteIconUrl || null,
      previewImageUrl: form.previewImageUrl || null,
      tags: form.tags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      allowDuplicate
    };
    try {
      const r = await fetch(
        bookmark ? `/api/bookmarks/${bookmark.id}` : "/api/bookmarks",
        {
          method: bookmark ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        }
      );
      const data = r.status === 204 ? {} : await r.json();
      if (r.status === 409 && data.duplicate) {
        setDuplicate(data.duplicate);
        setMessage(data.detail);
        return;
      }
      if (!r.ok) {
        setMessage(
          data.detail ||
            Object.values(data.errors || {})
              .flat()
              .join(" ") ||
            "Please check the details."
        );
        return;
      }
      onSaved();
    } catch {
      setMessage(
        "The bookmark could not be saved. Your details are still here."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
      >
        <header>
          <div>
            <span className="eyebrow">
              {bookmark ? "UPDATE YOUR SHELF" : "ADD TO YOUR SHELF"}
            </span>
            <h2 id="form-title">
              {bookmark ? "Edit bookmark" : "Save something good"}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>
        {stage === "url" ? (
          <div className="url-step">
            <label htmlFor="url">Paste a link</label>
            <div className="url-row">
              <input
                id="url"
                autoFocus
                type="url"
                placeholder="https://example.com/an-interesting-page"
                value={form.url}
                onChange={(e) => change("url", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") inspect();
                }}
              />
              <button
                className="primary"
                disabled={busy || !form.url}
                onClick={inspect}
              >
                {busy ? "Gathering…" : "Gather details"}
              </button>
            </div>
            <p className="field-hint">
              We’ll look for the title, description, icon, and preview image.
            </p>
          </div>
        ) : (
          <div className="details-step">
            {form.previewImageUrl ? (
              <div
                className="preview"
                style={{
                  backgroundImage: `url("${form.previewImageUrl.replaceAll('"', "")}")`
                }}
              />
            ) : (
              <div className="preview fallback">
                <span>Preview unavailable</span>
              </div>
            )}
            <div className="form-grid">
              <label>
                Web address
                <input
                  type="url"
                  value={form.url}
                  onChange={(e) => change("url", e.target.value)}
                />
              </label>
              <label>
                Title
                <input
                  autoFocus
                  value={form.title}
                  maxLength={300}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              <label className="wide">
                Description
                <textarea
                  rows={3}
                  maxLength={1000}
                  value={form.description}
                  onChange={(e) => change("description", e.target.value)}
                />
              </label>
              <label className="wide">
                Personal notes
                <textarea
                  rows={2}
                  maxLength={10000}
                  placeholder="Why are you saving this?"
                  value={form.notes}
                  onChange={(e) => change("notes", e.target.value)}
                />
              </label>
              <label className="wide">
                Tags
                <input
                  value={form.tags}
                  placeholder="design, research, weekend"
                  onChange={(e) => change("tags", e.target.value)}
                />
                <small>Separate tags with commas.</small>
              </label>
            </div>
            <div className="form-options">
              <label>
                <input
                  type="checkbox"
                  checked={form.favorite}
                  onChange={(e) => change("favorite", e.target.checked)}
                />{" "}
                Favorite
              </label>
              <label>
                Reading status{" "}
                <select
                  value={form.readingStatus}
                  onChange={(e) => change("readingStatus", e.target.value)}
                >
                  <option value="to_read">To read</option>
                  <option value="read">Read</option>
                </select>
              </label>
            </div>
          </div>
        )}
        {message && (
          <div className="form-message" role="status">
            {message}
          </div>
        )}
        {duplicate && (
          <div className="duplicate">
            <strong>Already on your shelf:</strong> {duplicate.title}
            <div>
              <button className="text-button" onClick={() => save(true)}>
                Save another copy
              </button>
            </div>
          </div>
        )}
        {stage === "details" && (
          <footer>
            <button
              className="secondary"
              onClick={() => (bookmark ? onClose() : setStage("url"))}
            >
              Back
            </button>
            <button
              className="primary"
              disabled={busy || !form.title || !form.url}
              onClick={() => save()}
            >
              {busy ? "Saving…" : bookmark ? "Save changes" : "Save bookmark"}
            </button>
          </footer>
        )}
      </section>
    </div>
  );
}
