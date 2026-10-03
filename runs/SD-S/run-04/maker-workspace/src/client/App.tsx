import { useEffect, useState } from 'react';
import type { CurrentUser } from '../shared/contracts/auth';
import { api } from './api/client';
import { AuthScreen } from './features/auth/AuthScreen';
import { BookmarkCollection } from './features/bookmarks/BookmarkCollection';

export function App() {
  const [user, setUser] = useState<CurrentUser | null | undefined>(undefined);
  useEffect(() => {
    api<CurrentUser>('/auth/me')
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  if (user === undefined)
    return (
      <div className="app-loading">
        <span className="brand">
          Keepsake<span>.</span>
        </span>
        <p>Opening your collection…</p>
      </div>
    );
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  return (
    <BookmarkCollection
      user={user}
      onSignOut={async () => {
        await api('/auth/logout', { method: 'POST' });
        setUser(null);
      }}
    />
  );
}
