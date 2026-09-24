import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getExercises, getPrograms, getSettings } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";
import { Button, Header, Page, Panel } from "@/components/ui";
import { EFFECTIVE_REP_THRESHOLD, MAX_COUNTED_RIR } from "@/lib/effective-reps";

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

      {/* Places, one row each. The preferences are behind the Settings row. */}
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
        <MenuRow
          href="/settings/preferences"
          title="Settings"
          detail={`${settings.weightUnit} · rest ${settings.defaultRestSeconds / 60}m · theme`}
        />
      </nav>

      <Panel className="mt-5">
        <h2 className="eyebrow">Effective reps</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          <span className="text-ink">RIR</span> (reps in reserve) is how many more reps you
          could have done with good form when you stopped the set: 0 means nothing left, 5
          means five or more. The last few reps before failure are the ones that drive
          growth, and effective reps count only those. Each rated set scores{" "}
          <span className="text-ink">{EFFECTIVE_REP_THRESHOLD} − RIR</span>, up to the reps
          you did: 10 reps at 1 RIR scores 4, at 0 RIR it scores 5. Rest-pause mini-sets add
          every rep. A set rated above{" "}
          <span className="text-ink">{MAX_COUNTED_RIR} RIR</span> is a warm-up and stays out
          of every total. Sets without a rating are left out too, and each total on{" "}
          <Link href="/stats" className="text-accent underline">Stats</Link> shows how many
          sets it covers.
        </p>
      </Panel>

      <Panel className="mt-3">
        <h2 className="eyebrow">About</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          IronLog shows how your training is really going, so you can decide what to
          change. Log each set with its RIR, and Today and Stats show whether every muscle
          gets enough hard sets, whether those sets are close enough to failure, and how
          your strength is trending. Use that to adjust volume, intensity and frequency.
          The reference bands (5 hard sets a week as the floor, 10–16 as the productive
          range, 20–40 effective reps per muscle per session, each muscle twice a week)
          come from <em>Hypertrophy Training — Principles That Work</em>, 2026 edition. A
          hard set is a working set at 3 RIR or less.
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
