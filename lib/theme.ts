/** Dark or light, kept per device in a cookie so the server paints the right
 *  one first — no flash of the wrong theme — and without a database column. */
export const THEME_COOKIE = "ironlog-theme";
export type Theme = "dark" | "light";
export const THEMES: Theme[] = ["dark", "light"];
export const THEME_COLOR: Record<Theme, string> = { dark: "#0b0b0c", light: "#f4f2ee" };

export function parseTheme(value: string | undefined): Theme {
  return value === "light" ? "light" : "dark";
}
