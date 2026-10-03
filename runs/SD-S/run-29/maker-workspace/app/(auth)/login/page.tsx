import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { AuthForm } from "@/components/auth/auth-form";
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/bookmarks");
  return <main id="main" className="auth-page" data-harness-ready="true"><section className="brand-panel"><Link href="/" className="brand brand-light">KEPT<span>.</span></Link><div><p className="eyebrow light">YOUR CORNER OF THE INTERNET</p><h1>The good stuff.<br/><em>Kept close.</em></h1><p className="brand-copy">A quiet, considered place for the links you want to find again.</p></div><p className="brand-foot">Private by default · Yours by design</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">WELCOME BACK</p><h2>Sign in to your library</h2><p className="muted">Your bookmarks have been waiting.</p><AuthForm mode="login"/><p className="switch-copy">New to Kept? <Link href="/register">Create an account</Link></p></div></section></main>;
}
