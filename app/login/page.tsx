import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AUTH_COOKIE, authToken, checkPasscode, isAuthToken } from "@/lib/auth";
import { Button, inputClass } from "@/components/ui";

export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const entered = String(formData.get("passcode") ?? "");
  if (!(await checkPasscode(entered))) redirect("/login?wrong=1");

  const jar = await cookies();
  jar.set(AUTH_COOKIE, await authToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ wrong?: string }> }) {
  const jar = await cookies();
  if (await isAuthToken(jar.get(AUTH_COOKIE)?.value)) redirect("/");
  const { wrong } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="rise">
        <p className="eyebrow text-accent">Strength log</p>
        <h1 className="display mt-1 text-6xl font-semibold">IronLog</h1>
        <p className="mt-2 text-sm text-ink-dim">
          Counts the reps that count. Enter the passcode to continue.
        </p>
      </div>

      <form action={signIn} className="rise rise-2 mt-8 space-y-3">
        <input
          name="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          className={`${inputClass} min-h-12`}
        />
        {wrong && <p className="text-sm text-bad">That passcode is not right.</p>}
        <Button type="submit" variant="primary" className="w-full min-h-12">Enter</Button>
      </form>
    </main>
  );
}
