import { useState, type FormEvent } from "react";
import { api } from "../../lib/api.js";

export function SignInPage({ onSuccess, navigate }: { onSuccess: () => Promise<void>; navigate: (path: string) => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api("/auth/sign-in/email", { method: "POST", body: JSON.stringify({ email, password, rememberMe: true }) }); await onSuccess(); }
    catch { setError("That email or password didn’t work. Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page" data-harness-ready="true">
    <section className="auth-brand"><div className="brand-mark">K</div><p>Your private corner of the web.</p></section>
    <section className="auth-card">
      <div className="eyebrow">WELCOME BACK</div><h1>Sign in to Keep</h1><p className="muted">Your links, thoughtfully organized and always close.</p>
      <form onSubmit={submit}>
        <label>Email<input autoFocus type="email" autoComplete="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
      <button className="text-button" onClick={()=>navigate("/recover")}>Forgot your password?</button>
      <div className="auth-divider"/><p>New to Keep? <button className="text-button inline" onClick={()=>navigate("/register")}>Create an account</button></p>
    </section>
  </main>;
}
