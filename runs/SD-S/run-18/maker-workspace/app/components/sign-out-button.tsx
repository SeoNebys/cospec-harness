import { useState } from "react";
import { authClient } from "~/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  return (
    <button className="text-button" type="button" disabled={pending} onClick={async () => {
      setPending(true);
      await authClient.signOut();
      window.location.assign("/login");
    }}>
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
