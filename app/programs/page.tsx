import { getPrograms } from "@/lib/db";
import { ButtonLink, Empty, Header, Page } from "@/components/ui";
import { ProgramList } from "./list";

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
        <ProgramList programs={programs} />
      )}

      <p className="mt-4 text-xs text-ink-faint">
        Drag by the handle to reorder. Swipe your own programs left to delete them;
        presets can only be hidden, and the ★ pinned program cannot be deleted. It is
        always the first card on the home screen.
      </p>
    </Page>
  );
}
