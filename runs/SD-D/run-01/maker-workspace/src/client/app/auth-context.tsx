import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from './api';

export interface User { id: string; email: string }
interface AuthValue { user: User | null; loading: boolean; authenticate(email: string, password: string, register: boolean): Promise<void>; logout(): Promise<void> }
const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api<User>('/auth/me').then(setUser).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const value = useMemo<AuthValue>(() => ({
    user, loading,
    authenticate: async (email, password, register) => setUser(await api<User>(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: JSON.stringify({ email, password }) })),
    logout: async () => { await api('/auth/logout', { method: 'POST' }); setUser(null); },
  }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
