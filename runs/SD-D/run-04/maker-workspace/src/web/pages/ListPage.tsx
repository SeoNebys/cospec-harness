import { useState } from 'react';
import type { CreateBookmarkInput, View } from '../../shared/types';
import { api } from '../api/client';
import { BookmarkEditor, type SaveOutcome } from '../components/BookmarkEditor';
import { BackupPanel } from '../components/BackupPanel';
import { CollectionView } from '../components/CollectionView';
import { ArchivedPage } from './ArchivedPage';
import { ReadLaterPage } from './ReadLaterPage';

// App root: save box + backup + view tabs. Each tab renders the collection for a
// view. A reload token bumps on save/import so the active view refetches.

const TABS: Array<{ view: View; label: string }> = [
  { view: 'all', label: 'All' },
  { view: 'readLater', label: 'Read Later' },
  { view: 'archived', label: 'Archived' },
];

export function ListPage() {
  const [active, setActive] = useState<View>('all');
  const [reloadToken, setReloadToken] = useState(0);
  const bump = () => setReloadToken((n) => n + 1);

  const handleSave = async (input: CreateBookmarkInput): Promise<SaveOutcome> => {
    const res = await api.create(input);
    bump();
    return { existing: res.existing };
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Bookmarks</h1>
        <p>Save a web address and it’ll show up below with a preview.</p>
      </header>

      <BackupPanel onImported={bump} />
      <BookmarkEditor onSave={handleSave} />

      <nav className="view-tabs">
        {TABS.map((t) => (
          <button
            key={t.view}
            type="button"
            className={`view-tab${active === t.view ? ' active' : ''}`}
            onClick={() => setActive(t.view)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {active === 'archived' ? (
        <ArchivedPage reloadToken={reloadToken} />
      ) : active === 'readLater' ? (
        <ReadLaterPage reloadToken={reloadToken} />
      ) : (
        <CollectionView
          view="all"
          reloadToken={reloadToken}
          emptyTitle="No bookmarks yet"
          emptyHint="Paste a web address above to save your first one."
        />
      )}
    </div>
  );
}
