import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lattice — Your quiet corner of the web",
  description: "Save, organize, and rediscover the links worth keeping.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
