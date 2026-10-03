import { NavLink, Outlet } from 'react-router';

export function AppShell() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <NavLink to="/" className="brand">Keepsake</NavLink>
        <nav aria-label="Main navigation">
          <NavLink to="/">Bookmarks</NavLink>
          <NavLink to="/to-read">To Read</NavLink>
          <NavLink to="/archive">Archive</NavLink>
        </nav>
        <NavLink className="button primary" to="/bookmarks/new">Add bookmark</NavLink>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
