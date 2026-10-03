import type { Editor } from '@tiptap/react';
import { useRef, useState, type KeyboardEvent } from 'react';

export function NoteToolbar({ editor }: { editor: Editor }) {
  const [activeIndex,setActiveIndex]=useState(0);const toolbar=useRef<HTMLDivElement>(null);
  const buttons = [
    ['Bold',() => editor.chain().focus().toggleBold().run(),editor.isActive('bold')],
    ['Italic',() => editor.chain().focus().toggleItalic().run(),editor.isActive('italic')],
    ['Heading 2',() => editor.chain().focus().toggleHeading({level:2}).run(),editor.isActive('heading',{level:2})],
    ['Heading 3',() => editor.chain().focus().toggleHeading({level:3}).run(),editor.isActive('heading',{level:3})],
    ['Bulleted list',() => editor.chain().focus().toggleBulletList().run(),editor.isActive('bulletList')],
    ['Numbered list',() => editor.chain().focus().toggleOrderedList().run(),editor.isActive('orderedList')],
    ['Quote',() => editor.chain().focus().toggleBlockquote().run(),editor.isActive('blockquote')],
  ] as const;
  const setLink=()=>{const href=window.prompt('Link address (HTTP or HTTPS)');if(!href)return;try{const url=new URL(href);if(!['http:','https:'].includes(url.protocol))throw new Error();editor.chain().focus().extendMarkRange('link').setLink({href:url.toString()}).run();}catch{window.alert('Enter a complete HTTP or HTTPS address.');}};
  const all=[...buttons,['Link',setLink,editor.isActive('link')] as const];
  const onKeyDown=(event:KeyboardEvent)=>{const items=[...toolbar.current!.querySelectorAll<HTMLButtonElement>('button')];let next=activeIndex;if(event.key==='ArrowRight')next=(activeIndex+1)%items.length;else if(event.key==='ArrowLeft')next=(activeIndex-1+items.length)%items.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=items.length-1;else if(event.key==='Escape'){event.preventDefault();editor.commands.focus();return;}else return;event.preventDefault();setActiveIndex(next);items[next]?.focus();};
  return <div ref={toolbar} className="note-toolbar" role="toolbar" aria-label="Note formatting" onKeyDown={onKeyDown}>{all.map(([label,action,pressed],index) => <button type="button" key={label} tabIndex={index===activeIndex?0:-1} aria-pressed={pressed} onFocus={()=>setActiveIndex(index)} onClick={action}>{label}</button>)}</div>;
}
