import type { CreateBookmarkInput } from '../../src/shared/types.js';
export function bookmarkInput(overrides:Partial<CreateBookmarkInput>={}):CreateBookmarkInput{return {url:'https://example.com',title:'Example',description:null,notes:null,tags:[],isFavorite:false,allowDuplicate:false,...overrides};}
