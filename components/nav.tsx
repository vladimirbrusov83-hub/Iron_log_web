"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/* Today sits in the middle, raised out of the bar. It is where every workout
   starts and the only tab reached mid-session, so it is the one that has to be
   findable with a thumb without looking. */
const TABS = [
  { href: "/programs", label: "Programs", icon: IconPrograms },
  { href: "/history", label: "History", icon: IconHistory },
  { href: "/", label: "Today", icon: IconToday, center: true },
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

          if (tab.center) {
            return (
              <li key={tab.href} className="flex-1">
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className="relative flex h-16 flex-col items-center justify-end pb-2"
                >
                  {/* The ring is the page background, so the circle reads as
                      punched through the bar rather than sitting on it. */}
                  <span
                    className={`absolute -top-5 flex h-14 w-14 items-center justify-center
                                rounded-full border-4 border-bg bg-accent text-black
                                transition-transform active:scale-95 ${
                      active ? "shadow-[0_0_24px_-2px_rgba(255,106,31,0.75)]"
                             : "shadow-[0_6px_16px_-6px_rgba(0,0,0,0.9)]"
                    }`}
                  >
                    <Icon size={26} />
                  </span>
                  <span
                    className="eyebrow"
                    style={{
                      color: active ? "var(--accent)" : "var(--ink-dim)",
                      letterSpacing: "0.08em",
                    }}
                  >
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          }

          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-16 flex-col items-center justify-center gap-1
                            transition-colors ${active ? "text-accent" : "text-ink-faint"}`}
              >
                {active && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
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

function svg(size: number) {
  return {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round",
  } as const;
}

function IconToday({ size = 22 }: { size?: number }) {
  return (
    <svg {...svg(size)} strokeWidth={2}>
      <path d="M3 10.5v3M21 10.5v3M6 12h12" />
      <rect x="6" y="7.5" width="2.8" height="9" rx="0.6" fill="currentColor" stroke="none" />
      <rect x="15.2" y="7.5" width="2.8" height="9" rx="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
function IconHistory({ size = 22 }: { size?: number }) {
  return (
    <svg {...svg(size)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /><path d="M12 7v5l3 2" />
    </svg>
  );
}
function IconPrograms({ size = 22 }: { size?: number }) {
  return (
    <svg {...svg(size)}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M9 9v11" />
    </svg>
  );
}
function IconStats({ size = 22 }: { size?: number }) {
  return (
    <svg {...svg(size)}>
      <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />
    </svg>
  );
}
function IconMore({ size = 22 }: { size?: number }) {
  return (
    <svg {...svg(size)}>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </svg>
  );
}
