import { normalizeSearch, visibleNoteText } from '@shared/normalize.js';
export function searchDocument(input: {
  title: string | null;
  url: string;
  description: string | null;
  noteMarkdown: string;
}) {
  return {
    searchTitle: normalizeSearch(input.title || input.url),
    searchUrl: normalizeSearch(input.url),
    searchDescription: normalizeSearch(input.description ?? ''),
    searchNote: normalizeSearch(visibleNoteText(input.noteMarkdown))
  };
}
