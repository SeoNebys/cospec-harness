import type { Bookmark } from "@/features/bookmarks/types";
import { BookmarkCard } from "./bookmark-card";

export function BookmarkList({ items, focus }: { items: Bookmark[]; focus?: string }) {
  return <div className="bookmark-list">{items.map((item) => <BookmarkCard key={item.id} bookmark={item} focused={focus === item.id} />)}</div>;
}
