import { EditorContent, useEditor } from '@tiptap/react';
import type { NoteDocument } from '../../../shared/schemas/noteDocument';
import { noteExtensions } from './noteExtensions';

export function NoteEditor({
  value,
  onChange,
}: {
  value: NoteDocument | null;
  onChange: (document: NoteDocument | null) => void;
}) {
  const editor = useEditor({
    extensions: noteExtensions,
    content: value ?? { type: 'doc', content: [{ type: 'paragraph' }] },
    immediatelyRender: false,
    editorProps: { attributes: { role: 'textbox', 'aria-label': 'Bookmark note' } },
    onUpdate: ({ editor: current }) => onChange(current.isEmpty ? null : (current.getJSON() as NoteDocument)),
  });
  if (!editor)
    return (
      <div className="note-editor" aria-busy="true">
        Loading editor…
      </div>
    );
  const link = () => {
    const href = window.prompt('Link address (HTTP or HTTPS)');
    if (!href) return;
    try {
      const parsed = new URL(href);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error();
      editor.chain().focus().extendMarkRange('link').setLink({ href: parsed.toString() }).run();
    } catch {
      window.alert('Enter a complete HTTP or HTTPS address.');
    }
  };
  return (
    <div>
      <div className="editor-toolbar" role="toolbar" aria-label="Note formatting">
        <button
          type="button"
          aria-pressed={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
          <span className="sr-only">Bold</span>
        </button>
        <button
          type="button"
          aria-pressed={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
          <span className="sr-only">Italic</span>
        </button>
        <button type="button" aria-pressed={editor.isActive('link')} onClick={link}>
          Link
        </button>
        <button
          type="button"
          aria-pressed={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          • List
        </button>
        <button
          type="button"
          aria-pressed={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1. List
        </button>
      </div>
      <EditorContent editor={editor} className="note-editor" />
    </div>
  );
}
