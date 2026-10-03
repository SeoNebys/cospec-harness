import { useState } from "react";
import { Button, Dialog } from "../../components";
import type { SavedView } from "../../lib/api";

export interface SavedViewListProps {
  views: SavedView[];
  activeId?: number | null;
  onOpen: (view: SavedView) => void;
  onEdit: (view: SavedView) => void;
  onDelete: (view: SavedView) => void | Promise<void>;
}

export function SavedViewList({ views, activeId, onOpen, onEdit, onDelete }: SavedViewListProps) {
  const [deleting, setDeleting] = useState<SavedView | null>(null);

  if (!views.length) {
    return <p className="saved-views-empty">No saved views yet.</p>;
  }

  return (
    <>
      <ul className="saved-view-list">
        {views.map((view) => (
          <li key={view.id} className={activeId === view.id ? "saved-view--active" : ""}>
            <Button variant="quiet" onClick={() => onOpen(view)}>
              {view.name}
            </Button>
            <div className="saved-view-list__actions">
              <Button
                size="small"
                variant="quiet"
                aria-label={`Edit ${view.name}`}
                onClick={() => onEdit(view)}
              >
                Edit
              </Button>
              <Button
                size="small"
                variant="quiet"
                aria-label={`Delete ${view.name}`}
                onClick={() => setDeleting(view)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
      <Dialog
        open={deleting !== null}
        destructive
        title="Delete saved view?"
        description={
          deleting ? `Delete “${deleting.name}”? Your bookmarks will not be changed.` : undefined
        }
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="quiet" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const selected = deleting;
                setDeleting(null);
                if (selected) void onDelete(selected);
              }}
            >
              Delete saved view
            </Button>
          </>
        }
      />
    </>
  );
}
