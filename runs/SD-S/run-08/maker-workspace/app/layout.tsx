import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Keepsake — Bookmark manager",
  description: "A calm, private place for links worth keeping.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <header className="site-header">
          <nav className="nav-shell" aria-label="Primary navigation">
            <Link className="brand" href="/" aria-label="Keepsake home">
              <span className="brand-mark" aria-hidden="true">K</span>
              <span>Keepsake</span>
            </Link>
            <span className="nav-note">Your personal link library</span>
          </nav>
        </header>
        <main id="main-content">{children}</main>
        <div id="global-live-status" className="sr-only" aria-live="polite" aria-atomic="true" />
      </body>
    </html>
  );
}
