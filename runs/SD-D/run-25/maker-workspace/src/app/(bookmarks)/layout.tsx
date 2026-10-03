import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";

export default async function BookmarkLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await requireSession();
  return <AppShell userName={session.user.name}>{children}</AppShell>;
}
