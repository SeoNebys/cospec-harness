import type { BlobStore } from './blob-store.js';
export const removeOrphan=async(store:BlobStore,digest:string)=>store.remove(digest);
