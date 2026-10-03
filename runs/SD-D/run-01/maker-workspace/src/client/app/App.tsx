import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from './auth-context';
import { AuthPage } from '../features/auth/AuthPage';

export function App() {
  const { user, loading, logout } = useAuth();
  if (loading) return <main className="center-message" aria-live="polite">Loading your collection…</main>;
  if (!user) return <AuthPage />;
  return <div className="app-shell" data-harness-ready="true">
    <header className="topbar"><NavLink to="/" className="brand">keepmark<span>.</span></NavLink><nav aria-label="Primary">
      <NavLink to="/">Collection</NavLink><NavLink to="/read-later">Read later</NavLink><NavLink to="/archive">Archive</NavLink><NavLink to="/settings">Data</NavLink>
    </nav><div className="account"><span>{user.email}</span><button className="text-button" onClick={() => void logout()}>Sign out</button></div></header>
    <Outlet />
    <div id="live-status" className="sr-only" aria-live="polite" />
  </div>;
}
