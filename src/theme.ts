export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const themeStorageKey = "atc-dialogue-studio.theme";

export const themeBarColour: Record<ResolvedTheme, string> = {
  light: "#ffffff",
  dark: "#131a21"
};

export const themeOptions: { value: ThemePreference; label: string; title: string }[] = [
  { value: "system", label: "Match the system theme", title: "Theme: follow the system setting" },
  { value: "light", label: "Light theme", title: "Theme: light" },
  { value: "dark", label: "Dark theme", title: "Theme: dark" }
];

export function prefersDark(): boolean {
  return typeof window !== "undefined"
    && typeof window.matchMedia === "function"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") return prefersDark() ? "dark" : "light";
  return preference;
}

export function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(themeStorageKey);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    // A blocked storage API just means the system setting is followed.
  }
  return "system";
}

/**
 * `data-theme` always carries the resolved theme, so the stylesheet only needs
 * one dark block and never has to repeat it inside a media query.
 */
export function applyTheme(resolved: ResolvedTheme) {
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", themeBarColour[resolved]);
}

/**
 * Runs before first paint so a dark-theme session never flashes white. Kept in
 * sync by hand with the copy inlined in index.html for the static build.
 */
export const themeBootScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(themeStorageKey)})||"system";var d=p==="dark"||(p==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.dataset.theme=d?"dark":"light";}catch(e){document.documentElement.dataset.theme="light";}})();`;
