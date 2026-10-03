import { useState, type FormEvent } from 'react';
import type { CurrentUser } from '../../../shared/contracts/auth';
import { api } from '../../api/client';

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: CurrentUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      onAuthenticated(
        await api<CurrentUser>(`/auth/${mode}`, {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        }),
      );
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Could not continue.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell" data-harness-ready="true">
      <section className="auth-story" aria-label="About Keepsake">
        <a className="brand brand-light" href="/">
          Keepsake<span>.</span>
        </a>
        <div>
          <p className="eyebrow">Your corner of the internet</p>
          <h1>
            Save the good stuff.
            <br />
            <em>Find it again.</em>
          </h1>
          <p>One calm place for every article, recipe, reference, and rabbit hole worth keeping.</p>
        </div>
        <p className="auth-quote">
          “A library is not a luxury but one of the necessities of life.”
        </p>
      </section>
      <section className="auth-panel">
        <form className="auth-form" onSubmit={submit}>
          <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Start your collection'}</p>
          <h2>{mode === 'login' ? 'Sign in to Keepsake' : 'Create your account'}</h2>
          <p className="muted">
            {mode === 'login'
              ? 'Your saved corners of the web are waiting.'
              : 'A private home for the links you want to remember.'}
          </p>
          <label>
            Email address
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 12 characters"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary wide" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <p className="auth-switch">
            {mode === 'login' ? 'New to Keepsake?' : 'Already have an account?'}{' '}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </form>
      </section>
    </main>
  );
}
