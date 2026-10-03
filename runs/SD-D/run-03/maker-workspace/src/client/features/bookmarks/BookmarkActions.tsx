import { useState } from "react";
import { Button, Status } from "../../components";
import { api, type Bookmark, type BookmarkApiClient } from "../../lib/api";

export interface BookmarkActionsProps {
  bookmark: Bookmark;
  client?: BookmarkApiClient | undefined;
  onUpdated: (bookmark: Bookmark, outcome?: string) => void;
}

type PendingAction = "favorite" | "archive" | "refresh" | null;

export function BookmarkActions({ bookmark, client = api, onUpdated }: BookmarkActionsProps) {
  const [pending, setPending] = useState<PendingAction>(null);
  const [outcome, setOutcome] = useState("");
  const [failed, setFailed] = useState(false);

  async function patch(
    action: Exclude<PendingAction, "refresh" | null>,
    change: { favorite: boolean } | { archived: boolean },
    message: string,
  ) {
    setPending(action);
    setFailed(false);
    try {
      const updated = await client.updateBookmark(bookmark.id, change);
      const retention = "archived" in change && bookmark.unread ? " Read Later retained." : "";
      const result = `${message}${retention}`;
      setOutcome(result);
      onUpdated(updated, result);
    } catch {
      setFailed(true);
      setOutcome("The bookmark could not be changed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function refresh() {
    setPending("refresh");
    setFailed(false);
    try {
      await client.refreshBookmarkMetadata(bookmark.id);
      setOutcome("Page detail refresh started. Your custom text will be kept.");
    } catch {
      setFailed(true);
      setOutcome("Page details could not be refreshed. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="bookmark-actions" aria-label="Bookmark actions">
      <div className="bookmark-actions__buttons">
        <Button
          busy={pending === "favorite"}
          busyLabel="Updating…"
          onClick={() =>
            patch(
              "favorite",
              { favorite: !bookmark.favorite },
              bookmark.favorite ? "Removed from favorites." : "Added to favorites.",
            )
          }
        >
          {bookmark.favorite ? "Remove from favorites" : "Add to favorites"}
        </Button>
        <Button
          busy={pending === "archive"}
          busyLabel="Updating…"
          onClick={() =>
            patch(
              "archive",
              { archived: !bookmark.archived },
              bookmark.archived ? "Bookmark restored." : "Bookmark archived.",
            )
          }
        >
          {bookmark.archived ? "Restore bookmark" : "Archive bookmark"}
        </Button>
        <Button
          variant="quiet"
          busy={pending === "refresh"}
          busyLabel="Starting refresh…"
          onClick={refresh}
        >
          Refresh page details
        </Button>
      </div>
      <Status tone={failed ? "error" : outcome ? "success" : "neutral"}>
        {outcome || "Bookmark actions ready."}
      </Status>
    </section>
  );
}
