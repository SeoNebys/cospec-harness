"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { RECOVERY_MESSAGE } from "@/lib/auth/recovery";

type Mode = "sign-in" | "sign-up" | "forgot" | "reset";

export function AuthForm({ mode, resetToken }: { mode: Mode; resetToken?: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");
    const name = String(data.get("name") ?? "");
    try {
      if (mode === "sign-in") {
        const result = await authClient.signIn.email({ email, password, callbackURL: "/bookmarks" });
        if (result.error) throw new Error(result.error.message ?? "Unable to sign in.");
        router.push("/bookmarks");
        router.refresh();
      } else if (mode === "sign-up") {
        const result = await authClient.signUp.email({ email, password, name, callbackURL: "/bookmarks" });
        if (result.error) throw new Error(result.error.message ?? "Unable to create the account.");
        router.push("/bookmarks");
        router.refresh();
      } else if (mode === "forgot") {
        await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        setMessage(RECOVERY_MESSAGE);
      } else {
        const token = resetToken;
        if (!token) throw new Error("This reset link is incomplete. Request a new one.");
        const result = await authClient.resetPassword({ newPassword: password, token });
        if (result.error) throw new Error(result.error.message ?? "Unable to reset the password.");
        setMessage("Your password has been reset. You can sign in now.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  const title = {
    "sign-in": "Welcome back",
    "sign-up": "Create your collection",
    forgot: "Reset your password",
    reset: "Choose a new password",
  }[mode];

  return (
    <main className="auth-page" data-harness-ready="true">
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="brand">Safekeep</div>
        <h1 id="auth-title">{title}</h1>
        <p className="muted">A calm, private home for links worth keeping.</p>
        <form className="stack" onSubmit={onSubmit}>
          {mode === "sign-up" ? (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input className="input" id="name" name="name" autoComplete="name" required maxLength={80} />
            </div>
          ) : null}
          {mode !== "reset" ? (
            <div className="field">
              <label htmlFor="email">Email</label>
              <input className="input" id="email" name="email" type="email" autoComplete="email" required />
            </div>
          ) : null}
          {mode !== "forgot" ? (
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                className="input"
                id="password"
                name="password"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                minLength={12}
                maxLength={128}
                required
              />
              {mode !== "sign-in" ? <small className="muted">Use at least 12 characters.</small> : null}
            </div>
          ) : null}
          {error ? <div className="form-message error" role="alert">{error}</div> : null}
          {message ? <div className="form-message" role="status">{message}</div> : null}
          <button className="button" type="submit" disabled={pending}>
            {pending ? "Working…" : title}
          </button>
        </form>
        <p className="muted">
          {mode === "sign-in" ? <><Link href="/forgot-password">Forgot password?</Link> · <Link href="/sign-up">Create account</Link></> : null}
          {mode === "sign-up" ? <>Already have an account? <Link href="/sign-in">Sign in</Link></> : null}
          {mode === "forgot" || mode === "reset" ? <Link href="/sign-in">Back to sign in</Link> : null}
        </p>
      </section>
    </main>
  );
}
