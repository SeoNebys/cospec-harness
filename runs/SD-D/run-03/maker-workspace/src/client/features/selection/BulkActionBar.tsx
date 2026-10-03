import { useRef, useState } from "react";
import { Button, Dialog, TextField } from "../../components";
import {
  ApiError,
  api,
  type BookmarkApiClient,
  type BulkAction,
  type BulkResult,
  type Selection,
} from "../../lib/api";

export interface BulkActionBarProps {
  selection: Selection;
  client?: BookmarkApiClient | undefined;
  onComplete: (result: BulkResult, action: BulkAction) => void;
  onClear: () => void;
  onExpired: () => void;
}

function normalizeTags(value: string): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of value.split(",")) {
    const display = entry.replace(/\s+/gu, " ").trim();
    const key = display.normalize("NFKC").toLocaleLowerCase("und");
    if (!display || seen.has(key)) continue;
    seen.add(key);
    result.push(display);
  }
  return result;
}

const stateActions: Array<{ label: string; action: BulkAction }> = [
  { label: "Favorite", action: { type: "favorite" } },
  { label: "Unfavorite", action: { type: "unfavorite" } },
  { label: "Mark unread", action: { type: "mark_unread" } },
  { label: "Mark read", action: { type: "mark_read" } },
  { label: "Archive", action: { type: "archive" } },
  { label: "Restore", action: { type: "restore" } },
];

export function BulkActionBar({
  selection,
  client = api,
  onComplete,
  onClear,
  onExpired,
}: BulkActionBarProps) {
  const [tags, setTags] = useState("");
  const [pending, setPending] = useState(false);
  const [consumed, setConsumed] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [error, setError] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);

  async function apply(action: BulkAction) {
    setPending(true);
    setError("");
    setResult(null);
    try {
      const next = await client.applyBulkAction(selection.id, action);
      setResult(next);
      setConsumed(true);
      setDeleteOpen(false);
      onComplete(next, action);
    } catch (cause) {
      const expired =
        cause instanceof ApiError &&
        (cause.problem.code === "SELECTION_EXPIRED" ||
          cause.problem.code === "SELECTION_NOT_FOUND");
      setError(
        cause instanceof ApiError
          ? cause.problem.message
          : "The bulk action could not be completed. Please try again.",
      );
      if (expired) onExpired();
    } finally {
      setPending(false);
    }
  }

  function applyTags(type: "add_tags" | "remove_tags") {
    const normalized = normalizeTags(tags);
    if (normalized.length === 0) {
      setError("Enter at least one tag before applying a tag action.");
      return;
    }
    void apply({ type, tags: normalized });
  }

  async function clear() {
    setPending(true);
    setError("");
    try {
      if (!consumed) await client.clearSelection(selection.id);
      onClear();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.problem.message
          : "The selection could not be cleared. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  const disabled = pending || consumed;

  return (
    <section className="bulk-action-bar" aria-label="Bulk actions">
      <div className="bulk-action-bar__heading">
        <strong>
          {selection.selectedCount} bookmark{selection.selectedCount === 1 ? "" : "s"} selected
        </strong>
        <Button size="small" variant="quiet" disabled={pending} onClick={clear}>
          Clear selection
        </Button>
      </div>

      <fieldset className="bulk-action-bar__states">
        <legend>Status actions</legend>
        {stateActions.map(({ label, action }) => (
          <Button key={action.type} size="small" disabled={disabled} onClick={() => apply(action)}>
            {label}
          </Button>
        ))}
      </fieldset>

      <div className="bulk-action-bar__tags">
        <TextField
          id="bulk-tags"
          label="Bulk tags"
          value={tags}
          placeholder="research, reading"
          hint="Separate multiple tags with commas."
          disabled={disabled}
          onChange={(event) => setTags(event.currentTarget.value)}
        />
        <div>
          <Button size="small" disabled={disabled} onClick={() => applyTags("add_tags")}>
            Add tags
          </Button>
          <Button size="small" disabled={disabled} onClick={() => applyTags("remove_tags")}>
            Remove tags
          </Button>
        </div>
      </div>

      <Button
        ref={deleteButtonRef}
        variant="danger"
        disabled={disabled}
        onClick={() => setDeleteOpen(true)}
      >
        Permanently delete
      </Button>

      {pending ? (
        <div role="status" aria-label="Bulk action progress" aria-live="polite">
          Applying action to {selection.selectedCount} bookmark
          {selection.selectedCount === 1 ? "" : "s"}…
        </div>
      ) : null}
      {result ? (
        <div role="status" aria-label="Bulk action result" aria-live="polite" aria-atomic="true">
          Processed {result.processedCount} of {result.selectedCount}; changed {result.changedCount}
          .
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="bulk-action-bar__error">
          {error}
        </div>
      ) : null}

      <Dialog
        open={deleteOpen}
        title={`Delete ${selection.selectedCount} bookmark${selection.selectedCount === 1 ? "" : "s"}?`}
        description="This permanently removes every selected bookmark and cannot be undone."
        onClose={() => setDeleteOpen(false)}
        destructive
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" busy={pending} onClick={() => apply({ type: "delete" })}>
              Delete {selection.selectedCount} bookmark
              {selection.selectedCount === 1 ? "" : "s"}
            </Button>
          </>
        }
      />
    </section>
  );
}
