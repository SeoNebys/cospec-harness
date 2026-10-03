import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import './styles.css';
import { api } from './api.js';
import {
  AllBookmarks, UnreadView, ArchiveView, AddBookmark, BookmarkDetail,
  SavedViews, ImportExport, Preferences,
} from './pages.jsx';

const FONT_SCALE = { small: 0.9, medium: 1, large: 1.15 };

function applyFont(size) {
  document.documentElement.style.setProperty('--font-scale', String(FONT_SCALE[size] || 1));
}

function App() {
  const [, setPrefs] = useState(null);
  useEffect(() => {
    api.getPreferences().then((p) => { setPrefs(p); applyFont(p.fontSize); }).catch(() => {});
  }, []);

  return (
    <HashRouter>
      <div className="app">
        <aside className="sidebar">
          <h1>🔖 Bookmarks</h1>
          <nav>
            <NavLink to="/add">＋ Add</NavLink>
            <NavLink to="/" end>All</NavLink>
            <NavLink to="/unread">Unread</NavLink>
            <NavLink to="/archive">Archive</NavLink>
            <NavLink to="/views">Saved views</NavLink>
            <NavLink to="/import-export">Import / Export</NavLink>
            <NavLink to="/preferences">Preferences</NavLink>
          </nav>
        </aside>
        <main className="main">
          <Routes>
            <Route path="/" element={<AllBookmarks />} />
            <Route path="/add" element={<AddBookmark />} />
            <Route path="/unread" element={<UnreadView />} />
            <Route path="/archive" element={<ArchiveView />} />
            <Route path="/bookmark/:id" element={<BookmarkDetail />} />
            <Route path="/views" element={<SavedViews />} />
            <Route path="/import-export" element={<ImportExport />} />
            <Route path="/preferences" element={<Preferences onApply={(p) => applyFont(p.fontSize)} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

createRoot(document.getElementById('root')).render(<App />);
