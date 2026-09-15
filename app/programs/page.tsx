import Link from "next/link";
import { copyProgram, togglePin } from "@/app/actions";
import { getPrograms } from "@/lib/db";
import { Button, ButtonLink, Empty, Header, Page, Panel } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function ProgramsPage() {
  const programs = await getPrograms();

  return (
    <Page>
      <Header
        title="Programs"
        action={<ButtonLink href="/programs/new" variant="primary">New</ButtonLink>}
      />

      {programs.length === 0 ? (
        <Empty>No programs yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {programs.map((p) => {
            const sets = p.days.reduce(
              (sum, d) => sum + d.exercises.reduce((n, e) => n + e.plannedSets, 0), 0);
            return (
              <li key={p.id}>
                <Panel className={p.isPinned ? "border-accent/40" : ""}>
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/programs/${p.id}`} className="min-w-0 flex-1">
                      <h2 className="display truncate text-xl font-semibold">{p.name}</h2>
                      <p className="tnum text-[11px] text-ink-faint">
                        {p.days.length} days · {sets} planned sets a week
                        {p.isPreset && " · preset"}
                      </p>
                      {p.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-ink-dim">{p.description}</p>
                      )}
                    </Link>
                    <form action={togglePin.bind(null, p.id, p.isPinned)}>
                      <button
                        className={`h-10 w-10 rounded-xl border text-base ${
                          p.isPinned
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-line-2 text-ink-faint"
                        }`}
                        aria-label={p.isPinned ? "Unpin program" : "Pin to home screen"}
                        title={p.isPinned ? "Unpin" : "Pin to home screen"}
                      >
                        ★
                      </button>
                    </form>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <ButtonLink href={`/programs/${p.id}`} className="flex-1">Open</ButtonLink>
                    <form action={copyProgram.bind(null, p.id)} className="flex-1">
                      <Button type="submit" className="w-full">Duplicate</Button>
                    </form>
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-ink-faint">
        The pinned program is the one the home screen offers to start.
      </p>
    </Page>
  );
}
