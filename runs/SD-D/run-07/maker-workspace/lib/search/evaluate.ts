import type { Bookmark } from "@/lib/domain/types";
import type { Ast } from "./parser";
const normalize=(v:string)=>v.normalize("NFKC").toLocaleLowerCase("und");
export function matches(bookmark:Bookmark,ast:Ast|null):boolean { if(!ast)return true;if(ast.type==="and")return matches(bookmark,ast.left)&&matches(bookmark,ast.right);if(ast.type==="or")return matches(bookmark,ast.left)||matches(bookmark,ast.right);if(ast.type==="not")return!matches(bookmark,ast.child);const needle=normalize(ast.value);if(ast.type==="tag")return bookmark.tags.some(t=>normalize(t)===needle);const hay=normalize([bookmark.title,bookmark.url,bookmark.description,bookmark.note,...bookmark.tags].join(" "));return hay.includes(needle); }
