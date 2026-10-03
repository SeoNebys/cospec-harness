import { useCallback, useEffect, useState } from "react";
import { api, type BookmarkApiClient, type SavedView } from "../../lib/api";
import type { ViewState } from "../../lib/view-state";

export function applySavedViewToViewState(view: SavedView, current: ViewState): ViewState {
  return {
    ...current,
    scope: view.scope,
    query: view.query,
    tags: [...view.tags],
    favorite: view.favorite ?? null,
    unread: view.unread ?? null,
    sort: view.sort,
    savedViewId: view.id,
    bookmarkId: null,
    editing: false,
    cursor: null,
  };
}

export function useSavedViews(client: BookmarkApiClient = api) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setViews(await client.listSavedViews());
    } catch {
      setError("Saved views could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsert = useCallback((view: SavedView) => {
    setViews((current) =>
      [...current.filter((candidate) => candidate.id !== view.id), view].sort((left, right) =>
        left.name.localeCompare(right.name),
      ),
    );
  }, []);

  const remove = useCallback(
    async (view: SavedView) => {
      await client.deleteSavedView(view.id);
      setViews((current) => current.filter((candidate) => candidate.id !== view.id));
    },
    [client],
  );

  return { views, loading, error, reload, upsert, remove };
}
