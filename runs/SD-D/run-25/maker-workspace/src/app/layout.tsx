import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Safekeep",
  description: "A calm home for links worth keeping.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
