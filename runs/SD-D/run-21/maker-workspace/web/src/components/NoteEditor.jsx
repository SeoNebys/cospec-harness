import React, { useEffect, useRef } from 'react';

// Simple rich-text note editor (bold/italic/lists/links) producing HTML,
// sanitized server-side on save (FR-026).
export default function NoteEditor({ value, onChange }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, [value]);

  const cmd = (command) => {
    document.execCommand(command, false, null);
    if (command === 'createLink') return;
    emit();
  };
  const link = () => {
    const url = window.prompt('Link URL:');
    if (url) document.execCommand('createLink', false, url);
    emit();
  };
  const emit = () => onChange(ref.current ? ref.current.innerHTML : '');

  return (
    <div className="note-editor">
      <div className="note-toolbar">
        <button type="button" onClick={() => cmd('bold')}><strong>B</strong></button>
        <button type="button" onClick={() => cmd('italic')}><em>I</em></button>
        <button type="button" onClick={() => cmd('insertUnorderedList')}>• List</button>
        <button type="button" onClick={() => cmd('insertOrderedList')}>1. List</button>
        <button type="button" onClick={link}>Link</button>
      </div>
      <div
        ref={ref}
        className="note-area"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        data-placeholder="Write a note…"
      />
    </div>
  );
}
