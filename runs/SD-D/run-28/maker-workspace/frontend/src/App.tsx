import { useCallback, useEffect, useState } from 'react';
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useParams,
  Navigate,
} from 'react-router-dom';
import { api, type Preferences, type SavedView } from './api/client.ts';
import { BookmarksView } from './pages/BookmarksView.tsx';
import { PreferencesPage } from './pages/Preferences.tsx';

const DEFAULT_PREFS: Preferences = {
  defaultSort: 'date_added_desc',
  itemsShown: 25,
  textSize: 'medium',
};

function Shell() {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [views, setViews] = useState<SavedView[]>([]);

  const loadViews = useCallback(() => {
    api.views().then((r) => setViews(r.views)).catch(() => setViews([]));
  }, []);

  useEffect(() => {
    api.preferences().then(setPrefs).catch(() => setPrefs(DEFAULT_PREFS));
    loadViews();
  }, [loadViews]);

  useEffect(() => {
    document.documentElement.setAttribute('data-size', prefs.textSize);
  }, [prefs.textSize]);

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>🔖 Bookmarks</h1>
        <nav className="nav">
          <NavLink to="/" end>
            All bookmarks
          </NavLink>
          <NavLink to="/unread">Read later</NavLink>
          <NavLink to="/archive">Archive</NavLink>
          <div className="section">Saved views</div>
          {views.length === 0 && <div className="muted" style={{ padding: '4px 10px' }}>None yet</div>}
          {views.map((v) => (
            <NavLink key={v.id} to={`/views/${v.id}`}>
              {v.name}
            </NavLink>
          ))}
          <div className="section">Settings</div>
          <NavLink to="/preferences">Preferences</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Routes>
          <Route
            path="/"
            element={
              <BookmarksView
                scope="active"
                defaultSort={prefs.defaultSort}
                pageSize={prefs.itemsShown}
                onViewsChanged={loadViews}
              />
            }
          />
          <Route
            path="/unread"
            element={
              <BookmarksView scope="unread" defaultSort={prefs.defaultSort} pageSize={prefs.itemsShown} onViewsChanged={loadViews} />
            }
          />
          <Route
            path="/archive"
            element={
              <BookmarksView scope="archived" defaultSort={prefs.defaultSort} pageSize={prefs.itemsShown} onViewsChanged={loadViews} />
            }
          />
          <Route path="/views/:id" element={<ViewRoute views={views} prefs={prefs} onViewsChanged={loadViews} />} />
          <Route path="/preferences" element={<PreferencesPage prefs={prefs} onChange={setPrefs} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function ViewRoute({
  views,
  prefs,
  onViewsChanged,
}: {
  views: SavedView[];
  prefs: Preferences;
  onViewsChanged: () => void;
}) {
  const { id } = useParams();
  const view = views.find((v) => String(v.id) === id) ?? null;
  return (
    <div>
      {view && (
        <div className="row-flex" style={{ marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{view.name}</h2>
          <div className="spacer" />
          <button
            className="danger"
            onClick={async () => {
              if (confirm(`Delete the view "${view.name}"?`)) {
                await api.deleteView(view.id);
                onViewsChanged();
                window.location.hash = '';
                window.history.pushState({}, '', '/');
                onViewsChanged();
              }
            }}
          >
            Delete view
          </button>
        </div>
      )}
      <BookmarksView
        key={id}
        scope="active"
        view={view}
        defaultSort={prefs.defaultSort}
        pageSize={prefs.itemsShown}
        onViewsChanged={onViewsChanged}
      />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
