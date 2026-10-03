import React from 'react';
import { BookmarkList } from '../components/BookmarkList.jsx';

export function UnreadView() {
  return <BookmarkList view="unread" title="Unread / Read later" />;
}
