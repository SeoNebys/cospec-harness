"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const links = [
  ["/", "Library"],
  ["/to-read", "To read"],
  ["/favorites", "Favorites"],
  ["/archive", "Archive"]
];
export function AppShell({
  children,
  ready
}: {
  children: React.ReactNode;
  ready: boolean;
}) {
  const path = usePathname();
  return (
    <div className="shell" data-harness-ready={ready ? "true" : undefined}>
      <aside className="rail">
        <Link href="/" className="brand" aria-label="Kept home">
          <span className="brand-mark">K</span>
          <span>kept.</span>
        </Link>
        <nav aria-label="Bookmark views">
          {links.map(([href, label], i) => (
            <Link
              key={href}
              href={href}
              className={path === href ? "nav-link active" : "nav-link"}
            >
              <span aria-hidden>{["▦", "◷", "★", "□"][i]}</span>
              {label}
            </Link>
          ))}
        </nav>
        <div className="rail-note">
          <span>YOUR SPACE</span>
          <p>A quiet corner for everything worth coming back to.</p>
        </div>
      </aside>
      <div className="workspace">{children}</div>
    </div>
  );
}
