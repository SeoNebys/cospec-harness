import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Kept — your reading shelf",
  description: "Save, revisit, and organize the web."
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
