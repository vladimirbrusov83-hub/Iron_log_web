import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import {
  type Band, BAND_LABEL, WEEKLY_SETS_FLOOR, WEEKLY_SETS_HIGH, WEEKLY_SETS_LOW,
} from "@/lib/targets";

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 pt-5">{children}</main>;
}

export function Header({
  title, eyebrow, subtitle, action, back,
}: {
  title: string; eyebrow?: string; subtitle?: ReactNode; action?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <header className="rise mb-5">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-sm text-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
          {back.label}
        </Link>
      )}
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1 text-accent">{eyebrow}</p>}
          <h1 className="display truncate text-4xl font-semibold">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-ink-dim">{subtitle}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}

export function SectionTitle({
  children, action,
}: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}

export function Panel({
  children, className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-panel p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-line-2 px-4 py-8 text-center text-sm text-ink-faint">
      {children}
    </p>
  );
}

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 " +
  "text-sm font-semibold transition-[background-color,border-color,transform] " +
  "active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100";

const VARIANTS = {
  primary: "bg-accent text-black hover:bg-[#ff7d3d] shadow-[0_6px_20px_-8px_rgba(255,106,31,0.7)]",
  quiet: "border border-line-2 bg-panel-2 text-ink hover:border-ink-faint",
  ghost: "text-ink-dim hover:text-ink",
  danger: "border border-bad/30 text-bad hover:bg-bad/10",
} as const;

type Variant = keyof typeof VARIANTS;

export function Button({
  variant = "quiet", className = "", ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...props} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`} />;
}

export function ButtonLink({
  variant = "quiet", className = "", ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link {...props} className={`${BUTTON_BASE} ${VARIANTS[variant]} ${className}`} />;
}

/** A labelled number. `hint` carries the caveat that stops a number being
 *  misread — most often how much of it was actually rated. */
export function Stat({
  label, value, hint, accent = false, big = false,
}: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean; big?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-3.5 py-3">
      <div className="eyebrow">{label}</div>
      <div
        className={`display tnum mt-1 font-semibold ${big ? "text-5xl" : "text-3xl"} ${
          accent ? "text-accent" : ""
        }`}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[11px] leading-tight text-ink-faint">{hint}</div>}
    </div>
  );
}

/** A horizontal bar, used everywhere a per-muscle or per-lift total is compared
 *  against the biggest one on the screen. */
export function Bar({ fraction, accent = false }: { fraction: number; accent?: boolean }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-3">
      <div
        className={`h-full rounded-full transition-[width] duration-500 ${
          accent ? "bg-accent" : "bg-ink-faint"
        }`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const BAND_COLOR: Record<Band, string> = {
  none: "text-ink-faint",
  below: "text-bad",
  low: "text-warn",
  in: "text-good",
  above: "text-warn",
};

const BAND_BG: Record<Band, string> = {
  none: "bg-ink-faint",
  below: "bg-bad",
  low: "bg-warn",
  in: "bg-good",
  above: "bg-warn",
};

/** Weekly hard sets for one muscle drawn against the paper's floor (5) and
 *  productive range (10–16). The scale runs to 20 so "over" has room to show. */
export function SetsBandBar({ sets, band }: { sets: number; band: Band }) {
  const scale = 20;
  const pct = (n: number) => `${Math.min(100, (n / scale) * 100)}%`;
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-panel-3">
      <div
        className="absolute inset-y-0 bg-good/15"
        style={{ left: pct(WEEKLY_SETS_LOW), width: pct(WEEKLY_SETS_HIGH - WEEKLY_SETS_LOW) }}
      />
      <div className="absolute inset-y-0 w-px bg-line-2" style={{ left: pct(WEEKLY_SETS_FLOOR) }} />
      <div
        className={`absolute inset-y-0 left-0 rounded-full ${BAND_BG[band]} transition-[width] duration-500`}
        style={{ width: pct(sets) }}
      />
    </div>
  );
}

export function BandTag({ band }: { band: Band }) {
  return (
    <span className={`eyebrow ${BAND_COLOR[band]}`} style={{ letterSpacing: "0.08em" }}>
      {BAND_LABEL[band]}
    </span>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line-2 bg-panel-2 px-3 text-ink " +
  "outline-none placeholder:text-ink-faint focus:border-accent";
