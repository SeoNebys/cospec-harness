import { useState, type FormEvent } from "react";
import { api } from "../../lib/api.js";

export function ResetPasswordPage({ navigate }: { navigate: (path: string) => void }) {
  const [password,setPassword]=useState(""); const [confirm,setConfirm]=useState(""); const [message,setMessage]=useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if(password!==confirm){setMessage("Passwords do not match.");return;} try { await api("/auth/reset-password", {method:"POST",body:JSON.stringify({token:new URLSearchParams(location.search).get("token"),newPassword:password})}); setMessage("Password reset. Return to sign in."); } catch { setMessage("This reset link is invalid or expired."); } }
  return <main className="auth-page" data-harness-ready="true"><section className="auth-card solo"><button className="back-button" onClick={()=>navigate("/")}>← Back</button><h1>Choose a new password</h1><form onSubmit={submit}><label>New password <span className="hint">15–128 characters</span><input autoFocus type="password" value={password} onChange={(e)=>setPassword(e.target.value)} required /></label><label>Confirm password<input type="password" value={confirm} onChange={(e)=>setConfirm(e.target.value)} required /></label>{message&&<p role="status" className="form-message">{message}</p>}<button className="primary full">Reset password</button></form></section></main>;
}
