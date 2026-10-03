import type { Bookmark } from '@bookmarks/shared';
import type { QueryAst,Atom } from './types.js';
function matchAtom(item:Bookmark,atom:Atom,noteText:string){const tags=item.tags.map(t=>t.name.toLocaleLowerCase());if(atom.kind==='tag')return tags.includes(atom.value);const hay=[item.title,item.url,noteText,...tags].join(' ').toLocaleLowerCase();return hay.includes(atom.value)}
export function matches(item:Bookmark,ast:QueryAst,noteText=item.noteSource){if(!ast.length||ast.every(b=>!b.length))return true;return ast.some(branch=>branch.every(atom=>atom.negated?!matchAtom(item,atom,noteText):matchAtom(item,atom,noteText)))}
