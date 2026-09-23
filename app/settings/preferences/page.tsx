import { cookies } from "next/headers";
import { getSettings } from "@/lib/db";
import { Header, Page } from "@/components/ui";
import { THEME_COOKIE, parseTheme } from "@/lib/theme";
import { SettingsForm } from "./form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [settings, jar] = await Promise.all([getSettings(), cookies()]);
  return (
    <Page>
      <Header back={{ href: "/settings", label: "More" }} title="Settings" />
      <SettingsForm settings={settings} theme={parseTheme(jar.get(THEME_COOKIE)?.value)} />
    </Page>
  );
}
