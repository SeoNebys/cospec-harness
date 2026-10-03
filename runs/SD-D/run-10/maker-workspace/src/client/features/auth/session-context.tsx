import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../../app/api-client';

type User = { id: string; email: string };
type SessionResponse = { authenticated: boolean; csrfToken: string; user: User | null };
type SessionContextValue = {
  loading: boolean;
  user: User | null;
  login(email: string, password: string): Promise<void>;
  register(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  requestReset(email: string): Promise<void>;
  confirmReset(token: string, password: string): Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  const apply = useCallback((session: SessionResponse) => {
    api.setCsrfToken(session.csrfToken);
    setUser(session.user);
  }, []);

  useEffect(() => {
    api
      .request<SessionResponse>('/api/auth/session')
      .then(apply)
      .finally(() => setLoading(false));
  }, [apply]);

  const value = useMemo<SessionContextValue>(
    () => ({
      loading,
      user,
      async login(email, password) {
        apply(
          await api.request<SessionResponse>('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }),
        );
      },
      async register(email, password) {
        apply(
          await api.request<SessionResponse>('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
          }),
        );
      },
      async logout() {
        await api.request('/api/auth/logout', { method: 'POST' });
        api.setCsrfToken(null);
        const session = await api.request<SessionResponse>('/api/auth/session');
        apply(session);
      },
      async requestReset(email) {
        await api.request('/api/auth/password-reset/request', {
          method: 'POST',
          body: JSON.stringify({ email }),
        });
      },
      async confirmReset(token, password) {
        await api.request('/api/auth/password-reset/confirm', {
          method: 'POST',
          body: JSON.stringify({ token, password }),
        });
      },
    }),
    [apply, loading, user],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used within SessionProvider');
  return value;
}
