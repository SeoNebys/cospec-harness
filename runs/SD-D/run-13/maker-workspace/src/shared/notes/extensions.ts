import StarterKit from '@tiptap/starter-kit';

/** The only editor extensions allowed by the persisted rich-note schema. */
export const noteExtensions = [StarterKit.configure({ heading: { levels: [2,3] } })];
