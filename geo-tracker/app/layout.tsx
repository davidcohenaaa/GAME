import type { Metadata } from "next";
import Nav from "./components/Nav";
import "./globals.css";

export const metadata: Metadata = { title: "GEO Tracker – נראות במנועי AI" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>
        <Nav />
        <main>{children}</main>
      </body>
    </html>
  );
}
