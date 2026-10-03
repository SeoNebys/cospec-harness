import { useState, type FormEvent } from 'react';
import { useAuth } from '../../app/auth-context';

export function AuthForm() {
  const { authenticate } = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await authenticate(email, password, register); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to continue.'); }
    finally { setBusy(false); }
  };
  return <form className="auth-form" onSubmit={submit} aria-describedby={error ? 'auth-error' : undefined}>
    <label>Email<input name="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
    <label>Password<input name="password" type="password" autoComplete={register ? 'new-password' : 'current-password'} minLength={12} required value={password} onChange={e => setPassword(e.target.value)} /></label>
    {error && <p id="auth-error" className="error" role="alert">{error}</p>}
    <button className="primary" disabled={busy}>{busy ? 'Please wait…' : register ? 'Create account' : 'Sign in'}</button>
    <button type="button" className="text-button" onClick={() => { setRegister(v => !v); setError(''); }}>
      {register ? 'Already have an account? Sign in' : 'New here? Create an account'}
    </button>
  </form>;
}
