import type { ReadingState } from "@/lib/db/schema";

export type ReadingAction = "mark_read" | "mark_unread" | "remove_tracking";

export function nextReadingState(current: ReadingState, action: ReadingAction): ReadingState {
  if (action === "mark_read") return "read";
  if (action === "mark_unread") return "unread";
  return "none";
}
