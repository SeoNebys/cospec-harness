import { type FormEvent, type Ref, useEffect, useRef, useState } from "react";
import { Button, IconPlaceholder, Status, TextAreaField, TextField } from "../../components";
import {
  ApiError,
  api,
  type Bookmark,
  type BookmarkApiClient,
  type MetadataPreview,
  type Scope,
} from "../../lib/api";

export interface CaptureFormProps {
  client?: BookmarkApiClient;
  onSaved: (bookmark: Bookmark) => void;
  onDuplicate: (bookmarkId: number, scope?: Scope) => void;
  onCancel?: () => void;
  addressInputRef?: Ref<HTMLInputElement>;
}

type PreviewState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; value: MetadataPreview }
  | { phase: "error"; message: string };

function validWebAddress(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function duplicateFrom(error: unknown) {
  if (
    error instanceof ApiError &&
    error.status === 409 &&
    error.problem.code === "DUPLICATE_BOOKMARK" &&
    "existingBookmarkId" in error.problem
  ) {
    return error.problem;
  }
  return null;
}

export function CaptureForm({
  client = api,
  onSaved,
  onDuplicate,
  onCancel,
  addressInputRef,
}: CaptureFormProps) {
  const [address, setAddress] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [titleChanged, setTitleChanged] = useState(false);
  const [descriptionChanged, setDescriptionChanged] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [unread, setUnread] = useState(false);
  const [preview, setPreview] = useState<PreviewState>({ phase: "idle" });
  const [addressError, setAddressError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const titleChangedRef = useRef(false);
  const descriptionChangedRef = useRef(false);

  useEffect(() => {
    const trimmed = address.trim();
    setAddressError(null);
    setSaveError(null);
    if (!trimmed || !validWebAddress(trimmed)) {
      setPreview({ phase: "idle" });
      return;
    }

    const controller = new AbortController();
    setPreview({ phase: "loading" });
    const timer = window.setTimeout(() => {
      client
        .previewMetadata(trimmed, { signal: controller.signal })
        .then((result) => {
          if (controller.signal.aborted) return;
          setPreview({ phase: "ready", value: result });
          if (!titleChangedRef.current) setTitle(result.title || result.fallbackTitle);
          if (!descriptionChangedRef.current) setDescription(result.description);
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          const duplicate = duplicateFrom(error);
          if (duplicate) {
            setPreview({ phase: "error", message: "Opening the existing bookmark…" });
            onDuplicate(duplicate.existingBookmarkId, duplicate.existingScope);
            return;
          }
          setPreview({
            phase: "error",
            message:
              error instanceof ApiError
                ? error.problem.message
                : "Page details could not be retrieved. You can still save this bookmark.",
          });
        });
    }, 350);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [address, client, onDuplicate]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = address.trim();
    if (!validWebAddress(trimmed)) {
      setAddressError("Enter a full website address beginning with http:// or https://.");
      return;
    }

    const controller = new AbortController();
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await client.createBookmark(
        {
          address: trimmed,
          ...(titleChanged ? { title: title.trim() } : {}),
          ...(descriptionChanged ? { description: description.trim() } : {}),
          favorite,
          unread,
        },
        { signal: controller.signal },
      );
      onSaved(saved);
    } catch (error) {
      const duplicate = duplicateFrom(error);
      if (duplicate) {
        setSaveError("That address is already saved. Opening the existing bookmark…");
        onDuplicate(duplicate.existingBookmarkId, duplicate.existingScope);
      } else {
        setSaveError(
          error instanceof ApiError
            ? error.problem.message
            : "The bookmark could not be saved. Please try again.",
        );
      }
    } finally {
      setSaving(false);
    }
  }

  const failedPreview =
    preview.phase === "ready" &&
    (preview.value.status === "failed" || preview.value.status === "skipped_unsafe");

  return (
    <form className="capture-form" onSubmit={handleSubmit} noValidate>
      <TextField
        ref={addressInputRef}
        id="capture-address"
        label="Web address"
        type="url"
        inputMode="url"
        autoComplete="url"
        required
        autoFocus
        placeholder="https://example.com/article"
        value={address}
        error={addressError ?? undefined}
        hint="Paste a page address. Its title, description, and icon will be filled in when available."
        onChange={(event) => setAddress(event.currentTarget.value)}
      />

      <div className="capture-preview" aria-live="polite">
        {preview.phase === "loading" ? <Status>Fetching page details…</Status> : null}
        {preview.phase === "ready" && !failedPreview ? (
          <Status tone="success">Page details found</Status>
        ) : null}
        {failedPreview ? (
          <Status tone="warning">
            Page details were unavailable. This will be saved with a fallback title.
          </Status>
        ) : null}
        {preview.phase === "error" ? (
          <Status tone={preview.message.startsWith("Opening") ? "neutral" : "warning"}>
            {preview.message}
          </Status>
        ) : null}
        {preview.phase === "ready" && !preview.value.iconAvailable ? (
          <IconPlaceholder label="Site icon unavailable" />
        ) : null}
      </div>

      <div className="capture-form__optional">
        <TextField
          id="capture-title"
          label="Title (optional)"
          value={title}
          placeholder="Filled in automatically"
          onChange={(event) => {
            titleChangedRef.current = true;
            setTitleChanged(true);
            setTitle(event.currentTarget.value);
          }}
        />
        <TextAreaField
          id="capture-description"
          label="Description (optional)"
          value={description}
          placeholder="Filled in automatically when the page provides one"
          rows={3}
          onChange={(event) => {
            descriptionChangedRef.current = true;
            setDescriptionChanged(true);
            setDescription(event.currentTarget.value);
          }}
        />
      </div>

      <fieldset className="capture-form__choices">
        <legend>Save options</legend>
        <label>
          <input
            type="checkbox"
            checked={unread}
            onChange={(event) => setUnread(event.currentTarget.checked)}
          />
          Read Later
        </label>
        <label>
          <input
            type="checkbox"
            checked={favorite}
            onChange={(event) => setFavorite(event.currentTarget.checked)}
          />
          Favorite
        </label>
      </fieldset>

      {saveError ? (
        <Status tone="error" className="capture-form__error">
          {saveError}
        </Status>
      ) : null}

      <div className="capture-form__actions">
        {onCancel ? (
          <Button variant="quiet" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" variant="primary" busy={saving} busyLabel="Saving…">
          Save bookmark
        </Button>
      </div>
    </form>
  );
}
