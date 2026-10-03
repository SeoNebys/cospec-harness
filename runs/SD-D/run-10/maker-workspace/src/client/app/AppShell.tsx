import type { ReactNode } from 'react';
import { useSession } from '../features/auth/session-context';

export type AppView =
  | 'library'
  | 'read-later'
  | 'favorites'
  | 'archive'
  | 'tags'
  | 'collections'
  | 'saved-searches';
const navigation: Array<{ id: AppView; label: string; icon: string }> = [
  { id: 'library', label: 'Library', icon: '⌂' },
  { id: 'read-later', label: 'Read Later', icon: '◷' },
  { id: 'favorites', label: 'Favorites', icon: '◇' },
  { id: 'archive', label: 'Archive', icon: '▣' },
  { id: 'tags', label: 'Tags', icon: '⌗' },
  { id: 'collections', label: 'Collections', icon: '▦' },
  { id: 'saved-searches', label: 'Saved Searches', icon: '⌕' },
];

export function AppShell({
  children,
  count,
  view,
  onNavigate,
}: {
  children: ReactNode;
  count: number;
  view: AppView;
  onNavigate(view: AppView): void;
}) {
  const session = useSession();
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="wordmark" href="/" aria-label="Keepwell home">
          <span className="wordmark-mark">K</span> Keepwell
        </a>
        <nav aria-label="Library navigation">
          {navigation.map((item) => (
            <button
              className={`nav-item ${view === item.id ? 'nav-item--active' : ''}`}
              key={item.id}
              onClick={() => onNavigate(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.id === 'library' && <span className="nav-count">{count}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{session.user?.email.slice(0, 1).toUpperCase()}</div>
          <div className="sidebar-user">
            <strong>{session.user?.email.split('@')[0]}</strong>
            <span>{session.user?.email}</span>
          </div>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={() => void session.logout()}
          >
            ↗
          </button>
        </div>
      </aside>
      <div className="workspace">
        {children}
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={view === item.id ? 'active' : ''}
              onClick={() => onNavigate(item.id)}
            >
              <span>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
