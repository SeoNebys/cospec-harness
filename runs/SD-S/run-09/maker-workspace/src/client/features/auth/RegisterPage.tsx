import { useState, type FormEvent } from "react";
import { api } from "../../lib/api.js";

export function RegisterPage({ navigate }: { navigate: (path: string) => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (form.password !== form.confirm) { setMessage("Passwords do not match."); return; }
    if ([...form.password].length < 15) { setMessage("Use at least 15 characters."); return; }
    setBusy(true); setMessage("");
    try {
      await api("/auth/sign-up/email", { method: "POST", body: JSON.stringify({ name: form.name, email: form.email, password: form.password }) });
      setMessage("Account request accepted. You can sign in now.");
    } catch { setMessage("We couldn’t complete that request. Check the fields and try again."); }
    finally { setBusy(false); }
  }
  return <main className="auth-page" data-harness-ready="true"><section className="auth-brand"><div className="brand-mark">K</div><p>Save what matters. Find it later.</p></section><section className="auth-card">
    <button className="back-button" onClick={()=>navigate("/")}>← Back to sign in</button><div className="eyebrow">YOUR LIBRARY</div><h1>Create an account</h1>
    <form onSubmit={submit}>
      <label>Name<input autoFocus value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} maxLength={80} required /></label>
      <label>Email<input type="email" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} required /></label>
      <label>Password <span className="hint">15–128 characters</span><input type="password" value={form.password} onChange={(e)=>setForm({...form,password:e.target.value})} required /></label>
      <label>Confirm password<input type="password" value={form.confirm} onChange={(e)=>setForm({...form,confirm:e.target.value})} required /></label>
      {message && <p className="form-message" role="status">{message}</p>}
      <button className="primary full" disabled={busy}>{busy ? "Creating…" : "Create account"}</button>
    </form>
  </section></main>;
}
