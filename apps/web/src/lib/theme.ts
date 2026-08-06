// Theme is now locked to dark (Supercell). File retained so old imports do not
// break until they are removed — delete when no references remain.
export const DEFAULT_THEME = "dark" as const;
export const THEME_STORAGE_KEY = "settersaga:theme";
export type Theme = "dark";
export function resolveTheme(): Theme {
  return "dark";
}
export function getNextTheme(): Theme {
  return "dark";
}
