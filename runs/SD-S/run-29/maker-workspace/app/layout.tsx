import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = { title: "Kept — Your bookmark library", description: "Save, organize, and find the links worth keeping." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;
}
