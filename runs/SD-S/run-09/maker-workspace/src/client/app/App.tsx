import { AuthGate } from "../features/auth/AuthGate.js";
import { BookmarkLibrary } from "../features/bookmarks/BookmarkLibrary.js";
export function App(){return <AuthGate>{(session,signOut)=><BookmarkLibrary session={session} signOut={signOut}/>}</AuthGate>}
