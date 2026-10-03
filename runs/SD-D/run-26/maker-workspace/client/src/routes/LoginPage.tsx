import { useState, type FormEvent } from 'react';
import { useSession } from '../features/auth/session.js';
export function LoginPage() {
  const { login } = useSession();
  const [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
      setPassword('');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-page" data-harness-ready="true">
      <section className="login-card">
        <div className="brand-mark" aria-hidden="true">
          L
        </div>
        <p className="eyebrow">Private bookmark library</p>
        <h1>Welcome to Larder</h1>
        <p>Your links, notes, and reading pile stay on this server.</p>
        <form onSubmit={submit}>
          <label htmlFor="password">Owner password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
          />
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="primary wide" disabled={busy}>
            {busy ? 'Signing in…' : 'Open my library'}
          </button>
        </form>
        <p className="login-hint">
          Review password: <code>review-bookmarks</code>
        </p>
      </section>
    </main>
  );
}
