import { useState, type FormEvent } from 'react';
import { ApiError } from '../../app/api-client';
import { useSession } from './session-context';
import './auth.css';

type Mode = 'login' | 'register' | 'recover' | 'reset';

export function AuthPages() {
  const resetToken = new URLSearchParams(window.location.search).get('reset');
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login');
  const [email, setEmail] = useState('review@example.test');
  const [password, setPassword] = useState('ReviewPassphrase-2026!');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const session = useSession();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'login') await session.login(email, password);
      if (mode === 'register') await session.register(email, password);
      if (mode === 'recover') {
        await session.requestReset(email);
        setMessage('If that account exists, a reset link has been sent.');
      }
      if (mode === 'reset' && resetToken) {
        await session.confirmReset(resetToken, password);
        window.history.replaceState({}, '', '/');
        setMode('login');
        setMessage('Password updated. Sign in with your new password.');
      }
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.problem.detail : 'Something went wrong. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page" data-harness-ready="true">
      <section className="auth-story">
        <a className="wordmark wordmark--light" href="/" aria-label="Keepwell home">
          <span className="wordmark-mark">K</span> Keepwell
        </a>
        <div className="auth-story-copy">
          <p className="eyebrow">A calmer corner of the internet</p>
          <h1>
            Keep what matters.
            <br />
            Find it when it does.
          </h1>
          <p>Save useful pages with their context intact—then make the collection unmistakably yours.</p>
        </div>
        <div className="auth-quote">
          <span>“</span>
          <p>A library is not a luxury but one of the necessities of life.</p>
          <small>Henry Ward Beecher</small>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={submit}>
          <p className="eyebrow">
            {mode === 'register'
              ? 'Start your library'
              : mode === 'recover'
                ? 'Account recovery'
                : mode === 'reset'
                  ? 'Choose a new password'
                  : 'Welcome back'}
          </p>
          <h2>
            {mode === 'register'
              ? 'Create your account'
              : mode === 'recover'
                ? 'Reset your password'
                : mode === 'reset'
                  ? 'Make it memorable'
                  : 'Sign in to Keepwell'}
          </h2>
          <p className="muted">
            {mode === 'recover'
              ? 'We’ll send instructions if an account matches that address.'
              : mode === 'reset'
                ? 'Use at least 12 characters.'
                : 'Your private collection is waiting.'}
          </p>
          {mode !== 'reset' && (
            <label>
              Email address
              <input
                type="email"
                required
                maxLength={320}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {mode !== 'recover' && (
            <label>
              Password
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          )}
          {error && (
            <div className="message message--error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="message message--success" role="status">
              {message}
            </div>
          )}
          <button className="button button--primary button--wide" disabled={busy} type="submit">
            {busy
              ? 'One moment…'
              : mode === 'login'
                ? 'Sign in'
                : mode === 'register'
                  ? 'Create account'
                  : mode === 'reset'
                    ? 'Update password'
                    : 'Send reset link'}
          </button>
          <div className="auth-switches">
            {mode !== 'login' && (
              <button type="button" onClick={() => setMode('login')}>
                Back to sign in
              </button>
            )}
            {mode === 'login' && (
              <button type="button" onClick={() => setMode('register')}>
                Create an account
              </button>
            )}
            {mode === 'login' && (
              <button type="button" onClick={() => setMode('recover')}>
                Forgot password?
              </button>
            )}
          </div>
          <p className="review-hint">Review access is prefilled for this milestone.</p>
        </form>
      </section>
    </main>
  );
}
