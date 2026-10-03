import { EMPTY_NOTE } from '../../src/shared/notes/schema.js';
export function bookmarkInput(index=1){return{url:`https://example.com/article-${index}`,title:`Article ${index}`,description:`Description ${index}`,notes:EMPTY_NOTE,tags:[index%2?'Research':'Design'],favorite:index%3===0,toRead:index%4===0};}
