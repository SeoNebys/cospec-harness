import { type FormEvent, useEffect, useState } from "react";
import { Button, Dialog, TextField } from "../../components";
import {
  ApiError,
  api,
  type BookmarkApiClient,
  type SavedView,
  type SearchCriteria,
} from "../../lib/api";

export interface SavedViewDialogProps {
  open: boolean;
  criteria: SearchCriteria;
  existing?: SavedView;
  client?: BookmarkApiClient;
  onSaved: (view: SavedView) => void;
  onClose: () => void;
}

export function SavedViewDialog({
  open,
  criteria,
  existing,
  client = api,
  onSaved,
  onClose,
}: SavedViewDialogProps) {
  const [name, setName] = useState(existing?.name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(existing?.name ?? "");
      setError(null);
    }
  }, [existing?.name, open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const displayName = name.trim();
    if (!displayName) {
      setError("Enter a name for this view.");
      return;
    }
    const controller = new AbortController();
    setSaving(true);
    setError(null);
    const input = { ...criteria, name: displayName };
    try {
      const saved = existing
        ? await client.updateSavedView(existing.id, input, { signal: controller.signal })
        : await client.createSavedView(input, { signal: controller.signal });
      onSaved(saved);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.problem.message
          : "The saved view could not be stored. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      title={existing ? "Update saved view" : "Save this view"}
      description="Saved views rerun these criteria against your current bookmarks."
      onClose={onClose}
    >
      <form className="saved-view-form" onSubmit={submit}>
        <TextField
          label="View name"
          value={name}
          required
          autoFocus
          error={error ?? undefined}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <div className="saved-view-summary">
          <strong>Criteria</strong>
          <span>{criteria.query || "All bookmarks"}</span>
          {criteria.tags.length ? <span>Tags: {criteria.tags.join(", ")}</span> : null}
          <span>Scope: {criteria.scope.replace("_", " ")}</span>
        </div>
        <div className="capture-form__actions">
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" busy={saving}>
            {existing ? "Update view" : "Save view"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
