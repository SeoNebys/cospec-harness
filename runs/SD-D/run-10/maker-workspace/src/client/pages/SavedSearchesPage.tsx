import { useEffect, useState } from 'react';
import type { SearchCriteria } from '../../shared/contracts/search';
import { api } from '../app/api-client';
type Saved = { id: string; name: string; criteria: SearchCriteria; matchCount: number; version: number };
export function SavedSearchesPage({ onOpen }: { onOpen(criteria: SearchCriteria): void }) {
  const [items, setItems] = useState<Saved[]>([]);
  const load = () => api.request<{ items: Saved[] }>('/api/saved-searches').then((r) => setItems(r.items));
  useEffect(() => {
    void load();
  }, []);
  const rename = async (item: Saved) => {
    const name = window.prompt('Rename saved search', item.name);
    if (!name) return;
    await api.request(`/api/saved-searches/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ expectedVersion: item.version, name }),
    });
    await load();
  };
  const remove = async (item: Saved) => {
    if (!window.confirm(`Delete “${item.name}”? No bookmarks will change.`)) return;
    await api.request(`/api/saved-searches/${item.id}`, {
      method: 'DELETE',
      body: JSON.stringify({ expectedVersion: item.version }),
    });
    await load();
  };
  return (
    <main className="management-page">
      <p className="eyebrow">Live, reusable criteria</p>
      <h1>Saved Searches</h1>
      <p className="muted">Each saved search runs against your library as it exists now.</p>
      <div className="management-list">
        {items.map((item) => (
          <article key={item.id}>
            <button className="management-name" onClick={() => onOpen(item.criteria)}>
              {item.name}
            </button>
            <span>{item.matchCount} current matches</span>
            <button onClick={() => void rename(item)}>Rename</button>
            <button onClick={() => void remove(item)}>Delete</button>
          </article>
        ))}
        {items.length === 0 && <p className="muted">Save a useful combination from any bookmark view.</p>}
      </div>
    </main>
  );
}
