import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom';
import { ListPage } from './pages/ListPage';
import { SettingsPage } from './pages/SettingsPage';
import { PreferencesProvider } from './state/preferences';
import './styles.css';

function App() {
  return (
    <PreferencesProvider>
      <div className="app">
        <header className="topbar">
          <h1>🔖 Bookmarks</h1>
          <nav>
            <NavLink to="/" end>
              All
            </NavLink>
            <NavLink to="/readlater">Read Later</NavLink>
            <NavLink to="/archive">Archive</NavLink>
            <NavLink to="/settings">Settings</NavLink>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<ListPage view="all" key="all" />} />
            <Route path="/readlater" element={<ListPage view="readlater" key="readlater" />} />
            <Route path="/archive" element={<ListPage view="archive" key="archive" />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </PreferencesProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
