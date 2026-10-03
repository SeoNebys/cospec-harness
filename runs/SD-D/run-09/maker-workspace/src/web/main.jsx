import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { api } from './api/client.js';
import { AllView } from './routes/AllView.jsx';
import { UnreadView } from './routes/UnreadView.jsx';
import { ArchivedView } from './routes/ArchivedView.jsx';
import { AddView } from './routes/AddView.jsx';
import { EditView } from './routes/EditView.jsx';
import { FiltersView } from './routes/FiltersView.jsx';
import { ImportExportView } from './routes/ImportExportView.jsx';
import { PreferencesView } from './routes/PreferencesView.jsx';

export const PrefsContext = React.createContext({ prefs: null, reloadPrefs: () => {} });

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash || '#/');
  useEffect(() => {
    const onChange = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  const path = hash.replace(/^#/, '') || '/';
  return path;
}

export function navigate(to) {
  window.location.hash = to;
}

const NAV = [
  { to: '/', label: 'All bookmarks' },
  { to: '/unread', label: 'Unread / Read later' },
  { to: '/archived', label: 'Archived' },
  { to: '/add', label: '+ Add bookmark' },
  { to: '/filters', label: 'Saved filters' },
  { to: '/import-export', label: 'Import / Export' },
  { to: '/preferences', label: 'Preferences' },
];

function Sidebar({ path }) {
  return (
    <nav className="sidebar">
      <h1>🔖 Bookmarks</h1>
      <div className="nav">
        {NAV.map((n) => {
          const active = path === n.to || (n.to !== '/' && path.startsWith(n.to));
          return (
            <a key={n.to} href={`#${n.to}`} className={active ? 'active' : ''}>
              {n.label}
            </a>
          );
        })}
      </div>
    </nav>
  );
}

function Router({ path }) {
  if (path === '/') return <AllView />;
  if (path === '/unread') return <UnreadView />;
  if (path === '/archived') return <ArchivedView />;
  if (path === '/add') return <AddView />;
  if (path.startsWith('/edit/')) return <EditView id={decodeURIComponent(path.slice('/edit/'.length))} />;
  if (path === '/filters') return <FiltersView />;
  if (path === '/import-export') return <ImportExportView />;
  if (path === '/preferences') return <PreferencesView />;
  return <div className="empty">Not found</div>;
}

function App() {
  const path = useHashRoute();
  const [prefs, setPrefs] = useState(null);
  const [ready, setReady] = useState(false);

  const reloadPrefs = useCallback(async () => {
    const p = await api.preferences();
    setPrefs(p);
    document.documentElement.setAttribute('data-font', p.fontSize);
    return p;
  }, []);

  useEffect(() => {
    // Initial data load gate for the harness readiness marker.
    (async () => {
      try {
        await reloadPrefs();
      } catch {
        /* preferences fall back to defaults visually */
      } finally {
        setReady(true);
      }
    })();
  }, [reloadPrefs]);

  useEffect(() => {
    if (ready) {
      document.body.setAttribute('data-harness-ready', 'true');
    }
  }, [ready]);

  return (
    <PrefsContext.Provider value={{ prefs, reloadPrefs }}>
      <div className="layout">
        <Sidebar path={path} />
        <main className="main">{ready ? <Router path={path} /> : <div className="empty">Loading…</div>}</main>
      </div>
    </PrefsContext.Provider>
  );
}

createRoot(document.getElementById('root')).render(<App />);
