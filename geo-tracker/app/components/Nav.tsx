"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "דשבורד" },
  { href: "/check-link", label: "בדיקת לינק" },
  { href: "/settings", label: "הגדרות" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <header className="nav">
      <strong className="logo">GEO Tracker</strong>
      <nav>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={path === l.href ? "active" : ""}>
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
