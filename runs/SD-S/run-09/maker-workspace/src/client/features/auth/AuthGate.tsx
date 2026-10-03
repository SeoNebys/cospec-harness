import { useEffect, useState } from "react";
import type { SessionResponse } from "../../../shared/contracts/auth.js";
import { api } from "../../lib/api.js";
import { SignInPage } from "./SignInPage.js";
import { RegisterPage } from "./RegisterPage.js";
import { RecoveryPage } from "./RecoveryPage.js";
import { ResetPasswordPage } from "./ResetPasswordPage.js";

export function AuthGate({ children }: { children: (session: NonNullable<SessionResponse>, signOut: () => Promise<void>) => React.ReactNode }) {
  const [session, setSession] = useState<SessionResponse | undefined>();
  const [route, setRoute] = useState(window.location.pathname);

  useEffect(() => {
    api<SessionResponse>("/auth/get-session").then(setSession).catch(() => setSession(null));
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function navigate(path: string) {
    window.history.pushState({}, "", path);
    setRoute(path);
  }
  async function refresh() { setSession(await api<SessionResponse>("/auth/get-session")); navigate("/"); }
  async function signOut() { await api("/auth/sign-out", { method: "POST", body: "{}" }); setSession(null); }

  if (session === undefined) return <main className="center-state"><div className="spinner" aria-label="Checking your session" /></main>;
  if (session) return <>{children(session, signOut)}</>;
  if (route === "/register") return <RegisterPage navigate={navigate} />;
  if (route === "/recover") return <RecoveryPage navigate={navigate} />;
  if (route === "/reset-password") return <ResetPasswordPage navigate={navigate} />;
  return <SignInPage onSuccess={refresh} navigate={navigate} />;
}
