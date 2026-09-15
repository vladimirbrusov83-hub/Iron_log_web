"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: "▣" },
  { href: "/history", label: "History", icon: "▤" },
  { href: "/programs", label: "Programs", icon: "▦" },
  { href: "/stats", label: "Stats", icon: "▨" },
  { href: "/settings", label: "More", icon: "⋯" },
];

export function Nav() {
  const pathname = usePathname();
  // The passcode screen is the one page with nowhere to navigate to.
  if (pathname === "/login") return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          // "/" would otherwise light up on every page.
          const active = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-[11px] ${
                  active ? "text-accent" : "text-ink-faint"
                }`}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
