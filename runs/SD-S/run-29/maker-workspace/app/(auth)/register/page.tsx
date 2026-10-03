import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/server";
import { AuthForm } from "@/components/auth/auth-form";
export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/bookmarks");
  return <main id="main" className="auth-page" data-harness-ready="true"><section className="brand-panel"><Link href="/" className="brand brand-light">KEPT<span>.</span></Link><div><p className="eyebrow light">START YOUR COLLECTION</p><h1>Worth saving.<br/><em>Easy to find.</em></h1><p className="brand-copy">Collect the ideas, tools, and stories that make the web feel like yours.</p></div><p className="brand-foot">Private by default · Yours by design</p></section><section className="auth-panel"><div className="auth-card"><p className="eyebrow">JOIN KEPT</p><h2>Create your library</h2><p className="muted">A private home for everything worth returning to.</p><AuthForm mode="register"/><p className="switch-copy">Already have an account? <Link href="/login">Sign in</Link></p></div></section></main>;
}
