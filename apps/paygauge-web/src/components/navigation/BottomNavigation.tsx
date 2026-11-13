"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Plus, Settings, WalletCards } from "lucide-react";

const left = [
  { href: "/dashboard", icon: Home, label: "Home" },
  { href: "/loans", icon: WalletCards, label: "Payments", exact: true },
];
const right = [
  { href: "/calendar", icon: CalendarDays, label: "Calendar" },
  { href: "/settings", icon: Settings, label: "More", also: ["/income"] },
];

export function BottomNavigation() {
  const pathname = usePathname().replace(/\/$/, "") || "/";

  const tab = (item: { href: string; icon: typeof Home; label: string; exact?: boolean; also?: string[] }) => {
    const matches = (href: string) => pathname === href || (!item.exact && pathname.startsWith(`${href}/`));
    const active = matches(item.href) || (item.href === "/loans" && /^\/(loans\/(detail|edit|payments)|payments)/.test(pathname)) || (item.also ?? []).some(matches);
    const Icon = item.icon;
    return (
      <Link aria-current={active ? "page" : undefined} className={`pg-nav-link ${active ? "active" : ""}`} href={item.href} key={item.href}>
        <span className="pg-nav-icon"><Icon aria-hidden="true" /></span>
        <span className="pg-nav-label">{item.label}</span>
      </Link>
    );
  };

  return (
    <nav className="pg-bottom-nav" aria-label="Primary navigation">
      {left.map(tab)}
      <div className="pg-nav-plus">
        <Link href="/loans/new" aria-label="Add payment" aria-current={pathname === "/loans/new" ? "page" : undefined}><Plus aria-hidden="true" /></Link>
      </div>
      {right.map(tab)}
    </nav>
  );
}
