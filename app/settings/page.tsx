import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSettings } from "@/lib/db";
import { AUTH_COOKIE } from "@/lib/auth";
import { Button, ButtonLink, Header, Page, Panel } from "@/components/ui";
import { EFFECTIVE_REP_THRESHOLD, MAX_RIR } from "@/lib/effective-reps";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

async function signOut() {
  "use server";
  const jar = await cookies();
  jar.delete(AUTH_COOKIE);
  redirect("/login");
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <Page>
      <Header title="Settings" />

      <SettingsForm settings={settings} />

      <section className="mt-5 space-y-2">
        <ButtonLink href="/exercises" className="w-full">Exercise library</ButtonLink>
        <ButtonLink href="/programs" className="w-full">Programs</ButtonLink>
      </section>

      <Panel className="mt-5">
        <h2 className="text-sm font-medium">Effective reps</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          Every working set you tick off and rate scores{" "}
          <span className="text-ink">{EFFECTIVE_REP_THRESHOLD} − RIR</span> effective reps,
          capped at the reps you did. RIR {MAX_RIR} means &ldquo;{MAX_RIR} or more left&rdquo;
          and scores nothing — that is the value for a set that was genuinely easy.
          A set with no RIR is not scored at all rather than scored as zero, so the
          totals on <Link href="/stats" className="text-accent underline">Stats</Link>{" "}
          always say how many sets they were able to count.
        </p>
      </Panel>

      <Panel className="mt-3">
        <h2 className="text-sm font-medium">About</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-dim">
          IronLog on the web — a rebuild of the iOS app on a Neon Postgres database.
          The AI coach from that version is gone on purpose: nothing here suggests a
          load or tells you to deload. It records what you did and counts it.
        </p>
      </Panel>

      <form action={signOut} className="mt-5">
        <Button variant="danger" className="w-full">Sign out</Button>
      </form>
    </Page>
  );
}
