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
      <h1 className="text-3xl font-semibold tracking-tight">IronLog</h1>
      <p className="mt-1 text-sm text-ink-dim">Enter the passcode to continue.</p>

      <form action={signIn} className="mt-6 space-y-3">
        <input
          name="passcode"
          type="password"
          autoFocus
          autoComplete="current-password"
          placeholder="Passcode"
          className={inputClass}
        />
        {wrong && <p className="text-sm text-red-400">That passcode is not right.</p>}
        <Button type="submit" variant="primary" className="w-full">Enter</Button>
      </form>
    </main>
  );
}
