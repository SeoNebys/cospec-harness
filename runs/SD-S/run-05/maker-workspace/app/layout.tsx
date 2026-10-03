import type { Metadata } from "next";
import "./styles.css";

export const metadata:Metadata={title:"Kept — your bookmarks, beautifully organized",description:"Save, enrich, tag, and find your favorite corners of the web."};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>;}
