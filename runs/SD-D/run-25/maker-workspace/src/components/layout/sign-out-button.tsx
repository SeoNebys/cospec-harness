"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export function SignOutButton() {
  const router = useRouter();
  return <button className="nav-link" type="button" onClick={async () => { await authClient.signOut(); router.push("/sign-in"); router.refresh(); }}>Sign out</button>;
}
