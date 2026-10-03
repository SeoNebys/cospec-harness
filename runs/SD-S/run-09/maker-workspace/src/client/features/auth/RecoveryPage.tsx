import { useState, type FormEvent } from "react";
import { api } from "../../lib/api.js";

export function RecoveryPage({ navigate }: { navigate: (path: string) => void }) {
  const [email,setEmail]=useState(""); const [sent,setSent]=useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); try { await api("/auth/request-password-reset", { method:"POST", body:JSON.stringify({ email, redirectTo:`${location.origin}/reset-password` }) }); } finally { setSent(true); } }
  return <main className="auth-page" data-harness-ready="true"><section className="auth-card solo"><button className="back-button" onClick={()=>navigate("/")}>← Back</button><div className="eyebrow">ACCOUNT RECOVERY</div><h1>Reset your password</h1>
    {sent ? <div className="success-panel" role="status"><h2>Check your inbox</h2><p>If an account exists for that email, we sent a reset link.</p></div> : <form onSubmit={submit}><p className="muted">Enter your email and we’ll send a secure reset link.</p><label>Email<input autoFocus type="email" value={email} onChange={(e)=>setEmail(e.target.value)} required /></label><button className="primary full">Send reset link</button></form>}
  </section></main>;
}
