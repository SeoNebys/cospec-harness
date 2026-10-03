import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

export function AppShell({ children, userName }: { children: ReactNode; userName: string }) {
  return (
    <div className="app-layout">
      <header className="topbar">
        <Link className="brand" href="/bookmarks">Safekeep</Link>
        <nav className="main-nav" aria-label="Main navigation">
          <Link className="nav-link" href="/bookmarks">Bookmarks</Link>
          <Link className="nav-link" href="/unread">Unread</Link>
          <Link className="nav-link" href="/archive">Archive</Link>
          <span className="sr-only">Signed in as {userName}</span>
          <SignOutButton />
        </nav>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}
