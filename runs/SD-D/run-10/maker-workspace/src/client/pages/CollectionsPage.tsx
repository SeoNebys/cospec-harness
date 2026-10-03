import { useEffect, useState } from 'react';
import { ApiError, api } from '../app/api-client';
type Item = {
  id: string;
  name: string;
  activeBookmarkCount: number;
  archivedBookmarkCount: number;
  version: number;
};
export function CollectionsPage({ onBrowse }: { onBrowse(item: Item): void }) {
  const [items, setItems] = useState<Item[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const load = () => api.request<{ items: Item[] }>('/api/collections').then((r) => setItems(r.items));
  useEffect(() => {
    void load();
  }, []);
  const create = async () => {
    try {
      await api.request('/api/collections', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.problem.detail : 'Could not create collection.');
    }
  };
  const rename = async (item: Item) => {
    const next = window.prompt('Rename collection', item.name);
    if (!next) return;
    await api.request(`/api/collections/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion: item.version, name: next }),
    });
    await load();
  };
  const remove = async (item: Item) => {
    const impact = await api.request<{ bookmarkCount: number }>(
      `/api/collections/${item.id}/deletion-impact`,
    );
    if (
      !window.confirm(
        `Delete this collection and leave ${impact.bookmarkCount} bookmarks unfiled? Their tags will stay.`,
      )
    )
      return;
    await api.request(`/api/collections/${item.id}`, {
      method: 'DELETE',
      body: JSON.stringify({
        expectedVersion: item.version,
        confirmation: 'unfile',
        expectedBookmarkCount: impact.bookmarkCount,
      }),
    });
    await load();
  };
  return (
    <main className="management-page">
      <p className="eyebrow">Optional folders</p>
      <h1>Collections</h1>
      <p className="muted">Collections are optional. Tags remain attached when a collection is removed.</p>
      <div className="create-row">
        <input
          aria-label="New collection name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New collection"
        />
        <button className="button button--primary" onClick={() => void create()}>
          Create collection
        </button>
      </div>
      {error && <p className="message message--error">{error}</p>}
      <div className="management-list">
        {items.map((item) => (
          <article key={item.id}>
            <button className="management-name" onClick={() => onBrowse(item)}>
              {item.name}
            </button>
            <span>
              {item.activeBookmarkCount} active · {item.archivedBookmarkCount} archived
            </span>
            <button onClick={() => void rename(item)}>Rename</button>
            <button onClick={() => void remove(item)}>Delete</button>
          </article>
        ))}
      </div>
    </main>
  );
}
