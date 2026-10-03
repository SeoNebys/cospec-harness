"use client";
/* eslint-disable @next/next/no-location-assign-relative-destination -- authentication needs a full reload after the session cookie changes */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

const copy: Record<Mode, { title: string; lede: string; action: string }> = {
  "sign-in": { title: "Welcome back", lede: "Open your library and pick up where you left off.", action: "Sign in" },
  "sign-up": { title: "Create your library", lede: "A private home for the links you want to keep.", action: "Create account" },
  forgot: { title: "Reset your password", lede: "We’ll send a one-time reset link if the account exists.", action: "Send reset link" },
  reset: { title: "Choose a new password", lede: "Use at least 12 characters for your new password.", action: "Save new password" },
};

export function AuthForm({ mode }: { mode: Mode }) {
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const details = copy[mode];

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError(""); setNotice("");
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email") ?? "").trim();
    const password = String(values.get("password") ?? "");
    try {
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) throw new Error("The email or password is incorrect.");
        window.location.href = "/bookmarks";
      } else if (mode === "sign-up") {
        const name = String(values.get("name") ?? "").trim();
        const result = await authClient.signUp.email({ name, email, password });
        if (result.error) throw new Error(result.error.message || "We couldn’t create that account.");
        window.location.href = "/bookmarks";
      } else if (mode === "forgot") {
        await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        setNotice("If that email is registered, a reset link is on its way.");
      } else {
        const token = params.get("token") ?? "";
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error("That reset link is invalid or has expired.");
        setNotice("Your password has been updated. You can sign in now.");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally { setPending(false); }
  }

  return (
    <div className="auth-panel">
      <h2>{details.title}</h2><p className="lede">{details.lede}</p>
      <form className="form-stack" onSubmit={submit}>
        {mode === "sign-up" && <div className="field"><label htmlFor="name">Name</label><input className="input" id="name" name="name" autoComplete="name" required maxLength={100} /></div>}
        {mode !== "reset" && <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required /></div>}
        {mode !== "forgot" && <div className="field"><label htmlFor="password">Password</label><input className="input" id="password" name="password" type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} required minLength={12} maxLength={128} /><span className="form-note">12–128 characters</span></div>}
        {mode === "sign-in" && <div style={{textAlign:"right"}}><Link className="text-link form-note" href="/forgot-password">Forgot password?</Link></div>}
        {error && <div className="error-box" role="alert">{error}</div>}
        {notice && <div className="notice" role="status">{notice}</div>}
        <button className="button button-primary" disabled={pending}>{pending ? "Working…" : details.action}</button>
      </form>
      {mode === "sign-in" && <p className="auth-switch">New to Lattice? <Link href="/sign-up">Create an account</Link></p>}
      {mode === "sign-up" && <p className="auth-switch">Already have an account? <Link href="/sign-in">Sign in</Link></p>}
      {(mode === "forgot" || mode === "reset") && <p className="auth-switch"><Link href="/sign-in">Back to sign in</Link></p>}
    </div>
  );
}
