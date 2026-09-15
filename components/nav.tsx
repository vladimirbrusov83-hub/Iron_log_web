"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Today", icon: IconToday },
  { href: "/history", label: "History", icon: IconHistory },
  { href: "/programs", label: "Programs", icon: IconPrograms },
  { href: "/stats", label: "Stats", icon: IconStats },
  { href: "/settings", label: "More", icon: IconMore },
];

export function Nav() {
  const pathname = usePathname();
  // The passcode screen is the one page with nowhere to navigate to. The gym
  // screen hides it too: the finish button lives at the bottom of that page and
  // a nav bar under it invites a mis-tap out of a live workout.
  if (pathname === "/login" || pathname.startsWith("/log/")) return null;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 backdrop-blur-md"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map((tab) => {
          // "/" would otherwise light up on every page.
          const active = tab.href === "/"
            ? pathname === "/"
            : pathname.startsWith(tab.href) ||
              (tab.href === "/settings" && pathname.startsWith("/exercises"));
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                className={`relative flex h-16 flex-col items-center justify-center gap-1
                            transition-colors ${active ? "text-accent" : "text-ink-faint"}`}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />
                )}
                <Icon />
                <span className="eyebrow" style={{ color: "inherit", letterSpacing: "0.08em" }}>
                  {tab.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const svg = {
  width: 22, height: 22, viewBox: "0 0 24 24", fill: "none",
  stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
} as const;

function IconToday() {
  return (
    <svg {...svg}>
      <path d="M6 9v6M18 9v6M3 10.5v3M21 10.5v3M6 12h12" />
      <rect x="6" y="8" width="2.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
      <rect x="15.5" y="8" width="2.5" height="8" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconHistory() {
  return (
    <svg {...svg}>
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconPrograms() {
  return (
    <svg {...svg}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M9 9v11" />
    </svg>
  );
}
function IconStats() {
  return (
    <svg {...svg}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg {...svg}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
