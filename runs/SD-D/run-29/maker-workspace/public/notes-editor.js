// A small contenteditable rich-notes editor with a formatting toolbar
// (bold, italic, bullet/numbered lists, link). Produces HTML that the server
// sanitizes on save. Returns { element, getHTML }.
export function createNotesEditor(initialHtml = '') {
  const wrap = document.createElement('div');

  const toolbar = document.createElement('div');
  toolbar.className = 'notes-toolbar';

  const editor = document.createElement('div');
  editor.className = 'notes-editor';
  editor.contentEditable = 'true';
  editor.dataset.placeholder = 'Add notes… (bold, italic, lists, links)';
  editor.innerHTML = initialHtml || '';

  const cmd = (command, value = null) => {
    editor.focus();
    // Produce tag-based markup (<b>/<i>) rather than styled <span>s, so the
    // server's allowlist sanitizer preserves the formatting.
    try { document.execCommand('styleWithCSS', false, false); } catch { /* ignore */ }
    document.execCommand(command, false, value);
  };

  const buttons = [
    ['B', 'bold', 'Bold', { fontWeight: 'bold' }],
    ['I', 'italic', 'Italic', { fontStyle: 'italic' }],
    ['• List', 'insertUnorderedList', 'Bullet list', {}],
    ['1. List', 'insertOrderedList', 'Numbered list', {}],
  ];
  for (const [label, command, title] of buttons) {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.addEventListener('click', () => cmd(command));
    toolbar.appendChild(b);
  }
  const linkBtn = document.createElement('button');
  linkBtn.type = 'button';
  linkBtn.textContent = '🔗 Link';
  linkBtn.title = 'Insert link';
  linkBtn.addEventListener('click', () => {
    const url = prompt('Link URL (https://…)');
    if (url) cmd('createLink', url);
  });
  toolbar.appendChild(linkBtn);

  wrap.appendChild(toolbar);
  wrap.appendChild(editor);

  return { element: wrap, getHTML: () => editor.innerHTML };
}
