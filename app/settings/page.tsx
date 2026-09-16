import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getExercises, getPrograms, getSettings } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";
import { Button, Header, Page, Panel, SectionTitle } from "@/components/ui";
import { EFFECTIVE_REP_THRESHOLD, MAX_COUNTED_RIR } from "@/lib/effective-reps";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}

export default async function MorePage() {
  const [settings, exercises, programs] = await Promise.all([
    getSettings(), getExercises(), getPrograms(),
  ]);

  return (
    <Page>
      <Header title="More" />

      {/* The two things kept here are places, not preferences, so they get rows
          of their own rather than a pair of buttons under the sliders. */}
      <nav className="rise mb-5 space-y-2">
        <MenuRow
          href="/exercises"
          title="Exercise library"
          detail={`${exercises.length} lift${exercises.length === 1 ? "" : "s"} · add or delete`}
        />
        <MenuRow
          href="/programs"
          title="Programs"
          detail={`${programs.length} program${programs.length === 1 ? "" : "s"}`}
        />
      </nav>

      <SectionTitle>Preferences</SectionTitle>
      <SettingsForm settings={settings} />

      <Panel className="mt-5">
        <h2 className="eyebrow">Effective reps</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          Every set you log and rate scores{" "}
          <span className="text-ink">{EFFECTIVE_REP_THRESHOLD} − RIR</span> effective reps,
          capped at the reps you did. Rate a set above{" "}
          <span className="text-ink">{MAX_COUNTED_RIR} RIR</span> and it does not count at
          all — no score, no working set, no volume. That is what a warm-up is now, which
          is why there is no warm-up checkbox any more. A set with no RIR is not scored
          rather than scored as zero, so the totals on{" "}
          <Link href="/stats" className="text-accent underline">Stats</Link> always say how
          many sets they were able to count.
        </p>
      </Panel>

      <Panel className="mt-3">
        <h2 className="eyebrow">About</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          IronLog records what you did and counts it. Nothing here suggests a load or
          tells you to deload. The reference bands on Today and Stats (5-set floor, 10–16
          hard sets a week, 20–40 effective reps per muscle per session, 2× a week) come
          from <em>Hypertrophy Training — Principles That Work</em>, 2026 edition.
        </p>
      </Panel>

      <form action={signOut} className="mt-5">
        <Button variant="danger" className="w-full">Sign out</Button>
      </form>
    </Page>
  );
}

function MenuRow({
  href, title, detail,
}: { href: string; title: string; detail: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-2xl border border-line bg-panel
                 px-4 transition-colors hover:border-accent/60 active:bg-panel-2"
    >
      <span className="min-w-0 flex-1">
        <span className="display block truncate text-xl font-semibold">{title}</span>
        <span className="tnum block truncate text-[11px] text-ink-faint">{detail}</span>
      </span>
      <span className="shrink-0 text-accent">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 5l7 7-7 7" />
        </svg>
      </span>
    </Link>
  );
}
