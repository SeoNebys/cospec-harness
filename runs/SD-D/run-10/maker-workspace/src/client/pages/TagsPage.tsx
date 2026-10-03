import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '../app/api-client';
export function TagsPage({ onBrowse }: { onBrowse(tag: { id: string; name: string }): void }) {
  const [items, setItems] = useState<
    Array<{ id: string; name: string; bookmarkCount: number; version: number }>
  >([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(
    () =>
      api
        .request<{
          items: Array<{ id: string; name: string; bookmarkCount: number; version: number }>;
        }>('/api/tags')
        .then((result) => setItems(result.items)),
    [],
  );
  useEffect(() => {
    void load();
  }, [load]);
  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.request('/api/tags', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.problem.detail : 'Could not create tag.');
    }
  };
  const rename = async (item: (typeof items)[number]) => {
    const next = window.prompt('Rename tag', item.name);
    if (!next) return;
    try {
      await api.request(`/api/tags/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ expectedVersion: item.version, name: next }),
      });
      await load();
    } catch (e) {
      const problem = e instanceof ApiError ? e.problem : null;
      const extra = problem as typeof problem & { targetTag?: { id: string } };
      if (
        problem?.code === 'tag_merge_required' &&
        extra.targetTag &&
        window.confirm('That tag already exists. Merge them?')
      ) {
        await api.request(`/api/tags/${item.id}/merge`, {
          method: 'POST',
          body: JSON.stringify({
            expectedVersion: item.version,
            targetTagId: extra.targetTag.id,
            confirmation: 'merge',
          }),
        });
        await load();
      } else setError(problem?.detail ?? 'Could not rename tag.');
    }
  };
  const remove = async (item: (typeof items)[number]) => {
    const impact = await api.request<{ bookmarkCount: number; savedSearchCount: number }>(
      `/api/tags/${item.id}/deletion-impact`,
    );
    if (
      !window.confirm(
        `Remove #${item.name} from ${impact.bookmarkCount} bookmarks and ${impact.savedSearchCount} saved searches? Bookmarks will stay.`,
      )
    )
      return;
    await api.request(`/api/tags/${item.id}`, {
      method: 'DELETE',
      body: JSON.stringify({
        expectedVersion: item.version,
        confirmation: 'delete',
        expectedBookmarkCount: impact.bookmarkCount,
        expectedSavedSearchCount: impact.savedSearchCount,
      }),
    });
    await load();
  };
  return (
    <main className="management-page">
      <p className="eyebrow">Primary organization</p>
      <h1>Tags</h1>
      <p className="muted">A bookmark can carry several tags, with or without a collection.</p>
      <div className="create-row">
        <input
          aria-label="New tag name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New tag"
        />
        <button className="button button--primary" onClick={() => void create()}>
          Create tag
        </button>
      </div>
      {error && <p className="message message--error">{error}</p>}
      <div className="management-list">
        {items.map((item) => (
          <article key={item.id}>
            <button className="management-name" onClick={() => onBrowse(item)}>
              #{item.name}
            </button>
            <span>{item.bookmarkCount} bookmarks</span>
            <button onClick={() => void rename(item)}>Rename</button>
            <button onClick={() => void remove(item)}>Delete</button>
          </article>
        ))}
      </div>
    </main>
  );
}
