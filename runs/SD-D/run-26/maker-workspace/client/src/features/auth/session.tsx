import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, jsonBody, setCsrf } from '../../services/api.js';
type Session = {
  loading: boolean;
  authenticated: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true),
    [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    api<{ csrfToken: string }>('/api/session')
      .then((s) => {
        setCsrf(s.csrfToken);
        setAuthenticated(true);
      })
      .catch(() => setAuthenticated(false))
      .finally(() => setLoading(false));
  }, []);
  const login = useCallback(async (password: string) => {
    const s = await api<{ csrfToken: string }>('/api/session', {
      method: 'POST',
      body: jsonBody({ password })
    });
    setCsrf(s.csrfToken);
    setAuthenticated(true);
  }, []);
  const logout = useCallback(async () => {
    await api('/api/session', { method: 'DELETE' });
    setCsrf(null);
    setAuthenticated(false);
  }, []);
  return (
    <Context.Provider value={{ loading, authenticated, login, logout }}>
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const value = useContext(Context);
  if (!value) throw new Error('SessionProvider missing');
  return value;
}
