import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { BookmarkCollection } from "@/components/bookmarks/bookmark-collection";
export const dynamic = "force-dynamic";

export default async function BookmarksPage() {
  const user = await getCurrentUser(); if (!user) redirect("/login");
  return <BookmarkCollection user={user}/>;
}
