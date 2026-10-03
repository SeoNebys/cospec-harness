import { type FormEvent, useState } from "react";
import { Button, Status, TextAreaField, TextField } from "../../components";
import {
  ApiError,
  api,
  type Bookmark,
  type BookmarkApiClient,
  type BookmarkPatch,
  type Scope,
} from "../../lib/api";
import { NoteEditor } from "./NoteEditor";

export interface BookmarkEditorProps {
  bookmark: Bookmark;
  client?: BookmarkApiClient | undefined;
  onSaved: (bookmark: Bookmark) => void;
  onCancel: () => void;
  onDuplicate: (bookmarkId: number, scope?: Scope) => void;
  onRequestDelete?: ((bookmark: Bookmark) => void) | undefined;
}

type EditableField = "address" | "title" | "description" | "tags" | "noteMarkdown";

function normalizeTags(value: string): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const raw of value.split(",")) {
    const tag = raw.trim();
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
  }
  return result;
}

export function BookmarkEditor({
  bookmark,
  client = api,
  onSaved,
  onCancel,
  onDuplicate,
  onRequestDelete,
}: BookmarkEditorProps) {
  const [address, setAddress] = useState(bookmark.address);
  const [title, setTitle] = useState(bookmark.title);
  const [description, setDescription] = useState(bookmark.description);
  const [tags, setTags] = useState(bookmark.tags.map((tag) => tag.name).join(", "));
  const [noteMarkdown, setNoteMarkdown] = useState(bookmark.noteMarkdown);
  const [acceptTitle, setAcceptTitle] = useState(false);
  const [acceptDescription, setAcceptDescription] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableField, string>>>({});

  function clearFieldError(field: EditableField) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setFieldErrors({});
    const controller = new AbortController();
    try {
      const patch: BookmarkPatch = {
        ...(address.trim() !== bookmark.address ? { address: address.trim() } : {}),
        ...(!acceptTitle && title.trim() !== bookmark.title ? { title: title.trim() } : {}),
        ...(!acceptDescription && description.trim() !== bookmark.description
          ? { description: description.trim() }
          : {}),
        ...(noteMarkdown !== bookmark.noteMarkdown ? { noteMarkdown } : {}),
        ...(tags !== bookmark.tags.map((tag) => tag.name).join(", ")
          ? { tags: normalizeTags(tags) }
          : {}),
        ...(acceptTitle ? { acceptRetrievedTitle: true } : {}),
        ...(acceptDescription ? { acceptRetrievedDescription: true } : {}),
      };
      if (Object.keys(patch).length === 0) {
        onSaved(bookmark);
        return;
      }
      const updated = await client.updateBookmark(bookmark.id, patch, {
        signal: controller.signal,
      });
      onSaved(updated);
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        cause.problem.code === "DUPLICATE_BOOKMARK" &&
        "existingBookmarkId" in cause.problem
      ) {
        onDuplicate(cause.problem.existingBookmarkId, cause.problem.existingScope);
      } else {
        const message =
          cause instanceof ApiError
            ? cause.problem.message
            : "The bookmark could not be updated. Please try again.";
        const problemField = cause instanceof ApiError ? cause.problem.field : undefined;
        const field = problemField === "tag" ? "tags" : problemField;
        if (
          field === "address" ||
          field === "title" ||
          field === "description" ||
          field === "tags" ||
          field === "noteMarkdown"
        ) {
          setFieldErrors({ [field]: message });
        } else {
          setError(message);
        }
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="bookmark-editor" onSubmit={submit}>
      <TextField
        id="bookmark-edit-address"
        label="Web address"
        type="url"
        required
        value={address}
        error={fieldErrors.address}
        onChange={(event) => {
          clearFieldError("address");
          setAddress(event.currentTarget.value);
        }}
      />
      <div className="bookmark-editor__candidate-field">
        <TextField
          id="bookmark-edit-title"
          label="Title"
          required
          value={title}
          error={fieldErrors.title}
          onChange={(event) => {
            clearFieldError("title");
            setAcceptTitle(false);
            setTitle(event.currentTarget.value);
          }}
        />
        {bookmark.retrievedTitleCandidate && bookmark.retrievedTitleCandidate !== bookmark.title ? (
          <div className="metadata-candidate">
            <span>Retrieved suggestion: {bookmark.retrievedTitleCandidate}</span>
            <Button
              size="small"
              variant="quiet"
              onClick={() => {
                setTitle(bookmark.retrievedTitleCandidate ?? title);
                setAcceptTitle(true);
              }}
            >
              Use retrieved title
            </Button>
          </div>
        ) : null}
      </div>
      <div className="bookmark-editor__candidate-field">
        <TextAreaField
          id="bookmark-edit-description"
          label="Description"
          rows={3}
          value={description}
          error={fieldErrors.description}
          onChange={(event) => {
            clearFieldError("description");
            setAcceptDescription(false);
            setDescription(event.currentTarget.value);
          }}
        />
        {bookmark.retrievedDescriptionCandidate &&
        bookmark.retrievedDescriptionCandidate !== bookmark.description ? (
          <div className="metadata-candidate">
            <span>Retrieved suggestion: {bookmark.retrievedDescriptionCandidate}</span>
            <Button
              size="small"
              variant="quiet"
              onClick={() => {
                setDescription(bookmark.retrievedDescriptionCandidate ?? description);
                setAcceptDescription(true);
              }}
            >
              Use retrieved description
            </Button>
          </div>
        ) : null}
      </div>
      <TextField
        id="bookmark-edit-tags"
        label="Tags"
        value={tags}
        error={fieldErrors.tags}
        hint="Separate tags with commas. Capitalization-only duplicates are combined."
        onChange={(event) => {
          clearFieldError("tags");
          setTags(event.currentTarget.value);
        }}
      />
      <NoteEditor
        value={noteMarkdown}
        onChange={(value) => {
          clearFieldError("noteMarkdown");
          setNoteMarkdown(value);
        }}
      />
      {fieldErrors.noteMarkdown ? <Status tone="error">{fieldErrors.noteMarkdown}</Status> : null}
      {error ? <Status tone="error">{error}</Status> : null}
      <div className="bookmark-editor__actions">
        {onRequestDelete ? (
          <Button variant="danger" onClick={() => onRequestDelete(bookmark)}>
            Delete bookmark
          </Button>
        ) : null}
        <Button variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" busy={saving} busyLabel="Saving changes…">
          Save changes
        </Button>
      </div>
    </form>
  );
}
