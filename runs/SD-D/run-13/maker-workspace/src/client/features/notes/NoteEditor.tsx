import { EditorContent, useEditor } from '@tiptap/react';
import type { RichTextDocument } from '../../../shared/api/types.js';
import { noteExtensions } from '../../../shared/notes/extensions.js';
import { NoteToolbar } from './NoteToolbar.js';

export function NoteEditor({ value, onChange }: { value: RichTextDocument; onChange: (value: RichTextDocument) => void }) {
  const cleanDocument=(document:RichTextDocument):RichTextDocument=>JSON.parse(JSON.stringify(document),(key,item)=>key==='attrs'&&item?.href?{href:item.href}:item) as RichTextDocument;
  const editor = useEditor({
    extensions: noteExtensions, content: value,
    editorProps: { attributes: { role:'textbox', 'aria-label':'Notes', 'aria-multiline':'true', class:'note-editor-content' }, handleKeyDown:(view,event)=>{if(event.altKey&&event.key==='F10'){event.preventDefault();(view.dom.closest('.note-editor')?.querySelector('[role="toolbar"] button') as HTMLElement|null)?.focus();return true;}return false;} },
    onUpdate: ({editor}) => onChange(cleanDocument(editor.getJSON() as RichTextDocument)),
  });
  if (!editor) return <div className="note-editor-content" aria-label="Notes"/>;
  return <div className="note-editor"><NoteToolbar editor={editor}/><EditorContent editor={editor}/></div>;
}
