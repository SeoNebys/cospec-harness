import { useState } from "react";
import { redirect, useNavigate } from "react-router";
import type { Route } from "./+types/_auth.login";
import { getSession } from "~/auth/require-user.server";
import { config } from "~/config.server";
import { authClient } from "~/lib/auth-client";

export async function loader({ request }: Route.LoaderArgs) {
  const session = await getSession(request);
  if (session) throw redirect("/");
  return { reviewMode: config.reviewMode };
}

export default function Login({ loaderData }: Route.ComponentProps) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  return (
    <main className="login-page" data-harness-ready="true">
      <section className="login-intro" aria-labelledby="login-title">
        <a className="brand" href="/" aria-label="Keepsake home">
          <span className="brand-mark" aria-hidden="true">K</span>
          <span>Keepsake</span>
        </a>
        <div>
          <p className="eyebrow">Your corner of the web</p>
          <h1 id="login-title">Keep the good parts.</h1>
          <p className="login-lede">Save the pages worth returning to, then find them again without the clutter.</p>
        </div>
        <div className="login-feature">
          <span aria-hidden="true">↗</span>
          <p><strong>Paste once.</strong><br />We’ll bring back the title and description.</p>
        </div>
      </section>

      <section className="login-card" aria-label="Sign in">
        <p className="eyebrow">Welcome back</p>
        <h2>Sign in to your library</h2>
        <form onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setPending(true);
          const result = await authClient.signIn.email({ email, password });
          setPending(false);
          if (result.error) {
            setError("That email and password didn’t match. Please try again.");
            return;
          }
          await navigate("/");
        }}>
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required minLength={10} value={password} onChange={(event) => setPassword(event.target.value)} />
          {error ? <p className="form-error" role="alert">{error}</p> : null}
          <button className="button button-primary button-wide" disabled={pending} type="submit">{pending ? "Signing in…" : "Sign in"}</button>
        </form>
        {loaderData.reviewMode ? (
          <aside className="review-hint">
            <strong>Review account</strong>
            <span>alice@example.test</span>
            <span>Bookmarks-Alice-2026!</span>
          </aside>
        ) : null}
      </section>
    </main>
  );
}
