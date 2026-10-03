import type { ReactNode } from 'react';
import { Button } from '../components/Button';

export type LibraryView = 'active' | 'unread' | 'archived';
export function AppShell({
  view,
  counts,
  onView,
  onCreate,
  children,
  status,
}: {
  view: LibraryView;
  counts: Record<LibraryView, number>;
  onView: (view: LibraryView) => void;
  onCreate: () => void;
  children: ReactNode;
  status: string;
}) {
  return (
    <div className="app-shell">
      <header className="masthead">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            P
          </div>
          <div>
            <h1>Pinboard</h1>
            <p>Your thoughtful corner of the web.</p>
          </div>
        </div>
        <Button onClick={onCreate}>+ Save a link</Button>
      </header>
      <div className="layout">
        <nav className="nav" aria-label="Bookmark views">
          {(['active', 'unread', 'archived'] as const).map((item) => (
            <button key={item} aria-current={view === item ? 'page' : undefined} onClick={() => onView(item)}>
              <span>{item === 'active' ? 'Library' : item === 'unread' ? 'Read later' : 'Archive'}</span>{' '}
              <span aria-label={`${counts[item]} bookmarks`}>{counts[item]}</span>
            </button>
          ))}
        </nav>
        <main className="main">{children}</main>
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {status}
      </div>
    </div>
  );
}
