import type { BookmarkPatch } from '@bookmarks/shared';
export const addToReadLater=():BookmarkPatch=>({isReadLater:true,isRead:false});
export const markRead=():BookmarkPatch=>({isReadLater:true,isRead:true});
export const markUnread=():BookmarkPatch=>({isReadLater:true,isRead:false});
export const removeFromReadLater=():BookmarkPatch=>({isReadLater:false,isRead:false});
