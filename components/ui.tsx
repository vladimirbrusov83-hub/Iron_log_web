import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Page({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-2xl px-4 pt-5">{children}</main>;
}

export function Header({
  title, subtitle, action,
}: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-dim">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function Panel({
  children, className = "",
}: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-panel p-4 ${className}`}>
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-faint">
      {children}
    </p>
  );
}

const BUTTON_BASE =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 " +
  "text-sm font-medium transition-colors disabled:opacity-40";

const VARIANTS = {
  primary: "bg-accent text-black hover:bg-accent/90",
  quiet: "border border-line bg-panel-2 text-ink hover:border-ink-faint",
  danger: "border border-red-900 text-red-400 hover:bg-red-950/40",
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
  label, value, hint, accent = false,
}: { label: string; value: ReactNode; hint?: ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-panel-2 px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</div>
      <div className={`tnum mt-0.5 text-xl font-semibold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div>}
    </div>
  );
}

/** A horizontal bar, used everywhere a per-muscle or per-lift total is compared
 *  against the biggest one on the screen. */
export function Bar({ fraction, accent = false }: { fraction: number; accent?: boolean }) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0)) * 100;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-panel-2">
      <div
        className={`h-full rounded-full ${accent ? "bg-accent" : "bg-ink-faint"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-lg border border-line bg-panel-2 px-3 text-ink " +
  "outline-none placeholder:text-ink-faint focus:border-accent";
