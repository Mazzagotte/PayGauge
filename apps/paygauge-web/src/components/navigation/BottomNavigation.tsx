"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Gauge, Home, Settings } from "lucide-react";

const navItems = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/loans", icon: Gauge, label: "Loans" },
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/settings", icon: Settings, label: "More" },
];

export function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="pg-bottom-nav" aria-label="Primary navigation">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link className={`pg-nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
            <Icon aria-hidden="true" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
