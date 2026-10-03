import { AuthForm } from './AuthForm';

export function AuthPage() {
  return <main className="auth-page" data-harness-ready="true">
    <section className="brand-panel"><a className="brand" href="/">keepmark<span>.</span></a><h1>A calmer home for the web you want to keep.</h1><p>Save links in seconds. Find them when they matter.</p></section>
    <section className="auth-card"><div><p className="eyebrow">Your private collection</p><h2>Welcome</h2><p>Sign in or create an account to begin.</p></div><AuthForm /></section>
  </main>;
}
