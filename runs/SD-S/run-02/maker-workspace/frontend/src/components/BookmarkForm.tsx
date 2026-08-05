import { useEffect, useState } from "react";
import type { Bookmark, CreateInput } from "../api/client";

interface Props {
  /** When set, the form edits this bookmark; otherwise it creates a new one. */
  editing?: Bookmark | null;
  error?: string | null;
  onSubmit: (input: CreateInput) => void;
  onCancelEdit: () => void;
}

function tagsToText(tags: string[]): string {
  return tags.join(", ");
}

function textToTags(text: string): string[] {
  return text
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t !== "");
}

export function BookmarkForm({ editing, error, onSubmit, onCancelEdit }: Props) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tagsText, setTagsText] = useState("");

  useEffect(() => {
    if (editing) {
      setUrl(editing.url);
      setTitle(editing.title);
      setDescription(editing.description ?? "");
      setTagsText(tagsToText(editing.tags));
    } else {
      setUrl("");
      setTitle("");
      setDescription("");
      setTagsText("");
    }
  }, [editing]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      url: url.trim(),
      title: title.trim() || undefined,
      description: description.trim() || undefined,
      tags: textToTags(tagsText),
    });
  };

  return (
    <form className="bookmark-form" onSubmit={submit} aria-label="Save bookmark">
      <h2>{editing ? "Edit bookmark" : "Save a bookmark"}</h2>
      <label>
        Address
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          aria-label="Address"
          required
        />
      </label>
      <label>
        Title <span className="hint">(optional — filled in automatically)</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          aria-label="Title"
        />
      </label>
      <label>
        Tags <span className="hint">(comma-separated)</span>
        <input
          type="text"
          value={tagsText}
          onChange={(e) => setTagsText(e.target.value)}
          placeholder="tech, reading"
          aria-label="Tags"
        />
      </label>
      <label>
        Notes <span className="hint">(optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Notes"
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button type="submit">{editing ? "Save changes" : "Save bookmark"}</button>
        {editing && (
          <button type="button" onClick={onCancelEdit}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
