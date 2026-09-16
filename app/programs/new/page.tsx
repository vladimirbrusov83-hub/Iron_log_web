import { createProgramAction } from "@/app/actions";
import { Button, Header, Page, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Name it, then build it a day at a time on the program page. */
export default function NewProgramPage() {
  async function create(formData: FormData) {
    "use server";
    await createProgramAction(
      String(formData.get("name") ?? ""),
      String(formData.get("description") ?? ""),
    );
  }

  return (
    <Page>
      <Header back={{ href: "/programs", label: "Programs" }} title="New program" />
      <form action={create} className="space-y-2">
        <input
          name="name"
          autoFocus
          required
          placeholder="Program name"
          aria-label="Program name"
          className={`${inputClass} display text-xl font-semibold`}
        />
        <textarea
          name="description"
          placeholder="What this program is for (optional)"
          rows={2}
          className={`${inputClass} py-2 text-sm`}
        />
        <Button type="submit" variant="primary" className="w-full">Create program</Button>
      </form>
      <p className="mt-2 text-[11px] text-ink-faint">
        You add days, and the lifts in them, on the next screen.
      </p>
    </Page>
  );
}
