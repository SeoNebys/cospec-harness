import { useState } from 'react'

// Appears when one or more bookmarks are selected (US6). Applies a single action
// — add tag, mark read/unread, archive, or delete — to the whole selection at
// once. "Select all shown" ticks everything currently visible (FR-025); delete
// is behind a confirm step (FR-026).
export function BatchToolbar({
  selectedCount,
  shownCount,
  allShownSelected,
  onSelectAllShown,
  onClear,
  onAddTag,
  onRemoveTag,
  onSetRead,
  onArchive,
  onDelete
}: {
  selectedCount: number
  shownCount: number
  allShownSelected: boolean
  onSelectAllShown: () => void
  onClear: () => void
  onAddTag: (tagName: string) => void
  onRemoveTag: (tagName: string) => void
  onSetRead: (value: boolean) => void
  onArchive: () => void
  onDelete: () => void
}): JSX.Element {
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function addTag(): void {
    const name = window.prompt('Tag to add to the selected bookmarks')
    if (name && name.trim()) onAddTag(name.trim())
  }

  function removeTag(): void {
    const name = window.prompt('Tag to remove from the selected bookmarks')
    if (name && name.trim()) onRemoveTag(name.trim())
  }

  return (
    <div className="batch-toolbar">
      <span className="batch-count">{selectedCount} selected</span>
      <button className="secondary" onClick={onSelectAllShown}>
        {allShownSelected ? 'Deselect all' : `Select all ${shownCount} shown`}
      </button>
      <span className="batch-sep" />
      <button className="secondary" onClick={addTag}>
        Add tag
      </button>
      <button className="secondary" onClick={removeTag}>
        Remove tag
      </button>
      <button className="secondary" onClick={() => onSetRead(true)}>
        Mark read
      </button>
      <button className="secondary" onClick={() => onSetRead(false)}>
        Mark unread
      </button>
      <button className="secondary" onClick={onArchive}>
        Archive
      </button>
      {!confirmingDelete ? (
        <button className="danger" onClick={() => setConfirmingDelete(true)}>
          Delete…
        </button>
      ) : (
        <span className="confirm-delete">
          Delete {selectedCount} permanently?
          <button
            className="danger"
            onClick={() => {
              setConfirmingDelete(false)
              onDelete()
            }}
          >
            Yes, delete
          </button>
          <button className="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </button>
        </span>
      )}
      <button className="secondary" onClick={onClear}>
        Clear selection
      </button>
    </div>
  )
}
