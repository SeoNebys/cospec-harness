import { NavLink, Outlet, useLocation } from 'react-router';
import { useSession } from '../features/auth/session.js';
export function AppShell() {
  const { logout } = useSession(),
    location = useLocation();
  const params = new URLSearchParams(location.search);
  const withCollection = (collection: string) =>
    `/?${new URLSearchParams({ ...Object.fromEntries(params), collection }).toString()}`;
  return (
    <div className="app-shell" data-harness-ready="true">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <span className="brand-mark small">L</span>
          <span>Larder</span>
        </NavLink>
        <nav aria-label="Primary">
          <NavLink to={withCollection('active')}>Library</NavLink>
          <NavLink to={withCollection('unread')}>Read later</NavLink>
          <NavLink to={withCollection('archive')}>Archive</NavLink>
          <NavLink to="/import-export">Import / export</NavLink>
        </nav>
        <button className="quiet" onClick={() => void logout()}>
          Sign out
        </button>
      </header>
      <Outlet />
    </div>
  );
}
