import { requireSession } from "@/lib/auth/session";
import { AppShell } from "@/components/ui/app-shell";
import { LibraryView } from "@/components/bookmarks/library-view";
export default async function Page(){const session=await requireSession();return <AppShell name={session.user.name}><LibraryView status="active"/></AppShell>}
